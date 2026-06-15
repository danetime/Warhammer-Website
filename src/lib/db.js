import { supabase } from "./supabaseClient";

/* ============================================================================
   Data layer — replaces the prototype's window.storage persistence.
   Each function maps the DB's snake_case columns to the camelCase shapes the
   UI components already expect, so the UI code does not change.
   ============================================================================ */

const ts = (s) => (s ? Date.parse(s) : 0);
const rid = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID)
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2);

/* ---------- row mappers: DB (snake_case) -> UI (camelCase) ---------- */
const fromFixture = (r) => ({
  id: r.id, playerA: r.player_a, playerB: r.player_b, date: r.date,
  points: r.points, notes: r.notes, kind: r.kind || "friendly",
  pageId: r.page_id, scenario: r.scenario, created: ts(r.created_at),
});
const fromReport = (r) => ({
  id: r.id, playerA: r.player_a, playerB: r.player_b, armyA: r.army_a, armyB: r.army_b,
  date: r.date, points: r.points, winner: r.winner, score: r.score, moment: r.moment,
  shame: r.shame || [], filedBy: r.filed_by, created: ts(r.created_at),
});
const fromQuote = (r) => ({
  id: r.id, text: r.text, saidBy: r.said_by, addedBy: r.added_by, created: ts(r.created_at),
});
const fromFaq = (r) => ({ id: r.id, q: r.question, a: r.answer, created: ts(r.created_at) });
const fromRule = (r) => ({
  id: r.id, title: r.title, body: r.body, link: r.link, pdfPath: r.pdf_path,
  addedBy: r.added_by, created: ts(r.created_at),
});
const fromPage = (r) => ({
  id: r.id, kind: r.kind, title: r.title, rows: r.rows || [], info: r.info || {},
  created: ts(r.created_at),
});
const fromProposal = (r) => ({
  id: r.id, title: r.title, detail: r.detail, proposedBy: r.proposed_by, status: r.status,
  votes: r.votes || {}, sealedAt: ts(r.sealed_at), sealedBy: r.sealed_by,
  struckAt: ts(r.struck_at), created: ts(r.created_at),
});
const fromChampion = (r) => ({
  id: r.id, member: r.member, season: r.season, awardedAt: ts(r.awarded_at),
  isCurrent: r.is_current, created: ts(r.created_at),
});
const fromPhoto = (r) => ({
  id: r.id, caption: r.caption, uploader: r.uploader, kind: r.kind,
  votes: r.votes || [], storagePath: r.storage_path, created: ts(r.created_at),
});
const fromHonour = (r) => ({
  id: r.id, member: r.member, category: r.category, title: r.title,
  season: r.season, awardedBy: r.awarded_by, created: ts(r.created_at),
});
const fromAvailability = (r) => ({
  id: r.id, member: r.member, date: r.date, kind: r.kind, pageId: r.page_id,
  note: r.note, takers: r.takers || [], created: ts(r.created_at),
});

const list = async (table, mapper) => {
  const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: true });
  if (error) { console.error("load " + table + " failed", error); return []; }
  return (data || []).map(mapper);
};

/* ---------- photo storage ---------- */
export const PHOTO_BUCKET = "photos";
export const photoUrl = (path) =>
  path ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl : null;

function dataURLtoBlob(dataURL) {
  const [head, b64] = dataURL.split(",");
  const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export const db = {
  fixtures: {
    list: () => list("fixtures", fromFixture),
    add: (f) => supabase.from("fixtures").insert({
      player_a: f.playerA, player_b: f.playerB, date: f.date || null, points: f.points,
      notes: f.notes, kind: f.kind || "friendly", page_id: f.pageId || null, scenario: f.scenario || null,
    }),
    remove: (id) => supabase.from("fixtures").delete().eq("id", id),
  },
  reports: {
    list: () => list("battle_reports", fromReport),
    add: (r) => supabase.from("battle_reports").insert({
      player_a: r.playerA, player_b: r.playerB, army_a: r.armyA, army_b: r.armyB,
      date: r.date || null, points: r.points, winner: r.winner, score: r.score,
      moment: r.moment, shame: r.shame || [], filed_by: r.filedBy,
    }),
    remove: (id) => supabase.from("battle_reports").delete().eq("id", id),
  },
  quotes: {
    list: () => list("quotes", fromQuote),
    add: (q) => supabase.from("quotes").insert({ text: q.text, said_by: q.saidBy, added_by: q.addedBy }),
    remove: (id) => supabase.from("quotes").delete().eq("id", id),
  },
  faqs: {
    list: () => list("faqs", fromFaq),
    add: (f) => supabase.from("faqs").insert({ question: f.q, answer: f.a }),
    remove: (id) => supabase.from("faqs").delete().eq("id", id),
  },
  rules: {
    list: () => list("library_entries", fromRule),
    add: (r) => supabase.from("library_entries").insert({ title: r.title, body: r.body, link: r.link }),
    remove: (id) => supabase.from("library_entries").delete().eq("id", id),
  },
  pages: {
    list: () => list("pages", fromPage),
    add: (p) => supabase.from("pages").insert({ kind: p.kind, title: p.title, rows: p.rows || [], info: p.info || {} }),
    update: (id, patch) => supabase.from("pages").update(patch).eq("id", id),
    remove: (id) => supabase.from("pages").delete().eq("id", id),
  },
  proposals: {
    list: () => list("proposals", fromProposal),
    add: (p) => supabase.from("proposals").insert({
      title: p.title, detail: p.detail, proposed_by: p.proposedBy, status: "open", votes: {},
    }),
    setVotes: (id, votes) => supabase.from("proposals").update({ votes }).eq("id", id),
    seal: (id, by) => supabase.from("proposals").update({
      status: "sealed", sealed_at: new Date().toISOString(), sealed_by: by,
    }).eq("id", id),
    strike: (id) => supabase.from("proposals").update({
      status: "struck", struck_at: new Date().toISOString(),
    }).eq("id", id),
    remove: (id) => supabase.from("proposals").delete().eq("id", id),
  },
  champions: {
    list: () => list("champions", fromChampion),
    add: (c) => supabase.from("champions").insert({ member: c.member, season: c.season, is_current: true }),
    retireAll: () => supabase.from("champions").update({ is_current: false }).eq("is_current", true),
    remove: (id) => supabase.from("champions").delete().eq("id", id),
  },
  photos: {
    list: () => list("photos", fromPhoto),
    add: async ({ dataURL, caption, uploader, kind }) => {
      const blob = dataURLtoBlob(dataURL);
      const path = kind + "/" + rid() + ".jpg";
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type });
      if (up.error) return up;
      return supabase.from("photos").insert({ caption, uploader, kind, storage_path: path, votes: [] });
    },
    setVotes: (id, votes) => supabase.from("photos").update({ votes }).eq("id", id),
    remove: async (photo) => {
      if (photo.storagePath) await supabase.storage.from(PHOTO_BUCKET).remove([photo.storagePath]);
      return supabase.from("photos").delete().eq("id", photo.id);
    },
  },
  honours: {
    list: () => list("honours", fromHonour),
    add: (h) => supabase.from("honours").insert({
      member: h.member, category: h.category, title: h.title,
      season: h.season || null, awarded_by: h.awardedBy,
    }),
    remove: (id) => supabase.from("honours").delete().eq("id", id),
  },
  availability: {
    list: () => list("availability", fromAvailability),
    add: (a) => supabase.from("availability").insert({
      member: a.member, date: a.date || null, kind: a.kind,
      page_id: a.pageId || null, note: a.note,
    }),
    setTakers: (id, takers) => supabase.from("availability").update({ takers }).eq("id", id),
    remove: (id) => supabase.from("availability").delete().eq("id", id),
  },
};
