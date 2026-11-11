package main

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
	"go.mongodb.org/mongo-driver/v2/mongo"
	"go.mongodb.org/mongo-driver/v2/mongo/options"
)

// ============================================================================
// MODELS - how each document is stored in MongoDB (bson) and sent to React (json)
// ============================================================================

type Business struct {
	ID        bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Name      string        `bson:"name" json:"name"`
	OwnerID   bson.ObjectID `bson:"ownerId" json:"ownerId"`
	CreatedAt time.Time     `bson:"createdAt" json:"createdAt"`
}

type User struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	Name         string        `bson:"name" json:"name"`
	Email        string        `bson:"email" json:"email"`
	PasswordHash string        `bson:"passwordHash" json:"-"` // bcrypt hash, never sent out
	Role         string        `bson:"role" json:"role"`      // "owner" or "staff"
	BusinessID   bson.ObjectID `bson:"businessId" json:"businessId"`
	CreatedAt    time.Time     `bson:"createdAt" json:"createdAt"`
}

type Product struct {
	ID           bson.ObjectID `bson:"_id,omitempty" json:"id"`
	BusinessID   bson.ObjectID `bson:"businessId" json:"-"`
	SKU          string        `bson:"sku" json:"sku"` // unique per business
	Name         string        `bson:"name" json:"name"`
	Category     string        `bson:"category" json:"category"`
	Warehouse    string        `bson:"warehouse" json:"warehouse"` // where the item is stored
	Price        float64       `bson:"price" json:"price"`
	Stock        int           `bson:"stock" json:"stock"`
	MinThreshold int           `bson:"minThreshold" json:"minThreshold"`
	Vendor       string        `bson:"vendor" json:"vendor"`
	Notes        string        `bson:"notes" json:"notes"`
	CreatedAt    time.Time     `bson:"createdAt" json:"createdAt"`
	UpdatedAt    time.Time     `bson:"updatedAt" json:"updatedAt"`
	// Version goes up by one on every edit of the product details. Edits must
	// send the version they started from, so two people can't overwrite each
	// other's changes without noticing (optimistic locking).
	Version   int64  `bson:"version" json:"version"`
	UpdatedBy string `bson:"updatedBy,omitempty" json:"updatedBy,omitempty"`
}

// Kinds of log book / history entries
const (
	KindCreated = "created" // new product (quantity = opening stock)
	KindRestock = "restock" // stock in
	KindSale    = "sale"    // sold through billing
	KindRemoved = "removed" // stock out (damage, loss, correction...)
	KindEdited  = "edited"  // product details changed (no stock change)
	KindDeleted = "deleted" // product removed from the catalogue
)

type FieldChange struct {
	Field string `bson:"field" json:"field"`
	From  string `bson:"from" json:"from"`
	To    string `bson:"to" json:"to"`
}

type StockMovement struct {
	ID            bson.ObjectID `bson:"_id,omitempty" json:"id"`
	BusinessID    bson.ObjectID `bson:"businessId" json:"-"`
	ProductID     bson.ObjectID `bson:"productId" json:"productId"`
	ProductName   string        `bson:"productName" json:"productName"`
	SKU           string        `bson:"sku,omitempty" json:"sku,omitempty"`
	Action        string        `bson:"action" json:"action"` // "in", "out", "edit" or "delete"
	Kind          string        `bson:"kind,omitempty" json:"kind"`
	Quantity      int           `bson:"quantity" json:"quantity"`
	StockBefore   *int          `bson:"stockBefore,omitempty" json:"stockBefore,omitempty"`
	StockAfter    *int          `bson:"stockAfter,omitempty" json:"stockAfter,omitempty"`
	BillNumber    int64         `bson:"billNumber,omitempty" json:"billNumber,omitempty"`
	Changes       []FieldChange `bson:"changes,omitempty" json:"changes,omitempty"`
	PerformedBy   string        `bson:"performedBy" json:"performedBy"`
	PerformedByID bson.ObjectID `bson:"performedById,omitempty" json:"-"`
	Notes         string        `bson:"notes" json:"notes"`
	Timestamp     time.Time     `bson:"timestamp" json:"timestamp"`
}

type BillItem struct {
	ProductID   bson.ObjectID `bson:"productId" json:"productId"`
	ProductName string        `bson:"productName" json:"productName"`
	Quantity    int           `bson:"quantity" json:"quantity"`
	Price       float64       `bson:"price" json:"price"`
}

type Bill struct {
	ID          bson.ObjectID `bson:"_id,omitempty" json:"id"`
	BusinessID  bson.ObjectID `bson:"businessId" json:"-"`
	Number      int64         `bson:"number" json:"number"` // per-business bill number: 1, 2, 3...
	Items       []BillItem    `bson:"items" json:"items"`
	TotalAmount float64       `bson:"totalAmount" json:"totalAmount"`
	CreatedBy   string        `bson:"createdBy" json:"createdBy"`
	CreatedByID bson.ObjectID `bson:"createdById,omitempty" json:"createdById"`
	Timestamp   time.Time     `bson:"timestamp" json:"timestamp"`
}

// ============================================================================
// STORE - one handle per MongoDB collection
// ============================================================================

type Store struct {
	client     *mongo.Client
	db         *mongo.Database
	users      *mongo.Collection
	businesses *mongo.Collection
	products   *mongo.Collection
	history    *mongo.Collection
	bills      *mongo.Collection
	counters   *mongo.Collection
	// txn is true when the server supports multi-document transactions
	// (replica sets such as MongoDB Atlas). A standalone local server doesn't.
	txn bool
}

func connectStore(ctx context.Context, uri, dbName string) (*Store, error) {
	client, err := mongo.Connect(options.Client().ApplyURI(uri).SetServerSelectionTimeout(10 * time.Second))
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := client.Ping(ctx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("ping: %w", err)
	}

	db := client.Database(dbName)
	s := &Store{
		client:     client,
		db:         db,
		users:      db.Collection("users"),
		businesses: db.Collection("businesses"),
		products:   db.Collection("products"),
		history:    db.Collection("stock_history"),
		bills:      db.Collection("bills"),
		counters:   db.Collection("counters"),
	}
	if err := s.ensureIndexes(ctx); err != nil {
		return nil, fmt.Errorf("indexes: %w", err)
	}
	var hello bson.M
	if err := client.Database("admin").RunCommand(ctx, bson.D{{Key: "hello", Value: 1}}).Decode(&hello); err == nil {
		_, replicaSet := hello["setName"]
		s.txn = replicaSet || hello["msg"] == "isdbgrid"
	}
	// Products created before versioning start at version 1
	if _, err := s.products.UpdateMany(ctx, bson.M{"version": bson.M{"$exists": false}}, bson.M{"$set": bson.M{"version": 1}}); err != nil {
		return nil, fmt.Errorf("version migration: %w", err)
	}
	return s, nil
}

func (s *Store) ensureIndexes(ctx context.Context) error {
	if _, err := s.users.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "email", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "businessId", Value: 1}, {Key: "role", Value: 1}}},
	}); err != nil {
		return err
	}
	if _, err := s.products.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{Keys: bson.D{{Key: "businessId", Value: 1}, {Key: "name", Value: 1}}},
		{Keys: bson.D{{Key: "businessId", Value: 1}, {Key: "sku", Value: 1}}, Options: options.Index().SetUnique(true)},
		{Keys: bson.D{{Key: "businessId", Value: 1}, {Key: "warehouse", Value: 1}}},
	}); err != nil {
		return err
	}
	if _, err := s.history.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "businessId", Value: 1}, {Key: "timestamp", Value: -1}},
	}); err != nil {
		return err
	}
	_, err := s.bills.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: bson.D{{Key: "businessId", Value: 1}, {Key: "timestamp", Value: -1}},
	})
	return err
}

// nextSequence returns an auto-incrementing number for the given counter name.
func (s *Store) nextSequence(ctx context.Context, name string) (int64, error) {
	var doc struct {
		Seq int64 `bson:"seq"`
	}
	err := s.counters.FindOneAndUpdate(ctx,
		bson.M{"_id": name},
		bson.M{"$inc": bson.M{"seq": 1}},
		options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After),
	).Decode(&doc)
	return doc.Seq, err
}

// nextSKU generates the next automatic SKU for a business, e.g. SKU-0001.
func (s *Store) nextSKU(ctx context.Context, businessID bson.ObjectID) (string, error) {
	n, err := s.nextSequence(ctx, "sku:"+businessID.Hex())
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("SKU-%04d", n), nil
}

// withTxn runs fn inside a MongoDB transaction when the server supports it, so
// all of fn's writes are saved together or not at all. The driver retries fn
// automatically on transient write conflicts (e.g. two people billing the same
// product at the same moment). Without transaction support fn runs directly.
func (s *Store) withTxn(ctx context.Context, fn func(ctx context.Context) error) error {
	if !s.txn {
		return fn(ctx)
	}
	sess, err := s.client.StartSession()
	if err != nil {
		return err
	}
	defer sess.EndSession(context.WithoutCancel(ctx))
	_, err = sess.WithTransaction(ctx, func(tx context.Context) (any, error) {
		return nil, fn(tx)
	})
	return err
}

func (s *Store) Close() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = s.client.Disconnect(ctx)
}
