import { supabase } from "./supabaseClient";

/* ----------------------------------------------------------------------------
   Best-effort client trigger for an email notification.

   Tells the /api/notify serverless function that something happened; the
   function decides recipients/content server-side. This NEVER throws and is
   fire-and-forget on purpose: sending an email must never block or break the
   underlying action (posting availability, accepting a game, etc.). In local
   `vite dev` there is no /api route, so the call simply no-ops.
   ---------------------------------------------------------------------------- */
export async function notify(type, payload = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ type, ...payload }),
    });
  } catch (e) {
    /* notifications are best-effort — ignore failures */
  }
}
