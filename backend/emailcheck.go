package main

import (
	"context"
	"errors"
	"fmt"
	"net"
	"regexp"
	"strings"
	"time"
)

// Checks that reject obviously fake email addresses at signup, before a code is
// sent. They can't prove a mailbox exists (only the emailed code does that), but
// they stop addresses like a@gmail.com, test@gmail.com or me@notarealdomain.xyz.

// Common throwaway-mail providers. Not exhaustive.
var disposableDomains = map[string]bool{
	"mailinator.com": true, "guerrillamail.com": true, "guerrillamail.net": true, "guerrillamail.org": true,
	"guerrillamailblock.com": true, "sharklasers.com": true, "grr.la": true, "10minutemail.com": true,
	"10minutemail.net": true, "tempmail.com": true, "temp-mail.org": true, "temp-mail.io": true,
	"tempmailo.com": true, "throwawaymail.com": true, "trashmail.com": true, "trashmail.net": true,
	"yopmail.com": true, "yopmail.net": true, "yopmail.fr": true, "getnada.com": true, "nada.email": true,
	"dispostable.com": true, "maildrop.cc": true, "mailnesia.com": true, "mintemail.com": true,
	"fakeinbox.com": true, "mohmal.com": true, "emailondeck.com": true, "mytemp.email": true,
	"spambox.us": true, "spamgourmet.com": true, "mailcatch.com": true, "tmpmail.org": true,
	"tmpmail.net": true, "burnermail.io": true, "discard.email": true, "moakt.com": true,
	"inboxkitten.com": true, "emailfake.com": true, "fakemail.net": true, "33mail.com": true,
}

// New Gmail usernames are 6-30 characters: letters, digits and dots, not
// starting or ending with a dot. ("+tag" aliases are removed before the check.)
var gmailLocal = regexp.MustCompile(`^[a-z0-9][a-z0-9.]{4,28}[a-z0-9]$`)

// emailProblem returns a message for the user when the address looks fake, or
// "" when it passes. lookup reports whether a domain can receive mail.
func emailProblem(ctx context.Context, email string, lookup func(context.Context, string) bool) string {
	at := strings.LastIndex(email, "@")
	if at < 1 {
		return "Please enter a valid email address"
	}
	local, domain := email[:at], email[at+1:]

	if disposableDomains[domain] {
		return "Please use your own permanent email address, not a temporary one"
	}
	if domain == "gmail.com" || domain == "googlemail.com" {
		base, _, _ := strings.Cut(local, "+")
		if !gmailLocal.MatchString(base) || strings.Contains(base, "..") {
			return "That doesn't look like a real Gmail address. Gmail names are 6 to 30 letters, numbers or dots"
		}
	}
	if !lookup(ctx, domain) {
		return fmt.Sprintf("We couldn't find a mail server for %q. Check the spelling of the email address", domain)
	}
	return ""
}

// domainHasMail checks DNS for a mail server (MX), falling back to an address
// record as email delivery does. If the lookup itself fails (no network, DNS
// timeout) it says "yes", so a DNS hiccup never blocks a real user.
func domainHasMail(ctx context.Context, domain string) bool {
	ctx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()
	r := &net.Resolver{}

	mx, err := r.LookupMX(ctx, domain)
	if err == nil {
		for _, m := range mx {
			if m.Host != "" && m.Host != "." { // "." is a "null MX": the domain accepts no mail
				return true
			}
		}
		return false
	}
	if !isNotFound(err) {
		return true
	}

	// No MX record: mail can still be delivered to the domain's own address.
	addrs, err := r.LookupHost(ctx, domain)
	if err == nil {
		return len(addrs) > 0
	}
	return !isNotFound(err)
}

func isNotFound(err error) bool {
	var dnsErr *net.DNSError
	return errors.As(err, &dnsErr) && dnsErr.IsNotFound
}

// emailProblem on the app: uses the real DNS check unless a test replaced it.
func (a *App) emailProblem(ctx context.Context, email string) string {
	lookup := a.domainCheck
	if lookup == nil {
		lookup = domainHasMail
	}
	return emailProblem(ctx, email, lookup)
}
