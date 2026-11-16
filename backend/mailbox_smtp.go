package main

import (
	"context"
	"errors"
	"net"
	"net/smtp"
	"net/textproto"
	"sort"
	"strings"
	"time"
)

// smtpProbe asks the recipient's own mail server whether a mailbox exists, the
// way a real delivery would start (EHLO, MAIL FROM, RCPT TO) but stopping before
// any message is sent: nothing is ever delivered to the person. Servers answer
// "user unknown" for mailboxes that don't exist (Gmail does this reliably).
//
// It needs outbound port 25, which many hosts block (Render's free plan does,
// and so do some home or office networks). When the port can't be reached it
// returns an error and signup carries on without the check.
type smtpProbe struct {
	from string // address used in MAIL FROM; should be a real sender address
	port string // "25" unless a test points it elsewhere
	// mxHosts lists the mail servers for a domain, best first. nil = real DNS.
	mxHosts func(ctx context.Context, domain string) ([]string, error)
}

func newSMTPProbe(from string) smtpProbe {
	return smtpProbe{from: from, port: "25"}
}

func (p smtpProbe) hosts(ctx context.Context, domain string) ([]string, error) {
	if p.mxHosts != nil {
		return p.mxHosts(ctx, domain)
	}
	mx, err := net.DefaultResolver.LookupMX(ctx, domain)
	if err != nil || len(mx) == 0 {
		return []string{domain}, nil // no MX record: the domain itself receives mail
	}
	sort.SliceStable(mx, func(i, j int) bool { return mx[i].Pref < mx[j].Pref })
	out := make([]string, 0, len(mx))
	for _, m := range mx {
		if h := strings.TrimSuffix(m.Host, "."); h != "" {
			out = append(out, h)
		}
	}
	return out, nil
}

func (p smtpProbe) Check(ctx context.Context, email string) (MailboxResult, error) {
	at := strings.LastIndex(email, "@")
	if at < 1 {
		return MailboxUnknown, errors.New("invalid address")
	}
	domain := email[at+1:]

	hosts, err := p.hosts(ctx, domain)
	if err != nil || len(hosts) == 0 {
		return MailboxUnknown, errors.New("no mail server found")
	}
	if len(hosts) > 2 {
		hosts = hosts[:2] // the best two are enough; keep signup fast
	}

	helo, sender := "prodtrack.local", p.from
	if i := strings.LastIndex(p.from, "@"); i > 0 {
		helo = p.from[i+1:]
	} else {
		sender = "postmaster@" + helo
	}

	var lastErr error
	for _, host := range hosts {
		res, err := p.probeHost(ctx, host, helo, sender, email)
		if err == nil {
			return res, nil
		}
		lastErr = err
	}
	return MailboxUnknown, lastErr
}

func (p smtpProbe) probeHost(ctx context.Context, host, helo, sender, email string) (MailboxResult, error) {
	d := net.Dialer{Timeout: 5 * time.Second}
	conn, err := d.DialContext(ctx, "tcp", net.JoinHostPort(host, p.port))
	if err != nil {
		return MailboxUnknown, err // port blocked, server down...
	}
	defer conn.Close()
	_ = conn.SetDeadline(time.Now().Add(10 * time.Second))

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		return MailboxUnknown, err
	}
	defer c.Close()
	if err := c.Hello(helo); err != nil {
		return MailboxUnknown, err
	}
	if err := c.Mail(sender); err != nil {
		return MailboxUnknown, nil // the server dislikes our sender: tells us nothing about the mailbox
	}
	err = c.Rcpt(email)
	_ = c.Quit()

	if err == nil {
		return MailboxValid, nil
	}
	var perr *textproto.Error
	if errors.As(err, &perr) && isNoSuchMailbox(perr) {
		return MailboxInvalid, nil
	}
	return MailboxUnknown, nil // temporary errors, greylisting, policy blocks...: can't tell
}

// isNoSuchMailbox is true only for "this recipient doesn't exist" answers. Other
// refusals (blocked IP, spam policy, rate limits) say nothing about the mailbox.
func isNoSuchMailbox(e *textproto.Error) bool {
	if e.Code != 550 && e.Code != 551 && e.Code != 553 && e.Code != 554 {
		return false
	}
	msg := strings.ToLower(e.Msg)
	for _, marker := range []string{
		"5.1.1", "5.1.2", "5.1.3", "5.1.6", "user unknown", "unknown user", "no such user", "no such recipient",
		"does not exist", "doesn't exist", "mailbox not found", "mailbox unavailable", "invalid recipient",
		"recipient address rejected", "recipient rejected", "user not found", "account disabled", "no mailbox here",
	} {
		if strings.Contains(msg, marker) {
			return true
		}
	}
	return false
}
