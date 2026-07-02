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
  pageId: r.page_id, scenario: r.scenario, round: r.round, created: ts(r.created_at),
});
const fromReport = (r) => ({
  id: r.id, playerA: r.player_a, playerB: r.player_b, armyA: r.army_a, armyB: r.army_b,
  date: r.date, points: r.points, winner: r.winner, score: r.score, moment: r.moment,
  shame: r.shame || [], filedBy: r.filed_by, margin: r.margin, ranked: r.ranked !== false,
  doubles: !!r.doubles, playerA2: r.player_a2 || "", playerB2: r.player_b2 || "",
  armyA2: r.army_a2 || "", armyB2: r.army_b2 || "",
  kind: r.kind || null, pageId: r.page_id, comments: r.comments || [],
  created: ts(r.created_at),
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
  votes: r.votes || [], comments: r.comments || [], storagePath: r.storage_path, created: ts(r.created_at),
});
const fromLaurel = (r) => ({
  id: r.id, competition: r.competition, winner: r.winner, year: r.year, note: r.note, created: ts(r.created_at),
});
const fromHonour = (r) => ({
  id: r.id, member: r.member, category: r.category, title: r.title,
  season: r.season, awardedBy: r.awarded_by, created: ts(r.created_at),
});
const fromAvailability = (r) => ({
  id: r.id, member: r.member, date: r.date, kind: r.kind, pageId: r.page_id,
  note: r.note, takers: r.takers || [], created: ts(r.created_at),
});
const fromCommittedList = (r) => ({
  id: r.id, pageId: r.page_id, player: r.player, member: r.member, points: r.points,
  body: r.body || "", committed: !!r.committed, committedAt: ts(r.committed_at),
  author: r.author, created: ts(r.created_at),
});
const fromPlaceholder = (r) => ({
  id: r.id, name: r.display_name, faction: r.faction, surname: r.surname || "",
  note: r.note || "", joined: r.joined, created: ts(r.created_at), isPlaceholder: true,
});

/* battle report UI shape -> DB row (shared by add and update) */
const reportRow = (r) => ({
  player_a: r.playerA, player_b: r.playerB, army_a: r.armyA, army_b: r.armyB,
  date: r.date || null, points: r.points, winner: r.winner,
  margin: r.winner === "draw" ? null : (r.margin || "victory"),
  ranked: r.ranked !== false, score: r.score,
  moment: r.moment, shame: r.shame || [],
  doubles: !!r.doubles, player_a2: (r.doubles && r.playerA2) ? r.playerA2 : null,
  player_b2: (r.doubles && r.playerB2) ? r.playerB2 : null,
  army_a2: (r.doubles && r.armyA2) ? r.armyA2 : null,
  army_b2: (r.doubles && r.armyB2) ? r.armyB2 : null,
  kind: r.kind || null, page_id: r.pageId || null,
});

const list = async (table, mapper) => {
  try {
    const { data, error } = await supabase.from(table).select("*").order("created_at", { ascending: true });
    if (error) { console.error("load " + table + " failed", error); return []; }
    return (data || []).map(mapper);
  } catch (e) { console.error("load " + table + " threw", e); return []; }
};

/* ---------- photo storage ---------- */
export const PHOTO_BUCKET = "photos";
export const photoUrl = (path) =>
  path ? supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl : null;

export const EMBLEM_BUCKET = "emblems";
export const emblemUrl = (path) =>
  path ? supabase.storage.from(EMBLEM_BUCKET).getPublicUrl(path).data.publicUrl : null;

export const AVATAR_BUCKET = "avatars";
export const avatarUrl = (path) =>
  path ? supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl : null;

function dataURLtoBlob(dataURL) {
  const [head, b64] = dataURL.split(",");
  const mime = (head.match(/:(.*?);/) || [])[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// File extension for an image mime type. Kept in sync with the stored blob so a
// transparent PNG isn't saved under a .jpg name (which would imply no alpha).
const extFor = (mime) =>
  mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";

export const db = {
  fixtures: {
    list: () => list("fixtures", fromFixture),
    add: (f) => supabase.from("fixtures").insert({
      player_a: f.playerA, player_b: f.playerB, date: f.date || null, points: f.points,
      notes: f.notes, kind: f.kind || "friendly", page_id: f.pageId || null, scenario: f.scenario || null,
      round: f.round ?? null,
    }).select().single(),
    update: (id, f) => supabase.from("fixtures").update({
      player_a: f.playerA, player_b: f.playerB, date: f.date || null, points: f.points,
      notes: f.notes, kind: f.kind || "friendly", page_id: f.pageId || null, scenario: f.scenario || null,
      round: f.round ?? null,
    }).eq("id", id),
    remove: (id) => supabase.from("fixtures").delete().eq("id", id),
  },
  reports: {
    list: () => list("battle_reports", fromReport),
    add: (r) => supabase.from("battle_reports").insert({
      ...reportRow(r), filed_by: r.filedBy,
    }),
    // Edit in place — same fields as add, but filed_by stays with the original filer.
    update: (id, r) => supabase.from("battle_reports").update(reportRow(r)).eq("id", id),
    setComments: (id, comments) => supabase.from("battle_reports").update({ comments }).eq("id", id),
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
      const path = kind + "/" + rid() + "." + extFor(blob.type);
      const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: blob.type });
      if (up.error) return up;
      return supabase.from("photos").insert({ caption, uploader, kind, storage_path: path, votes: [] });
    },
    setCaption: (id, caption) => supabase.from("photos").update({ caption }).eq("id", id),
    setVotes: (id, votes) => supabase.from("photos").update({ votes }).eq("id", id),
    setComments: (id, comments) => supabase.from("photos").update({ comments }).eq("id", id),
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
    }).select().single(),
    setTakers: (id, takers) => supabase.from("availability").update({ takers }).eq("id", id),
    remove: (id) => supabase.from("availability").delete().eq("id", id),
  },
  committedLists: {
    list: () => list("committed_lists", fromCommittedList),
    add: (c) => supabase.from("committed_lists").insert({
      page_id: c.pageId || null, player: c.player, member: c.member || null,
      points: c.points || null, body: c.body || "", author: c.author,
      committed: !!c.committed, committed_at: c.committed ? new Date().toISOString() : null,
    }).select().single(),
    update: (id, patch) => supabase.from("committed_lists").update(patch).eq("id", id),
    commit: (id) => supabase.from("committed_lists").update({
      committed: true, committed_at: new Date().toISOString(),
    }).eq("id", id),
    uncommit: (id) => supabase.from("committed_lists").update({
      committed: false, committed_at: null,
    }).eq("id", id),
    remove: (id) => supabase.from("committed_lists").delete().eq("id", id),
  },
  emblems: {
    list: () => list("army_emblems", (r) => ({ army: r.army, path: r.storage_path })),
    set: async (army, dataURL) => {
      const blob = dataURLtoBlob(dataURL);
      const slug = army.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const path = slug + "-" + Date.now() + "." + extFor(blob.type);
      const up = await supabase.storage.from(EMBLEM_BUCKET).upload(path, blob, { contentType: blob.type });
      if (up.error) return up;
      return supabase.from("army_emblems").upsert({ army, storage_path: path }, { onConflict: "army" });
    },
    remove: (army) => supabase.from("army_emblems").delete().eq("army", army),
  },
  laurels: {
    list: () => list("laurels", fromLaurel),
    add: (l) => supabase.from("laurels").insert({
      competition: l.competition, winner: l.winner, year: l.year || null, note: l.note || null,
    }),
    remove: (id) => supabase.from("laurels").delete().eq("id", id),
  },
  settings: {
    get: async () => {
      try {
        const { data, error } = await supabase.from("settings").select("*");
        if (error) { console.error("load settings failed", error); return {}; }
        const out = {};
        for (const r of data || []) out[r.key] = r.value;
        return out;
      } catch (e) { console.error("load settings threw", e); return {}; }
    },
    set: (key, value) => supabase.from("settings").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" }),
  },
  placeholders: {
    list: () => list("placeholder_members", fromPlaceholder),
    add: (p) => supabase.from("placeholder_members").insert({
      display_name: p.name, faction: p.faction || "The Empire",
      surname: p.surname || null, note: p.note || null,
    }).select().single(),
    update: (id, patch) => supabase.from("placeholder_members").update(patch).eq("id", id),
    remove: (id) => supabase.from("placeholder_members").delete().eq("id", id),
    // Tie a placeholder to a registered account; carries history over server-side.
    merge: (id, targetName) => supabase.rpc("merge_placeholder", { p_id: id, target_name: targetName }),
  },
  profiles: {
    update: (id, patch) => supabase.from("profiles").update(patch).eq("id", id),
    // Change a member's username, carrying ALL their history with it (battle
    // reports, votes, honours, availability…). Server-side RPC, gated to the
    // member themselves or an admin; see supabase/rename.sql.
    rename: (oldName, newName) => supabase.rpc("rename_member", { old_name: oldName, new_name: newName }),
    setAdmin: (id, isAdmin) => supabase.from("profiles").update({ is_admin: isAdmin }).eq("id", id),
    remove: (id) => supabase.rpc("admin_delete_member", { target: id }),
    setImage: async (id, field, dataURL) => {
      const blob = dataURLtoBlob(dataURL);
      const path = (field === "mascot_path" ? "mascot" : "avatar") + "/" + id + "-" + Date.now() + "." + extFor(blob.type);
      const up = await supabase.storage.from(AVATAR_BUCKET).upload(path, blob, { contentType: blob.type });
      if (up.error) return up;
      return supabase.from("profiles").update({ [field]: path }).eq("id", id);
    },
  },
};
