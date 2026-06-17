// ============================================================================
// The Old World League — weekly digest (Vercel Cron)
// ----------------------------------------------------------------------------
// Runs on a schedule (see vercel.json "crons"). Summarises the week's new
// photos and battles and emails everyone who hasn't opted out of the digest.
// If nothing happened that week, it sends nothing.
//
// Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" when CRON_SECRET is
// set, so we reject anything else. Transport lives in ./_mailer.js (Resend if
// RESEND_API_KEY is set, otherwise Gmail SMTP). Required env (server-side):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   a transport: RESEND_API_KEY (+ MAIL_FROM) or GMAIL_USER + GMAIL_APP_PASSWORD
//   CRON_SECRET (recommended), SITE_URL (optional)
// ============================================================================
import { createClient } from "@supabase/supabase-js";
import { mailerConfigured, fromHeader, senderAddress, sendMail } from "./_mailer.js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.SITE_URL || "";

export default async function handler(req, res) {
  if (CRON_SECRET) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: "Unauthorized" });
  }
  if (!SUPABASE_URL || !SERVICE_ROLE || !mailerConfigured())
    return res.status(500).json({ error: "Email is not configured on the server." });

  const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 7 * 86400000).toISOString();

  try {
    const [{ data: photos }, { data: reports }] = await Promise.all([
      db.from("photos").select("caption, uploader, created_at").gte("created_at", since).order("created_at", { ascending: false }),
      db.from("battle_reports").select("player_a, player_b, created_at").gte("created_at", since),
    ]);
    const nPhotos = (photos || []).length;
    const nReports = (reports || []).length;
    if (nPhotos === 0 && nReports === 0) return res.status(200).json({ ok: true, skipped: "nothing new this week" });

    const { data: nameRow } = await db.from("settings").select("value").eq("key", "site_name").maybeSingle();
    const SITE_NAME = (typeof nameRow?.value === "string" && nameRow.value.trim()) ? nameRow.value : "The Old World League";

    const parts = [`Here's what stirred at ${SITE_NAME} this week:`];
    if (nPhotos) {
      parts.push(
        `\n\n📸 ${nPhotos} new photo${nPhotos > 1 ? "s" : ""} in the gallery` +
          photos.slice(0, 6).map((p) => `\n  • ${p.caption || "Untitled"}${p.uploader ? " — " + p.uploader : ""}`).join(""),
      );
    }
    if (nReports) parts.push(`\n\n⚔️ ${nReports} battle${nReports > 1 ? "s" : ""} fought and filed.`);
    parts.push(`\n\nSee it all on the League site.`);
    const text = parts.join("") + `\n\n— ${SITE_NAME}${SITE_URL ? "\n" + SITE_URL : ""}`;

    const { data: profs } = await db.from("profiles").select("id, email_prefs");
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    const emailById = {};
    for (const u of (list?.users || [])) emailById[u.id] = u.email;
    const to = [];
    for (const p of (profs || [])) {
      if ((p.email_prefs || {}).digest === false) continue;
      if (emailById[p.id]) to.push(emailById[p.id]);
    }
    if (to.length === 0) return res.status(200).json({ ok: true, skipped: "no recipients" });

    await sendMail({ from: fromHeader(SITE_NAME), to: senderAddress(), bcc: to, subject: `${SITE_NAME} — this week`, text });
    return res.status(200).json({ ok: true, sent: to.length, photos: nPhotos, reports: nReports });
  } catch (e) {
    return res.status(500).json({ error: "Digest failed.", detail: String((e && e.message) || e) });
  }
}
