// ============================================================================
// The Old World League — email transport (Resend or Gmail SMTP)
// ----------------------------------------------------------------------------
// One place that knows how to send mail, so the notify + digest functions don't
// care which provider is wired up. It prefers Resend when RESEND_API_KEY is set
// — use that with a club domain and a verified sender for a proper "from"
// address (e.g. hello@yourclub.com) and better deliverability — and otherwise
// falls back to Gmail SMTP (nodemailer), exactly as before.
//
// Env (server-side, in Vercel):
//   Resend:  RESEND_API_KEY
//            MAIL_FROM="The Old World League <hello@yourclub.com>"  (its address
//            must be on a domain you've verified in Resend)
//   Gmail:   GMAIL_USER, GMAIL_APP_PASSWORD
//            MAIL_FROM optional — defaults to GMAIL_USER
//
// Files in /api whose names start with "_" are shared helpers, not routes.
// ============================================================================
import nodemailer from "nodemailer";

const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM; // "Name <addr>" or a bare address

// Is any transport wired up at all?
export function mailerConfigured() {
  return !!(RESEND_API_KEY || (GMAIL_USER && GMAIL_APP_PASSWORD));
}

// The bare sending address (no display name): MAIL_FROM's address, else GMAIL_USER.
// Used as the visible "to" on broadcasts (everyone else is BCC'd to hide addresses).
export function senderAddress() {
  if (MAIL_FROM) {
    const m = MAIL_FROM.match(/<([^>]+)>/);
    return (m ? m[1] : MAIL_FROM).trim();
  }
  return GMAIL_USER;
}

// A "from" header branded with the (editable) site name, e.g.
//   "The Old World League <hello@yourclub.com>"
export function fromHeader(siteName) {
  return `"${siteName}" <${senderAddress()}>`;
}

const arr = (v) => (Array.isArray(v) ? v : v ? [v] : []);

// Send one message. Prefers Resend; falls back to Gmail SMTP. Throws on failure
// so callers can decide how loud to be (notify swallows it; digest reports it).
export async function sendMail({ from, to, bcc, subject, text }) {
  if (RESEND_API_KEY) {
    const payload = { from, to: arr(to), subject, text };
    const b = arr(bcc);
    if (b.length) payload.bcc = b;
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${await r.text().catch(() => "")}`);
    return;
  }
  const transport = nodemailer.createTransport({ service: "gmail", auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD } });
  await transport.sendMail({ from, to, bcc, subject, text });
}
