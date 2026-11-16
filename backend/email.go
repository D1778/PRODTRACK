package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// Mailer sends an email. Two implementations exist:
//   - brevoMailer: sends real email through Brevo's HTTPS API (works on hosts
//     that block SMTP, such as Render's free plan)
//   - logMailer: prints the email to the console (local development)
type Mailer interface {
	Send(ctx context.Context, to, subject, text, html string) error
}

// newMailer picks the real mailer when BREVO_API_KEY and MAIL_FROM are set.
func newMailer(cfg Config) Mailer {
	if cfg.BrevoAPIKey != "" && cfg.MailFrom != "" {
		log.Printf("Email: sending verification codes through Brevo from %s", cfg.MailFrom)
		return brevoMailer{apiKey: cfg.BrevoAPIKey, fromEmail: cfg.MailFrom, fromName: cfg.MailFromName, client: &http.Client{Timeout: 15 * time.Second}}
	}
	log.Println("WARNING: BREVO_API_KEY / MAIL_FROM not set. Verification emails are NOT sent; codes are printed here in the console instead.")
	return logMailer{}
}

type logMailer struct{}

func (logMailer) Send(_ context.Context, to, subject, text, _ string) error {
	log.Printf("EMAIL (not sent) to=%s subject=%q\n%s", to, subject, text)
	return nil
}

type brevoMailer struct {
	apiKey, fromEmail, fromName string
	client                      *http.Client
}

func (m brevoMailer) Send(ctx context.Context, to, subject, text, html string) error {
	payload, err := json.Marshal(map[string]any{
		"sender":      map[string]string{"name": m.fromName, "email": m.fromEmail},
		"to":          []map[string]string{{"email": to}},
		"subject":     subject,
		"textContent": text,
		"htmlContent": html,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.brevo.com/v3/smtp/email", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("api-key", m.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, err := m.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode/100 != 2 {
		body, _ := io.ReadAll(io.LimitReader(res.Body, 512))
		return fmt.Errorf("brevo returned %d: %s", res.StatusCode, body)
	}
	return nil
}

// verificationEmail builds the plain-text and HTML bodies for a code email.
func verificationEmail(name, code string) (subject, text, html string) {
	subject = "Your ProdTrack verification code"
	text = fmt.Sprintf("Hi %s,\n\nYour ProdTrack verification code is %s\n\nIt expires in %d minutes. If you didn't create a ProdTrack account, you can ignore this email.\n",
		name, code, int(codeTTL.Minutes()))
	html = fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
<h2 style="color:#4f46e5;margin:0 0 12px">ProdTrack</h2>
<p>Hi %s,</p>
<p>Your verification code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">%s</p>
<p style="color:#555">It expires in %d minutes. If you didn't create a ProdTrack account, you can ignore this email.</p>
</div>`, htmlEscape(name), code, int(codeTTL.Minutes()))
	return
}

// resetEmail builds the bodies for a password-reset code email.
func resetEmail(name, code string) (subject, text, html string) {
	subject = "Reset your ProdTrack password"
	text = fmt.Sprintf("Hi %s,\n\nYour ProdTrack password reset code is %s\n\nIt expires in %d minutes. If you didn't ask to reset your password, you can ignore this email: your password has not been changed.\n",
		name, code, int(codeTTL.Minutes()))
	html = fmt.Sprintf(`<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px">
<h2 style="color:#4f46e5;margin:0 0 12px">ProdTrack</h2>
<p>Hi %s,</p>
<p>Your password reset code is:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:8px;margin:16px 0">%s</p>
<p style="color:#555">It expires in %d minutes. If you didn't ask to reset your password, you can ignore this email: your password has not been changed.</p>
</div>`, htmlEscape(name), code, int(codeTTL.Minutes()))
	return
}

func htmlEscape(s string) string {
	r := bytes.NewBuffer(nil)
	for _, c := range s {
		switch c {
		case '&':
			r.WriteString("&amp;")
		case '<':
			r.WriteString("&lt;")
		case '>':
			r.WriteString("&gt;")
		case '"':
			r.WriteString("&quot;")
		default:
			r.WriteRune(c)
		}
	}
	return r.String()
}
