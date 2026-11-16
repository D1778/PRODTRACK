package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/textproto"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/v2/bson"
)

// ---------------------------------------------------------------------------
// Unit tests (no database needed)
// ---------------------------------------------------------------------------

func TestPasswordHashing(t *testing.T) {
	hash, err := hashPassword("correct horse")
	if err != nil {
		t.Fatal(err)
	}
	if hash == "correct horse" || !strings.HasPrefix(hash, "$2") {
		t.Fatalf("expected a bcrypt hash, got %q", hash)
	}
	if !checkPassword(hash, "correct horse") {
		t.Error("correct password was rejected")
	}
	if checkPassword(hash, "wrong horse") {
		t.Error("wrong password was accepted")
	}
}

func TestJWTRoundTrip(t *testing.T) {
	ts := TokenService{secret: []byte("test-secret-test-secret-test-secret"), ttl: time.Hour}
	u := User{ID: bson.NewObjectID(), BusinessID: bson.NewObjectID(), Role: "owner"}
	token, err := ts.Issue(u)
	if err != nil {
		t.Fatal(err)
	}
	claims, err := ts.Parse(token)
	if err != nil {
		t.Fatalf("valid token rejected: %v", err)
	}
	if claims.Subject != u.ID.Hex() || claims.BusinessID != u.BusinessID.Hex() || claims.Role != "owner" {
		t.Errorf("claims mismatch: %+v", claims)
	}

	other := TokenService{secret: []byte("another-secret-another-secret-xx"), ttl: time.Hour}
	if _, err := other.Parse(token); err == nil {
		t.Error("token signed with a different secret was accepted")
	}
	if _, err := ts.Parse(token[:len(token)-2] + "xx"); err == nil {
		t.Error("tampered token was accepted")
	}
	expired := TokenService{secret: ts.secret, ttl: -time.Minute}
	old, _ := expired.Issue(u)
	if _, err := ts.Parse(old); err == nil {
		t.Error("expired token was accepted")
	}
}

func TestValidation(t *testing.T) {
	for in, want := range map[string]bool{
		"Owner@Shop.com ": true, "a@b.co": true, "no-at-sign": false, "x@nodot": false, "": false, "Name <a@b.co>": false,
	} {
		if _, ok := normalizeEmail(in); ok != want {
			t.Errorf("normalizeEmail(%q) = %v, want %v", in, ok, want)
		}
	}
	if e, _ := normalizeEmail(" Owner@Shop.com "); e != "owner@shop.com" {
		t.Errorf("email not normalized: %q", e)
	}
	if validatePassword("short") == "" || validatePassword("long enough") != "" {
		t.Error("password length rules are wrong")
	}
}

func TestAggregateBills(t *testing.T) {
	pen, book := bson.NewObjectID(), bson.NewObjectID()
	day1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	bills := []Bill{
		{Timestamp: day1, TotalAmount: 30, Items: []BillItem{{ProductID: pen, ProductName: "Pen", Quantity: 3, Price: 10}}},
		{Timestamp: day1.Add(time.Hour), TotalAmount: 100, Items: []BillItem{{ProductID: book, ProductName: "Book", Quantity: 1, Price: 100}}},
		{Timestamp: day1.Add(24 * time.Hour), TotalAmount: 10, Items: []BillItem{{ProductID: pen, ProductName: "Pen", Quantity: 1, Price: 10}}},
	}
	res := aggregateBills(bills, time.UTC)
	if len(res.Daily) != 2 || res.Daily[0].Date != "2026-01-01" || res.Daily[0].TotalSales != 130 || res.Daily[0].Bills != 2 {
		t.Errorf("unexpected daily summary: %+v", res.Daily)
	}
	if res.TopProducts[0].Name != "Book" || res.TopProducts[1].Quantity != 4 {
		t.Errorf("unexpected top products: %+v", res.TopProducts)
	}
	// Viewer timezone moves a late-UTC bill to the next local day
	late := []Bill{{Timestamp: time.Date(2026, 1, 1, 22, 0, 0, 0, time.UTC), TotalAmount: 5}}
	if d := aggregateBills(late, time.FixedZone("IST", 5*3600+1800)).Daily[0].Date; d != "2026-01-02" {
		t.Errorf("timezone not applied, got %s", d)
	}
}

func TestLoadDotEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	os.WriteFile(path, []byte("# comment\nPT_TEST_A=hello\nPT_TEST_B=\"quoted value\"\nexport PT_TEST_C=x\n"), 0o600)
	t.Setenv("PT_TEST_C", "from-env")
	os.Unsetenv("PT_TEST_A")
	os.Unsetenv("PT_TEST_B")
	loadDotEnv(path)
	if os.Getenv("PT_TEST_A") != "hello" || os.Getenv("PT_TEST_B") != "quoted value" {
		t.Error(".env values not loaded")
	}
	if os.Getenv("PT_TEST_C") != "from-env" {
		t.Error(".env must not override real environment variables")
	}
	os.Unsetenv("PT_TEST_A")
	os.Unsetenv("PT_TEST_B")
}

// ---------------------------------------------------------------------------
// End-to-end API test against a real MongoDB.
// Runs only when MONGODB_TEST_URI is set, e.g.
//   MONGODB_TEST_URI=mongodb://localhost:27017 go test ./...
// It uses a throwaway database that is dropped afterwards.
// ---------------------------------------------------------------------------

type apiClient struct {
	t     *testing.T
	base  string
	token string
}

func (c *apiClient) do(method, path string, body any) (int, map[string]any, []any) {
	c.t.Helper()
	var buf bytes.Buffer
	if body != nil {
		json.NewEncoder(&buf).Encode(body)
	}
	req, _ := http.NewRequest(method, c.base+"/api"+path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var obj map[string]any
	var arr []any
	if json.Unmarshal(raw, &obj) != nil {
		json.Unmarshal(raw, &arr)
	}
	if strings.Contains(string(raw), "$2a$") || strings.Contains(string(raw), "passwordHash") {
		c.t.Errorf("%s %s leaked a password hash: %s", method, path, raw)
	}
	return res.StatusCode, obj, arr
}

func expect(t *testing.T, what string, got, want int, body map[string]any) {
	t.Helper()
	if got != want {
		t.Fatalf("%s: status %d, want %d (body %v)", what, got, want, body)
	}
}

// testDomainCheck stands in for DNS so tests don't need a network. Only
// "nodomain.invalid" counts as a domain without a mail server.
func testDomainCheck(_ context.Context, domain string) bool { return domain != "nodomain.invalid" }

func TestEmailProblem(t *testing.T) {
	ok := []string{"asha@example.com", "dinudevees@gmail.com", "krkunal404@gmail.com", "first.last@gmail.com", "someone+shop@gmail.com", "abcdef@gmail.com", "a.very.long.name.here@gmail.com"}
	for _, e := range ok {
		if msg := emailProblem(context.Background(), e, testDomainCheck); msg != "" {
			t.Errorf("%s should be accepted, got: %s", e, msg)
		}
	}
	bad := []string{
		"a@gmail.com", "test@gmail.com", "abcde@gmail.com", // Gmail names need 6+ characters
		"ab..cd12@gmail.com", ".abcdef@gmail.com", "abcdef.@gmail.com", "abc_def1@gmail.com", // dots/underscores misuse
		"averyveryverylongusername1234567@gmail.com", // over 30 characters
		"someone@mailinator.com", "x@yopmail.com", // disposable
		"person@nodomain.invalid", // no mail server
	}
	for _, e := range bad {
		if msg := emailProblem(context.Background(), e, testDomainCheck); msg == "" {
			t.Errorf("%s should be rejected", e)
		}
	}
}

// fakeChecker stands in for the mailbox-verification service.
type fakeChecker struct{}

func (fakeChecker) Check(_ context.Context, email string) (MailboxResult, error) {
	switch email {
	case "ghost@example.com":
		return MailboxInvalid, nil
	case "maybe@example.com":
		return MailboxUnknown, nil
	case "broken@example.com":
		return MailboxUnknown, fmt.Errorf("service down")
	}
	return MailboxValid, nil
}

func TestZeroBounceParsing(t *testing.T) {
	answers := map[string]string{
		"valid@x.com":    `{"status":"valid"}`,
		"gone@x.com":     `{"status":"invalid","sub_status":"mailbox_not_found"}`,
		"temp@x.com":     `{"status":"do_not_mail","sub_status":"disposable"}`,
		"trap@x.com":     `{"status":"spamtrap"}`,
		"catchall@x.com": `{"status":"catch-all"}`,
		"unknown@x.com":  `{"status":"unknown"}`,
		"nocredit@x.com": `{"error":"Invalid API key or your account ran out of credits"}`,
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/validate" || r.URL.Query().Get("api_key") != "k" {
			t.Errorf("unexpected request %s", r.URL)
		}
		fmt.Fprint(w, answers[r.URL.Query().Get("email")])
	}))
	defer srv.Close()
	zb := zeroBounce{apiKey: "k", baseURL: srv.URL, client: srv.Client()}

	want := map[string]MailboxResult{
		"valid@x.com": MailboxValid, "gone@x.com": MailboxInvalid, "temp@x.com": MailboxInvalid, "trap@x.com": MailboxInvalid,
		"catchall@x.com": MailboxUnknown, "unknown@x.com": MailboxUnknown,
	}
	for email, expected := range want {
		got, err := zb.Check(context.Background(), email)
		if err != nil || got != expected {
			t.Errorf("%s: got %v (err %v), want %v", email, got, err, expected)
		}
	}
	if _, err := zb.Check(context.Background(), "nocredit@x.com"); err == nil {
		t.Error("an error response (bad key / no credits) should be reported as an error so signup can fail open")
	}
}

// fakeMailServer is a tiny SMTP server that answers like a real one:
// "550 5.1.1" for recipients starting with "ghost", a policy block for "blocked",
// a temporary error for "later", and OK for everyone else. It never accepts mail (no DATA).
func fakeMailServer(t *testing.T) (port string, stop func()) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				tp := textproto.NewConn(c)
				tp.PrintfLine("220 fake.test ESMTP")
				for {
					line, err := tp.ReadLine()
					if err != nil {
						return
					}
					up := strings.ToUpper(line)
					switch {
					case strings.HasPrefix(up, "EHLO"), strings.HasPrefix(up, "HELO"):
						tp.PrintfLine("250 fake.test")
					case strings.HasPrefix(up, "MAIL"):
						tp.PrintfLine("250 2.1.0 OK")
					case strings.HasPrefix(up, "RCPT"):
						switch {
						case strings.Contains(up, "<GHOST"):
							tp.PrintfLine("550-5.1.1 The email account that you tried to reach does not exist.")
							tp.PrintfLine("550 5.1.1 Please try double-checking the recipient's address.")
						case strings.Contains(up, "<BLOCKED"):
							tp.PrintfLine("550 5.7.1 Message rejected due to spam policy for your IP")
						case strings.Contains(up, "<LATER"):
							tp.PrintfLine("451 4.7.1 Greylisted, try again later")
						default:
							tp.PrintfLine("250 2.1.5 OK")
						}
					case strings.HasPrefix(up, "QUIT"):
						tp.PrintfLine("221 bye")
						return
					default:
						tp.PrintfLine("250 OK")
					}
				}
			}(conn)
		}
	}()
	_, port, _ = net.SplitHostPort(ln.Addr().String())
	return port, func() { ln.Close() }
}

func TestSMTPProbe(t *testing.T) {
	port, stop := fakeMailServer(t)
	defer stop()
	probe := smtpProbe{
		from: "sender@example.com", port: port,
		mxHosts: func(context.Context, string) ([]string, error) { return []string{"127.0.0.1"}, nil },
	}
	want := map[string]MailboxResult{
		"alice@example.com":   MailboxValid,
		"ghost1@example.com":  MailboxInvalid, // "550 5.1.1 account does not exist"
		"blocked@example.com": MailboxUnknown, // 550 but a policy block says nothing about the mailbox
		"later@example.com":   MailboxUnknown, // temporary error / greylisting
	}
	for email, expected := range want {
		got, err := probe.Check(context.Background(), email)
		if err != nil || got != expected {
			t.Errorf("%s: got %v (err %v), want %v", email, got, err, expected)
		}
	}

	// A port nobody listens on (blocked, like Render's free plan) is an error, so signup fails open
	stop()
	if _, err := probe.Check(context.Background(), "alice@example.com"); err == nil {
		t.Error("an unreachable mail server should be reported as an error")
	}
}

// captureMailer records the verification code "sent" to each address.
type captureMailer struct {
	mu    sync.Mutex
	codes map[string]string
	sent  map[string]int // how many emails each address received
}

var sixDigits = regexp.MustCompile(`\b\d{6}\b`)

func (m *captureMailer) Send(_ context.Context, to, _, text, _ string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.codes == nil {
		m.codes = map[string]string{}
		m.sent = map[string]int{}
	}
	m.codes[to] = sixDigits.FindString(text)
	m.sent[to]++
	return nil
}

func (m *captureMailer) count(to string) int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sent[to]
}

func (m *captureMailer) code(to string) string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.codes[to]
}

// signupVerified creates an account and confirms its email, leaving the client logged in.
func (c *apiClient) signupVerified(m *captureMailer, name, business, email, password string) {
	c.t.Helper()
	status, body, _ := c.do("POST", "/auth/signup", map[string]string{"name": name, "businessName": business, "email": email, "password": password})
	expect(c.t, "signup", status, 202, body)
	status, body, _ = c.do("POST", "/auth/verify", map[string]string{"email": email, "code": m.code(email)})
	expect(c.t, "verify email", status, 200, body)
	c.token = body["token"].(string)
}

// loginVerified logs in an unverified account (a new staff member): the first
// login is refused until the emailed code is entered.
func (c *apiClient) loginVerified(m *captureMailer, email, password string) {
	c.t.Helper()
	status, body, _ := c.do("POST", "/auth/login", map[string]string{"email": email, "password": password})
	expect(c.t, "login before verifying", status, 403, body)
	status, body, _ = c.do("POST", "/auth/verify", map[string]string{"email": email, "code": m.code(email)})
	expect(c.t, "verify email", status, 200, body)
	c.token = body["token"].(string)
}

func TestAPIEndToEnd(t *testing.T) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI to run the end-to-end MongoDB test")
	}
	ctx := context.Background()
	dbName := fmt.Sprintf("prodtrack_test_%d", time.Now().UnixNano())
	store, err := connectStore(ctx, uri, dbName)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { store.db.Drop(ctx); store.Close() }()

	mails := &captureMailer{}
	app := &App{store: store, tokens: TokenService{secret: []byte("e2e-secret-e2e-secret-e2e-secret!"), ttl: time.Hour}, mailer: mails, domainCheck: testDomainCheck, checker: fakeChecker{}}
	srv := httptest.NewServer(newRouter(app, t.TempDir()))
	defer srv.Close()

	// A mailbox that doesn't exist is refused before anything is created or emailed;
	// "can't tell" and a failing checking service don't block the signup.
	ghost := &apiClient{t: t, base: srv.URL}
	status, body, _ := ghost.do("POST", "/auth/signup", map[string]string{"name": "Ghost", "businessName": "Ghost Co", "email": "ghost@example.com", "password": "supersecret"})
	expect(t, "nonexistent mailbox", status, 400, body)
	if mails.code("ghost@example.com") != "" {
		t.Error("a code was emailed to a mailbox that doesn't exist")
	}
	if n, _ := store.users.CountDocuments(ctx, bson.M{"email": "ghost@example.com"}); n != 0 {
		t.Error("an account was created for a mailbox that doesn't exist")
	}
	for _, e := range []string{"maybe@example.com", "broken@example.com"} {
		status, body, _ = ghost.do("POST", "/auth/signup", map[string]string{"name": "Maybe", "businessName": "Maybe Co", "email": e, "password": "supersecret"})
		expect(t, "unknown mailbox "+e, status, 202, body)
	}

	// Fake-looking addresses are refused before any code is emailed
	fakeClient := &apiClient{t: t, base: srv.URL}
	for _, fake := range []string{"a@gmail.com", "x@mailinator.com", "person@nodomain.invalid"} {
		status, body, _ := fakeClient.do("POST", "/auth/signup", map[string]string{"name": "Fake", "businessName": "Fake Co", "email": fake, "password": "supersecret"})
		expect(t, "fake email "+fake, status, 400, body)
		if mails.code(fake) != "" {
			t.Errorf("a code was emailed to the fake address %s", fake)
		}
	}

	// Signup only creates an unverified account: no token until the emailed code is entered.
	owner := &apiClient{t: t, base: srv.URL}
	status, body, _ = owner.do("POST", "/auth/signup", map[string]string{"name": "Asha", "businessName": "Asha Stores", "email": "Asha@Example.com", "password": "supersecret"})
	expect(t, "signup", status, 202, body)
	if body["needsVerification"] != true || body["token"] != nil {
		t.Errorf("signup must require verification and issue no token: %v", body)
	}
	code := mails.code("asha@example.com")
	if len(code) != 6 {
		t.Fatalf("no 6-digit code was emailed (got %q)", code)
	}
	status, body, _ = owner.do("POST", "/auth/login", map[string]string{"email": "asha@example.com", "password": "supersecret"})
	expect(t, "login before verifying", status, 403, body)
	if body["needsVerification"] != true || body["token"] != nil {
		t.Errorf("unverified login must be refused without a token: %v", body)
	}
	wrong := "000000"
	if code == wrong {
		wrong = "111111"
	}
	status, body, _ = owner.do("POST", "/auth/verify", map[string]string{"email": "asha@example.com", "code": wrong})
	expect(t, "wrong code", status, 400, body)
	status, body, _ = owner.do("POST", "/auth/verify", map[string]string{"email": "asha@example.com", "code": code})
	expect(t, "verify email", status, 200, body)
	owner.token = body["token"].(string)
	if body["user"].(map[string]any)["businessName"] != "Asha Stores" {
		t.Errorf("verify response missing business: %v", body)
	}
	status, body, _ = owner.do("POST", "/auth/verify", map[string]string{"email": "asha@example.com", "code": code})
	expect(t, "code can't be reused", status, 400, body)
	status, body, _ = owner.do("POST", "/auth/login", map[string]string{"email": "asha@example.com", "password": "supersecret"})
	expect(t, "login after verifying", status, 200, body)

	status, body, _ = owner.do("POST", "/auth/signup", map[string]string{"name": "X", "businessName": "Y", "email": "asha@example.com", "password": "supersecret"})
	expect(t, "duplicate signup", status, 409, body)

	anon := &apiClient{t: t, base: srv.URL}
	status, body, _ = anon.do("POST", "/auth/login", map[string]string{"email": "asha@example.com", "password": "wrongpass"})
	expect(t, "wrong password", status, 401, body)
	status, body, _ = anon.do("GET", "/products", nil)
	expect(t, "no token", status, 401, body)
	anon.token = "not.a.jwt"
	status, body, _ = anon.do("GET", "/products", nil)
	expect(t, "bad token", status, 401, body)

	status, body, _ = owner.do("POST", "/products", map[string]any{"name": "Pen", "sku": " pen 01 ", "warehouse": "Main Store", "category": "Stationery", "price": 10, "stock": 5, "minThreshold": 2})
	expect(t, "add product", status, 201, body)
	penID := body["id"].(string)
	if body["sku"] != "PEN-01" || body["warehouse"] != "Main Store" {
		t.Errorf("sku/warehouse not saved: %v", body)
	}
	status, body, _ = owner.do("POST", "/products", map[string]any{"name": "Pen copy", "sku": "PEN-01", "category": "Stationery", "price": 1})
	expect(t, "duplicate sku", status, 409, body)
	status, body, _ = owner.do("POST", "/products", map[string]any{"name": "Book", "category": "Stationery", "price": 100, "stock": 1, "minThreshold": 1})
	expect(t, "add product 2", status, 201, body)
	bookID := body["id"].(string)
	if body["sku"] != "SKU-0001" {
		t.Errorf("expected auto SKU-0001, got %v", body["sku"])
	}
	status, body, _ = owner.do("PUT", "/products/"+bookID, map[string]any{"name": "Book", "category": "Stationery", "price": 100, "minThreshold": 1, "warehouse": "Backroom"})
	expect(t, "edit without version", status, 400, body)
	status, body, _ = owner.do("PUT", "/products/"+bookID, map[string]any{"name": "Book", "category": "Stationery", "price": 100, "minThreshold": 1, "warehouse": "Backroom", "version": 1})
	expect(t, "edit product", status, 200, body)
	if body["sku"] != "SKU-0001" || body["warehouse"] != "Backroom" || body["stock"].(float64) != 1 {
		t.Errorf("edit changed the wrong fields: %v", body)
	}

	status, body, _ = owner.do("POST", "/stock", map[string]any{"productId": penID, "action": "in", "quantity": 10, "reason": "Restock"})
	expect(t, "stock in", status, 200, body)
	status, body, _ = owner.do("POST", "/stock", map[string]any{"productId": penID, "action": "out", "quantity": 999})
	expect(t, "stock out too many", status, 409, body)

	// Staff
	status, body, _ = owner.do("POST", "/staff", map[string]string{"name": "Ghost", "email": "ghost@example.com", "password": "staffpass1"})
	expect(t, "staff with a nonexistent mailbox", status, 400, body)
	status, body, _ = owner.do("POST", "/staff", map[string]string{"name": "Ravi", "email": "ravi@example.com", "password": "staffpass1"})
	expect(t, "add staff", status, 201, body)
	staffID := body["id"].(string)
	staff := &apiClient{t: t, base: srv.URL}
	staff.loginVerified(mails, "ravi@example.com", "staffpass1")
	status, body, _ = staff.do("GET", "/staff", nil)
	expect(t, "staff cannot list staff", status, 403, body)
	status, body, _ = staff.do("GET", "/analytics", nil)
	expect(t, "staff cannot see analytics", status, 403, body)

	// Billing: prices come from the DB, not the client
	status, body, _ = staff.do("POST", "/billing", map[string]any{"items": []map[string]any{
		{"productId": penID, "quantity": 2, "price": 0.01}, {"productId": penID, "quantity": 1}, {"productId": bookID, "quantity": 1},
	}})
	expect(t, "create bill", status, 201, body)
	if body["totalAmount"].(float64) != 130 || body["number"].(float64) != 1 {
		t.Errorf("bill total/number wrong: %v", body)
	}

	// Insufficient stock rolls back every deduction
	status, body, _ = owner.do("POST", "/billing", map[string]any{"items": []map[string]any{
		{"productId": penID, "quantity": 1}, {"productId": bookID, "quantity": 5},
	}})
	expect(t, "bill short on stock", status, 409, body)
	_, _, products := owner.do("GET", "/products", nil)
	stock := map[string]float64{}
	for _, p := range products {
		m := p.(map[string]any)
		stock[m["name"].(string)] = m["stock"].(float64)
	}
	if stock["Pen"] != 12 || stock["Book"] != 0 {
		t.Errorf("stock after rollback wrong: %v", stock)
	}

	status, body, _ = owner.do("GET", "/analytics?tzOffset=-330", nil)
	expect(t, "analytics", status, 200, body)
	if len(body["daily"].([]any)) != 1 || len(body["topProducts"].([]any)) != 2 {
		t.Errorf("analytics wrong: %v", body)
	}
	_, _, history := owner.do("GET", "/history", nil)
	if len(history) != 6 { // 2 new products + 1 edit + restock + 2 billing lines
		t.Errorf("expected 6 history entries, got %d", len(history))
	}

	// Profile: the verified login email can't be swapped; a password change needs the current password
	status, body, _ = owner.do("PUT", "/auth/profile", map[string]string{"name": "Asha K", "email": "asha.k@example.com"})
	expect(t, "email change refused", status, 400, body)
	status, body, _ = owner.do("PUT", "/auth/profile", map[string]string{"name": "Asha K", "email": "asha@example.com", "newPassword": "newsecret1"})
	expect(t, "password change without current password", status, 401, body)
	status, body, _ = owner.do("PUT", "/auth/profile", map[string]string{"name": "Asha K", "email": "asha@example.com", "currentPassword": "supersecret", "newPassword": "newsecret1"})
	expect(t, "profile update", status, 200, body)
	status, body, _ = anon.do("POST", "/auth/login", map[string]string{"email": "asha@example.com", "password": "newsecret1"})
	expect(t, "login with new credentials", status, 200, body)

	// Removed staff lose access immediately
	status, body, _ = owner.do("DELETE", "/staff/"+staffID, nil)
	expect(t, "remove staff", status, 200, body)
	status, body, _ = staff.do("GET", "/products", nil)
	expect(t, "removed staff token", status, 401, body)

	// Another business can't see or touch this one's data
	other := &apiClient{t: t, base: srv.URL}
	other.signupVerified(mails, "Bo", "Bo Mart", "bo@example.com", "bopassword")
	_, _, otherProducts := other.do("GET", "/products", nil)
	if len(otherProducts) != 0 {
		t.Errorf("tenant isolation broken: %v", otherProducts)
	}
	status, body, _ = other.do("DELETE", "/products/"+penID, nil)
	expect(t, "cross-business delete", status, 404, body)

	status, body, _ = owner.do("DELETE", "/products/"+bookID, nil)
	expect(t, "delete product", status, 200, body)

	// Pictures: everyone can set their own; only owners can set the business logo
	const tinyPNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
	status, body, _ = other.do("POST", "/staff", map[string]string{"name": "Mia", "email": "mia@example.com", "password": "staffpass1"})
	expect(t, "add staff for pictures", status, 201, body)
	mia := &apiClient{t: t, base: srv.URL}
	mia.loginVerified(mails, "mia@example.com", "staffpass1")
	status, body, _ = mia.do("PUT", "/auth/avatar", map[string]string{"image": tinyPNG})
	expect(t, "staff sets own avatar", status, 200, body)
	if body["user"].(map[string]any)["avatar"] != tinyPNG {
		t.Errorf("avatar not returned: %v", body)
	}
	status, body, _ = mia.do("PUT", "/business", map[string]string{"name": "Hacked", "logo": tinyPNG})
	expect(t, "staff cannot edit the business", status, 403, body)
	status, body, _ = other.do("PUT", "/business", map[string]string{"name": "Bo Mart", "logo": tinyPNG})
	expect(t, "owner sets business logo", status, 200, body)
	status, body, _ = other.do("PUT", "/business", map[string]string{"name": "   "})
	expect(t, "empty business name", status, 400, body)
	status, body, _ = other.do("PUT", "/business", map[string]string{"name": "Bo Mart & Co"})
	expect(t, "rename keeps the logo", status, 200, body)
	if u := body["user"].(map[string]any); u["businessName"] != "Bo Mart & Co" || u["businessLogo"] != tinyPNG {
		t.Errorf("rename should keep the logo: %v", u)
	}
	status, body, _ = other.do("PUT", "/auth/avatar", map[string]string{"image": tinyPNG})
	expect(t, "owner sets own avatar", status, 200, body)
	status, body, _ = mia.do("GET", "/auth/me", nil)
	expect(t, "me", status, 200, body)
	if u := body["user"].(map[string]any); u["avatar"] != tinyPNG || u["businessLogo"] != tinyPNG || u["businessName"] != "Bo Mart & Co" {
		t.Errorf("staff should see own avatar, the business logo and the new business name: %v", u)
	}
	for _, bad := range []string{"data:text/html;base64,PGI+", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,AAAA", "not an image", "data:image/png;base64,!!!"} {
		status, body, _ = mia.do("PUT", "/auth/avatar", map[string]string{"image": bad})
		expect(t, "reject "+bad, status, 400, body)
	}
	status, body, _ = mia.do("PUT", "/auth/avatar", map[string]string{"image": ""})
	expect(t, "remove avatar", status, 200, body)
	if body["user"].(map[string]any)["avatar"] != "" {
		t.Errorf("avatar not removed: %v", body)
	}

	// Verification limits: 5 wrong guesses lock the code; a resend (after the
	// cooldown) issues a fresh one.
	late := &apiClient{t: t, base: srv.URL}
	status, body, _ = late.do("POST", "/auth/signup", map[string]string{"name": "Cy", "businessName": "Cy Co", "email": "cy@example.com", "password": "cypassword"})
	expect(t, "signup cy", status, 202, body)
	cyCode := mails.code("cy@example.com")
	bad := "000000"
	if cyCode == bad {
		bad = "111111"
	}
	for i := 0; i < maxCodeAttempts; i++ {
		late.do("POST", "/auth/verify", map[string]string{"email": "cy@example.com", "code": bad})
	}
	status, body, _ = late.do("POST", "/auth/verify", map[string]string{"email": "cy@example.com", "code": cyCode})
	expect(t, "locked after too many attempts", status, 429, body)
	status, body, _ = late.do("POST", "/auth/resend", map[string]string{"email": "cy@example.com"})
	expect(t, "resend during cooldown", status, 429, body)
	_, err = store.users.UpdateOne(ctx, bson.M{"email": "cy@example.com"}, bson.M{"$set": bson.M{"verifySentAt": time.Now().Add(-2 * time.Minute)}})
	if err != nil {
		t.Fatal(err)
	}
	status, body, _ = late.do("POST", "/auth/resend", map[string]string{"email": "cy@example.com"})
	expect(t, "resend after cooldown", status, 200, body)
	status, body, _ = late.do("POST", "/auth/verify", map[string]string{"email": "cy@example.com", "code": mails.code("cy@example.com")})
	expect(t, "verify with fresh code", status, 200, body)

	// Forgot password: the answer never reveals whether an email is registered, and
	// only verified accounts are sent a code.
	stranger := &apiClient{t: t, base: srv.URL}
	status, body, _ = stranger.do("POST", "/auth/forgot", map[string]string{"email": "nobody@example.com"})
	expect(t, "forgot for an unknown email", status, 200, body)
	if mails.count("nobody@example.com") != 0 {
		t.Error("a reset email was sent to an address with no account")
	}
	status, body, _ = stranger.do("POST", "/auth/signup", map[string]string{"name": "Dee", "businessName": "Dee Co", "email": "dee@example.com", "password": "deepassword"})
	expect(t, "signup dee (left unverified)", status, 202, body)
	before := mails.count("dee@example.com")
	status, body, _ = stranger.do("POST", "/auth/forgot", map[string]string{"email": "dee@example.com"})
	expect(t, "forgot for an unverified account", status, 200, body)
	if mails.count("dee@example.com") != before {
		t.Error("an unverified account must verify its email first, not receive a reset code")
	}

	// A verified account (Bo) resets its password with the emailed code
	status, body, _ = stranger.do("POST", "/auth/forgot", map[string]string{"email": "bo@example.com"})
	expect(t, "forgot for a verified account", status, 200, body)
	resetCode := mails.code("bo@example.com")
	if len(resetCode) != 6 {
		t.Fatalf("no 6-digit reset code was emailed (got %q)", resetCode)
	}
	wrongReset := "000000"
	if resetCode == wrongReset {
		wrongReset = "111111"
	}
	status, body, _ = stranger.do("POST", "/auth/reset", map[string]string{"email": "bo@example.com", "code": wrongReset, "newPassword": "brandnewpass1"})
	expect(t, "reset with a wrong code", status, 400, body)
	status, body, _ = stranger.do("POST", "/auth/reset", map[string]string{"email": "bo@example.com", "code": resetCode, "newPassword": "short"})
	expect(t, "reset with a weak password", status, 400, body)
	status, body, _ = stranger.do("POST", "/auth/reset", map[string]string{"email": "bo@example.com", "code": resetCode, "newPassword": "brandnewpass1"})
	expect(t, "reset with the right code", status, 200, body)
	status, body, _ = stranger.do("POST", "/auth/reset", map[string]string{"email": "bo@example.com", "code": resetCode, "newPassword": "anotherpass22"})
	expect(t, "a reset code can't be reused", status, 400, body)
	status, body, _ = stranger.do("POST", "/auth/login", map[string]string{"email": "bo@example.com", "password": "bopassword"})
	expect(t, "old password no longer works", status, 401, body)
	status, body, _ = stranger.do("POST", "/auth/login", map[string]string{"email": "bo@example.com", "password": "brandnewpass1"})
	expect(t, "new password works", status, 200, body)
	status, body, _ = other.do("GET", "/auth/me", nil)
	expect(t, "logins from before the reset are signed out", status, 401, body)

	// Wrong guesses lock the reset code
	time.Sleep(1100 * time.Millisecond) // the cooldown test below needs a distinct second from the reset
	_, err = store.users.UpdateOne(ctx, bson.M{"email": "bo@example.com"}, bson.M{"$unset": bson.M{"resetSentAt": ""}})
	if err != nil {
		t.Fatal(err)
	}
	stranger.do("POST", "/auth/forgot", map[string]string{"email": "bo@example.com"})
	lockCode := mails.code("bo@example.com")
	badGuess := "000000"
	if lockCode == badGuess {
		badGuess = "111111"
	}
	for i := 0; i < maxCodeAttempts; i++ {
		stranger.do("POST", "/auth/reset", map[string]string{"email": "bo@example.com", "code": badGuess, "newPassword": "brandnewpass1"})
	}
	status, body, _ = stranger.do("POST", "/auth/reset", map[string]string{"email": "bo@example.com", "code": lockCode, "newPassword": "brandnewpass1"})
	expect(t, "reset locked after too many attempts", status, 429, body)
}

// ---------------------------------------------------------------------------
// Concurrency: many people changing the same product at the same moment.
// ---------------------------------------------------------------------------

func newTestServer(t *testing.T) (*Store, string, *captureMailer, func()) {
	uri := os.Getenv("MONGODB_TEST_URI")
	if uri == "" {
		t.Skip("set MONGODB_TEST_URI to run MongoDB tests")
	}
	ctx := context.Background()
	store, err := connectStore(ctx, uri, fmt.Sprintf("prodtrack_test_%d", time.Now().UnixNano()))
	if err != nil {
		t.Fatal(err)
	}
	mails := &captureMailer{}
	app := &App{store: store, tokens: TokenService{secret: []byte("e2e-secret-e2e-secret-e2e-secret!"), ttl: time.Hour}, mailer: mails, domainCheck: testDomainCheck}
	srv := httptest.NewServer(newRouter(app, t.TempDir()))
	return store, srv.URL, mails, func() { srv.Close(); store.db.Drop(ctx); store.Close() }
}

func TestConcurrentUpdates(t *testing.T) {
	store, base, mails, done := newTestServer(t)
	defer done()
	t.Logf("transactions enabled: %v", store.txn)

	owner := &apiClient{t: t, base: base}
	owner.signupVerified(mails, "Owner", "Race Shop", "race@example.com", "racepassword")
	staff := []*apiClient{owner}
	for i := 0; i < 3; i++ {
		email := fmt.Sprintf("staff%d@example.com", i)
		owner.do("POST", "/staff", map[string]string{"name": fmt.Sprintf("Staff %d", i), "email": email, "password": "staffpass1"})
		c := &apiClient{t: t, base: base}
		c.loginVerified(mails, email, "staffpass1")
		staff = append(staff, c)
	}
	newProduct := func(name string, stock int) (string, float64) {
		_, b, _ := owner.do("POST", "/products", map[string]any{"name": name, "category": "Test", "price": 10, "stock": stock})
		return b["id"].(string), b["version"].(float64)
	}
	parallel := func(n int, fn func(i int) int) map[int]int {
		var mu sync.Mutex
		codes := map[int]int{}
		var wg sync.WaitGroup
		for i := 0; i < n; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				code := fn(i)
				mu.Lock()
				codes[code]++
				mu.Unlock()
			}(i)
		}
		wg.Wait()
		return codes
	}
	stockOf := func(id string) int {
		_, _, list := owner.do("GET", "/products", nil)
		for _, p := range list {
			if m := p.(map[string]any); m["id"] == id {
				return int(m["stock"].(float64))
			}
		}
		t.Fatalf("product %s missing", id)
		return 0
	}

	// 1. 25 people remove 1 unit of a product that has 10: exactly 10 succeed.
	widget, _ := newProduct("Widget", 10)
	codes := parallel(25, func(i int) int {
		s, _, _ := staff[i%len(staff)].do("POST", "/stock", map[string]any{"productId": widget, "action": "out", "quantity": 1})
		return s
	})
	if codes[200] != 10 || codes[409] != 15 || stockOf(widget) != 0 {
		t.Errorf("concurrent stock-out: codes=%v stock=%d (want 10x200, 15x409, stock 0)", codes, stockOf(widget))
	}

	// 2. 20 people add 1 unit each at once: no update is lost.
	gadget, _ := newProduct("Gadget", 5)
	parallel(20, func(i int) int {
		s, _, _ := staff[i%len(staff)].do("POST", "/stock", map[string]any{"productId": gadget, "action": "in", "quantity": 1})
		return s
	})
	if got := stockOf(gadget); got != 25 {
		t.Errorf("concurrent stock-in: stock=%d, want 25", got)
	}

	// 3. 12 checkouts race for 5 units: exactly 5 bills, unique bill numbers,
	//    and no bill is half-saved (the second item is deducted only for winners).
	scarce, _ := newProduct("Scarce", 5)
	plenty, _ := newProduct("Plenty", 100)
	var mu sync.Mutex
	numbers := map[float64]bool{}
	codes = parallel(12, func(i int) int {
		s, b, _ := staff[i%len(staff)].do("POST", "/billing", map[string]any{"items": []map[string]any{
			{"productId": plenty, "quantity": 2}, {"productId": scarce, "quantity": 1},
		}})
		if s == 201 {
			mu.Lock()
			numbers[b["number"].(float64)] = true
			mu.Unlock()
		}
		return s
	})
	if codes[201] != 5 || len(numbers) != 5 || stockOf(scarce) != 0 || stockOf(plenty) != 90 {
		t.Errorf("concurrent billing: codes=%v numbers=%v scarce=%d plenty=%d (want 5 bills, scarce 0, plenty 90)",
			codes, numbers, stockOf(scarce), stockOf(plenty))
	}

	// 4. Every stock change is logged with a consistent before/after chain.
	_, _, history := owner.do("GET", "/history", nil)
	afters := map[float64]bool{}
	for _, h := range history {
		m := h.(map[string]any)
		if m["productId"] == widget && m["kind"] == "removed" {
			before, after := m["stockBefore"].(float64), m["stockAfter"].(float64)
			if before-after != 1 {
				t.Errorf("bad before/after: %v -> %v", before, after)
			}
			afters[after] = true
		}
	}
	if len(afters) != 10 { // 9,8,...,0 each exactly once
		t.Errorf("expected 10 distinct stock-after values for Widget, got %v", afters)
	}

	// 5. Two people edit the same product from the same version: one wins,
	//    the other gets 409 with the latest data instead of overwriting.
	doc, version := newProduct("Doc", 1)
	codes = parallel(2, func(i int) int {
		s, _, _ := staff[i].do("PUT", "/products/"+doc, map[string]any{
			"name": "Doc", "category": "Test", "price": 10 + i + 1, "version": version,
		})
		return s
	})
	if codes[200] != 1 || codes[409] != 1 {
		t.Errorf("concurrent edits: codes=%v, want one 200 and one 409", codes)
	}
	s, b, _ := staff[1].do("PUT", "/products/"+doc, map[string]any{"name": "Doc", "category": "Test", "price": 50, "version": version})
	if s != 409 || b["code"] != "version_conflict" || b["current"].(map[string]any)["version"].(float64) != version+1 {
		t.Errorf("stale edit should return the latest version: %d %v", s, b)
	}
	s, _, _ = staff[1].do("PUT", "/products/"+doc, map[string]any{"name": "Doc", "category": "Test", "price": 50, "version": version + 1})
	if s != 200 {
		t.Errorf("edit with the latest version should succeed, got %d", s)
	}

	// 6. Log book for today adds up (opening + added - sold - removed = closing).
	s, b, _ = owner.do("GET", "/logbook?tzOffset=0", nil)
	expect(t, "logbook", s, 200, b)
	sum := b["summary"].(map[string]any)
	if sum["unitsSold"].(float64) != 15 || sum["bills"].(float64) != 5 || sum["unitsRemoved"].(float64) != 10 ||
		sum["productsAdded"].(float64) != 5 || sum["edits"].(float64) != 2 {
		t.Errorf("logbook summary wrong: %v", sum)
	}
	for _, p := range b["products"].([]any) {
		row := p.(map[string]any)
		open, closing := row["opening"].(float64), row["closing"].(float64)
		if open+row["added"].(float64)-row["sold"].(float64)-row["removed"].(float64) != closing {
			t.Errorf("logbook row does not add up: %v", row)
		}
	}
	s, _, _ = staff[1].do("GET", "/logbook", nil)
	if s != 403 {
		t.Errorf("staff must not see the log book, got %d", s)
	}
}
