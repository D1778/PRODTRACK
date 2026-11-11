package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ============================================================================
// CONCURRENCY - how two people working at the same time stay consistent
//
//  1. Stock quantities only change through atomic $inc updates. A removal only
//     matches when enough stock is left, so stock can never go negative and no
//     update is ever lost (two "+5"s always give +10).
//  2. Each stock change and its log entry are written in one MongoDB
//     transaction (on Atlas), so the log book always matches the stock.
//     Billing deducts every item, takes the bill number and writes the bill in
//     one transaction: a bill is saved completely or not at all.
//  3. Editing product details uses optimistic locking: the client sends the
//     version it loaded; if someone saved in between, the edit is rejected with
//     409 and the latest product, instead of silently overwriting their work.
// ============================================================================

// apiError is a handled failure with an HTTP status, returned from inside
// transactions so they abort cleanly.
type apiError struct {
	status  int
	message string
	extra   map[string]any
}

func (e *apiError) Error() string { return e.message }

func fail(status int, msg string) *apiError { return &apiError{status: status, message: msg} }

// respondErr sends an apiError as-is, anything else as a 500.
func respondErr(w http.ResponseWriter, where string, err error) {
	var ae *apiError
	if errors.As(err, &ae) {
		body := map[string]any{"message": ae.message}
		for k, v := range ae.extra {
			body[k] = v
		}
		sendJSON(w, ae.status, body)
		return
	}
	if mongo.IsDuplicateKeyError(err) {
		sendError(w, http.StatusConflict, "That SKU is already used by another product")
		return
	}
	serverError(w, where, err)
}

func intPtr(v int) *int { return &v }

// ============================================================================
// PRODUCTS
// ============================================================================

type productInput struct {
	SKU          string  `json:"sku"`
	Warehouse    string  `json:"warehouse"`
	Name         string  `json:"name"`
	Category     string  `json:"category"`
	Price        float64 `json:"price"`
	Stock        int     `json:"stock"`
	MinThreshold int     `json:"minThreshold"`
	Vendor       string  `json:"vendor"`
	Notes        string  `json:"notes"`
	Version      int64   `json:"version"` // required for edits
}

func (p *productInput) validate() string {
	p.Name, p.Category = strings.TrimSpace(p.Name), strings.TrimSpace(p.Category)
	p.Vendor, p.Notes = strings.TrimSpace(p.Vendor), strings.TrimSpace(p.Notes)
	p.SKU = strings.ToUpper(strings.Join(strings.Fields(p.SKU), "-"))
	p.Warehouse = strings.TrimSpace(p.Warehouse)
	switch {
	case p.Name == "" || len(p.Name) > 120:
		return "Product name is required (max 120 characters)"
	case p.Category == "" || len(p.Category) > 80:
		return "Category is required (max 80 characters)"
	case len(p.SKU) > 40:
		return "SKU must be at most 40 characters"
	case len(p.Warehouse) > 80:
		return "Warehouse must be at most 80 characters"
	case len(p.Vendor) > 120 || len(p.Notes) > 1000:
		return "Vendor or notes are too long"
	case p.Price < 0 || p.Price > 1e9 || math.IsNaN(p.Price) || math.IsInf(p.Price, 0):
		return "Price must be between 0 and 1,000,000,000"
	case p.Stock < 0 || p.Stock > 1e9:
		return "Stock must be zero or more"
	case p.MinThreshold < 0 || p.MinThreshold > 1e9:
		return "Low-stock alert level must be zero or more"
	}
	p.Price = roundMoney(p.Price)
	return ""
}

// GET /api/products
func (a *App) listProducts(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	cur, err := a.store.products.Find(r.Context(), bson.M{"businessId": user.BusinessID},
		options.Find().SetSort(bson.D{{Key: "name", Value: 1}}))
	if err != nil {
		serverError(w, "list products", err)
		return
	}
	products := []Product{}
	if err := cur.All(r.Context(), &products); err != nil {
		serverError(w, "decode products", err)
		return
	}
	sendJSON(w, http.StatusOK, products)
}

// POST /api/products
func (a *App) createProduct(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	var in productInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if msg := in.validate(); msg != "" {
		sendError(w, http.StatusBadRequest, msg)
		return
	}

	var p Product
	err := a.store.withTxn(r.Context(), func(tx context.Context) error {
		sku := in.SKU
		if sku == "" {
			var err error
			if sku, err = a.store.nextSKU(tx, user.BusinessID); err != nil {
				return err
			}
		}
		now := time.Now().UTC()
		p = Product{
			ID: bson.NewObjectID(), BusinessID: user.BusinessID, SKU: sku, Warehouse: in.Warehouse,
			Name: in.Name, Category: in.Category, Price: in.Price, Stock: in.Stock,
			MinThreshold: in.MinThreshold, Vendor: in.Vendor, Notes: in.Notes,
			CreatedAt: now, UpdatedAt: now, Version: 1, UpdatedBy: user.Name,
		}
		if _, err := a.store.products.InsertOne(tx, p); err != nil {
			if mongo.IsDuplicateKeyError(err) {
				return fail(http.StatusConflict, "SKU "+sku+" is already used by another product")
			}
			return err
		}
		_, err := a.store.history.InsertOne(tx, StockMovement{
			ID: bson.NewObjectID(), BusinessID: user.BusinessID, ProductID: p.ID, ProductName: p.Name, SKU: p.SKU,
			Action: "in", Kind: KindCreated, Quantity: p.Stock, StockBefore: intPtr(0), StockAfter: intPtr(p.Stock),
			PerformedBy: user.Name, PerformedByID: user.ID, Notes: "New product", Timestamp: now,
		})
		return err
	})
	if err != nil {
		respondErr(w, "create product", err)
		return
	}
	sendJSON(w, http.StatusCreated, p)
}

func fmtMoney(v float64) string { return strconv.FormatFloat(v, 'f', 2, 64) }

// diffProduct lists the detail fields that an edit changes.
func diffProduct(old Product, in productInput) []FieldChange {
	var ch []FieldChange
	add := func(field, from, to string) {
		if from != to {
			ch = append(ch, FieldChange{Field: field, From: from, To: to})
		}
	}
	add("name", old.Name, in.Name)
	if in.SKU != "" {
		add("sku", old.SKU, in.SKU)
	}
	add("category", old.Category, in.Category)
	add("warehouse", old.Warehouse, in.Warehouse)
	add("price", fmtMoney(old.Price), fmtMoney(in.Price))
	add("minThreshold", strconv.Itoa(old.MinThreshold), strconv.Itoa(in.MinThreshold))
	add("vendor", old.Vendor, in.Vendor)
	add("notes", old.Notes, in.Notes)
	return ch
}

// PUT /api/products/{id}  {..details.., version}
// Stock is not changed here - use /api/stock so every change is logged.
func (a *App) updateProduct(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var in productInput
	if !decodeJSON(w, r, &in) {
		return
	}
	if msg := in.validate(); msg != "" {
		sendError(w, http.StatusBadRequest, msg)
		return
	}
	if in.Version <= 0 {
		sendError(w, http.StatusBadRequest, "Missing product version - reload the page and try again")
		return
	}

	var updated Product
	err := a.store.withTxn(r.Context(), func(tx context.Context) error {
		var cur Product
		if err := a.store.products.FindOne(tx, bson.M{"_id": id, "businessId": user.BusinessID}).Decode(&cur); err != nil {
			if errors.Is(err, mongo.ErrNoDocuments) {
				return fail(http.StatusNotFound, "This product was deleted by someone else")
			}
			return err
		}
		conflict := func(latest Product) error {
			who := latest.UpdatedBy
			if who == "" {
				who = "someone else"
			}
			return &apiError{
				status:  http.StatusConflict,
				message: fmt.Sprintf("%s changed this product while you were editing. Review the latest details and save again.", who),
				extra:   map[string]any{"code": "version_conflict", "current": latest},
			}
		}
		if cur.Version != in.Version {
			return conflict(cur)
		}

		changes := diffProduct(cur, in)
		if len(changes) == 0 {
			updated = cur // nothing to save
			return nil
		}

		set := bson.M{
			"name": in.Name, "category": in.Category, "price": in.Price, "minThreshold": in.MinThreshold,
			"vendor": in.Vendor, "notes": in.Notes, "warehouse": in.Warehouse,
			"updatedAt": time.Now().UTC(), "updatedBy": user.Name,
		}
		if in.SKU != "" {
			set["sku"] = in.SKU
		}
		// The version in the filter makes this a compare-and-swap: it only
		// succeeds if nobody saved since we read the product.
		err := a.store.products.FindOneAndUpdate(tx,
			bson.M{"_id": id, "businessId": user.BusinessID, "version": in.Version},
			bson.M{"$set": set, "$inc": bson.M{"version": 1}},
			options.FindOneAndUpdate().SetReturnDocument(options.After),
		).Decode(&updated)
		if errors.Is(err, mongo.ErrNoDocuments) {
			var latest Product
			_ = a.store.products.FindOne(tx, bson.M{"_id": id}).Decode(&latest)
			return conflict(latest)
		}
		if mongo.IsDuplicateKeyError(err) {
			return fail(http.StatusConflict, "SKU "+in.SKU+" is already used by another product")
		}
		if err != nil {
			return err
		}
		_, err = a.store.history.InsertOne(tx, StockMovement{
			ID: bson.NewObjectID(), BusinessID: user.BusinessID, ProductID: id, ProductName: updated.Name, SKU: updated.SKU,
			Action: "edit", Kind: KindEdited, StockBefore: intPtr(updated.Stock), StockAfter: intPtr(updated.Stock),
			PerformedBy: user.Name, PerformedByID: user.ID, Changes: changes, Timestamp: time.Now().UTC(),
		})
		return err
	})
	if err != nil {
		respondErr(w, "update product", err)
		return
	}
	sendJSON(w, http.StatusOK, updated)
}

// DELETE /api/products/{id}
func (a *App) deleteProduct(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	err := a.store.withTxn(r.Context(), func(tx context.Context) error {
		var p Product
		err := a.store.products.FindOneAndDelete(tx, bson.M{"_id": id, "businessId": user.BusinessID}).Decode(&p)
		if errors.Is(err, mongo.ErrNoDocuments) {
			return fail(http.StatusNotFound, "Product not found - it may already have been deleted")
		}
		if err != nil {
			return err
		}
		_, err = a.store.history.InsertOne(tx, StockMovement{
			ID: bson.NewObjectID(), BusinessID: user.BusinessID, ProductID: p.ID, ProductName: p.Name, SKU: p.SKU,
			Action: "delete", Kind: KindDeleted, StockBefore: intPtr(p.Stock), StockAfter: intPtr(p.Stock),
			PerformedBy: user.Name, PerformedByID: user.ID, Notes: "Removed from catalogue", Timestamp: time.Now().UTC(),
		})
		return err
	})
	if err != nil {
		respondErr(w, "delete product", err)
		return
	}
	sendJSON(w, http.StatusOK, map[string]string{"message": "Product deleted"})
}

// ============================================================================
// STOCK & HISTORY
// ============================================================================

// adjustStock atomically changes stock by delta. For removals (delta < 0) the
// update only matches when enough stock is available, so stock never goes
// negative even when several people remove stock at the same moment.
func (a *App) adjustStock(ctx context.Context, businessID, productID bson.ObjectID, delta int) (Product, error) {
	filter := bson.M{"_id": productID, "businessId": businessID}
	if delta < 0 {
		filter["stock"] = bson.M{"$gte": -delta}
	}
	var p Product
	err := a.store.products.FindOneAndUpdate(ctx, filter,
		bson.M{"$inc": bson.M{"stock": delta}, "$set": bson.M{"updatedAt": time.Now().UTC()}},
		options.FindOneAndUpdate().SetReturnDocument(options.After),
	).Decode(&p)
	if errors.Is(err, mongo.ErrNoDocuments) {
		var cur Product
		if a.store.products.FindOne(ctx, bson.M{"_id": productID, "businessId": businessID}).Decode(&cur) != nil {
			return p, fail(http.StatusNotFound, "A product in this request no longer exists")
		}
		return p, fail(http.StatusConflict, fmt.Sprintf("Not enough stock for %s - only %d left", cur.Name, cur.Stock))
	}
	return p, err
}

// POST /api/stock  {productId, action: "in"|"out", quantity, reason}
func (a *App) updateStock(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	var req struct {
		ProductID string `json:"productId"`
		Action    string `json:"action"`
		Quantity  int    `json:"quantity"`
		Reason    string `json:"reason"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	productID, err := bson.ObjectIDFromHex(req.ProductID)
	if err != nil {
		sendError(w, http.StatusBadRequest, "Please choose a product")
		return
	}
	if req.Quantity <= 0 || req.Quantity > 1e9 {
		sendError(w, http.StatusBadRequest, "Quantity must be at least 1")
		return
	}
	reason := strings.TrimSpace(req.Reason)
	if len(reason) > 300 {
		sendError(w, http.StatusBadRequest, "Reason is too long")
		return
	}
	delta, kind := req.Quantity, KindRestock
	switch req.Action {
	case "in":
	case "out":
		delta, kind = -req.Quantity, KindRemoved
	default:
		sendError(w, http.StatusBadRequest, "Action must be 'in' or 'out'")
		return
	}

	var p Product
	var move StockMovement
	err = a.store.withTxn(r.Context(), func(tx context.Context) error {
		var err error
		if p, err = a.adjustStock(tx, user.BusinessID, productID, delta); err != nil {
			return err
		}
		move = StockMovement{
			ID: bson.NewObjectID(), BusinessID: user.BusinessID, ProductID: p.ID, ProductName: p.Name, SKU: p.SKU,
			Action: req.Action, Kind: kind, Quantity: req.Quantity,
			StockBefore: intPtr(p.Stock - delta), StockAfter: intPtr(p.Stock),
			PerformedBy: user.Name, PerformedByID: user.ID, Notes: reason, Timestamp: time.Now().UTC(),
		}
		_, err = a.store.history.InsertOne(tx, move)
		return err
	})
	if err != nil {
		respondErr(w, "update stock", err)
		return
	}
	sendJSON(w, http.StatusOK, map[string]any{"message": "Stock updated", "product": p, "movement": move})
}

// GET /api/history - newest first
func (a *App) listHistory(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	cur, err := a.store.history.Find(r.Context(), bson.M{"businessId": user.BusinessID},
		options.Find().SetSort(bson.D{{Key: "timestamp", Value: -1}, {Key: "_id", Value: -1}}).SetLimit(2000))
	if err != nil {
		serverError(w, "list history", err)
		return
	}
	items := []StockMovement{}
	if err := cur.All(r.Context(), &items); err != nil {
		serverError(w, "decode history", err)
		return
	}
	for i := range items {
		items[i].Kind = kindOf(items[i])
	}
	sendJSON(w, http.StatusOK, items)
}

// kindOf fills in the kind for entries written before kinds existed.
func kindOf(m StockMovement) string {
	if m.Kind != "" {
		return m.Kind
	}
	switch {
	case m.Action == "in" && m.Notes == "Initial stock":
		return KindCreated
	case m.Action == "in":
		return KindRestock
	case m.Action == "out" && m.Notes == "Sold via billing":
		return KindSale
	default:
		return KindRemoved
	}
}

// ============================================================================
// BILLING
// ============================================================================

// POST /api/billing  {items: [{productId, quantity}]}
// Prices and names come from the database, never from the browser.
func (a *App) createBill(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	var req struct {
		Items []struct {
			ProductID string `json:"productId"`
			Quantity  int    `json:"quantity"`
		} `json:"items"`
	}
	if !decodeJSON(w, r, &req) {
		return
	}
	if len(req.Items) == 0 {
		sendError(w, http.StatusBadRequest, "The bill is empty")
		return
	}
	if len(req.Items) > 500 {
		sendError(w, http.StatusBadRequest, "Too many items in one bill")
		return
	}

	// Merge duplicate lines, keeping the order products were added in.
	type line struct {
		id  bson.ObjectID
		qty int
	}
	var lines []line
	index := map[bson.ObjectID]int{}
	for _, it := range req.Items {
		id, err := bson.ObjectIDFromHex(it.ProductID)
		if err != nil || it.Quantity <= 0 || it.Quantity > 1e6 {
			sendError(w, http.StatusBadRequest, "Each item needs a product and a quantity of at least 1")
			return
		}
		if i, seen := index[id]; seen {
			lines[i].qty += it.Quantity
		} else {
			index[id] = len(lines)
			lines = append(lines, line{id, it.Quantity})
		}
	}

	var bill Bill
	err := a.store.withTxn(r.Context(), func(tx context.Context) error {
		// Without transactions (standalone MongoDB), undo deductions on failure.
		var done []line
		rollback := func() {
			if a.store.txn {
				return // the transaction abort undoes everything
			}
			for _, l := range done {
				if _, err := a.adjustStock(context.WithoutCancel(tx), user.BusinessID, l.id, l.qty); err != nil {
					log.Printf("ERROR rollback stock for %s: %v", l.id.Hex(), err)
				}
			}
		}

		now := time.Now().UTC()
		bill = Bill{ID: bson.NewObjectID(), BusinessID: user.BusinessID, CreatedBy: user.Name, CreatedByID: user.ID, Timestamp: now}
		var moves []any
		for _, l := range lines {
			p, err := a.adjustStock(tx, user.BusinessID, l.id, -l.qty)
			if err != nil {
				rollback()
				return err
			}
			done = append(done, l)
			bill.Items = append(bill.Items, BillItem{ProductID: p.ID, ProductName: p.Name, Quantity: l.qty, Price: p.Price})
			bill.TotalAmount += p.Price * float64(l.qty)
			moves = append(moves, StockMovement{
				ID: bson.NewObjectID(), BusinessID: user.BusinessID, ProductID: p.ID, ProductName: p.Name, SKU: p.SKU,
				Action: "out", Kind: KindSale, Quantity: l.qty, StockBefore: intPtr(p.Stock + l.qty), StockAfter: intPtr(p.Stock),
				PerformedBy: user.Name, PerformedByID: user.ID, Notes: "Sold via billing", Timestamp: now,
			})
		}
		bill.TotalAmount = roundMoney(bill.TotalAmount)

		number, err := a.store.nextSequence(tx, "bill:"+user.BusinessID.Hex())
		if err != nil {
			rollback()
			return err
		}
		bill.Number = number
		for i := range moves {
			mv := moves[i].(StockMovement)
			mv.BillNumber = number
			mv.Notes = fmt.Sprintf("Sold on bill #%04d", number)
			moves[i] = mv
		}
		if _, err := a.store.bills.InsertOne(tx, bill); err != nil {
			rollback()
			return err
		}
		if _, err := a.store.history.InsertMany(tx, moves); err != nil {
			if !a.store.txn {
				log.Printf("ERROR record sale history for bill %d: %v", number, err)
				return nil // the sale itself is saved; don't undo it
			}
			return err
		}
		return nil
	})
	if err != nil {
		respondErr(w, "create bill", err)
		return
	}
	sendJSON(w, http.StatusCreated, bill)
}
