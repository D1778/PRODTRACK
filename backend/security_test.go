package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/v2/bson"
)

// ---------------------------------------------------------------------------
// Security tests: injection (SQL-style and MongoDB operator injection), auth
// bypass, cross-business access, privilege escalation and rate limiting.
// ---------------------------------------------------------------------------

// rawDo sends body exactly as written (not re-encoded), so malformed and
// operator-injection payloads reach the server untouched.
func rawDo(t *testing.T, base, method, path, token, body string) (int, string) {
	t.Helper()
	req, _ := http.NewRequest(method, base+"/api"+path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", token)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(raw)
}

// MongoDB operator injection: JSON objects/arrays where the API expects a
// string. Request fields are typed Go strings, so these must be refused while
// decoding - before anything reaches the database (no database is used here).
func TestOperatorInjectionRejected(t *testing.T) {
	app := &App{tokens: TokenService{secret: []byte("test-secret-test-secret-test-secret"), ttl: time.Hour}}
	srv := httptest.NewServer(newRouter(app, t.TempDir()))
	defer srv.Close()

	cases := []struct{ path, body string }{
		{"/auth/login", `{"email":{"$ne":null},"password":{"$ne":null}}`},
		{"/auth/login", `{"email":{"$gt":""},"password":"anything"}`},
		{"/auth/login", `{"email":{"$regex":".*"},"password":"anything"}`},
		{"/auth/login", `{"email":"owner@example.com","password":{"$ne":""}}`},
		{"/auth/login", `{"email":["owner@example.com"],"password":"x"}`},
		{"/auth/login", `{"email":{"$where":"sleep(5000)"},"password":"x"}`},
		{"/auth/login", `{"email":"a@b.com","password":"x"`}, // truncated JSON
		{"/auth/signup", `{"name":"x","businessName":"y","email":{"$ne":null},"password":"password1"}`},
		{"/auth/verify", `{"email":"a@b.com","code":{"$ne":""}}`},
		{"/auth/verify", `{"email":{"$ne":null},"code":"123456"}`},
		{"/auth/reset", `{"email":{"$ne":null},"code":{"$ne":""},"newPassword":"hacked123"}`},
		{"/auth/forgot", `{"email":{"$ne":null}}`},
		{"/auth/resend", `{"email":{"$gt":""}}`},
	}
	for _, c := range cases {
		status, body := rawDo(t, srv.URL, "POST", c.path, "", c.body)
		if status != http.StatusBadRequest {
			t.Errorf("POST %s %s: status %d, want 400 (body %s)", c.path, c.body, status, body)
		}
		if strings.Contains(body, `"token"`) {
			t.Errorf("POST %s %s: returned a token: %s", c.path, c.body, body)
		}
	}
}

// Requests with a missing, forged, tampered or expired token must never reach
// a handler. Token checks happen before any database lookup.
func TestAuthBypassRejected(t *testing.T) {
	secret := []byte("test-secret-test-secret-test-secret")
	app := &App{tokens: TokenService{secret: secret, ttl: time.Hour}}
	srv := httptest.NewServer(newRouter(app, t.TempDir()))
	defer srv.Close()

	id := bson.NewObjectID().Hex()
	sign := func(method jwt.SigningMethod, key any, c Claims) string {
		s, err := jwt.NewWithClaims(method, c).SignedString(key)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	claims := func(mut func(*Claims)) Claims {
		c := Claims{BusinessID: id, Role: "owner", RegisteredClaims: jwt.RegisteredClaims{
			Subject: id, Issuer: "prodtrack", IssuedAt: jwt.NewNumericDate(time.Now()), ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		}}
		if mut != nil {
			mut(&c)
		}
		return c
	}
	good := sign(jwt.SigningMethodHS256, secret, claims(nil))
	parts := strings.Split(good, ".")

	tokens := map[string]string{
		"no header":         "",
		"empty bearer":      "Bearer ",
		"basic auth":        "Basic YWRtaW46YWRtaW4=",
		"garbage":           "Bearer not.a.jwt",
		"alg none":          "Bearer " + sign(jwt.SigningMethodNone, jwt.UnsafeAllowNoneSignatureType, claims(nil)),
		"wrong secret":      "Bearer " + sign(jwt.SigningMethodHS256, []byte("attacker-guess"), claims(nil)),
		"HS512 not allowed": "Bearer " + sign(jwt.SigningMethodHS512, secret, claims(nil)),
		"expired":           "Bearer " + sign(jwt.SigningMethodHS256, secret, claims(func(c *Claims) { c.ExpiresAt = jwt.NewNumericDate(time.Now().Add(-time.Minute)) })),
		"no expiry":         "Bearer " + sign(jwt.SigningMethodHS256, secret, claims(func(c *Claims) { c.ExpiresAt = nil })),
		"wrong issuer":      "Bearer " + sign(jwt.SigningMethodHS256, secret, claims(func(c *Claims) { c.Issuer = "evil" })),
		"injected subject":  "Bearer " + sign(jwt.SigningMethodHS256, secret, claims(func(c *Claims) { c.Subject = `{"$ne":null}` })),
		"tampered payload":  "Bearer " + parts[0] + "." + strings.TrimRight(parts[1], "A") + "B." + parts[2],
		"stripped sig":      "Bearer " + parts[0] + "." + parts[1] + ".",
	}
	for name, tok := range tokens {
		for _, path := range []string{"/products", "/staff", "/auth/me"} {
			if status, body := rawDo(t, srv.URL, "GET", path, tok, ""); status != http.StatusUnauthorized {
				t.Errorf("%s on GET %s: status %d, want 401 (body %s)", name, path, status, body)
			}
		}
	}
}

func TestRateLimiter(t *testing.T) {
	l := newRateLimiter(3, time.Minute, false)
	now := time.Now()
	for i := 0; i < 3; i++ {
		if !l.allow("1.2.3.4", now) {
			t.Fatalf("request %d blocked, want allowed", i+1)
		}
	}
	if l.allow("1.2.3.4", now) {
		t.Fatal("4th request allowed, want blocked")
	}
	if !l.allow("5.6.7.8", now) {
		t.Fatal("other IP blocked")
	}
	if !l.allow("1.2.3.4", now.Add(time.Minute)) {
		t.Fatal("not allowed again after the window")
	}

	req := httptest.NewRequest("POST", "/", nil)
	req.RemoteAddr = "10.0.0.1:5555"
	req.Header.Set("X-Forwarded-For", "6.6.6.6, 9.9.9.9")
	if ip := l.clientIP(req); ip != "10.0.0.1" {
		t.Errorf("without TRUST_PROXY, client IP = %s, want 10.0.0.1 (X-Forwarded-For can be forged)", ip)
	}
	if ip := newRateLimiter(3, time.Minute, true).clientIP(req); ip != "9.9.9.9" {
		t.Errorf("with TRUST_PROXY, client IP = %s, want the proxy-added 9.9.9.9", ip)
	}

	// Through the router: the limit applies to login, and blocked requests get 429.
	app := &App{tokens: TokenService{secret: []byte("x"), ttl: time.Hour}, authLimiter: newRateLimiter(2, time.Minute, false)}
	srv := httptest.NewServer(newRouter(app, t.TempDir()))
	defer srv.Close()
	var last int
	for i := 0; i < 3; i++ {
		last, _ = rawDo(t, srv.URL, "POST", "/auth/login", "", `{"email":`) // malformed: answered 400 without a database
	}
	if last != http.StatusTooManyRequests {
		t.Errorf("3rd login with limit 2: status %d, want 429", last)
	}
}

// End-to-end security checks against a real database (MONGODB_TEST_URI).
func TestSecurityEndToEnd(t *testing.T) {
	_, base, mails, done := newTestServer(t)
	defer done()

	a := &apiClient{t: t, base: base}
	a.signupVerified(mails, "Alice", "Shop A", "alice@example.com", "alicepass1")
	b := &apiClient{t: t, base: base}
	b.signupVerified(mails, "Bob", "Shop B", "bob@example.com", "bobpass12")

	// --- SQL-style injection strings at login: must never log in ---
	for _, email := range []string{
		`' OR '1'='1`, `' OR 1=1 --`, `alice@example.com' --`, `alice@example.com" OR "1"="1`,
		`admin'/*`, `{"$ne": null}`, `.*`, `alice@example.com'; DROP TABLE users; --`, `*`, `alice@example.com%00`,
	} {
		for _, pw := range []string{`' OR '1'='1`, `anything`, `{"$ne": ""}`, `" OR ""="`} {
			status, body := rawDo(t, base, "POST", "/auth/login", "", mustJSON(map[string]string{"email": email, "password": pw}))
			if status != http.StatusUnauthorized || strings.Contains(body, `"token"`) {
				t.Errorf("login %q / %q: status %d body %s, want 401 and no token", email, pw, status, body)
			}
		}
	}
	// Real email with injection passwords
	for _, pw := range []string{`' OR '1'='1`, `' OR 1=1 --`, `alicepass1' OR 'x'='x`, `{"$gt": ""}`} {
		if status, _ := rawDo(t, base, "POST", "/auth/login", "", mustJSON(map[string]string{"email": "alice@example.com", "password": pw})); status != http.StatusUnauthorized {
			t.Errorf("login alice with password %q: status %d, want 401", pw, status)
		}
	}

	// --- Injection strings are stored literally, never executed ---
	evil := `'; DROP TABLE products; -- {"$set":{"stock":9999}} <script>alert(1)</script>`
	code, p, _ := a.do("POST", "/products", map[string]any{"name": evil, "category": `{"$gt":""}`, "price": 5, "stock": 3, "notes": `$where: function(){return true}`})
	expect(t, "create product with injection strings", code, http.StatusCreated, p)
	if p["name"] != evil || p["stock"].(float64) != 3 {
		t.Errorf("product was altered by injection text: %v", p)
	}
	aProduct := p["id"].(string)

	// Query/path parameter injection
	for _, q := range []string{`{"$gt":""}`, `' OR 1=1 --`, `2026-01-01' OR '1'='1`} {
		if status, _ := rawDo(t, base, "GET", "/logbook?date="+url.QueryEscape(q), "Bearer "+a.token, ""); status != http.StatusBadRequest {
			t.Errorf("logbook date %q: status %d, want 400", q, status)
		}
	}
	for _, id := range []string{`{"$ne":null}`, `' OR 1=1 --`, `000000000000000000000000' OR '1'='1`} {
		if status, _ := rawDo(t, base, "DELETE", "/products/"+url.PathEscape(id), "Bearer "+a.token, ""); status != http.StatusBadRequest {
			t.Errorf("delete product id %q: status %d, want 400", id, status)
		}
	}
	// Operator injection in authenticated bodies
	for _, body := range []string{
		`{"productId":{"$ne":null},"action":"out","quantity":1}`,
		`{"productId":"` + aProduct + `","action":"out","quantity":{"$gt":0}}`,
		`{"items":[{"productId":{"$ne":null},"quantity":1}]}`,
	} {
		path := "/stock"
		if strings.Contains(body, "items") {
			path = "/billing"
		}
		if status, _ := rawDo(t, base, "POST", path, "Bearer "+a.token, body); status != http.StatusBadRequest {
			t.Errorf("POST %s %s: status %d, want 400", path, body, status)
		}
	}

	// --- Cross-business access (Bob must not touch Alice's data) ---
	if code, body, _ := b.do("PUT", "/products/"+aProduct, map[string]any{"name": "pwned", "category": "x", "price": 0, "version": 1}); code != http.StatusNotFound {
		t.Errorf("Bob edited Alice's product: status %d %v", code, body)
	}
	if code, body, _ := b.do("POST", "/stock", map[string]any{"productId": aProduct, "action": "out", "quantity": 1}); code != http.StatusNotFound {
		t.Errorf("Bob changed Alice's stock: status %d %v", code, body)
	}
	if code, body, _ := b.do("POST", "/billing", map[string]any{"items": []map[string]any{{"productId": aProduct, "quantity": 1}}}); code != http.StatusNotFound {
		t.Errorf("Bob billed Alice's product: status %d %v", code, body)
	}
	if code, body, _ := b.do("DELETE", "/products/"+aProduct, nil); code != http.StatusNotFound {
		t.Errorf("Bob deleted Alice's product: status %d %v", code, body)
	}
	_, _, list := b.do("GET", "/products", nil)
	if len(list) != 0 {
		t.Errorf("Bob sees %d of Alice's products", len(list))
	}
	_, _, hist := b.do("GET", "/history", nil)
	if len(hist) != 0 {
		t.Errorf("Bob sees %d of Alice's history entries", len(hist))
	}

	// --- Privilege escalation: role sent by the client is ignored ---
	code, st, _ := a.do("POST", "/staff", map[string]any{"name": "Sam", "email": "sam@example.com", "password": "sampass12", "role": "owner", "businessId": bson.NewObjectID().Hex()})
	expect(t, "create staff", code, http.StatusCreated, st)
	if st["role"] != "staff" {
		t.Errorf("staff created with role %v, want staff", st["role"])
	}
	sam := &apiClient{t: t, base: base}
	sam.loginVerified(mails, "sam@example.com", "sampass12")
	for _, r := range [][2]string{{"GET", "/staff"}, {"POST", "/staff"}, {"GET", "/analytics"}, {"GET", "/logbook"}, {"PUT", "/business"}, {"DELETE", "/staff/" + st["id"].(string)}} {
		if code, _, _ := sam.do(r[0], r[1], map[string]any{"name": "x", "email": "x2@example.com", "password": "password1"}); code != http.StatusForbidden {
			t.Errorf("staff %s %s: status %d, want 403", r[0], r[1], code)
		}
	}
	if code, _, _ := b.do("DELETE", "/staff/"+st["id"].(string), nil); code != http.StatusNotFound {
		t.Errorf("Bob removed Alice's staff member: status %d", code)
	}

	// --- Price tampering: bill totals come from the database ---
	code, bill, _ := a.do("POST", "/billing", map[string]any{"items": []map[string]any{{"productId": aProduct, "quantity": 2, "price": 0}}, "totalAmount": 0})
	expect(t, "bill", code, http.StatusCreated, bill)
	if bill["totalAmount"].(float64) != 10 {
		t.Errorf("bill total %v, want 10 (2 x 5 from the database)", bill["totalAmount"])
	}
	if code, _, _ := a.do("POST", "/billing", map[string]any{"items": []map[string]any{{"productId": aProduct, "quantity": -5}}}); code != http.StatusBadRequest {
		t.Errorf("negative quantity bill: status %d, want 400", code)
	}

	// --- Changing the password on the profile page signs out other sessions ---
	other := &apiClient{t: t, base: base}
	code, res, _ := other.do("POST", "/auth/login", map[string]string{"email": "alice@example.com", "password": "alicepass1"})
	expect(t, "second login", code, http.StatusOK, res)
	other.token = res["token"].(string)
	time.Sleep(1100 * time.Millisecond) // token times have one-second precision
	code, res, _ = a.do("PUT", "/auth/profile", map[string]any{"name": "Alice", "email": "alice@example.com", "currentPassword": "alicepass1", "newPassword": "alicepass2"})
	expect(t, "change password", code, http.StatusOK, res)
	if code, _, _ := other.do("GET", "/auth/me", nil); code != http.StatusUnauthorized {
		t.Errorf("old session still works after password change: status %d", code)
	}
	tok, _ := res["token"].(string)
	if tok == "" {
		t.Fatal("password change returned no new token")
	}
	a.token = tok
	if code, body, _ := a.do("GET", "/auth/me", nil); code != http.StatusOK {
		t.Errorf("new token after password change: status %d %v", code, body)
	}
	if code, _, _ := a.do("PUT", "/auth/profile", map[string]any{"name": "Alice", "email": "alice@example.com", "currentPassword": "wrong", "newPassword": "alicepass3"}); code != http.StatusUnauthorized {
		t.Errorf("password change with wrong current password: status %d, want 401", code)
	}
}

func mustJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
