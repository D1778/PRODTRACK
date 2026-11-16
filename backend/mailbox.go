package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"time"
)

// Mailbox checking: before any verification email is sent, ask an email
// verification service whether the mailbox really exists. A well-formed address
// at a real domain (for example zz123456@gmail.com) passes the DNS check, but
// only the recipient's mail server knows whether that mailbox exists.

type MailboxResult int

const (
	MailboxUnknown MailboxResult = iota // can't tell (catch-all domains, timeouts...): allow, the emailed code still protects us
	MailboxValid
	MailboxInvalid // doesn't exist, disposable, spam trap...: refuse
)

type MailboxChecker interface {
	Check(ctx context.Context, email string) (MailboxResult, error)
}

// newMailboxChecker picks how mailboxes are checked: ZeroBounce when
// ZEROBOUNCE_API_KEY is set (works from any host), otherwise by asking the
// recipient's mail server directly (free, but needs outbound port 25).
func newMailboxChecker(cfg Config) MailboxChecker {
	if cfg.ZeroBounceKey != "" {
		log.Println("Email: checking that mailboxes exist (ZeroBounce) before sending verification codes")
		return zeroBounce{apiKey: cfg.ZeroBounceKey, baseURL: "https://api.zerobounce.net", client: &http.Client{Timeout: 12 * time.Second}}
	}
	log.Println("Email: checking that mailboxes exist by asking the recipient's mail server (needs outbound port 25; if it is blocked the check is skipped)")
	return newSMTPProbe(cfg.MailFrom)
}

type zeroBounce struct {
	apiKey, baseURL string
	client          *http.Client
}

func (z zeroBounce) Check(ctx context.Context, email string) (MailboxResult, error) {
	q := url.Values{"api_key": {z.apiKey}, "email": {email}}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, z.baseURL+"/v2/validate?"+q.Encode(), nil)
	if err != nil {
		return MailboxUnknown, err
	}
	res, err := z.client.Do(req)
	if err != nil {
		return MailboxUnknown, err
	}
	defer res.Body.Close()

	var body struct {
		Status    string `json:"status"`
		SubStatus string `json:"sub_status"`
		Error     string `json:"error"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return MailboxUnknown, fmt.Errorf("zerobounce: unreadable response (HTTP %d)", res.StatusCode)
	}
	if body.Status == "" { // e.g. an invalid key or no credits left
		return MailboxUnknown, fmt.Errorf("zerobounce: HTTP %d: %s", res.StatusCode, body.Error)
	}
	switch body.Status {
	case "valid":
		return MailboxValid, nil
	case "invalid", "spamtrap", "do_not_mail":
		return MailboxInvalid, nil
	default: // catch-all, unknown, abuse
		return MailboxUnknown, nil
	}
}

// mailboxProblem returns a message when the mailbox is known not to exist, or ""
// to go ahead. If the checking service fails, it lets the signup through (and
// logs it) rather than locking everyone out.
func (a *App) mailboxProblem(ctx context.Context, email string) string {
	if a.checker == nil {
		return ""
	}
	res, err := a.checker.Check(ctx, email)
	if err != nil {
		log.Printf("WARNING mailbox check failed for %s (allowing): %v", email, err)
		return ""
	}
	if res == MailboxInvalid {
		return "That email address doesn't exist or can't receive mail. Please check it and try again"
	}
	return ""
}
