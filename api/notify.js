// ============================================================================
// The Old World League — email notifications (instant alerts)
// ----------------------------------------------------------------------------
// A Vercel serverless function the app pings right after it writes to the DB:
//   type "availability" -> a member posted availability -> email all members
//   type "accepted"     -> someone took your game        -> email the poster
//   type "gathering"    -> admin published a gathering    -> email all members
//
// The browser can't read other members' emails (Supabase keeps them private),
// so this runs server-side with the service-role key. It NEVER trusts the
// client for content or recipients: it re-reads the record by id and derives
// everything itself, after verifying the caller's session.
//
// Transport lives in ./_mailer.js — Resend if RESEND_API_KEY is set, otherwise
// Gmail SMTP. Required env (set in Vercel, server-side):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   a transport: RESEND_API_KEY (+ MAIL_FROM) or GMAIL_USER + GMAIL_APP_PASSWORD
//   SITE_URL (optional, for links in the email)
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { mailerConfigured, fromHeader, senderAddress, sendMail } from "./_mailer.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || "";

const fmtDate = (d) => {
  if (!d) return "a date to be confirmed";
  try { return new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }); }
  catch { return d; }
};

async function emailMap(db) {
  const { data } = await db.auth.admin.listUsers({ perPage: 1000 });
  const m = {};
  for (const u of (data?.users || [])) m[u.id] = u.email;
  return m;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SUPABASE_URL || !SERVICE_ROLE || !mailerConfigured())
    return res.status(500).json({ error: "Email is not configured on the server." });

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not signed in." });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: userData, error: userErr } = await db.auth.getUser(token);
  const authUser = userData?.user;
  if (userErr || !authUser) return res.status(401).json({ error: "Invalid session." });

  const { data: me } = await db.from("profiles").select("id, display_name, is_admin").eq("id", authUser.id).single();
  const myName = me?.display_name || "A member";

  // site name is editable in the Admin tab; brand the emails with it
  const { data: nameRow } = await db.from("settings").select("value").eq("key", "site_name").maybeSingle();
  const SITE_NAME = (typeof nameRow?.value === "string" && nameRow.value.trim()) ? nameRow.value : "The Old World League";

  const from = fromHeader(SITE_NAME);
  const self = senderAddress();
  const footer = `\n\n— ${SITE_NAME}${SITE_URL ? "\n" + SITE_URL : ""}`;

  // email every member (honouring their opt-out), as BCC to protect addresses
  async function broadcast(prefKey, excludeId, subject, text) {
    const { data: profs } = await db.from("profiles").select("id, email_prefs");
    const emails = await emailMap(db);
    const to = [];
    for (const p of (profs || [])) {
      if (excludeId && p.id === excludeId) continue;
      if ((p.email_prefs || {})[prefKey] === false) continue;
      if (emails[p.id]) to.push(emails[p.id]);
    }
    if (to.length) await sendMail({ from, to: self, bcc: to, subject, text: text + footer });
    return to.length;
  }

  try {
    const type = body.type;

    if (type === "availability") {
      const { data: a } = await db.from("availability").select("*").eq("id", body.id).single();
      if (!a) return res.status(404).json({ error: "No such availability." });
      if (a.member !== myName) return res.status(403).json({ error: "Not your availability." });
      const sent = await broadcast(
        "broadcasts", authUser.id,
        `${a.member} is up for a game`,
        `${a.member} has posted availability for ${fmtDate(a.date)}.` +
          (a.note ? `\n\n“${a.note}”` : "") +
          `\n\nAnswer the call on the League site.`,
      );
      return res.status(200).json({ ok: true, sent });
    }

    if (type === "accepted") {
      const { data: a } = await db.from("availability").select("*").eq("id", body.id).single();
      if (!a) return res.status(404).json({ error: "No such availability." });
      if (!(a.takers || []).includes(myName)) return res.status(403).json({ error: "You have not accepted this." });
      const { data: poster } = await db.from("profiles").select("id").eq("display_name", a.member).maybeSingle();
      const emails = await emailMap(db);
      const to = poster ? emails[poster.id] : null;
      if (to) {
        await sendMail({
          from, to,
          subject: `${myName} answered your call to arms`,
          text: `${myName} has accepted your game for ${fmtDate(a.date)}.\n\nA fixture has been scheduled — see you across the table.` + footer,
        });
      }
      return res.status(200).json({ ok: true, sent: to ? 1 : 0 });
    }

    if (type === "challenge") {
      // A member threw down the gauntlet from another member's profile: the
      // app created the fixture, we email the challenged player. Recipient and
      // content are derived from the fixture row, never trusted from the client.
      const { data: f } = await db.from("fixtures").select("*").eq("id", body.id).single();
      if (!f) return res.status(404).json({ error: "No such fixture." });
      if (f.player_a !== myName && f.player_b !== myName) return res.status(403).json({ error: "Not your fixture." });
      const target = f.player_a === myName ? f.player_b : f.player_a;
      const { data: prof } = await db.from("profiles").select("id, email_prefs").eq("display_name", target).maybeSingle();
      const emails = await emailMap(db);
      const to = prof && (prof.email_prefs || {}).broadcasts !== false ? emails[prof.id] : null;
      if (to) {
        await sendMail({
          from, to,
          subject: `${myName} has thrown down the gauntlet`,
          text: `${myName} has challenged you to a battle on ${fmtDate(f.date)}.` +
            (f.points ? `\n${f.points} points.` : "") +
            (f.notes ? `\n\n“${f.notes}”` : "") +
            `\n\nThe fixture is on the slate — answer on the League site.` + footer,
        });
      }
      return res.status(200).json({ ok: true, sent: to ? 1 : 0 });
    }

    if (type === "gathering") {
      if (!me?.is_admin) return res.status(403).json({ error: "Admins only." });
      const { data: row } = await db.from("settings").select("value").eq("key", "next_social").maybeSingle();
      const s = row?.value || {};
      if (!(s.date || s.host || s.location)) return res.status(400).json({ error: "No gathering set." });
      const lines = [
        `A gathering has been called for ${fmtDate(s.date)}.`,
        s.host ? `Host: ${s.host}` : null,
        s.location ? `Where: ${s.location}` : null,
        s.note ? `\n${s.note}` : null,
      ].filter(Boolean).join("\n");
      const sent = await broadcast("broadcasts", authUser.id, `Next gathering — ${fmtDate(s.date)}`, lines);
      return res.status(200).json({ ok: true, sent });
    }

    return res.status(400).json({ error: "Unknown notification type." });
  } catch (e) {
    return res.status(500).json({ error: "Failed to send.", detail: String((e && e.message) || e) });
  }
}
