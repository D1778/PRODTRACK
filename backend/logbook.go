package main

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ============================================================================
// LOG BOOK (owner only) - everything that happened to the inventory on a day
// ============================================================================

type LogbookSummary struct {
	UnitsIn       int      `json:"unitsIn"`       // new products' opening stock + restocks
	UnitsSold     int      `json:"unitsSold"`     // through billing
	UnitsRemoved  int      `json:"unitsRemoved"`  // other stock-outs
	Revenue       float64  `json:"revenue"`       // bills that day
	Bills         int      `json:"bills"`         // number of bills
	ProductsAdded int      `json:"productsAdded"` // new products created
	Edits         int      `json:"edits"`         // product detail changes
	Deletions     int      `json:"deletions"`     // products deleted
	Entries       int      `json:"entries"`       // all log entries
	People        []string `json:"people"`        // who did something
}

type LogbookProduct struct {
	ProductID string `json:"productId"`
	Name      string `json:"name"`
	SKU       string `json:"sku"`
	Opening   *int   `json:"opening"` // stock at the start of the day (nil = unknown)
	Added     int    `json:"added"`
	Sold      int    `json:"sold"`
	Removed   int    `json:"removed"`
	Closing   *int   `json:"closing"` // stock at the end of the day (nil = unknown)
	Deleted   bool   `json:"deleted"`
	Created   bool   `json:"created"`
}

type LogbookDay struct {
	Date     string  `json:"date"`
	UnitsIn  int     `json:"unitsIn"`
	UnitsOut int     `json:"unitsOut"`
	Revenue  float64 `json:"revenue"`
	Entries  int     `json:"entries"`
}

type logbookResponse struct {
	Date     string           `json:"date"`
	Summary  LogbookSummary   `json:"summary"`
	Products []LogbookProduct `json:"products"`
	Entries  []StockMovement  `json:"entries"`
	Days     []LogbookDay     `json:"days"`
}

// viewerZone turns JS getTimezoneOffset() minutes into a time zone.
func viewerZone(r *http.Request) (*time.Location, string) {
	mins := 0
	if v, err := strconv.Atoi(r.URL.Query().Get("tzOffset")); err == nil && v >= -14*60 && v <= 14*60 {
		mins = v
	}
	off := -mins // JS offset is UTC - local
	sign := "+"
	if off < 0 {
		sign, off = "-", -off
	}
	return time.FixedZone("viewer", -mins*60), fmt.Sprintf("%s%02d:%02d", sign, off/60, off%60)
}

// signed returns how much a log entry changed the stock.
func signed(m StockMovement) int {
	switch m.Action {
	case "in":
		return m.Quantity
	case "out":
		return -m.Quantity
	}
	return 0
}

// GET /api/logbook?date=YYYY-MM-DD&tzOffset=<minutes>
func (a *App) logbook(w http.ResponseWriter, r *http.Request) {
	user := authUser(r)
	ctx := r.Context()
	loc, tzString := viewerZone(r)

	day := time.Now().In(loc)
	if d := r.URL.Query().Get("date"); d != "" {
		parsed, err := time.ParseInLocation("2006-01-02", d, loc)
		if err != nil {
			sendError(w, http.StatusBadRequest, "Date must look like 2026-01-31")
			return
		}
		day = parsed
	}
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
	end := start.AddDate(0, 0, 1)
	bid := user.BusinessID

	// 1. Entries of the day, oldest first
	cur, err := a.store.history.Find(ctx,
		bson.M{"businessId": bid, "timestamp": bson.M{"$gte": start, "$lt": end}},
		options.Find().SetSort(bson.D{{Key: "timestamp", Value: 1}, {Key: "_id", Value: 1}}))
	if err != nil {
		serverError(w, "logbook entries", err)
		return
	}
	entries := []StockMovement{}
	if err := cur.All(ctx, &entries); err != nil {
		serverError(w, "decode logbook", err)
		return
	}

	res := logbookResponse{Date: start.Format("2006-01-02"), Entries: entries, Products: []LogbookProduct{}}
	s := &res.Summary
	s.People = []string{}
	people := map[string]bool{}
	rows := map[bson.ObjectID]*LogbookProduct{}
	var order []bson.ObjectID
	net := map[bson.ObjectID]int{}

	for i := range entries {
		m := &entries[i]
		m.Kind = kindOf(*m)
		if m.PerformedBy != "" && !people[m.PerformedBy] {
			people[m.PerformedBy] = true
			s.People = append(s.People, m.PerformedBy)
		}
		row, ok := rows[m.ProductID]
		if !ok {
			row = &LogbookProduct{ProductID: m.ProductID.Hex(), Name: m.ProductName, SKU: m.SKU}
			rows[m.ProductID] = row
			order = append(order, m.ProductID)
		}
		row.Name = m.ProductName
		if m.SKU != "" {
			row.SKU = m.SKU
		}
		net[m.ProductID] += signed(*m)
		switch m.Kind {
		case KindCreated:
			row.Created = true
			row.Added += m.Quantity
			s.UnitsIn += m.Quantity
			s.ProductsAdded++
		case KindRestock:
			row.Added += m.Quantity
			s.UnitsIn += m.Quantity
		case KindSale:
			row.Sold += m.Quantity
			s.UnitsSold += m.Quantity
		case KindRemoved:
			row.Removed += m.Quantity
			s.UnitsRemoved += m.Quantity
		case KindEdited:
			s.Edits++
		case KindDeleted:
			row.Deleted = true
			s.Deletions++
		}
	}
	s.Entries = len(entries)

	// 2. Opening/closing stock per product.
	//    closing = current stock - everything that happened after the day.
	if len(order) > 0 {
		current := map[bson.ObjectID]int{}
		pc, err := a.store.products.Find(ctx, bson.M{"businessId": bid, "_id": bson.M{"$in": order}},
			options.Find().SetProjection(bson.M{"stock": 1}))
		if err == nil {
			var ps []Product
			if pc.All(ctx, &ps) == nil {
				for _, p := range ps {
					current[p.ID] = p.Stock
				}
			}
		}
		after := map[bson.ObjectID]int{}
		lastAfter := map[bson.ObjectID]*int{}
		hc, err := a.store.history.Find(ctx, bson.M{"businessId": bid, "productId": bson.M{"$in": order}, "timestamp": bson.M{"$gte": end}},
			options.Find().SetProjection(bson.M{"productId": 1, "action": 1, "quantity": 1}))
		if err == nil {
			var later []StockMovement
			if hc.All(ctx, &later) == nil {
				for _, m := range later {
					after[m.ProductID] += signed(m)
				}
			}
		}
		for _, m := range entries {
			if m.StockAfter != nil {
				lastAfter[m.ProductID] = m.StockAfter
			}
		}
		for _, id := range order {
			row := rows[id]
			// Product still exists: work back from today's stock.
			// Deleted product: use the stock recorded on its last entry.
			var closing *int
			if stock, exists := current[id]; exists {
				closing = intPtr(stock - after[id])
			} else if v := lastAfter[id]; v != nil {
				closing = intPtr(*v)
			}
			row.Closing = closing
			if closing != nil {
				open := *closing - net[id]
				if row.Created {
					open = 0
				}
				row.Opening = intPtr(open)
			}
			res.Products = append(res.Products, *row)
		}
	}

	// 3. Revenue from that day's bills
	bc, err := a.store.bills.Find(ctx, bson.M{"businessId": bid, "timestamp": bson.M{"$gte": start, "$lt": end}},
		options.Find().SetProjection(bson.M{"totalAmount": 1}))
	if err == nil {
		var bills []Bill
		if bc.All(ctx, &bills) == nil {
			for _, b := range bills {
				s.Revenue += b.TotalAmount
			}
			s.Bills = len(bills)
			s.Revenue = roundMoney(s.Revenue)
		}
	}

	// 4. Recent days with activity (for the day picker)
	days, err := a.recentDays(ctx, bid, tzString, time.Now().AddDate(0, 0, -60))
	if err != nil {
		serverError(w, "logbook days", err)
		return
	}
	res.Days = days
	sendJSON(w, http.StatusOK, res)
}

func (a *App) recentDays(ctx context.Context, bid bson.ObjectID, tz string, since time.Time) ([]LogbookDay, error) {
	dateExpr := bson.M{"$dateToString": bson.M{"format": "%Y-%m-%d", "date": "$timestamp", "timezone": tz}}
	byDay := map[string]*LogbookDay{}
	get := func(d string) *LogbookDay {
		if byDay[d] == nil {
			byDay[d] = &LogbookDay{Date: d}
		}
		return byDay[d]
	}

	hc, err := a.store.history.Aggregate(ctx, mongoPipeline(
		bson.M{"$match": bson.M{"businessId": bid, "timestamp": bson.M{"$gte": since}}},
		bson.M{"$group": bson.M{
			"_id":      dateExpr,
			"entries":  bson.M{"$sum": 1},
			"unitsIn":  bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$action", "in"}}, "$quantity", 0}}},
			"unitsOut": bson.M{"$sum": bson.M{"$cond": bson.A{bson.M{"$eq": bson.A{"$action", "out"}}, "$quantity", 0}}},
		}},
	))
	if err != nil {
		return nil, err
	}
	var hist []struct {
		Date     string `bson:"_id"`
		Entries  int    `bson:"entries"`
		UnitsIn  int    `bson:"unitsIn"`
		UnitsOut int    `bson:"unitsOut"`
	}
	if err := hc.All(ctx, &hist); err != nil {
		return nil, err
	}
	for _, h := range hist {
		d := get(h.Date)
		d.Entries, d.UnitsIn, d.UnitsOut = h.Entries, h.UnitsIn, h.UnitsOut
	}

	bc, err := a.store.bills.Aggregate(ctx, mongoPipeline(
		bson.M{"$match": bson.M{"businessId": bid, "timestamp": bson.M{"$gte": since}}},
		bson.M{"$group": bson.M{"_id": dateExpr, "revenue": bson.M{"$sum": "$totalAmount"}}},
	))
	if err != nil {
		return nil, err
	}
	var rev []struct {
		Date    string  `bson:"_id"`
		Revenue float64 `bson:"revenue"`
	}
	if err := bc.All(ctx, &rev); err != nil {
		return nil, err
	}
	for _, r := range rev {
		get(r.Date).Revenue = roundMoney(r.Revenue)
	}

	days := make([]LogbookDay, 0, len(byDay))
	for _, d := range byDay {
		days = append(days, *d)
	}
	sort.Slice(days, func(i, j int) bool { return days[i].Date > days[j].Date })
	return days, nil
}

func mongoPipeline(stages ...bson.M) bson.A {
	p := bson.A{}
	for _, s := range stages {
		p = append(p, s)
	}
	return p
}
