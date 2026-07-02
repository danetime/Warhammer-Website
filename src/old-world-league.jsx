import { useState, useEffect, useRef, useId, Component } from "react";
import { Routes, Route, useNavigate, useParams, Link } from "react-router-dom";
import {
  Swords, Trophy, Scroll, Camera, HelpCircle, Beer, Crown, Plus, Trash2,
  Pencil, LogOut, Upload, ThumbsUp, ThumbsDown, X, Shield, Skull, CalendarDays, Save,
  BookOpen, Link as LinkIcon, ChevronRight, ChevronDown, ChevronUp, Gavel, Award, Medal, Star, Utensils, ArrowLeft, Menu, Settings,
  Download, UserX, UserPlus, MessageSquare, RefreshCw
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";
import { db, photoUrl, emblemUrl, avatarUrl } from "./lib/db";
import { notify } from "./lib/notify";

/* ============================================================
   THE OLD WORLD LEAGUE — a private hub for a WHFB 7th ed group
   Auth + data live in Supabase (see lib/supabaseClient.js, lib/db.js).
   ============================================================ */

const FONT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Grenze+Gotisch:wght@500;700&family=Cinzel:wght@500;700;900&family=Alegreya:ital,wght@0,400;0,500;0,700;1,400;1,500&display=swap');
.f-black { font-family: 'Grenze Gotisch', 'Cinzel', serif; }
.f-disp { font-family: 'Cinzel', Georgia, serif; }
.f-body { font-family: 'Alegreya', Georgia, serif; }
.parchment {
  background-color: #fdf6e3;
  background-image: radial-gradient(rgba(120,84,32,0.05) 1px, transparent 1px);
  background-size: 14px 14px;
}
.rule-line { height:2px; background: linear-gradient(90deg, transparent, #92400e 20%, #7f1d1d 50%, #92400e 80%, transparent); }
input:focus, textarea:focus, select:focus, button:focus-visible { outline: 2px solid #b45309; outline-offset: 1px; }
.field { background-color: #fbf3df; background-image: radial-gradient(rgba(120,84,32,0.05) 1px, transparent 1px); background-size: 10px 10px; box-shadow: inset 0 1px 2px rgba(120,84,32,0.12); }
`;

/* ---------- id generator for nested JSONB rows (page rows, charter FAQs) ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

const today = () => new Date().toISOString().slice(0, 10);

/* App version — shown in the footer. Bump on each release. */
const VERSION = "1.3.0";

/* Changelog — newest first. Add an entry whenever you bump VERSION above.
   Shown in a pop-up when you click the version number in the footer. */
const CHANGELOG = [
  {
    version: "1.3.0",
    date: "2026-07-02",
    notes: [
      "Battle reports now carry their competition — pick Friendly / League / Cup when filing, and it's carried over automatically when a fixture is converted with “this game has been played”.",
      "League tables can tally themselves — the Grand Marshal's new “Tally from reports” button recounts a league's P/W/D/L straight from the reports filed against it. No more typing the numbers in by hand.",
      "Battle reports can be edited — the filer (or the Grand Marshal) can correct a report in place instead of striking and refiling it. The ladder recalculates itself.",
      "Doubles partners can record their own army, so 2v2 games count toward the right army records and ranks.",
      "A Doubles pairs table on the Battles tab — bragging rights for the best 2v2 pairing, without touching the main ladder.",
    ],
  },
  {
    version: "1.2.0",
    date: "2026-06-30",
    notes: [
      "Fixtures with no date set — tick “Date to be confirmed (TBC)” when you schedule a battle and it shows as TBC until you pin a day down.",
      "Turn a fixture into a result — click the crossed-swords on any scheduled battle (“this game has been played”) and the battle-report form opens pre-filled with the players, date and points. File it and the fixture is struck off automatically.",
      "Doubles (2v2) battles — tick “Doubles” on a battle report to add a partner to each side. The points, win/loss records and Might (ELO) are awarded to all four players exactly as a normal game.",
    ],
  },
  {
    version: "1.1.1",
    date: "2026-06-19",
    notes: [
      "Change your name — you can now rename yourself from your profile's Settings (the cog). Every battle, standing, vote and honour you've earned follows you to the new name, and your sign-in (email and watchword) stays exactly the same.",
      "The Grand Marshal can rename any member, either from their profile or straight from the Members roll in the Chambers.",
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-17",
    notes: [
      "Placeholder members — the Grand Marshal can enlist a player before they make an account, so their battles, Might and standings are tracked from the first game. They show on the muster roll marked “Unclaimed”. When the player signs up, the Grand Marshal links the placeholder to their account and the whole record carries over.",
      "The Grand Marshal can now edit a scheduled battle, not just add or strike it — fix a date, points or opponent without re-creating the fixture.",
      "Scheduled battles are grouped by league or cup first, then by round, so two leagues both on “Round 1” no longer pile under a single heading.",
      "Behind the banners: club emails can now be sent from the League's own address, and a new audit confirms every record is locked down before the gates open to the public.",
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-17",
    notes: [
      "Committed army lists — lock in the list you played so armies can't be tailored between rounds, sealed with a \"Committed\" wax stamp.",
      "Click any profile picture to enlarge it in a pop-up.",
      "Member surnames on profiles, styled to their army — e.g. \"Danetime of House Breach\" (Empire) or \"Danetime of Clan Breach\" (Skaven) — so a username ties to a real person. Set by the Grand Marshal.",
      "Rename uploaded photos after the fact, for the ones folk forget to name.",
      "Fixed transparent PNG emblems appearing on a black background when uploaded to the leagues.",
      "Battle-report name boxes fixed on mobile — the keyboard no longer hides after one letter, a member picker drops down as you type, and a name that isn't a registered member is now rejected so the ladder can't fragment on typos.",
      "Version number now shown in the footer — click it to open this changelog.",
    ],
  },
];

/* ---------- profiles (Supabase) -> the shape the UI expects ----------
   The DB stores snake_case; the UI expects { name, faction, isAdmin }. */
const mapProfile = (p) =>
  p ? { id: p.id, name: p.display_name, faction: p.faction, surname: p.surname || "", isAdmin: p.is_admin, joined: p.joined, avatarPath: p.avatar_path, mascotPath: p.mascot_path, emailPrefs: p.email_prefs || {} } : null;

async function loadProfiles() {
  try {
    const { data, error } = await supabase
      .from("profiles").select("*").order("joined", { ascending: true });
    if (error || !data) return {};
    const out = {};
    for (const p of data) out[p.id] = mapProfile(p);
    return out;
  } catch (e) { console.error("loadProfiles failed", e); return {}; }
}

async function fetchProfile(id) {
  if (!id) return null;
  try {
    const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
    return mapProfile(data);
  } catch (e) { console.error("fetchProfile failed", e); return null; }
}

/* Ensure a profile row exists for an authed user, as a fallback if the DB
   trigger hasn't created it yet (upsert ignores an existing row). The client
   only ever creates a NON-admin profile; the trigger assigns first-member
   admin. On a returning user with no profile, name/faction are recovered from
   sign-up metadata. */
async function ensureProfile(authUser, meta) {
  if (!authUser) return null;
  const existing = await fetchProfile(authUser.id);
  if (existing) return existing;
  const md = authUser.user_metadata || {};
  const display_name = (meta && meta.display_name) || md.display_name || (authUser.email ? authUser.email.split("@")[0] : "Soldier");
  const faction = (meta && meta.faction) || md.faction || "The Empire";
  await supabase.from("profiles").upsert(
    { id: authUser.id, display_name, faction, is_admin: false },
    { onConflict: "id", ignoreDuplicates: true }
  );
  return await fetchProfile(authUser.id);
}

/* ---------- armies of the Old World + their table colours ---------- */
const ARMIES = ["The Empire","Bretonnia","Dwarfs","High Elves","Dark Elves","Wood Elves",
  "Orcs & Goblins","Skaven","Vampire Counts","Tomb Kings","Warriors of Chaos","Daemons of Chaos",
  "Beastmen","Lizardmen","Ogre Kingdoms","Chaos Dwarfs","Dogs of War"];

/* A member's surname gets a faction "twist" on their profile: "Breach" becomes
   "House Breach" for the Empire, "Clan Breach" for Skaven, and so on. % is the
   surname; unknown factions fall back to "House %". */
const FACTION_HOUSE = {
  "The Empire": "House %",
  "Bretonnia": "House %",
  "Dwarfs": "Clan %",
  "High Elves": "House %",
  "Dark Elves": "House %",
  "Wood Elves": "the % Kindred",
  "Orcs & Goblins": "the % Tribe",
  "Skaven": "Clan %",
  "Vampire Counts": "the % Bloodline",
  "Tomb Kings": "the % Dynasty",
  "Warriors of Chaos": "the % Warband",
  "Daemons of Chaos": "the % Legion",
  "Beastmen": "the % Bray-Herd",
  "Lizardmen": "the % Spawning",
  "Ogre Kingdoms": "the % Tribe",
  "Chaos Dwarfs": "Clan %",
  "Dogs of War": "the % Company",
};
const houseName = (faction, surname) => {
  const s = (surname || "").trim();
  if (!s) return "";
  return (FACTION_HOUSE[faction] || "House %").replace("%", s);
};

const ARMY_STYLE = {
  "The Empire": "border-red-700 bg-red-50",
  "Bretonnia": "border-blue-700 bg-blue-50",
  "Dwarfs": "border-orange-700 bg-orange-50",
  "High Elves": "border-sky-500 bg-sky-50",
  "Dark Elves": "border-purple-700 bg-purple-50",
  "Wood Elves": "border-green-600 bg-green-50",
  "Orcs & Goblins": "border-lime-600 bg-lime-50",
  "Skaven": "border-stone-600 bg-stone-100",
  "Vampire Counts": "border-rose-900 bg-rose-50",
  "Tomb Kings": "border-yellow-500 bg-yellow-50",
  "Warriors of Chaos": "border-slate-700 bg-slate-100",
  "Daemons of Chaos": "border-fuchsia-700 bg-fuchsia-50",
  "Beastmen": "border-amber-900 bg-orange-50",
  "Lizardmen": "border-teal-600 bg-teal-50",
  "Ogre Kingdoms": "border-stone-500 bg-stone-50",
  "Chaos Dwarfs": "border-red-950 bg-stone-100",
  "Dogs of War": "border-indigo-600 bg-indigo-50",
};
const armyStyle = (a) => ARMY_STYLE[a] || "border-stone-300 bg-transparent";

/* default emblem emoji per army (admins can upload custom art to override) */
const ARMY_EMOJI = {
  "The Empire": "🛡️", "Bretonnia": "🐎", "Dwarfs": "🏰", "High Elves": "☀️",
  "Dark Elves": "🗡️", "Wood Elves": "🌳", "Orcs & Goblins": "👹", "Skaven": "🐀",
  "Vampire Counts": "🧛", "Tomb Kings": "💀", "Warriors of Chaos": "😈",
  "Daemons of Chaos": "👿", "Beastmen": "🐐", "Lizardmen": "🦎",
  "Ogre Kingdoms": "🍖", "Chaos Dwarfs": "🌋", "Dogs of War": "💰",
};
function ArmyEmblem({ army, emblems, size = 16 }) {
  if (!army) return null;
  const e = (emblems || []).find((x) => x.army === army);
  if (e) return <img src={emblemUrl(e.path)} alt="" style={{ width: size, height: size }} className="inline-block shrink-0 rounded-sm object-cover" />;
  const em = ARMY_EMOJI[army];
  if (em) return <span className="leading-none" style={{ fontSize: size - 1 }}>{em}</span>;
  return null;
}

/* ---------- rank ladders: games played -> army-themed title ----------
   Tier thresholds are shared across all armies so progression is fair. */
const RANK_THRESHOLDS = [0, 1, 3, 6, 10, 15, 22, 30, 42, 55];
const RANK_TITLES = {
  "The Empire": ["Stableboy","Camp Follower","Levy Spearman","Freeguild Recruit","Halberdier","Sergeant-at-Arms","Captain of the Watch","Knight of the Realm","Court Champion","Lord-General of the Empire"],
  "Dwarfs": ["Beardling","Miner","Quarreller","Ironbreaker","Longbeard","Hammerer","Thane","Runesmith","Dragon Slayer","King under the Mountain"],
  "Skaven": ["Skavenslave","Clanrat","Stormvermin","Packmaster","Warplock Jezzail","Plague Monk","Warlock Engineer","Chieftain","Grey Seer","Warlord of the Under-Empire"],
  "Orcs & Goblins": ["Snotling","Night Goblin","Goblin Boss","Orc Boy","'Ardboy","Big 'Un","Bigboss","Black Orc","Warboss","Da Big Boss of da Waaagh!"],
  "High Elves": ["Citizen","Lothern Spearman","Sea Guard","Silver Helm","White Lion","Sword Master of Hoeth","Noble","Mage of Saphery","Prince of Ulthuan","Phoenix King's Chosen"],
  "Dark Elves": ["Slave","Dreadspear","Darkshard","Corsair","Witch Elf","Cold One Knight","Assassin","Sorceress","Dreadlord","Hag Queen of Khaine"],
  "Wood Elves": ["Sapling","Glade Guard","Scout","Eternal Guard","Wardancer","Waywatcher","Glade Rider","Spellsinger","Glade Lord","Highborn of the Wild Hunt"],
  "Bretonnia": ["Peasant","Men-at-Arms","Bowman","Squire","Knight Errant","Knight of the Realm","Questing Knight","Grail Knight","Paladin","Grail-blessed Lord"],
  "Vampire Counts": ["Fresh Corpse","Skeleton","Zombie Dragon Fodder","Ghoul","Grave Guard","Wight","Necromancer","Wight King","Vampire Thrall","Vampire Lord"],
  "Tomb Kings": ["Tomb Dust","Skeleton Warrior","Tomb Guard","Necropolis Knight","Tomb Herald","Liche Acolyte","Liche Priest","Necrotect","Tomb Prince","Tomb King Awakened"],
  "Warriors of Chaos": ["Marauder","Chaos Warrior","Chosen","Aspiring Champion","Exalted Hero","Chaos Sorcerer","Chaos Lord","Favoured of the Gods","Daemon Prince Ascendant","Everchosen"],
  "Daemons of Chaos": ["Lesser Daemon","Nurgling","Bloodletter","Horror of Tzeentch","Daemonette","Flamer","Herald","Soul Grinder","Greater Daemon","Avatar of the Dark Gods"],
  "Beastmen": ["Chaos Spawnling","Ungor","Gor","Bestigor","Centigor","Bray-Shaman","Wargor","Great Bray-Shaman","Beastlord","Doombull of the Herd"],
  "Lizardmen": ["Skink Spawnling","Skink","Saurus Warrior","Temple Guard","Kroxigor","Skink Priest","Saurus Veteran","Scar-Veteran","Saurus Oldblood","Slann Mage-Priest"],
  "Ogre Kingdoms": ["Gnoblar","Ogre Bull","Ironguts","Leadbelcher","Maneater","Gorger","Hunter","Butcher","Bruiser","Tyrant of the Mountains"],
  "Chaos Dwarfs": ["Hobgoblin Slave","Chaos Dwarf Warrior","Blunderbuss","Ironsworn","Bull Centaur","Daemonsmith","Infernal Guard","Hellsmith","Sorcerer-Prophet","Lord of Zharr-Naggrund"],
  "Dogs of War": ["Camp Cook","Free Lance","Pikeman","Crossbowman","Duellist","Paymaster's Guard","Sergeant","Captain","Mercenary General","Merchant Prince of Tilea"],
};

/* games played per member name, counted from battle reports */
function gamesPlayedMap(reports) {
  const m = {};
  const bump = (n) => { if (n) m[n] = (m[n] || 0) + 1; };
  for (const r of reports) {
    const names = [];
    for (const n of [r.playerA, r.doubles ? r.playerA2 : null, r.playerB, r.doubles ? r.playerB2 : null]) {
      const t = (n || "").trim();
      if (t && !names.includes(t)) names.push(t);
    }
    names.forEach(bump);
  }
  return m;
}

/* given an army + games played, return current rank + progress to next */
function rankFor(army, games) {
  const ladder = RANK_TITLES[army] || RANK_TITLES["The Empire"];
  let tier = 0;
  for (let i = 0; i < RANK_THRESHOLDS.length; i++) {
    if (games >= RANK_THRESHOLDS[i]) tier = i;
  }
  const isMax = tier >= RANK_THRESHOLDS.length - 1;
  const nextAt = isMax ? null : RANK_THRESHOLDS[tier + 1];
  return {
    tier: tier + 1,
    title: ladder[tier],
    games,
    nextAt,
    toNext: isMax ? 0 : nextAt - games,
    isMax,
  };
}

/* games played per member, split by the army they fielded, from ALL reports
   (casual games count toward rank too). A game with no army recorded is
   attributed to that player's set army, so a member's tally never drops when
   ranks become per-army. Returns { name: { army: count } }. */
function gamesByArmyMap(reports, users) {
  const factionOf = {};
  for (const u of Object.values(users || {})) {
    const n = ((u && u.name) || "").trim();
    if (n) factionOf[n] = u.faction;
  }
  const m = {};
  const bump = (name, army) => {
    const n = (name || "").trim();
    if (!n) return;
    const a = (army && army.trim()) ? army.trim() : factionOf[n];
    if (!a) return;
    if (!m[n]) m[n] = {};
    m[n][a] = (m[n][a] || 0) + 1;
  };
  for (const r of reports) {
    const a = (r.playerA || "").trim(), b = (r.playerB || "").trim();
    bump(a, r.armyA);
    if (b && b !== a) bump(b, r.armyB);
    // Doubles partners count with the army they fielded (army_a2/army_b2);
    // if unrecorded, bump() falls back to their profile faction.
    if (r.doubles) {
      const a2 = (r.playerA2 || "").trim(), b2 = (r.playerB2 || "").trim();
      if (a2 && a2 !== a) bump(a2, r.armyA2);
      if (b2 && b2 !== b && b2 !== a2) bump(b2, r.armyB2);
    }
  }
  return m;
}

/* a member's headline rank: their set army if they've fielded it at all,
   otherwise their most-experienced (most-played) army. Adds .army to the
   rankFor() result so callers know which ladder it came from. */
function headlineRankFor(member, byArmy) {
  const armies = byArmy || {};
  const set = member && member.faction;
  let army = (set && armies[set] > 0) ? set : null;
  if (!army) {
    let best = 0;
    for (const [a, n] of Object.entries(armies)) if (n > best) { best = n; army = a; }
  }
  if (!army) army = set || "The Empire";
  return { army, ...rankFor(army, armies[army] || 0) };
}

const fmtDate = (d) => {
  if (!d) return "TBC";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch (e) { return d; }
};

/* relative day label for upcoming availability ("today", "this Sunday", …) */
function relDay(d) {
  if (!d) return "TBC";
  try {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const dt = new Date(d + "T12:00:00");
    const diff = Math.round((dt - t) / 86400000);
    if (diff === 0) return "today";
    if (diff === 1) return "tomorrow";
    if (diff > 1 && diff < 7) return "this " + dt.toLocaleDateString("en-GB", { weekday: "long" });
    if (diff >= 7 && diff < 14) return "next " + dt.toLocaleDateString("en-GB", { weekday: "long" });
    return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  } catch (e) { return d; }
}

/* competition label for fixtures / availability (Friendly / League: <title> / …) */
const KIND_LABEL = { friendly: "Friendly", league: "League", cup: "Cup" };
function competitionLabel(pages, item) {
  const base = KIND_LABEL[item.kind] || "Friendly";
  if (item.pageId) {
    const pg = (pages || []).find((p) => p.id === item.pageId);
    if (pg) return base + ": " + pg.title;
  }
  return base;
}

/* resolve a fixture's player to its league label + linked member (live), so a
   fixture shows the short league name and links to the right profile whether it
   was stored under the label or the username. */
function fixtureSide(pages, memberNames, f, side) {
  const raw = f[side] || "";
  const lower = raw.toLowerCase();
  const matched = (memberNames || []).find((n) => n.toLowerCase() === lower) || null;
  if (f.pageId) {
    const pg = (pages || []).find((p) => p.id === f.pageId);
    const row = pg && (pg.rows || []).find((r) =>
      (r.player || "").toLowerCase() === lower || (r.member || "").toLowerCase() === lower);
    if (row) {
      const member = row.member || (memberNames || []).find((n) => n.toLowerCase() === (row.player || "").toLowerCase()) || null;
      return { label: row.player || raw, member };
    }
  }
  return { label: raw, member: matched };
}
function FxSide({ f, side, pages, memberNames, navigate }) {
  const s = fixtureSide(pages, memberNames, f, side);
  return s.member
    ? <button onClick={() => navigate("/member/" + encodeURIComponent(s.member))} className="hover:text-red-900 hover:underline">{s.label || "—"}</button>
    : <span>{s.label}</span>;
}

/* ---------- ELO + records from battle reports ---------- */
const MARGIN_MULT = { marginal: 0.75, victory: 1, defiant: 1.25 };
const MARGIN_LABEL = { marginal: "Marginal victory", victory: "Victory", defiant: "Defiant victory" };

/* The players on each side of a report. A doubles (2v2) game has a partner in
   playerA2 / playerB2; a normal game leaves them empty. Returns trimmed,
   de-duplicated names so the same person can't be scored twice in one game. */
function reportTeams(r) {
  const clean = (...names) => {
    const out = [];
    for (const n of names) {
      const t = (n || "").trim();
      if (t && !out.includes(t)) out.push(t);
    }
    return out;
  };
  return {
    A: clean(r.playerA, r.doubles ? r.playerA2 : null),
    B: clean(r.playerB, r.doubles ? r.playerB2 : null),
  };
}

/* Which side a member played on in a report ("A" / "B"), or null. Considers
   doubles partners, so a partner is credited everywhere a primary player is. */
function reportSide(r, who) {
  const { A, B } = reportTeams(r);
  if (A.includes(who)) return "A";
  if (B.includes(who)) return "B";
  return null;
}

/* The army a named player fielded in a report, whichever of the four slots
   they occupied. "" if unrecorded (callers fall back to profile faction). */
function playerArmyIn(r, who) {
  const eq = (n) => (n || "").trim() === who;
  if (eq(r.playerA)) return r.armyA || "";
  if (eq(r.playerB)) return r.armyB || "";
  if (r.doubles && eq(r.playerA2)) return r.armyA2 || "";
  if (r.doubles && eq(r.playerB2)) return r.armyB2 || "";
  return "";
}

/* Pair records from ranked doubles games — the 2v2 bragging-rights table.
   A pair is the two names on a side, order-independent. */
function doublesLadder(reports) {
  const pairs = {};
  for (const r of reports) {
    if (!r.doubles || r.ranked === false) continue;
    const { A, B } = reportTeams(r);
    if (A.length !== 2 || B.length !== 2 || A.some((n) => B.includes(n))) continue;
    const rec = (t) => {
      const k = [...t].sort().join(" & ");
      return pairs[k] || (pairs[k] = { pair: k, p: 0, w: 0, d: 0, l: 0 });
    };
    const ra = rec(A), rb = rec(B);
    ra.p++; rb.p++;
    if (r.winner === "A") { ra.w++; rb.l++; }
    else if (r.winner === "B") { rb.w++; ra.l++; }
    else { ra.d++; rb.d++; }
  }
  return Object.values(pairs).sort((a, b) => b.w - a.w || b.p - a.p || a.l - b.l);
}

function computeStandings(reports) {
  const elo = {}, rec = {};
  const ensure = (p) => {
    if (!elo[p]) elo[p] = 1200;
    if (!rec[p]) rec[p] = { p: 0, w: 0, d: 0, l: 0, pts: 0 };
  };
  const sorted = [...reports].sort(
    (a, b) => (a.date || "").localeCompare(b.date || "") || (a.created || 0) - (b.created || 0)
  );
  for (const r of sorted) {
    if (r.ranked === false) continue;
    const { A: teamA, B: teamB } = reportTeams(r);
    // Skip if a side is empty or the two sides share a player (a misfiled game).
    if (!teamA.length || !teamB.length) continue;
    if (teamA.some((n) => teamB.includes(n))) continue;
    [...teamA, ...teamB].forEach(ensure);
    // Team rating is the average Might of its players, so a 2v2 swings each
    // member's Might exactly as a 1v1 would (for a singles game this reduces to
    // the player's own rating, leaving the maths identical to before).
    const avg = (t) => t.reduce((s, p) => s + elo[p], 0) / t.length;
    const ra = avg(teamA), rb = avg(teamB);
    const sa = r.winner === "A" ? 1 : r.winner === "B" ? 0 : 0.5;
    const K = 32 * (r.winner === "draw" ? 1 : (MARGIN_MULT[r.margin] || 1));
    for (const p of teamA) {
      const ea = 1 / (1 + Math.pow(10, (rb - elo[p]) / 400));
      elo[p] = Math.round(elo[p] + K * (sa - ea));
    }
    for (const p of teamB) {
      const eb = 1 / (1 + Math.pow(10, (ra - elo[p]) / 400));
      elo[p] = Math.round(elo[p] + K * ((1 - sa) - eb));
    }
    for (const p of teamA) {
      rec[p].p++;
      if (r.winner === "A") { rec[p].w++; rec[p].pts += 3; }
      else if (r.winner === "B") { rec[p].l++; }
      else { rec[p].d++; rec[p].pts++; }
    }
    for (const p of teamB) {
      rec[p].p++;
      if (r.winner === "B") { rec[p].w++; rec[p].pts += 3; }
      else if (r.winner === "A") { rec[p].l++; }
      else { rec[p].d++; rec[p].pts++; }
    }
  }
  const ladder = Object.keys(elo)
    .map((name) => ({ name, elo: elo[name], ...rec[name] }))
    .sort((a, b) => b.elo - a.elo || b.pts - a.pts);
  return ladder;
}

function shameBoard(reports) {
  const totals = {};
  let worst = null;
  for (const r of reports) {
    for (const s of r.shame || []) {
      const n = parseInt(s.ones, 10) || 0;
      if (!s.player || n <= 0) continue;
      totals[s.player] = (totals[s.player] || 0) + n;
      if (!worst || n > worst.ones) worst = { ...s, ones: n, date: r.date };
    }
  }
  const list = Object.keys(totals)
    .map((p) => ({ player: p, ones: totals[p] }))
    .sort((a, b) => b.ones - a.ones);
  return { list, worst };
}

/* ---------- image compression for the gallery / emblems / avatars ----------
   JPEG has no alpha channel, so encoding a transparent image (e.g. a PNG emblem)
   as JPEG turns the see-through areas BLACK. We avoid that by writing PNG
   whenever the image actually has transparent pixels — or whenever the caller
   asks for it (format: "png", used for army emblems). Opaque photos still go to
   JPEG so the gallery stays light. */
function imageHasAlpha(ctx, w, h) {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  } catch (e) { /* tainted canvas — treat as opaque */ }
  return false;
}
function compressImage(file, maxDim = 900, quality = 0.72, { format = "auto" } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not a valid image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * scale));
        c.height = Math.max(1, Math.round(img.height * scale));
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        let usePng = format === "png";
        if (format === "auto") {
          const alphaCapable = /image\/(png|webp|gif|svg)/i.test(file.type || "");
          usePng = alphaCapable && imageHasAlpha(ctx, c.width, c.height);
        }
        resolve(usePng ? c.toDataURL("image/png") : c.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- small UI primitives ---------- */
const B = ({ children, onClick, kind = "primary", small, disabled, title }) => {
  const base = "f-disp inline-flex items-center gap-1.5 rounded-sm border transition-colors disabled:opacity-40 ";
  const size = small ? "px-2.5 py-1 text-xs " : "px-4 py-2 text-sm ";
  const kinds = {
    primary: "bg-red-900 border-red-950 text-amber-50 hover:bg-red-800",
    gold: "bg-amber-600 border-amber-700 text-stone-900 hover:bg-amber-500",
    ghost: "bg-transparent border-stone-400 text-stone-700 hover:bg-stone-200",
    danger: "bg-stone-800 border-stone-900 text-red-200 hover:bg-stone-700",
  };
  return (
    <button title={title} disabled={disabled} onClick={onClick} className={base + size + kinds[kind]}>
      {children}
    </button>
  );
};

const Inp = (props) => (
  <input
    {...props}
    className={"f-body field w-full rounded-sm border border-amber-800/40 px-3 py-2 text-sm text-stone-900 placeholder-stone-500 " + (props.className || "")}
  />
);
const TA = (props) => (
  <textarea
    {...props}
    className={"f-body field w-full rounded-sm border border-amber-800/40 px-3 py-2 text-sm text-stone-900 placeholder-stone-500 " + (props.className || "")}
  />
);
const Sel = ({ children, ...props }) => (
  <select {...props} className="f-body field w-full rounded-sm border border-amber-800/40 px-2 py-2 text-sm text-stone-900">
    {children}
  </select>
);

const Card = ({ children, className = "" }) => (
  <div className={"rounded-sm border border-stone-300 bg-white/70 shadow-sm " + className}>{children}</div>
);

const H = ({ icon: Icon, children, right }) => (
  <div className="mb-3 mt-8 first:mt-0">
    <div className="flex items-end justify-between gap-2">
      <h2 className="f-disp flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-red-950">
        {Icon && <Icon size={18} className="text-amber-700" />} {children}
      </h2>
      {right}
    </div>
    <div className="rule-line mt-1" />
  </div>
);

const Empty = ({ children }) => (
  <p className="f-body py-6 text-center text-sm italic text-stone-500">{children}</p>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-stone-900/70 p-4">
    <div className="parchment mt-8 w-full max-w-lg rounded-sm border-2 border-amber-800 shadow-2xl">
      <div className="flex items-center justify-between border-b border-stone-300 px-4 py-3">
        <h3 className="f-disp text-base font-bold uppercase tracking-wide text-red-950">{title}</h3>
        <button onClick={onClose} className="text-stone-500 hover:text-stone-900"><X size={18} /></button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);

/* ---------- changelog (opened by clicking the version number in the footer) ---------- */
const ChangelogModal = ({ onClose }) => (
  <Modal title="Changelog" onClose={onClose}>
    <div className="space-y-5">
      {CHANGELOG.map((rel) => (
        <div key={rel.version}>
          <div className="flex items-baseline justify-between border-b border-stone-300 pb-1">
            <h4 className="f-disp text-sm font-bold uppercase tracking-wide text-red-950">v{rel.version}</h4>
            <span className="text-[11px] italic text-stone-500">{fmtDate(rel.date)}</span>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-stone-700">
            {rel.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      ))}
    </div>
  </Modal>
);

/* ---------- site footer (with the running version number) ---------- */
const SiteFooter = () => {
  const [showLog, setShowLog] = useState(false);
  return (
    <footer className="border-t border-stone-300 py-4 text-center">
      <p className="f-disp text-[10px] uppercase tracking-widest text-stone-400">
        Sigmar protects · No Age of Sigmar beyond this point
      </p>
      <button onClick={() => setShowLog(true)} title="View changelog"
        className="f-disp mt-1 text-[10px] uppercase tracking-widest text-stone-400/80 transition-colors hover:text-amber-700 hover:underline">
        v{VERSION}
      </button>
      {showLog && <ChangelogModal onClose={() => setShowLog(false)} />}
    </footer>
  );
};

/* ---------- click-to-enlarge image overlay (profile pictures) ---------- */
const ImagePopup = ({ src, alt, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 p-4" onClick={onClose}>
    <img src={src} alt={alt || ""} onClick={(e) => e.stopPropagation()}
      className="max-h-[85vh] max-w-[90vw] rounded-sm border-2 border-amber-700 object-contain shadow-2xl" />
    <button onClick={onClose} className="absolute right-4 top-4 text-stone-300 hover:text-amber-200" title="Close"><X size={26} /></button>
  </div>
);

/* ---------- wax seal stamped on a committed army list ----------
   Pure SVG (no image): a domed wax disc with an organic, turbulence-displaced
   blob edge, a vignette for depth, a double gold rim struck crisp on top, and
   "COMMITTED" curved around the rim via <textPath> with the shield in the
   middle. Tilted a touch so it reads as hand-stamped. */
const CommittedSeal = ({ size = 64 }) => {
  const uid = useId().replace(/[^a-z0-9]/gi, "");
  return (
    <div title="This army list is committed and sealed"
      className="relative inline-flex shrink-0 -rotate-6 items-center justify-center drop-shadow-md"
      style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} className="block">
        <defs>
          {/* domed wax body: highlight toward the upper-left, deepening to maroon at the rim */}
          <radialGradient id={`wax${uid}`} cx="37%" cy="32%" r="75%">
            <stop offset="0%" stopColor="#c11f1f" />
            <stop offset="45%" stopColor="#991b1b" />
            <stop offset="80%" stopColor="#7f1d1d" />
            <stop offset="100%" stopColor="#490e0e" />
          </radialGradient>
          {/* soft sheen across the top-left for a waxy gloss */}
          <radialGradient id={`sheen${uid}`} cx="34%" cy="27%" r="45%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          {/* vignette: darken the rim so the wax looks pressed/domed */}
          <radialGradient id={`vig${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="#2a0606" stopOpacity="0" />
            <stop offset="100%" stopColor="#2a0606" stopOpacity="0.55" />
          </radialGradient>
          {/* organic wax-blob edge: wobble the disc outline with Perlin noise */}
          <filter id={`rough${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.022" numOctaves="2" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <path id={`top${uid}`} d="M 9,50 A 41,41 0 0,1 91,50" fill="none" />
          <path id={`bot${uid}`} d="M 9,50 A 41,41 0 0,0 91,50" fill="none" />
        </defs>

        {/* irregular wax blob (edge displaced by turbulence) */}
        <g filter={`url(#rough${uid})`}>
          <circle cx="50" cy="50" r="47" fill={`url(#wax${uid})`} stroke="#330909" strokeWidth="1.2" />
          <circle cx="50" cy="50" r="47" fill={`url(#vig${uid})`} />
        </g>
        {/* crisp struck detail on top of the wax */}
        <circle cx="50" cy="50" r="44.5" fill="none" stroke="#f1cd72" strokeWidth="1.6" opacity="0.95" />
        <circle cx="50" cy="50" r="29" fill="none" stroke="#f1cd72" strokeWidth="1" opacity="0.8" />
        <circle cx="50" cy="50" r="44.5" fill={`url(#sheen${uid})`} />

        <text className="f-disp" fill="#fce9bd" fontSize="14" fontWeight="700" letterSpacing="1" textAnchor="middle">
          <textPath href={`#bot${uid}`} startOffset="50%">COMMITTED</textPath>
        </text>
        <text className="f-disp" fill="#f1cd72" fontSize="11" letterSpacing="3" textAnchor="middle">
          <textPath href={`#top${uid}`} startOffset="50%">✦ ✦ ✦</textPath>
        </text>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Shield size={Math.round(size * 0.28)} className="text-amber-200"
          style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.4))" }} />
      </div>
    </div>
  );
};

/* ---------- honours / side-titles (admin-awarded) ---------- */
const HONOUR_META = {
  league: { label: "League Champion", Icon: Trophy },
  cup: { label: "Cup Winner", Icon: Medal },
  spoon: { label: "Wooden Spoon", Icon: Utensils },
  custom: { label: "Honour", Icon: Star },
};
const HonourBadges = ({ items, size = 12 }) =>
  !items || items.length === 0
    ? null
    : items.map((h) => {
        const Icon = (HONOUR_META[h.category] || HONOUR_META.custom).Icon;
        return <Icon key={h.id} size={size} className="shrink-0 text-amber-600" title={h.title + (h.season ? " — " + h.season : "")} />;
      });

/* ============================================================
   LOGIN GATE
   First soul to register becomes Grand Marshal (admin).
   ============================================================ */
function LoginGate({ users, siteName, onAuthed, refreshUsers }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [faction, setFaction] = useState("The Empire");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const firstUser = Object.keys(users || {}).length === 0;

  const submit = async () => {
    setErr("");
    const uname = name.trim();
    const mail = email.trim();
    if (!mail || !pw || (mode === "register" && !uname)) {
      setErr(mode === "register" ? "Name, email and watchword required, soldier." : "Email and watchword required, soldier.");
      return;
    }
    if (mode === "register" && pw !== pw2) { setErr("The watchwords do not match."); return; }
    setBusy(true);
    try {
      if (mode === "register") {
        const { data: dupe } = await supabase
          .from("profiles").select("id").ilike("display_name", uname).limit(1);
        if (dupe && dupe.length) { setErr("That name is already on the muster roll."); setBusy(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email: mail, password: pw,
          options: { data: { display_name: uname, faction } },
        });
        if (error) { setErr(error.message); setBusy(false); return; }
        if (!data.session) { setErr("Check your email to confirm your enlistment, then sign in."); setBusy(false); return; }
        const prof = await ensureProfile(data.user, { display_name: uname, faction });
        if (!prof) { setErr("Enlisted, but your muster-roll profile could not be created."); setBusy(false); return; }
        await refreshUsers();
        onAuthed(prof);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pw });
        if (error) { setErr("No such name, or the watchword is wrong."); setBusy(false); return; }
        const prof = await ensureProfile(data.user, null);
        if (!prof) { setErr("Signed in, but your profile could not be created."); setBusy(false); return; }
        await refreshUsers();
        onAuthed(prof);
      }
    } catch (e) {
      setErr("The muster faltered. Try again.");
    }
    setBusy(false);
  };

  return (
    <div className="parchment f-body flex min-h-screen items-center justify-center p-4">
      <style>{FONT_CSS}</style>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Shield size={40} className="mx-auto mb-2 text-red-900" />
          <h1 className="f-black text-5xl font-bold text-red-950">{siteName || "The Old World League"}</h1>
          <p className="f-disp mt-1 text-xs uppercase tracking-widest text-amber-800">
            Warhammer Fantasy · Seventh Edition · Members Only
          </p>
        </div>
        <Card className="p-5">
          <div className="mb-4 flex gap-2">
            <B small kind={mode === "login" ? "primary" : "ghost"} onClick={() => setMode("login")}>Sign in</B>
            <B small kind={mode === "register" ? "primary" : "ghost"} onClick={() => setMode("register")}>Enlist</B>
          </div>
          <div className="space-y-3">
            {mode === "register" && (
              <Inp placeholder="Your name (e.g. Danetime)" value={name} onChange={(e) => setName(e.target.value)} />
            )}
            <Inp type="email" placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Inp type="password" placeholder="Watchword (do NOT reuse a real password)" value={pw}
              onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            {mode === "register" && (
              <Inp type="password" placeholder="Confirm watchword" value={pw2}
                onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            )}
            {mode === "register" && (
              <Sel value={faction} onChange={(e) => setFaction(e.target.value)}>
                {ARMIES.map(f => <option key={f}>{f}</option>)}
              </Sel>
            )}
            {err && <p className="text-sm font-medium text-red-800">{err}</p>}
            <B onClick={submit} disabled={busy}>{busy ? "Mustering…" : mode === "login" ? "Enter the league" : "Take the oath"}</B>
            {mode === "register" && firstUser && (
              <p className="text-xs italic text-amber-800">First to enlist becomes Grand Marshal (admin).</p>
            )}
            <p className="text-xs italic text-stone-500">
              This is a clubhouse lock, not a bank vault. Use a throwaway watchword.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ============================================================
   ERROR BOUNDARY — show a message instead of a blank screen
   ============================================================ */
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Render error", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="parchment f-body flex min-h-screen items-center justify-center p-6 text-center">
          <style>{FONT_CSS}</style>
          <div className="max-w-lg">
            <p className="f-disp text-lg font-bold text-red-950">Something went awry on the battlefield.</p>
            <p className="mt-2 text-sm text-stone-600">Try reloading. If it persists, the details are in the browser console (F12).</p>
            <pre className="mt-3 max-h-48 overflow-auto rounded-sm border border-stone-300 bg-stone-100 p-2 text-left text-xs text-red-800">{String(this.state.error)}</pre>
            <button onClick={() => location.reload()} className="f-disp mt-3 rounded-sm border border-red-950 bg-red-900 px-4 py-2 text-sm text-amber-50 hover:bg-red-800">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ============================================================
   APP SHELL
   ============================================================ */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState({});
  const [fixtures, setFixtures] = useState([]);
  const [reports, setReports] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [faq, setFaq] = useState([]);
  const [rules, setRules] = useState([]);
  const [pages, setPages] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [champions, setChampions] = useState([]);
  const [photosIdx, setPhotosIdx] = useState([]);
  const [honours, setHonours] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [emblems, setEmblems] = useState([]);
  const [laurels, setLaurels] = useState([]);
  const [committedLists, setCommittedLists] = useState([]);
  const [placeholders, setPlaceholders] = useState([]);
  const [settings, setSettings] = useState({});

  const siteName = (typeof settings.site_name === "string" && settings.site_name.trim()) ? settings.site_name : "The Old World League";
  const siteTagline = (typeof settings.site_tagline === "string" && settings.site_tagline.trim()) ? settings.site_tagline : "WHFB 7th Edition · By decree of the Grand Marshal";

  const refreshUsers = async () => {
    const us = await loadProfiles();
    setUsers(us);
    return us;
  };
  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) setUser(await fetchProfile(session.user.id));
  };

  // Pull every collection in one go. Run at boot, and again whenever the
  // signed-in member changes (see effect below).
  const loadAll = async () => {
    try {
      const [us, fx, rp, qt, fq, rl, pg, px, pr, ch, hn, av, em, lr, cl, ph, st] = await Promise.all([
        loadProfiles(), db.fixtures.list(), db.reports.list(), db.quotes.list(), db.faqs.list(),
        db.rules.list(), db.pages.list(), db.photos.list(), db.proposals.list(),
        db.champions.list(), db.honours.list(), db.availability.list(), db.emblems.list(),
        db.laurels.list(), db.committedLists.list(), db.placeholders.list(), db.settings.get(),
      ]);
      setUsers(us); setFixtures(fx); setReports(rp); setQuotes(qt);
      setFaq(fq); setRules(rl); setPages(pg); setPhotosIdx(px);
      setProposals(pr); setChampions(ch); setHonours(hn); setAvailability(av); setEmblems(em);
      setLaurels(lr); setCommittedLists(cl); setPlaceholders(ph); setSettings(st);
    } catch (e) { console.error("loadAll failed", e); }
  };

  useEffect(() => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setBooted(true); } };

    // Load everything, then boot. (Anonymous at first; RLS hides member data,
    // so the post-login effect below re-pulls it once we know who you are.)
    loadAll().finally(finish);

    // Resolve the current user separately so a slow auth lock can't hang boot.
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) setUser(await ensureProfile(session.user, null));
      } catch (e) { console.error("boot (auth) failed", e); }
    })();

    const safety = setTimeout(finish, 8000);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        try { setUser(session?.user ? await ensureProfile(session.user, null) : null); }
        catch (e) { console.error("auth change failed", e); }
      }, 0);
    });
    return () => { clearTimeout(safety); subscription.unsubscribe(); };
  }, []);

  // The pre-login fetch comes back empty (RLS), so re-pull everything the
  // moment we know the signed-in member — fixes the blank screen on first
  // login without needing a manual refresh. Guarded so it runs once per user.
  const loadedFor = useRef("anon");
  useEffect(() => {
    const key = user?.id || "anon";
    if (loadedFor.current === key) return;
    loadedFor.current = key;
    loadAll();
  }, [user]);


  const reload = {
    fixtures: async () => setFixtures(await db.fixtures.list()),
    reports: async () => setReports(await db.reports.list()),
    quotes: async () => setQuotes(await db.quotes.list()),
    faq: async () => setFaq(await db.faqs.list()),
    rules: async () => setRules(await db.rules.list()),
    pages: async () => setPages(await db.pages.list()),
    proposals: async () => setProposals(await db.proposals.list()),
    champions: async () => setChampions(await db.champions.list()),
    photosIdx: async () => setPhotosIdx(await db.photos.list()),
    honours: async () => setHonours(await db.honours.list()),
    availability: async () => setAvailability(await db.availability.list()),
    emblems: async () => setEmblems(await db.emblems.list()),
    laurels: async () => setLaurels(await db.laurels.list()),
    committedLists: async () => setCommittedLists(await db.committedLists.list()),
    placeholders: async () => setPlaceholders(await db.placeholders.list()),
    settings: async () => setSettings(await db.settings.get()),
  };

  useEffect(() => { document.title = siteName; }, [siteName]);

  const logout = async () => { await supabase.auth.signOut(); setUser(null); };

  if (!booted) {
    return (
      <div className="parchment f-disp flex min-h-screen items-center justify-center text-stone-600">
        <style>{FONT_CSS}</style>Unfurling the banners…
      </div>
    );
  }
  if (!user) return <LoginGate users={users} siteName={siteName} onAuthed={setUser} refreshUsers={refreshUsers} />;

  // Players known to the app = registered members + placeholders (the Grand
  // Marshal tracks records before someone signs up). Deduped case-insensitively
  // so a placeholder sharing a name with an as-yet-unlinked account appears once.
  const memberNames = (() => {
    const seen = new Set(); const out = [];
    for (const n of [...Object.values(users).map((u) => u.name), ...placeholders.map((p) => p.name)]) {
      const k = (n || "").toLowerCase();
      if (!n || seen.has(k)) continue;
      seen.add(k); out.push(n);
    }
    return out;
  })();
  const ctx = { user, users, placeholders, memberNames, fixtures, reports, quotes, faq, rules, pages, proposals, champions, photosIdx, honours, availability, emblems, laurels, committedLists, settings, siteName, siteTagline, db, reload, reloadAll: loadAll, refreshUsers, refreshUser, logout };

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/member/:name" element={<ProfilePage ctx={ctx} />} />
        <Route path="*" element={<Hub ctx={ctx} />} />
      </Routes>
    </ErrorBoundary>
  );
}

/* ============================================================
   HUB — masthead, tab nav, and the active tab
   ============================================================ */
function Hub({ ctx }) {
  const { user, logout, siteName, siteTagline } = ctx;
  const [tab, setTab] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = [
    { id: "home", label: "Town Square", icon: Beer },
    { id: "league", label: "League", icon: Trophy },
    { id: "cup", label: "Grand Tourney", icon: Crown },
    { id: "fame", label: "Hall of Fame", icon: Medal },
    { id: "council", label: "Council", icon: Gavel },
    { id: "battles", label: "Battles", icon: Swords },
    { id: "gallery", label: "Gallery", icon: Camera },
    { id: "rules", label: "Library", icon: BookOpen },
    { id: "faq", label: "Herald", icon: HelpCircle },
    ...(user.isAdmin ? [{ id: "admin", label: "Admin", icon: Settings }] : []),
  ];
  const cur = tabs.find((t) => t.id === tab) || tabs[0];
  const CurIcon = cur.icon;
  const pick = (id) => { setTab(id); setMenuOpen(false); };

  return (
    <div className="parchment f-body min-h-screen text-stone-900">
      <style>{FONT_CSS}</style>
      <header className="border-b-4 border-amber-700 bg-stone-900 text-amber-100">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="f-black text-3xl leading-none text-amber-200 sm:text-4xl">{siteName}</h1>
              <p className="f-disp mt-1 text-[10px] uppercase tracking-widest text-amber-500/80 sm:text-xs">
                {siteTagline}
              </p>
            </div>
            <div className="text-right">
              <p className="f-disp text-xs text-amber-200">
                <Link to={"/member/" + encodeURIComponent(user.name)} className="hover:text-amber-100 hover:underline">{user.name}</Link> {user.isAdmin && <Crown size={12} className="ml-1 inline text-amber-400" />}
              </p>
              <p className="text-[11px] italic text-stone-400">{user.faction}</p>
              <button onClick={logout} className="f-disp mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-stone-400 hover:text-amber-300">
                <LogOut size={11} /> Sign out
              </button>
            </div>
          </div>
          <nav className="mt-3">
            <button onClick={() => setMenuOpen((o) => !o)}
              className="f-disp flex w-full items-center justify-between rounded-sm bg-stone-800 px-3 py-2 text-xs uppercase tracking-wide text-amber-100 sm:hidden">
              <span className="flex items-center gap-1.5"><CurIcon size={14} /> {cur.label}</span>
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>
            {menuOpen && (
              <div className="mt-1 grid grid-cols-2 gap-1 sm:hidden">
                {tabs.map((t) => (
                  <button key={t.id} onClick={() => pick(t.id)}
                    className={"f-disp flex items-center gap-1.5 rounded-sm px-3 py-2 text-xs uppercase tracking-wide " +
                      (tab === t.id ? "bg-amber-600 text-stone-900" : "bg-stone-800 text-amber-100/80 hover:bg-stone-700")}>
                    <t.icon size={13} /> {t.label}
                  </button>
                ))}
              </div>
            )}
            <div className="hidden gap-1 overflow-x-auto pb-1 sm:flex">
              {tabs.map((t) => (
                <button key={t.id} onClick={() => pick(t.id)}
                  className={"f-disp flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs uppercase tracking-wide transition-colors " +
                    (tab === t.id ? "bg-amber-600 text-stone-900" : "text-amber-100/80 hover:bg-stone-800")}>
                  <t.icon size={13} /> {t.label}
                </button>
              ))}
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        {tab === "home" && <HomeTab ctx={ctx} go={setTab} />}
        {tab === "league" && <PagesTab ctx={ctx} kind="league" />}
        {tab === "cup" && <PagesTab ctx={ctx} kind="cup" />}
        {tab === "fame" && <FameTab ctx={ctx} />}
        {tab === "council" && <CouncilTab ctx={ctx} />}
        {tab === "battles" && <BattlesTab ctx={ctx} />}
        {tab === "gallery" && <GalleryTab ctx={ctx} />}
        {tab === "rules" && <RulesTab ctx={ctx} />}
        {tab === "faq" && <FaqTab ctx={ctx} />}
        {tab === "admin" && user.isAdmin && <AdminTab ctx={ctx} />}
      </main>
      <SiteFooter />
    </div>
  );
}

/* ============================================================
   PROFILE — a member's page: rank, ELO, per-army record, honours
   ============================================================ */
function ProfilePage({ ctx }) {
  const { user, users, placeholders, reports, champions, honours, emblems, logout, siteName, siteTagline, db, reload, reloadAll, refreshUsers, refreshUser } = ctx;
  const navigate = useNavigate();
  const { name: rawName } = useParams();
  const name = rawName || "";
  const account = Object.values(users).find((u) => u.name.toLowerCase() === name.toLowerCase());
  const placeholder = !account ? (placeholders || []).find((p) => p.name.toLowerCase() === name.toLowerCase()) : null;
  const member = account || placeholder || null;
  const isPlaceholder = !!placeholder; // tracked player without an account yet
  const who = member ? member.name : name;

  const games = gamesPlayedMap(reports);
  // include placeholder factions so headline-rank attribution still works for them
  const everyone = { ...users };
  for (const p of (placeholders || [])) everyone["ph-" + p.id] = p;
  const armyGames = gamesByArmyMap(reports, everyone);
  const myArmyGames = armyGames[who] || {};
  const standing = computeStandings(reports).find((r) => r.name === who);
  const rk = headlineRankFor(member, myArmyGames);
  const isChamp = champions.some((c) => c.isCurrent && c.member === who);
  const myHonours = honours.filter((h) => h.member === who);

  const byArmy = {};
  for (const r of reports) {
    if (r.ranked === false) continue;
    const side = reportSide(r, who);
    if (!side) continue;
    // Whichever of the four slots they played, count the army they fielded;
    // unrecorded falls back to their profile faction.
    const army = playerArmyIn(r, who) || member?.faction || "—";
    const res = r.winner === side ? "w" : r.winner === "draw" ? "d" : "l";
    if (!byArmy[army]) byArmy[army] = { games: 0, w: 0, l: 0, d: 0 };
    byArmy[army].games++; byArmy[army][res]++;
  }
  const armyRows = Object.entries(byArmy).sort((a, b) => b[1].games - a[1].games);

  const h2h = {};
  for (const r of reports) {
    if (r.ranked === false) continue;
    const side = reportSide(r, who);
    if (!side) continue;
    const { A, B } = reportTeams(r);
    const res = r.winner === side ? "w" : r.winner === "draw" ? "d" : "l";
    // Count every opponent on the other side (both, for a doubles game).
    for (const opp of (side === "A" ? B : A)) {
      if (!h2h[opp]) h2h[opp] = { games: 0, w: 0, l: 0, d: 0 };
      h2h[opp].games++; h2h[opp][res]++;
    }
  }
  const h2hRows = Object.entries(h2h).sort((a, b) => b[1].games - a[1].games);

  const recent = reports
    .filter((r) => reportSide(r, who))
    .sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.created - a.created)
    .slice(0, 6);

  const [showAward, setShowAward] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [zoom, setZoom] = useState(null);
  const [editName, setEditName] = useState("");
  const [editArmy, setEditArmy] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [emailPrefs, setEmailPrefs] = useState({});
  const [editErr, setEditErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [cat, setCat] = useState("league");
  const [hTitle, setHTitle] = useState("");
  const [hSeason, setHSeason] = useState("");
  const award = async () => {
    const title = hTitle.trim() || HONOUR_META[cat].label;
    await db.honours.add({ member: who, category: cat, title, season: hSeason.trim(), awardedBy: user.name });
    await reload.honours();
    setHTitle(""); setHSeason(""); setShowAward(false);
  };
  const removeHonour = async (id) => {
    if (!user.isAdmin) return;
    await db.honours.remove(id);
    await reload.honours();
  };

  const canEdit = !isPlaceholder && !!member && (member.name === user.name || user.isAdmin);
  const avatarSrc = member ? avatarUrl(member.avatarPath) : null;
  const mascotSrc = member ? avatarUrl(member.mascotPath) : null;
  const uploadImg = async (field, file) => {
    if (!file || !member || isPlaceholder) return;
    try {
      const dataURL = await compressImage(file, field === "avatar_path" ? 512 : 256, 0.85);
      const res = await db.profiles.setImage(member.id, field, dataURL);
      if (!res.error) await refreshUsers();
    } catch (e) { /* ignore */ }
  };
  const removeImg = async (field) => {
    if (!member || isPlaceholder) return;
    await db.profiles.update(member.id, { [field]: null });
    await refreshUsers();
  };
  const saveProfile = async () => {
    if (!member || isPlaceholder || saving) return;
    setEditErr(""); setSaving(true);
    try {
      // A username change must go through the rename RPC so every battle, vote
      // and honour recorded under the old name is carried across server-side.
      const newName = editName.trim();
      const renamed = !!newName && newName !== member.name;
      if (renamed) {
        const { error } = await db.profiles.rename(member.name, newName);
        if (error) { setEditErr(error.message || "Could not change that username."); return; }
      }
      if (editArmy && editArmy !== member.faction) await db.profiles.update(member.id, { faction: editArmy });
      if (user.isAdmin) {
        const newSurname = editSurname.trim();
        if (newSurname !== (member.surname || "")) await db.profiles.update(member.id, { surname: newSurname || null });
      }
      if (member.name === user.name) await db.profiles.update(member.id, { email_prefs: emailPrefs });
      // A rename rewrites many collections, so re-pull everything (not just users).
      await reloadAll();
      await refreshUser();
      setShowEdit(false);
      // Profile URLs are keyed by name — follow the member to their new one.
      if (renamed) navigate("/member/" + encodeURIComponent(newName), { replace: true });
    } catch (e) {
      setEditErr("Something went wrong saving the profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="parchment f-body min-h-screen text-stone-900">
      <style>{FONT_CSS}</style>
      <header className="border-b-4 border-amber-700 bg-stone-900 text-amber-100">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Link to="/" className="f-black text-3xl leading-none text-amber-200 hover:text-amber-100 sm:text-4xl">{siteName}</Link>
              <p className="f-disp mt-1 text-[10px] uppercase tracking-widest text-amber-500/80 sm:text-xs">
                {siteTagline}
              </p>
            </div>
            <div className="text-right">
              <p className="f-disp text-xs text-amber-200">
                <Link to={"/member/" + encodeURIComponent(user.name)} className="hover:text-amber-100 hover:underline">{user.name}</Link> {user.isAdmin && <Crown size={12} className="ml-1 inline text-amber-400" />}
              </p>
              <p className="text-[11px] italic text-stone-400">{user.faction}</p>
              <button onClick={logout} className="f-disp mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-stone-400 hover:text-amber-300">
                <LogOut size={11} /> Sign out
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        <button onClick={() => navigate("/")} className="f-disp mb-4 inline-flex items-center gap-1 text-xs uppercase tracking-wide text-stone-500 hover:text-red-900">
          <ArrowLeft size={12} /> Back to the Town Square
        </button>

        <div className="mb-6 rounded-sm border-2 border-amber-700 bg-gradient-to-r from-amber-100 to-amber-50 p-4 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 justify-center gap-3 sm:justify-start">
              <div className="flex flex-col items-center gap-1">
                {avatarSrc
                  ? <button type="button" onClick={() => setZoom({ src: avatarSrc, alt: who })} className="cursor-zoom-in" title="Click to enlarge">
                      <img src={avatarSrc} alt="" className="h-28 w-28 rounded-sm border-2 border-amber-700 object-cover shadow-sm transition-transform hover:scale-105" />
                    </button>
                  : <div className="flex h-28 w-28 items-center justify-center rounded-sm border-2 border-amber-700 bg-stone-200 text-stone-400"><Shield size={40} /></div>}
                <span className="f-disp text-[10px] uppercase tracking-wide text-stone-400">Avatar</span>
              </div>
              {mascotSrc && (
                <div className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => setZoom({ src: mascotSrc, alt: who + "'s Noble Steed" })} className="cursor-zoom-in" title="Click to enlarge">
                    <img src={mascotSrc} alt="Noble Steed" className="h-20 w-20 rounded-sm border-2 border-amber-700 object-cover shadow-sm transition-transform hover:scale-105" />
                  </button>
                  <span className="f-disp text-[10px] uppercase tracking-wide text-stone-400">Noble Steed</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h1 className="f-black flex items-center gap-2 text-3xl leading-tight text-red-950 sm:text-4xl">
                    <span className="break-words">{who}{member && member.surname && <span className="text-amber-800"> of {houseName(member.faction, member.surname)}</span>}</span>
                    {isChamp && <Crown size={22} className="shrink-0 text-amber-600" title="Champion of the Old World" />}
                  </h1>
                  <p className="f-disp text-sm italic text-stone-600">{rk.army} · {rk.title}{isPlaceholder ? " · unclaimed placeholder" : (!member ? " · not on the muster roll" : "")}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {canEdit && member && (
                    <button onClick={() => { setEditName(member.name); setEditArmy(member.faction); setEditSurname(member.surname || ""); setEmailPrefs(member.emailPrefs || {}); setEditErr(""); setShowEdit(true); }}
                      className="rounded-sm border border-stone-300 bg-white/70 p-1.5 text-stone-500 hover:text-red-900" title="Edit profile & settings">
                      <Settings size={18} />
                    </button>
                  )}
                  {user.isAdmin && (
                    <B small kind="gold" onClick={() => setShowAward(true)}><Plus size={12} /> Award title</B>
                  )}
                </div>
              </div>
            </div>
          </div>
          {myHonours.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {myHonours.map((h) => {
                const Icon = (HONOUR_META[h.category] || HONOUR_META.custom).Icon;
                return (
                  <span key={h.id} className="group inline-flex items-center gap-1.5 rounded-sm border border-amber-700/50 bg-amber-100/70 px-2 py-1 text-xs font-medium text-stone-800">
                    <Icon size={13} className="text-amber-700" />
                    {h.title}{h.season ? <span className="italic text-stone-500"> · {h.season}</span> : null}
                    {user.isAdmin && (
                      <button onClick={() => removeHonour(h.id)} className="ml-0.5 hidden text-stone-400 hover:text-red-800 group-hover:inline"><X size={11} /></button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <H icon={Trophy}>Record</H>
            <Card className="divide-y divide-stone-200">
              <div className="flex items-center justify-between px-3 py-2"><span className="f-disp text-sm">Might</span><span className="f-disp text-sm font-bold text-red-900">{standing ? standing.elo : "—"}</span></div>
              <div className="flex items-center justify-between px-3 py-2"><span className="f-disp text-sm">Games played</span><span className="f-disp text-sm font-bold">{games[who] || 0}</span></div>
              <div className="flex items-center justify-between px-3 py-2"><span className="f-disp text-sm">Won / Drawn / Lost</span><span className="f-disp text-sm font-bold">{standing ? standing.w + " / " + standing.d + " / " + standing.l : "0 / 0 / 0"}</span></div>
              <div className="flex items-center justify-between px-3 py-2"><span className="f-disp text-sm">League points</span><span className="f-disp text-sm font-bold">{standing ? standing.pts : 0}</span></div>
              {!rk.isMax && <div className="px-3 py-2 text-[11px] italic text-stone-500">{rk.toNext} more {rk.army} game(s) to {(RANK_TITLES[rk.army] || RANK_TITLES["The Empire"])[rk.tier]}</div>}
            </Card>
          </div>

          <div className="lg:col-span-2">
            <H icon={Shield}>Battle record by army</H>
            {armyRows.length === 0 ? (
              <Empty>No battles fought yet.</Empty>
            ) : (
              <Card className="overflow-hidden">
                <div className="flex gap-2 border-b border-stone-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                  <span className="flex-1">Army</span><span className="w-12 text-center">P</span><span className="w-12 text-center">W</span><span className="w-12 text-center">D</span><span className="w-12 text-center">L</span>
                </div>
                {armyRows.map(([army, s]) => {
                  const ac = myArmyGames[army] || s.games;
                  const ar = RANK_TITLES[army] ? rankFor(army, ac) : null;
                  return (
                  <div key={army} className={"flex items-center gap-2 border-l-4 px-3 py-2 text-sm " + armyStyle(army)}>
                    <span className="f-disp flex flex-1 items-center gap-1.5 font-medium">
                      <ArmyEmblem army={army} emblems={emblems} size={15} />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate">{army}</span>
                        {ar && <span className="block text-[11px] font-semibold text-amber-800" title={ac + " game(s) with this army"}>{ar.title}</span>}
                      </span>
                    </span>
                    <span className="w-12 text-center">{s.games}</span>
                    <span className="w-12 text-center font-bold text-green-800">{s.w}</span>
                    <span className="w-12 text-center">{s.d}</span>
                    <span className="w-12 text-center text-red-900">{s.l}</span>
                  </div>
                  );
                })}
              </Card>
            )}

            <H icon={Swords}>Head to head</H>
            {h2hRows.length === 0 ? (
              <Empty>No rivalries forged yet.</Empty>
            ) : (
              <Card className="overflow-hidden">
                <div className="flex gap-2 border-b border-stone-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                  <span className="flex-1">Opponent</span><span className="w-12 text-center">P</span><span className="w-12 text-center">W</span><span className="w-12 text-center">D</span><span className="w-12 text-center">L</span>
                </div>
                {h2hRows.map(([opp, s]) => (
                  <div key={opp} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <button onClick={() => navigate("/member/" + encodeURIComponent(opp))} className="f-disp flex-1 truncate text-left font-medium hover:text-red-900 hover:underline">{opp}</button>
                    <span className="w-12 text-center">{s.games}</span>
                    <span className="w-12 text-center font-bold text-green-800">{s.w}</span>
                    <span className="w-12 text-center">{s.d}</span>
                    <span className="w-12 text-center text-red-900">{s.l}</span>
                  </div>
                ))}
              </Card>
            )}

            <H icon={CalendarDays}>Recent battles</H>
            {recent.length === 0 ? (
              <Empty>No battles on record.</Empty>
            ) : (
              <Card className="divide-y divide-stone-200">
                {recent.map((r) => {
                  const side = reportSide(r, who);
                  const { A, B } = reportTeams(r);
                  const opps = side === "A" ? B : A;
                  const result = r.winner === "draw" ? "Draw" : r.winner === side ? "Win" : "Loss";
                  const tone = result === "Win" ? "text-green-800" : result === "Loss" ? "text-red-900" : "text-stone-500";
                  return (
                    <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="f-disp text-sm font-bold">
                          vs {opps.map((opp, i) => (
                            <span key={opp}>
                              {i > 0 ? " & " : ""}
                              <button onClick={() => navigate("/member/" + encodeURIComponent(opp))} className="hover:text-red-900 hover:underline">{opp}</button>
                            </span>
                          ))}
                          {r.doubles && <span className="ml-1 font-normal italic text-stone-400">(doubles)</span>}
                        </p>
                        <p className="text-[11px] italic text-stone-500">{fmtDate(r.date)}{r.points ? " · " + r.points + " pts" : ""}{r.score ? " · " + r.score : ""}</p>
                      </div>
                      <span className={"f-disp text-sm font-bold " + tone}>{result}</span>
                    </div>
                  );
                })}
              </Card>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />

      {showAward && (
        <Modal title={"Award a title to " + who} onClose={() => setShowAward(false)}>
          <div className="space-y-3">
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Title</p>
              <Sel value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="league">League Champion</option>
                <option value="cup">Cup / Tourney Winner</option>
                <option value="spoon">Wooden Spoon</option>
                <option value="custom">Custom…</option>
              </Sel>
            </div>
            <Inp placeholder={cat === "custom" ? "Title (e.g. Best Painted)" : "Override label (optional)"} value={hTitle} onChange={(e) => setHTitle(e.target.value)} />
            <Inp placeholder="Season (e.g. Spring Campaign 2526)" value={hSeason} onChange={(e) => setHSeason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && award()} />
            <B kind="gold" onClick={award}><Award size={14} /> Bestow the title</B>
          </div>
        </Modal>
      )}

      {showEdit && (
        <Modal title="Settings" onClose={() => setShowEdit(false)}>
          <div className="space-y-3">
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Username</p>
              <Inp value={editName} onChange={(e) => setEditName(e.target.value)} placeholder={member.name} maxLength={40} />
              <p className="mt-1 text-[11px] italic text-stone-500">
                {editName.trim() && editName.trim() !== member.name
                  ? <>Every battle, standing, vote and honour under <span className="font-bold not-italic">{member.name}</span> moves to <span className="font-bold not-italic text-amber-800">{editName.trim()}</span>.</>
                  : "Your name across the league. Changing it carries all your history with it."}
              </p>
            </div>
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Army you're currently playing</p>
              <Sel value={editArmy} onChange={(e) => setEditArmy(e.target.value)}>
                {ARMIES.map((a) => <option key={a}>{a}</option>)}
              </Sel>
            </div>
            {user.isAdmin && (
              <div>
                <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Surname (Grand Marshal only)</p>
                <Inp value={editSurname} onChange={(e) => setEditSurname(e.target.value)} placeholder="e.g. Breach" maxLength={40} />
                <p className="mt-1 text-[11px] italic text-stone-500">
                  {editSurname.trim()
                    ? <>Shown on the profile as <span className="font-bold not-italic text-amber-800">{who} of {houseName(editArmy || member.faction, editSurname)}</span></>
                    : "Helps tie a username to a real person, styled to their army."}
                </p>
              </div>
            )}
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Avatar</p>
              <div className="flex items-center gap-3">
                {avatarSrc
                  ? <img src={avatarSrc} alt="" className="h-14 w-14 rounded-sm border-2 border-amber-700 object-cover" />
                  : <div className="flex h-14 w-14 items-center justify-center rounded-sm border-2 border-amber-700 bg-stone-200 text-stone-400"><Shield size={20} /></div>}
                <label className="f-disp cursor-pointer rounded-sm border border-stone-300 bg-white/70 px-2 py-1 text-[11px] uppercase tracking-wide text-stone-600 hover:text-red-900">
                  {avatarSrc ? "Change" : "Upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImg("avatar_path", e.target.files && e.target.files[0])} />
                </label>
                {avatarSrc && <button onClick={() => removeImg("avatar_path")} className="f-disp text-[11px] uppercase tracking-wide text-stone-400 hover:text-red-800">Remove</button>}
              </div>
            </div>
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Noble Steed</p>
              <p className="f-body mb-1.5 text-[11px] italic text-stone-500">Optional — only shown on your profile if you add one.</p>
              <div className="flex items-center gap-3">
                {mascotSrc
                  ? <img src={mascotSrc} alt="" className="h-14 w-14 rounded-sm border-2 border-amber-700 object-cover" />
                  : <div className="flex h-14 w-14 items-center justify-center rounded-sm border-2 border-dashed border-amber-700/60 bg-stone-100 text-stone-400"><Camera size={18} /></div>}
                <label className="f-disp cursor-pointer rounded-sm border border-stone-300 bg-white/70 px-2 py-1 text-[11px] uppercase tracking-wide text-stone-600 hover:text-red-900">
                  {mascotSrc ? "Change" : "Upload"}<input type="file" accept="image/*" className="hidden" onChange={(e) => uploadImg("mascot_path", e.target.files && e.target.files[0])} />
                </label>
                {mascotSrc && <button onClick={() => removeImg("mascot_path")} className="f-disp text-[11px] uppercase tracking-wide text-stone-400 hover:text-red-800">Remove</button>}
              </div>
            </div>
            {member.name === user.name && (
              <div>
                <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Email notifications</p>
                <label className="f-body flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={emailPrefs.broadcasts !== false} onChange={(e) => setEmailPrefs({ ...emailPrefs, broadcasts: e.target.checked })} />
                  Availability calls &amp; gathering announcements
                </label>
                <label className="f-body mt-1 flex items-center gap-2 text-sm text-stone-700">
                  <input type="checkbox" checked={emailPrefs.digest !== false} onChange={(e) => setEmailPrefs({ ...emailPrefs, digest: e.target.checked })} />
                  Weekly digest
                </label>
                <p className="mt-1 text-[11px] italic text-stone-500">You're always emailed when someone accepts your own game.</p>
              </div>
            )}
            {editErr && <p className="f-body text-sm font-bold text-red-800">{editErr}</p>}
            <B onClick={saveProfile} disabled={saving}><Save size={14} /> {saving ? "Saving…" : "Save"}</B>
          </div>
        </Modal>
      )}

      {zoom && <ImagePopup src={zoom.src} alt={zoom.alt} onClose={() => setZoom(null)} />}
    </div>
  );
}

/* ============================================================
   HOME — Town Square
   ============================================================ */
function HomeTab({ ctx, go }) {
  const { user, users, placeholders, fixtures, reports, quotes, champions, photosIdx, honours, availability, pages, memberNames, db, reload, refreshUsers } = ctx;
  const navigate = useNavigate();
  const [newQuote, setNewQuote] = useState("");
  const [saidBy, setSaidBy] = useState("");
  const [thumbs, setThumbs] = useState({});
  const [lbId, setLbId] = useState(null);
  const [showAward, setShowAward] = useState(false);
  const [awardWho, setAwardWho] = useState("");
  const [awardSeason, setAwardSeason] = useState("");
  const [showAvail, setShowAvail] = useState(false);
  const [showAllFixtures, setShowAllFixtures] = useState(false);
  const [showAllCalls, setShowAllCalls] = useState(false);
  const [showAllRoster, setShowAllRoster] = useState(false);
  const [avDate, setAvDate] = useState(today());
  const [avKind, setAvKind] = useState("friendly");
  const [avPage, setAvPage] = useState("");
  const [avNote, setAvNote] = useState("");

  const ladder = computeStandings(reports);
  const shame = shameBoard(reports);
  // Everyone with a record = members + placeholders. Placeholders that share a
  // name with an account (an unlinked sign-up) are hidden so the roll shows once.
  const everyone = { ...users };
  for (const p of placeholders) everyone["ph-" + p.id] = p;
  const directory = [
    ...Object.values(users),
    ...placeholders.filter((p) => !Object.values(users).some((u) => u.name.toLowerCase() === p.name.toLowerCase())),
  ];
  const armyGames = gamesByArmyMap(reports, everyone);
  const currentChamp = champions.find((c) => c.isCurrent) || null;
  const pastChamps = champions.filter((c) => !c.isCurrent).sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));
  const upcoming = [...fixtures]
    .filter((f) => !f.date || f.date >= today())
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
    .slice(0, 3);
  const recentPhotos = [...photosIdx].sort((a, b) => b.created - a.created).slice(0, 2);
  const lb = lbId ? photosIdx.find((p) => p.id === lbId) : null;
  const recentQuotes = [...quotes].sort((a, b) => b.created - a.created).slice(0, 4);
  const openCalls = [...availability]
    .filter((a) => !a.date || a.date >= today())
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const myFixtures = [...fixtures]
    .filter((f) => (fixtureSide(pages, memberNames, f, "playerA").member === user.name || fixtureSide(pages, memberNames, f, "playerB").member === user.name) && (!f.date || f.date >= today()))
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));

  useEffect(() => {
    const out = {};
    for (const p of recentPhotos) out[p.id] = photoUrl(p.storagePath);
    setThumbs(out);
  }, [photosIdx.length]);

  const addQuote = async () => {
    const text = newQuote.trim();
    if (!text) return;
    await db.quotes.add({ text, saidBy: saidBy.trim() || "Unknown", addedBy: user.name });
    await reload.quotes();
    setNewQuote(""); setSaidBy("");
  };
  const delQuote = async (q) => {
    if (!(user.isAdmin || q.addedBy === user.name)) return;
    await db.quotes.remove(q.id);
    await reload.quotes();
  };
  const addComment = async (p, text) => {
    const next = [...(p.comments || []), { id: uid(), by: user.name, text, at: Date.now() }];
    await db.photos.setComments(p.id, next);
    await reload.photosIdx();
  };
  const delComment = async (p, cid) => {
    await db.photos.setComments(p.id, (p.comments || []).filter((c) => c.id !== cid));
    await reload.photosIdx();
  };
  const renamePhoto = async (p, caption) => {
    if (!(user.isAdmin || p.uploader === user.name)) return;
    await db.photos.setCaption(p.id, caption);
    await reload.photosIdx();
  };

  const awardChampion = async () => {
    if (!awardWho.trim() || !awardSeason.trim()) return;
    await db.champions.retireAll();
    await db.champions.add({ member: awardWho.trim(), season: awardSeason.trim() });
    await reload.champions();
    setAwardWho(""); setAwardSeason(""); setShowAward(false);
  };
  const abdicate = async () => {
    if (!confirm("Strip the current champion of the crown? They keep their place in the Roll of Honour.")) return;
    await db.champions.retireAll();
    await reload.champions();
  };

  const postAvail = async () => {
    if (!avDate) return;
    const res = await db.availability.add({ member: user.name, date: avDate, kind: avKind, pageId: avKind === "friendly" ? null : (avPage || null), note: avNote.trim() });
    await reload.availability();
    if (res && res.data && res.data.id) notify("availability", { id: res.data.id });
    setAvDate(today()); setAvKind("friendly"); setAvPage(""); setAvNote(""); setShowAvail(false);
  };
  const acceptCall = async (a) => {
    if (a.member === user.name || (a.takers || []).includes(user.name)) return;
    await db.fixtures.add({ playerA: a.member, playerB: user.name, date: a.date, points: "", notes: "", kind: a.kind, pageId: a.pageId, scenario: "" });
    await db.availability.setTakers(a.id, [...(a.takers || []), user.name]);
    await reload.fixtures();
    await reload.availability();
    notify("accepted", { id: a.id });
  };
  const removeCall = async (a) => {
    if (!(user.isAdmin || a.member === user.name)) return;
    await db.availability.remove(a.id);
    await reload.availability();
  };

  const medal = (i) => ["bg-amber-500 text-stone-900", "bg-stone-400 text-stone-900", "bg-amber-800 text-amber-100"][i] || "bg-stone-200 text-stone-600";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <SocialBanner ctx={ctx} />
        {currentChamp && (
          <div className="mb-6 flex items-center gap-4 rounded-sm border-2 border-amber-600 bg-gradient-to-r from-amber-100 to-amber-50 p-4 shadow-sm">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-amber-500 text-stone-900 shadow-md ring-2 ring-amber-700">
              <Crown size={30} />
            </div>
            <div>
              <p className="f-disp text-[11px] font-bold uppercase tracking-widest text-amber-800">Champion of the Old World</p>
              <p className="f-black text-3xl leading-tight text-red-950">{currentChamp.member}</p>
              <p className="text-xs italic text-stone-600">{currentChamp.season}</p>
            </div>
            {user.isAdmin && (
              <button onClick={abdicate} title="Strip the crown" className="ml-auto self-start text-stone-400 hover:text-red-800">
                <X size={16} />
              </button>
            )}
          </div>
        )}
        <H icon={CalendarDays}>Your fixtures</H>
        {myFixtures.length === 0 ? (
          <Empty>No games scheduled for you yet.</Empty>
        ) : (
          <div className="space-y-2">
            {(showAllFixtures ? myFixtures : myFixtures.slice(0, 3)).map((f) => {
              const oppSide = fixtureSide(pages, memberNames, f, "playerA").member === user.name ? "playerB" : "playerA";
              return (
                <Card key={f.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="f-disp text-sm font-bold">vs <FxSide f={f} side={oppSide} pages={pages} memberNames={memberNames} navigate={navigate} /></p>
                    <p className="text-xs italic text-stone-500">{f.round != null ? "Round " + f.round + " · " : ""}{competitionLabel(pages, f)}{f.points ? " · " + f.points + " pts" : ""}{f.scenario ? " · " + f.scenario : ""}</p>
                  </div>
                  <p className="f-disp shrink-0 text-xs uppercase tracking-wide text-amber-800">{f.date ? relDay(f.date) : "TBC"}</p>
                </Card>
              );
            })}
            {myFixtures.length > 3 && (
              <button onClick={() => setShowAllFixtures((v) => !v)}
                className="f-disp flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-amber-700/40 py-1.5 text-[11px] uppercase tracking-wide text-amber-800 hover:bg-amber-100/50">
                {showAllFixtures
                  ? <><ChevronUp size={13} /> Show fewer</>
                  : <><ChevronDown size={13} /> Show {myFixtures.length - 3} more</>}
              </button>
            )}
          </div>
        )}

        <H icon={Swords} right={<B small kind="gold" onClick={() => setShowAvail(true)}><Plus size={12} /> I'm available</B>}>
          Calls to Arms
        </H>
        {openCalls.length === 0 ? (
          <Empty>No one has posted availability. Be the first to call for a game.</Empty>
        ) : (
          <div className="space-y-2">
            {(showAllCalls ? openCalls : openCalls.slice(0, 3)).map((a) => {
              const accepted = (a.takers || []).includes(user.name);
              const mine = a.member === user.name;
              return (
                <Card key={a.id} className="flex items-start justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="f-disp text-sm font-bold">
                      <button onClick={() => navigate("/member/" + encodeURIComponent(a.member))} className="hover:text-red-900 hover:underline">{a.member}</button>
                      <span className="font-normal text-stone-600"> is up for a </span>
                      <span className="text-red-900">{competitionLabel(pages, a)}</span>
                      <span className="font-normal text-stone-600"> — {relDay(a.date)}</span>
                    </p>
                    {a.note && <p className="text-xs italic text-stone-500">{a.note}</p>}
                    {(a.takers || []).length > 0 && (
                      <p className="mt-0.5 text-[11px] text-stone-500">Answered by {(a.takers || []).join(", ")}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!mine && (accepted
                      ? <span className="f-disp text-[11px] uppercase tracking-wide text-green-800">Answered ✓</span>
                      : <B small kind="primary" onClick={() => acceptCall(a)}><Swords size={12} /> I'm up for it</B>)}
                    {(mine || user.isAdmin) && (
                      <button onClick={() => removeCall(a)} className="text-stone-400 hover:text-red-800" title="Withdraw"><Trash2 size={13} /></button>
                    )}
                  </div>
                </Card>
              );
            })}
            {openCalls.length > 3 && (
              <button onClick={() => setShowAllCalls((v) => !v)}
                className="f-disp flex w-full items-center justify-center gap-1 rounded-sm border border-dashed border-amber-700/40 py-1.5 text-[11px] uppercase tracking-wide text-amber-800 hover:bg-amber-100/50">
                {showAllCalls
                  ? <><ChevronUp size={13} /> Show fewer</>
                  : <><ChevronDown size={13} /> Show {openCalls.length - 3} more</>}
              </button>
            )}
          </div>
        )}

        <H icon={CalendarDays} right={<B small kind="ghost" onClick={() => go("battles")}>All battles <ChevronRight size={12} /></B>}>
          Upcoming engagements
        </H>
        {upcoming.length === 0 ? (
          <Empty>No battles scheduled. The realm is suspiciously quiet.</Empty>
        ) : (
          <div className="space-y-2">
            {upcoming.map((f) => (
              <Card key={f.id} className="flex items-center justify-between gap-3 p-3">
                <div>
                  <p className="f-disp text-sm font-bold text-stone-900"><FxSide f={f} side="playerA" pages={pages} memberNames={memberNames} navigate={navigate} /> <span className="text-red-900">vs</span> <FxSide f={f} side="playerB" pages={pages} memberNames={memberNames} navigate={navigate} /></p>
                  <p className="text-xs italic text-stone-500">{competitionLabel(pages, f)}{f.points ? " · " + f.points + " pts" : ""}{f.scenario ? " · " + f.scenario : ""}{f.notes ? " · " + f.notes : ""}</p>
                </div>
                <p className="f-disp shrink-0 text-xs uppercase tracking-wide text-amber-800">{fmtDate(f.date)}</p>
              </Card>
            ))}
          </div>
        )}

        <H icon={Camera} right={<B small kind="ghost" onClick={() => go("gallery")}>Gallery <ChevronRight size={12} /></B>}>
          From the front lines
        </H>
        {recentPhotos.length === 0 ? (
          <Empty>No photographs yet. Did the battles even happen?</Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recentPhotos.map((p) => (
              <Card key={p.id} className="overflow-hidden">
                <button className="block w-full" onClick={() => setLbId(p.id)}>
                  {thumbs[p.id]
                    ? <img src={thumbs[p.id]} alt={p.caption || "League photo"} className="h-40 w-full object-cover" />
                    : <div className="flex h-40 items-center justify-center text-xs text-stone-400">Loading…</div>}
                </button>
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <p className="truncate text-xs italic text-stone-600">{p.caption || "Untitled"} — {p.uploader}</p>
                  <button onClick={() => setLbId(p.id)} className="flex shrink-0 items-center gap-0.5 text-[11px] text-stone-500 hover:text-red-900" title="Comments">
                    <MessageSquare size={11} /> {(p.comments || []).length}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-4 lg:self-start">
        <H icon={Trophy} right={
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <B small kind="ghost" onClick={() => go("battles")}>Full standings <ChevronRight size={12} /></B>
            <B small kind="ghost" onClick={() => go("faq")}>What's Might? <HelpCircle size={12} /></B>
          </div>
        }>The Ladder</H>
        {ladder.length === 0 ? (
          <Empty>No ranked battles yet. File a battle report and claim the top spot before Dan does.</Empty>
        ) : (
          <Card className="divide-y divide-stone-200">
            {ladder.slice(0, 5).map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 px-3 py-2">
                <span className={"f-disp flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold " + medal(i)}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <button onClick={() => navigate("/member/" + encodeURIComponent(r.name))} className="f-disp block max-w-full truncate text-left text-sm font-bold hover:text-red-900 hover:underline">{r.name}</button>
                  <p className="text-[11px] text-stone-500">P{r.p} · W{r.w} D{r.d} L{r.l} · {r.pts} pts</p>
                </div>
                <p className="f-disp text-sm font-bold text-red-900">{r.elo}</p>
              </div>
            ))}
          </Card>
        )}

        <H icon={Skull}>Hall of Infamy</H>
        <Card className="p-3">
          {shame.list.length === 0 ? (
            <Empty>No catastrophic dice yet. Give it time.</Empty>
          ) : (
            <>
              {shame.worst && (
                <p className="mb-2 text-xs italic text-stone-600">
                  Worst single showing: <span className="font-bold text-red-900">{shame.worst.player}</span>, {shame.worst.ones} ones in one phase{shame.worst.note ? " (" + shame.worst.note + ")" : ""}.
                </p>
              )}
              <div className="space-y-1">
                {shame.list.slice(0, 5).map((s) => (
                  <div key={s.player} className="flex items-center justify-between text-sm">
                    <span className="f-disp">{s.player}</span>
                    <span className="font-bold text-red-900">{s.ones} ones</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>

        <H icon={Shield} right={user.isAdmin && <B small kind="gold" onClick={() => setShowAward(true)}><Crown size={12} /> Award crown</B>}>
          Muster Roll · {directory.length}
        </H>
        <Card className="divide-y divide-stone-200">
          {(showAllRoster ? directory : directory.slice(0, 8)).map((u) => {
            const rk = headlineRankFor(u, armyGames[u.name]);
            const isChamp = currentChamp && currentChamp.member === u.name;
            return (
              <div key={u.name} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="f-disp flex items-center gap-1.5 text-sm font-bold">
                    <button onClick={() => navigate("/member/" + encodeURIComponent(u.name))} className="truncate text-left hover:text-red-900 hover:underline">{u.name}</button>
                    {isChamp && <Crown size={12} className="shrink-0 text-amber-600" title="Champion of the Old World" />}
                    {u.isAdmin && <Gavel size={10} className="shrink-0 text-stone-400" title="Grand Marshal (admin)" />}
                    {u.isPlaceholder && <span className="shrink-0 rounded-sm bg-stone-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500" title="Tracked by the Grand Marshal — no account yet">Unclaimed</span>}
                    <HonourBadges items={honours.filter((h) => h.member === u.name)} size={11} />
                  </p>
                  <p className="text-[11px] italic text-stone-500" title={rk.isMax ? "Top rank reached" : rk.toNext + " more " + rk.army + " game(s) to " + (RANK_TITLES[rk.army] || RANK_TITLES["The Empire"])[rk.tier]}>
                    {rk.title} · {rk.army}
                  </p>
                </div>
              </div>
            );
          })}
          {directory.length > 8 && (
            <button onClick={() => setShowAllRoster((v) => !v)}
              className="f-disp flex w-full items-center justify-center gap-1 px-3 py-2 text-[11px] uppercase tracking-wide text-amber-800 hover:bg-amber-100/50">
              {showAllRoster
                ? <><ChevronUp size={13} /> Show fewer</>
                : <><ChevronDown size={13} /> Show {directory.length - 8} more</>}
            </button>
          )}
        </Card>

        {(currentChamp || pastChamps.length > 0) && (
          <>
            <H icon={Crown}>Roll of Honour</H>
            <Card className="divide-y divide-stone-200">
              {currentChamp && (
                <div className="flex items-center justify-between bg-amber-100/50 px-3 py-2">
                  <div>
                    <p className="f-disp text-sm font-bold">{currentChamp.member}</p>
                    <p className="text-[11px] italic text-stone-500">{currentChamp.season}</p>
                  </div>
                  <span className="f-disp text-[10px] font-bold uppercase tracking-wide text-amber-700">Reigning</span>
                </div>
              )}
              {pastChamps.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="f-disp text-sm font-bold text-stone-700">{c.member}</p>
                    <p className="text-[11px] italic text-stone-500">{c.season}</p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wide text-stone-400">Former</span>
                </div>
              ))}
            </Card>
          </>
        )}
      </div>

      {showAward && (
        <Modal title="Award the Champion's Crown" onClose={() => setShowAward(false)}>
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Crowning a new champion retires the current one to the Roll of Honour.</p>
            <Sel value={awardWho} onChange={(e) => setAwardWho(e.target.value)}>
              <option value="">— choose the victor —</option>
              {Object.values(users).map((u) => <option key={u.name} value={u.name}>{u.name}</option>)}
            </Sel>
            <Inp placeholder="Season (e.g. Spring Campaign 2526)" value={awardSeason}
              onChange={(e) => setAwardSeason(e.target.value)} onKeyDown={(e) => e.key === "Enter" && awardChampion()} />
            <B kind="gold" onClick={awardChampion}><Crown size={14} /> Crown the champion</B>
          </div>
        </Modal>
      )}

      {showAvail && (
        <Modal title="Post your availability" onClose={() => setShowAvail(false)}>
          <div className="space-y-3">
            <Inp type="date" value={avDate} onChange={(e) => setAvDate(e.target.value)} />
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Type of game</p>
              <Sel value={avKind} onChange={(e) => setAvKind(e.target.value)}>
                <option value="friendly">Friendly</option>
                <option value="league">League</option>
                <option value="cup">Cup</option>
              </Sel>
            </div>
            {avKind !== "friendly" && (
              <Sel value={avPage} onChange={(e) => setAvPage(e.target.value)}>
                <option value="">— which {avKind === "league" ? "league" : "cup"}? (optional) —</option>
                {pages.filter((p) => p.kind === avKind).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Sel>
            )}
            <Inp placeholder="Note (e.g. evenings only, can host)" value={avNote} onChange={(e) => setAvNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && postAvail()} />
            <B onClick={postAvail}><Plus size={14} /> Post availability</B>
          </div>
        </Modal>
      )}

      {lb && (
        <PhotoLightbox
          photo={lb}
          src={thumbs[lb.id] || photoUrl(lb.storagePath)}
          user={user}
          onClose={() => setLbId(null)}
          onComment={addComment}
          onDelComment={delComment}
          onRename={renamePhoto}
        />
      )}
    </div>
  );
}

/* ============================================================
   LEAGUE / CUP PAGES — admin-managed tables and brackets
   ============================================================ */
function EmblemManager({ ctx, onClose }) {
  const { emblems, db, reload } = ctx;
  const [busy, setBusy] = useState("");
  const upload = async (army, file) => {
    if (!file) return;
    setBusy(army);
    try {
      const dataURL = await compressImage(file, 128, 0.9, { format: "png" });
      const res = await db.emblems.set(army, dataURL);
      if (!res.error) await reload.emblems();
    } catch (e) { /* ignore */ }
    setBusy("");
  };
  const clear = async (army) => { await db.emblems.remove(army); await reload.emblems(); };
  return (
    <Modal title="Army emblems" onClose={onClose}>
      <p className="mb-3 text-xs italic text-stone-500">Upload a small square image per army. Until you do, the default emoji is shown.</p>
      <div className="max-h-[60vh] space-y-1 overflow-y-auto">
        {ARMIES.map((a) => {
          const has = emblems.find((x) => x.army === a);
          return (
            <div key={a} className="flex items-center gap-3 border-b border-stone-200 py-1.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center"><ArmyEmblem army={a} emblems={emblems} size={22} /></span>
              <span className="f-body flex-1 text-sm">{a}</span>
              <label className="f-disp cursor-pointer rounded-sm border border-amber-700 bg-amber-600 px-2 py-1 text-xs text-stone-900 hover:bg-amber-500">
                {busy === a ? "…" : (has ? "Replace" : "Upload")}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(a, e.target.files && e.target.files[0])} />
              </label>
              {has && <button onClick={() => clear(a)} className="text-stone-400 hover:text-red-800" title="Reset to emoji"><X size={14} /></button>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function PagesTab({ ctx, kind }) {
  const { user, pages, reports, emblems, memberNames, db, reload } = ctx;
  const mine = pages.filter((p) => p.kind === kind);
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showEmblems, setShowEmblems] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [genPage, setGenPage] = useState(null);
  const [manualPage, setManualPage] = useState(null);
  const [manualRows, setManualRows] = useState([]);
  const isAdmin = user.isAdmin;
  const label = kind === "league" ? "league table" : "tourney bracket";

  const blankRow = () =>
    kind === "league"
      ? { id: uid(), player: "", army: "", p: "0", w: "0", d: "0", l: "0", pts: "0" }
      : { id: uid(), round: "Round 1", a: "", b: "", score: "" };

  const [tpl, setTpl] = useState("blank");
  const cupTemplate = (n) => {
    const rounds = n === 16
      ? [["Round of 16", 8], ["Quarter-final", 4], ["Semi-final", 2], ["Final", 1]]
      : [["Quarter-final", 4], ["Semi-final", 2], ["Final", 1]];
    const rows = [];
    for (const [name, count] of rounds)
      for (let i = 0; i < count; i++)
        rows.push({ id: uid(), round: count > 1 ? name + " " + (i + 1) : name, a: "", b: "", score: "" });
    return rows;
  };

  const createPage = async () => {
    const t = newTitle.trim();
    if (!t) return;
    const rows = kind === "cup" && tpl !== "blank" ? cupTemplate(parseInt(tpl, 10)) : [blankRow()];
    await db.pages.add({ kind, title: t, rows, info: {} });
    await reload.pages();
    setNewTitle(""); setTpl("blank"); setShowNew(false);
  };
  const updatePage = async (pg) => { await db.pages.update(pg.id, { title: pg.title, rows: pg.rows, info: pg.info || {} }); await reload.pages(); };
  const deletePage = async (id) => { await db.pages.remove(id); await reload.pages(); setEditingId(null); };

  // Recount a league table's P/W/D/L from the battle reports filed against it
  // (reports carry the competition via kind/pageId — see reports-v2.sql).
  // Names, armies and member links are kept; Pts stays derived from W and D.
  const tallyPage = async (pg) => {
    const linked = reports.filter((r) => r.pageId === pg.id && r.ranked !== false);
    if (!linked.length) {
      alert("No reports are filed against “" + pg.title + "” yet. File battle reports with “League: " + pg.title + "” set, then tally again.");
      return;
    }
    if (!confirm("Recount P / W / D / L for “" + pg.title + "” from its " + linked.length + " filed report(s)? The numbers in the table are overwritten; names, armies and links are kept.")) return;
    const rows = (pg.rows || []).map((row) => {
      const nm = row.member || (memberNames || []).find((n) => n.toLowerCase() === (row.player || "").toLowerCase()) || (row.player || "").trim();
      let p = 0, w = 0, d = 0, l = 0;
      for (const r of linked) {
        const side = nm && reportSide(r, nm);
        if (!side) continue;
        p++;
        if (r.winner === "draw") d++; else if (r.winner === side) w++; else l++;
      }
      return { ...row, p: String(p), w: String(w), d: String(d), l: String(l) };
    });
    await db.pages.update(pg.id, { rows });
    await reload.pages();
  };
  const generateFixtures = async () => {
    if (!genPage) return;
    const players = [];
    for (const r of (genPage.rows || [])) {
      const nm = r.member || (memberNames || []).find((n) => n.toLowerCase() === (r.player || "").toLowerCase()) || (r.player || "").trim();
      if (nm && !players.includes(nm)) players.push(nm);
    }
    if (players.length < 2) { setGenPage(null); return; }
    const arr = players.slice();
    if (arr.length % 2 === 1) arr.push(null); // odd count -> a bye each round
    const n = arr.length, half = n / 2, totalRounds = n - 1;
    const pairs = [];
    for (let r = 0; r < totalRounds; r++) {
      for (let i = 0; i < half; i++) {
        const a = arr[i], b = arr[n - 1 - i];
        if (a && b) pairs.push({ a, b, round: r + 1 });
      }
      arr.splice(1, 0, arr.pop()); // rotate, keeping the first player fixed
    }
    for (const p of pairs) {
      await db.fixtures.add({ playerA: p.a, playerB: p.b, date: null, points: "", kind: "league", pageId: genPage.id, scenario: "", notes: "", round: p.round });
    }
    await reload.fixtures();
    setGenPage(null);
  };

  /* manual round-by-round fixture builder (for hand-drawn schedules) */
  const blankPairing = (round) => ({ id: uid(), round: String(round || 1), a: "", b: "", date: "" });
  const openManual = (pg) => { setManualRows([blankPairing(1)]); setManualPage(pg); };
  const closeManual = () => { setManualPage(null); setManualRows([]); };
  const setMR = (id, field, val) => setManualRows((rows) => rows.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  const addMR = () => setManualRows((rows) => [...rows, blankPairing(rows.length ? rows[rows.length - 1].round : 1)]);
  const delMR = (id) => setManualRows((rows) => (rows.length > 1 ? rows.filter((r) => r.id !== id) : rows));
  const createManualFixtures = async () => {
    if (!manualPage) return;
    const valid = manualRows.filter((r) => r.a.trim() && r.b.trim());
    for (const r of valid) {
      await db.fixtures.add({
        playerA: r.a.trim(), playerB: r.b.trim(), date: r.date || null,
        points: "", kind: "league", pageId: manualPage.id, scenario: "", notes: "",
        round: parseInt(r.round, 10) || null,
      });
    }
    await reload.fixtures();
    closeManual();
  };

  return (
    <div>
      <H icon={kind === "league" ? Trophy : Crown}
        right={isAdmin && (
          <span className="flex gap-2">
            {kind === "league" && <B small kind="ghost" onClick={() => setShowEmblems(true)}><Shield size={12} /> Emblems</B>}
            <B small kind="gold" onClick={() => setShowNew(true)}><Plus size={12} /> New {label}</B>
          </span>
        )}>
        {kind === "league" ? "The League" : "The Grand Tourney"}
      </H>
      {mine.length === 0 && (
        <Empty>
          {isAdmin ? "No " + label + "s yet. Create one above, Grand Marshal." : "The Grand Marshal has not posted any " + label + "s yet."}
        </Empty>
      )}
      <div className="space-y-6">
        {mine.map((pg) => (
          <div key={pg.id}>
            <PageBlock pg={pg} kind={kind} isAdmin={isAdmin}
              editing={editingId === pg.id}
              onEdit={() => setEditingId(pg.id)}
              onDone={() => setEditingId(null)}
              onChange={updatePage}
              onDelete={() => deletePage(pg.id)}
              blankRow={blankRow} emblems={emblems} memberNames={memberNames} />
            {kind === "league" && isAdmin && (
              <div className="mt-1 flex flex-wrap justify-end gap-2">
                <B small kind="ghost" onClick={() => tallyPage(pg)}><RefreshCw size={12} /> Tally from reports</B>
                <B small kind="ghost" onClick={() => openManual(pg)}><Pencil size={12} /> Build by hand</B>
                <B small kind="ghost" onClick={() => setGenPage(pg)}><CalendarDays size={12} /> Generate fixtures</B>
              </div>
            )}
            <CommittedLists ctx={ctx} pageId={pg.id} />
          </div>
        ))}
      </div>
      {showEmblems && <EmblemManager ctx={ctx} onClose={() => setShowEmblems(false)} />}
      {genPage && (
        <Modal title={"Generate fixtures — " + genPage.title} onClose={() => setGenPage(null)}>
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Creates the full round-robin — every player meets every other once, split into rounds (Round 1, 2, …). Points and dates are left blank to set later. Players link to profiles where you've set the member link.</p>
            <B onClick={generateFixtures}><CalendarDays size={14} /> Generate rounds</B>
          </div>
        </Modal>
      )}
      {manualPage && (
        <Modal title={"Build fixtures by hand — " + manualPage.title} onClose={closeManual}>
          <datalist id="wh-manual-members">{(memberNames || []).map((n) => <option key={n} value={n} />)}</datalist>
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Draw the pairings yourself, round by round. Leave the date blank for “TBC”. Points stay blank to set later; add special rules as a round note in the Battles tab.</p>
            <div className="space-y-2">
              {manualRows.map((r) => (
                <div key={r.id} className="space-y-2 rounded-sm border border-stone-300 bg-white/40 p-2">
                  <div className="flex items-center gap-2">
                    <span className="f-disp shrink-0 text-[11px] font-bold uppercase tracking-wide text-stone-500">Round</span>
                    <div className="w-16"><Inp type="number" min="1" value={r.round} onChange={(e) => setMR(r.id, "round", e.target.value)} /></div>
                    <div className="flex-1"><Inp type="date" value={r.date} onChange={(e) => setMR(r.id, "date", e.target.value)} /></div>
                    {manualRows.length > 1 && <button onClick={() => delMR(r.id)} className="shrink-0 text-stone-400 hover:text-red-800" title="Remove pairing"><X size={14} /></button>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1"><Inp list="wh-manual-members" placeholder="Combatant A" value={r.a} onChange={(e) => setMR(r.id, "a", e.target.value)} /></div>
                    <span className="f-disp shrink-0 text-xs text-red-900">vs</span>
                    <div className="flex-1"><Inp list="wh-manual-members" placeholder="Combatant B" value={r.b} onChange={(e) => setMR(r.id, "b", e.target.value)} /></div>
                  </div>
                </div>
              ))}
            </div>
            <B small kind="ghost" onClick={addMR}><Plus size={12} /> Add pairing</B>
            <div className="pt-1"><B onClick={createManualFixtures}><CalendarDays size={14} /> Create fixtures</B></div>
          </div>
        </Modal>
      )}
      {showNew && (
        <Modal title={"New " + label} onClose={() => setShowNew(false)}>
          <div className="space-y-3">
            <Inp placeholder={kind === "league" ? "e.g. Spring Campaign 2526" : "e.g. The Marshal's Cup"} value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createPage()} />
            {kind === "cup" && (
              <div>
                <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Bracket template</p>
                <Sel value={tpl} onChange={(e) => setTpl(e.target.value)}>
                  <option value="blank">Blank (build your own)</option>
                  <option value="8">8 combatants — quarters, semis, final</option>
                  <option value="16">16 combatants — round of 16 onwards</option>
                </Sel>
              </div>
            )}
            <B onClick={createPage}><Plus size={14} /> Create</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

function PageBlock({ pg, kind, isAdmin, editing, onEdit, onDone, onChange, onDelete, blankRow, emblems, memberNames }) {
  const [draft, setDraft] = useState(pg);
  useEffect(() => { setDraft(pg); }, [pg.id, editing]);

  const [openFaq, setOpenFaq] = useState(null);
  const info = draft.info || { rules: "", points: "", faqs: [] };
  const setInfo = (field, val) => setDraft({ ...draft, info: { ...info, [field]: val } });
  const setFaqRow = (fid, field, val) =>
    setInfo("faqs", (info.faqs || []).map((f) => (f.id === fid ? { ...f, [field]: val } : f)));
  const hasInfo = !!(info.rules || info.points || (info.faqs || []).some((f) => f.q));

  const setRow = (rid, field, val) =>
    setDraft({ ...draft, rows: draft.rows.map((r) => (r.id === rid ? { ...r, [field]: val } : r)) });
  const addRow = () => setDraft({ ...draft, rows: [...draft.rows, blankRow()] });
  const delRow = (rid) => setDraft({ ...draft, rows: draft.rows.filter((r) => r.id !== rid) });
  const saveAll = async () => { await onChange(draft); onDone(); };

  const noDraws = !!info.noDraws;
  const winPts = info.winPts === "" || info.winPts == null ? 3 : Number(info.winPts);
  const drawPts = info.drawPts === "" || info.drawPts == null ? 1 : Number(info.drawPts);
  const ptsFor = (r) => (parseInt(r.w) || 0) * winPts + (noDraws ? 0 : (parseInt(r.d) || 0) * drawPts);
  const cols = kind === "league"
    ? [["player", "Player", "w-32 truncate"], ["army", "Army", "w-36"], ["p", "P", "w-10"], ["w", "W", "w-10"], ["d", "D", "w-10"], ["l", "L", "w-10"], ["pts", "Pts", "w-12"]]
        .filter(([f]) => !(f === "d" && noDraws))
    : [["round", "Round", "w-28"], ["a", "Combatant A", "flex-1"], ["b", "Combatant B", "flex-1"], ["score", "Result", "w-24"]];

  const sortedRows = kind === "league" && !editing
    ? [...pg.rows].sort((a, b) => ptsFor(b) - ptsFor(a))
    : pg.rows;
  const navigate = useNavigate();
  const MEMBER_FIELD = { player: "member", a: "aMember", b: "bMember" };
  const linkFor = (r, f) => r[MEMBER_FIELD[f]] || (memberNames || []).find((n) => n.toLowerCase() === (r[f] || "").toLowerCase()) || null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-300 bg-stone-900 px-4 py-2.5">
        {editing ? (
          <input className="f-disp w-full bg-transparent text-sm font-bold uppercase tracking-wide text-amber-200"
            value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        ) : (
          <h3 className="f-disp text-sm font-bold uppercase tracking-wide text-amber-200">{pg.title}</h3>
        )}
        {isAdmin && (
          <div className="flex shrink-0 gap-2">
            {editing ? (
              <>
                <B small kind="gold" onClick={saveAll}><Save size={12} /> Save</B>
                <B small kind="danger" onClick={() => { if (confirm("Delete \u201C" + pg.title + "\u201D for everyone?")) onDelete(); }}><Trash2 size={12} /></B>
              </>
            ) : (
              <B small kind="ghost" onClick={onEdit}><Pencil size={12} /> Edit</B>
            )}
          </div>
        )}
      </div>
      <div className="lg:grid lg:grid-cols-3">
        {(hasInfo || editing) && (
          <div className="border-b border-stone-200 p-3 lg:order-2 lg:border-b-0 lg:border-l">
            {editing ? (
              <div className="space-y-2">
                <p className="f-disp text-[11px] font-bold uppercase tracking-widest text-stone-600">The Charter</p>
                <Inp placeholder="Points format (e.g. 1,500 pts · Win 3 / Draw 1)" value={info.points}
                  onChange={(e) => setInfo("points", e.target.value)} />
                <TA rows={4} placeholder="League rules (composition limits, deadlines, scoring…)" value={info.rules}
                  onChange={(e) => setInfo("rules", e.target.value)} />
                {kind === "league" && (
                  <label className="f-body flex items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" checked={!!info.noDraws} onChange={(e) => setInfo("noDraws", e.target.checked)} />
                    No draws (play for victory — hides the D column)
                  </label>
                )}
                {kind === "league" && (
                  <div className="flex gap-2">
                    <label className="f-body flex-1 text-[11px] font-bold uppercase tracking-widest text-stone-600">
                      Points per win
                      <Inp type="number" min="0" value={info.winPts ?? ""} placeholder="3" onChange={(e) => setInfo("winPts", e.target.value)} />
                    </label>
                    {!info.noDraws && (
                      <label className="f-body flex-1 text-[11px] font-bold uppercase tracking-widest text-stone-600">
                        Points per draw
                        <Inp type="number" min="0" value={info.drawPts ?? ""} placeholder="1" onChange={(e) => setInfo("drawPts", e.target.value)} />
                      </label>
                    )}
                  </div>
                )}
                {kind === "league" && (
                  <p className="f-body text-[11px] italic text-stone-500">Pts are worked out automatically from W and D.</p>
                )}
                <p className="f-disp pt-1 text-[11px] font-bold uppercase tracking-widest text-stone-600">FAQs</p>
                {(info.faqs || []).map((f) => (
                  <div key={f.id} className="space-y-1 rounded-sm border border-stone-300 bg-stone-50/60 p-2">
                    <Inp placeholder="Question" value={f.q} onChange={(e) => setFaqRow(f.id, "q", e.target.value)} />
                    <TA rows={2} placeholder="Answer" value={f.a} onChange={(e) => setFaqRow(f.id, "a", e.target.value)} />
                    <button onClick={() => setInfo("faqs", info.faqs.filter((x) => x.id !== f.id))}
                      className="text-stone-400 hover:text-red-800"><Trash2 size={13} /></button>
                  </div>
                ))}
                <B small kind="ghost" onClick={() => setInfo("faqs", [...(info.faqs || []), { id: uid(), q: "", a: "" }])}>
                  <Plus size={12} /> Add FAQ
                </B>
              </div>
            ) : (
              <div>
                <p className="f-disp mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-800">
                  <Scroll size={12} /> The Charter
                </p>
                {info.points && (
                  <p className="f-disp mb-2 rounded-sm border border-amber-700/40 bg-amber-100/60 px-2 py-1.5 text-xs font-bold text-stone-800">
                    {info.points}
                  </p>
                )}
                {info.rules && <p className="whitespace-pre-wrap text-sm text-stone-700">{info.rules}</p>}
                {(info.faqs || []).filter((f) => f.q).length > 0 && (
                  <div className="mt-3 space-y-1">
                    {info.faqs.filter((f) => f.q).map((f) => (
                      <div key={f.id} className="rounded-sm border border-stone-200 bg-white/50">
                        <button className="flex w-full items-center justify-between gap-1 px-2 py-1.5 text-left"
                          onClick={() => setOpenFaq(openFaq === f.id ? null : f.id)}>
                          <span className="text-xs font-medium">{f.q}</span>
                          <ChevronRight size={12} className={"shrink-0 text-stone-400 transition-transform " + (openFaq === f.id ? "rotate-90" : "")} />
                        </button>
                        {openFaq === f.id && (
                          <p className="whitespace-pre-wrap border-t border-stone-200 px-2 py-1.5 text-xs text-stone-700">
                            {f.a || "No answer recorded."}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <div className={"overflow-x-auto p-3 " + (hasInfo || editing ? "lg:order-1 lg:col-span-2" : "lg:col-span-3")}>
        <div className={kind === "league" ? "min-w-[560px]" : "min-w-[420px]"}>
          <div className="flex gap-2 border-b border-stone-300 pb-1">
            {cols.map(([f, lab, w]) => (
              <span key={f} className={"f-disp text-[11px] font-bold uppercase tracking-wide text-stone-500 " + w}>{lab}</span>
            ))}
            {editing && <span className="w-8" />}
          </div>
          {(editing ? draft.rows : sortedRows).map((r, i, arr) => {
            const baseRound = (x) => (x.round || "").replace(/\s*\d+$/, "");
            const showRoundHeader =
              kind === "cup" && !editing &&
              (i === 0 || baseRound(r) !== baseRound(arr[i - 1]));
            const rowCls = kind === "league" && !editing
              ? "border-l-4 pl-2 " + armyStyle(r.army)
              : i % 2 ? "bg-stone-100/60" : "";
            return (
              <div key={r.id}>
                {showRoundHeader && (
                  <p className="f-disp mt-3 border-b border-amber-700/40 pb-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-800 first:mt-1">
                    {baseRound(r) || "Round"}
                  </p>
                )}
                <div className={"flex items-center gap-2 py-1.5 " + rowCls}>
                  {cols.map(([f, lab, w]) => {
                    const linkable = f === "player" || f === "a" || f === "b";
                    if (editing) {
                      if (f === "army") return (
                        <select key={f} value={r[f] || ""} onChange={(e) => setRow(r.id, f, e.target.value)}
                          className={"f-body rounded-sm border border-stone-300 bg-white px-1 py-1 text-sm " + w}>
                          <option value="">— army —</option>
                          {ARMIES.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      );
                      if (linkable) return (
                        <div key={f} className={"flex flex-col gap-1 " + w}>
                          <input value={r[f] || ""} onChange={(e) => setRow(r.id, f, e.target.value)} placeholder={f === "player" ? "Name" : "Combatant"}
                            className="f-body rounded-sm border border-stone-300 bg-white px-2 py-1 text-sm" />
                          <select value={r[MEMBER_FIELD[f]] || ""} onChange={(e) => setRow(r.id, MEMBER_FIELD[f], e.target.value)} title="Link to a member's profile"
                            className="f-body rounded-sm border border-stone-300 bg-white px-1 py-1 text-[11px] text-stone-500">
                            <option value="">— link to member —</option>
                            {(memberNames || []).map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      );
                      if (f === "pts" && kind === "league") return (
                        <span key={f} title="Auto-calculated from W and D"
                          className={"f-body flex items-center px-2 py-1 text-sm font-bold text-red-900 " + w}>{ptsFor(r)}</span>
                      );
                      return (
                        <input key={f} value={r[f]} onChange={(e) => setRow(r.id, f, e.target.value)}
                          className={"f-body rounded-sm border border-stone-300 bg-white px-2 py-1 text-sm " + w} />
                      );
                    }
                    if (f === "army") return (
                      <span key={f} className={"f-body flex items-center gap-1 text-xs italic text-stone-600 " + w}><ArmyEmblem army={r[f]} emblems={emblems} size={14} /><span className="truncate">{r[f] || ""}</span></span>
                    );
                    if (linkable) {
                      const m = linkFor(r, f);
                      return m
                        ? <button key={f} onClick={() => navigate("/member/" + encodeURIComponent(m))} className={"f-body text-left text-sm font-medium text-red-900 hover:underline " + w}>{r[f]}</button>
                        : <span key={f} className={"f-body text-sm font-medium " + w}>{r[f]}</span>;
                    }
                    return (
                      <span key={f} className={"f-body text-sm " + w + (f === "pts" ? " font-bold text-red-900" : "")}>{f === "pts" && kind === "league" ? ptsFor(r) : r[f]}</span>
                    );
                  })}
                  {editing && (
                    <button onClick={() => delRow(r.id)} className="w-8 text-stone-400 hover:text-red-800"><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
            );
          })}
          {editing && <B small kind="ghost" onClick={addRow}><Plus size={12} /> Add row</B>}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   COMMITTED ARMY LISTS — lodged against a league/cup, then sealed
   so a list can't be tailored to the opponent between rounds.
   ============================================================ */
function CommittedLists({ ctx, pageId }) {
  const { user, memberNames, committedLists, db, reload } = ctx;
  const navigate = useNavigate();
  const lists = (committedLists || [])
    .filter((c) => c.pageId === pageId)
    .sort((a, b) => (a.player || "").localeCompare(b.player || "") || a.created - b.created);

  const [player, setPlayer] = useState("");
  const [points, setPoints] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ points: "", body: "" });

  const canTouch = (c) => user.isAdmin || c.author === user.name;
  const sealWarn = (name) => "Seal " + name + "’s list? Once committed it cannot be changed — only the Grand Marshal can unseal it.";

  const save = async (commit) => {
    const p = player.trim();
    if (!p) { setErr("Choose or name a player first."); return; }
    if (!body.trim()) { setErr("Write the army list in the box first."); return; }
    if (commit && !confirm(sealWarn(p))) return;
    setErr(""); setBusy(true);
    const member = (memberNames || []).find((n) => n.toLowerCase() === p.toLowerCase()) || null;
    const res = await db.committedLists.add({
      pageId, player: p, member, points: points.trim(), body: body.trim(),
      committed: !!commit, author: user.name,
    });
    setBusy(false);
    if (res?.error) { setErr("Couldn't save the list. " + (res.error.message || "Has the committed-lists migration been run?")); return; }
    setPlayer(""); setPoints(""); setBody("");
    await reload.committedLists();
  };

  const startEdit = (c) => { setEditId(c.id); setEdit({ points: c.points || "", body: c.body || "" }); };
  const saveEdit = async (c) => {
    await db.committedLists.update(c.id, { points: edit.points.trim() || null, body: edit.body.trim() });
    setEditId(null);
    await reload.committedLists();
  };
  const commit = async (c) => { if (confirm(sealWarn(c.player))) { await db.committedLists.commit(c.id); await reload.committedLists(); } };
  const uncommit = async (c) => { if (confirm("Unseal " + c.player + "’s list so it can be edited again?")) { await db.committedLists.uncommit(c.id); await reload.committedLists(); } };
  const remove = async (c) => { if (confirm("Delete " + c.player + "’s committed list?")) { await db.committedLists.remove(c.id); await reload.committedLists(); } };

  return (
    <Card className="mt-2 p-3">
      <p className="f-disp mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-800">
        <Scroll size={12} /> Committed army lists
      </p>
      <p className="f-body mb-3 text-[11px] italic text-stone-500">
        Lodge a list and seal it. Once committed it can&rsquo;t be changed &mdash; so there&rsquo;s no tailoring your army to your opponent between rounds. Only the Grand Marshal can unseal a list.
      </p>

      {lists.length === 0 ? (
        <p className="f-body mb-3 text-sm italic text-stone-500">No lists committed yet.</p>
      ) : (
        <div className="mb-4 space-y-2">
          {lists.map((c) => (
            <div key={c.id} className={"rounded-sm border p-2.5 " + (c.committed ? "border-amber-700/50 bg-amber-50/70" : "border-dashed border-stone-300 bg-white/50")}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="f-disp text-sm font-bold text-stone-800">
                    {c.member
                      ? <button onClick={() => navigate("/member/" + encodeURIComponent(c.member))} className="text-red-900 hover:underline">{c.player}</button>
                      : c.player}
                    {c.points ? <span className="f-body ml-1 text-xs italic text-stone-500">&middot; {c.points} pts</span> : null}
                  </p>
                  {!c.committed && <p className="f-disp text-[10px] uppercase tracking-wide text-stone-400">Draft &mdash; not yet sealed</p>}
                </div>
                {c.committed && <CommittedSeal size={62} />}
              </div>

              {editId === c.id ? (
                <div className="mt-2 space-y-2">
                  <Inp placeholder="Points (e.g. 750)" value={edit.points} onChange={(e) => setEdit({ ...edit, points: e.target.value })} />
                  <TA rows={6} value={edit.body} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
                  <div className="flex gap-2">
                    <B small kind="gold" onClick={() => saveEdit(c)}><Save size={12} /> Save</B>
                    <B small kind="ghost" onClick={() => setEditId(null)}>Cancel</B>
                  </div>
                </div>
              ) : (
                <pre className="f-body mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap break-words rounded-sm border border-stone-200 bg-white/70 p-2 text-xs text-stone-700">{c.body || "—"}</pre>
              )}

              {editId !== c.id && (user.isAdmin || (canTouch(c) && !c.committed)) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.committed ? (
                    <B small kind="ghost" onClick={() => uncommit(c)}><Pencil size={12} /> Unseal</B>
                  ) : (
                    <>
                      <B small kind="ghost" onClick={() => startEdit(c)}><Pencil size={12} /> Edit</B>
                      <B small kind="gold" onClick={() => commit(c)}><Shield size={12} /> Commit &amp; seal</B>
                    </>
                  )}
                  {(user.isAdmin || (c.author === user.name && !c.committed)) && (
                    <B small kind="danger" onClick={() => remove(c)} title="Delete"><Trash2 size={12} /></B>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-sm border border-stone-300 bg-stone-50/60 p-2.5">
        <p className="f-disp text-[11px] font-bold uppercase tracking-wide text-stone-600">Lodge a list</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:flex-1"><MemberPicker members={memberNames} placeholder="Player" value={player} onChange={(v) => setPlayer(v)} /></div>
          <div className="sm:w-36"><Inp placeholder="Points (e.g. 750)" value={points} onChange={(e) => setPoints(e.target.value)} /></div>
        </div>
        <TA rows={6} placeholder="Paste the army list here&hellip;" value={body} onChange={(e) => setBody(e.target.value)} />
        {err && <p className="f-body text-sm text-red-800">{err}</p>}
        <div className="flex flex-wrap gap-2">
          <B kind="gold" disabled={busy} onClick={() => save(true)}><Shield size={14} /> {busy ? "Saving…" : "Commit & seal"}</B>
          <B kind="ghost" disabled={busy} onClick={() => save(false)}><Save size={14} /> Save as draft</B>
        </div>
      </div>
    </Card>
  );
}

/* ============================================================
   BATTLES — fixtures (admin) + battle reports (anyone)
   ============================================================ */
/* Member autocomplete for the battle forms. Replaces the native <datalist>,
   whose suggestion dropdown is unreliable on iOS Safari (it often shows nothing).
   Filters the member list as you type and shows a tappable list that behaves the
   same on every device. Must live at module scope so it isn't re-created — and
   the input re-mounted, dropping focus — on every keystroke. Free text is still
   allowed; the battle forms validate against the member list on save.
   onChange is called with the string value (not a DOM event). */
function MemberPicker({ value, onChange, placeholder, members }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  useEffect(() => {
    const onDoc = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, []);
  const q = (value || "").trim().toLowerCase();
  const matches = (members || []).filter((n) => !q || n.toLowerCase().includes(q)).slice(0, 8);
  const onlyExact = matches.length === 1 && matches[0].toLowerCase() === q;
  return (
    <div ref={wrap} className="relative">
      <Inp placeholder={placeholder} value={value} autoCorrect="off" autoCapitalize="words"
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)} />
      {open && matches.length > 0 && !onlyExact && (
        <ul className="absolute left-0 right-0 z-30 mt-1 max-h-52 overflow-auto rounded-sm border border-amber-800/50 bg-stone-50 shadow-xl">
          {matches.map((n) => (
            <li key={n}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(n); setOpen(false); }}
                className="f-body block w-full px-3 py-2 text-left text-sm text-stone-800 hover:bg-amber-100 active:bg-amber-200">
                {n}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BattlesTab({ ctx }) {
  const { user, memberNames, fixtures, reports, pages, db, reload } = ctx;
  const navigate = useNavigate();
  const [showFx, setShowFx] = useState(false);
  const [editingFx, setEditingFx] = useState(null); // fixture id while editing; null when scheduling new
  const [showRp, setShowRp] = useState(false);
  const blankFx = () => ({ playerA: "", playerB: "", date: today(), points: "1500", kind: "friendly", pageId: "", scenario: "", notes: "" });
  const [fx, setFx] = useState(blankFx());
  const blankReport = () => ({
    playerA: "", playerB: "", armyA: "", armyB: "", date: today(), points: "1500",
    winner: "A", margin: "victory", ranked: true, score: "", moment: "", shame: [],
    doubles: false, playerA2: "", playerB2: "", armyA2: "", armyB2: "",
    kind: "friendly", pageId: "",
  });
  const [rp, setRp] = useState(blankReport());
  const [playedFx, setPlayedFx] = useState(null); // fixture id when filing from "game played"; null otherwise
  const [editingRp, setEditingRp] = useState(null); // report id while editing; null when filing new
  const [err, setErr] = useState("");

  // Resolve a typed name to the exact member name (case-insensitive), or "" if
  // they're not on the muster roll. Keeps standings/ELO from fragmenting on
  // typos or casing, and lets us refuse names that aren't real members.
  const canonName = (s) => (memberNames || []).find((n) => n.toLowerCase() === (s || "").trim().toLowerCase()) || "";

  const openAddFx = () => { setErr(""); setEditingFx(null); setFx(blankFx()); setShowFx(true); };
  const openEditFx = (f) => {
    setErr(""); setEditingFx(f.id);
    setFx({
      playerA: f.playerA || "", playerB: f.playerB || "", date: f.date || "",
      points: f.points || "", kind: f.kind || "friendly", pageId: f.pageId || "",
      scenario: f.scenario || "", notes: f.notes || "", round: f.round, // round carried through invisibly
    });
    setShowFx(true);
  };
  // Toggle a fixture's date between "to be confirmed" (empty) and a real date.
  const setFxTbc = (tbc) => setFx((p) => ({ ...p, date: tbc ? "" : today() }));
  const closeFx = () => { setShowFx(false); setEditingFx(null); setFx(blankFx()); };
  const saveFixture = async () => {
    setErr("");
    if (!fx.playerA.trim() || !fx.playerB.trim()) { setErr("Name both combatants."); return; }
    const a = canonName(fx.playerA), b = canonName(fx.playerB);
    if (!a || !b) { setErr("“" + (a ? fx.playerB : fx.playerA).trim() + "” isn’t a registered member — pick a name from the list."); return; }
    if (editingFx) await db.fixtures.update(editingFx, { ...fx, playerA: a, playerB: b });
    else await db.fixtures.add({ ...fx, playerA: a, playerB: b });
    await reload.fixtures();
    closeFx();
  };
  const delFixture = async (id) => { await db.fixtures.remove(id); await reload.fixtures(); };
  const saveRoundNote = async (pg, k, val) => {
    if (!pg) return;
    const v = (val || "").trim();
    const rounds = { ...(pg.info?.rounds || {}) };
    if (v) rounds[k] = v; else delete rounds[k];
    await db.pages.update(pg.id, { info: { ...(pg.info || {}), rounds } });
    await reload.pages();
  };

  // Open the battle-report form pre-filled from a scheduled fixture — "this game
  // has been played". Filing the report then strikes the fixture off the slate.
  const openPlayedFx = (f) => {
    setErr("");
    // A league fixture can be stored under a table-row label rather than a
    // username — resolve each side to the real member so the pre-filled names
    // pass the muster-roll check on save.
    const a = fixtureSide(pages, memberNames, f, "playerA");
    const b = fixtureSide(pages, memberNames, f, "playerB");
    setRp({
      ...blankReport(),
      playerA: a.member || f.playerA || "", playerB: b.member || f.playerB || "",
      date: f.date || today(), points: f.points || "1500",
      kind: f.kind || "friendly", pageId: f.pageId || "", // competition carries onto the report
    });
    setPlayedFx(f.id);
    setEditingRp(null);
    setShowRp(true);
  };
  const openAddRp = () => { setErr(""); setRp(blankReport()); setPlayedFx(null); setEditingRp(null); setShowRp(true); };
  const openEditRp = (r) => {
    setErr(""); setEditingRp(r.id); setPlayedFx(null);
    setRp({
      playerA: r.playerA || "", playerB: r.playerB || "", armyA: r.armyA || "", armyB: r.armyB || "",
      date: r.date || today(), points: r.points || "", winner: r.winner || "A",
      margin: r.margin || "victory", ranked: r.ranked !== false, score: r.score || "",
      moment: r.moment || "", shame: r.shame || [],
      doubles: !!r.doubles, playerA2: r.playerA2 || "", playerB2: r.playerB2 || "",
      armyA2: r.armyA2 || "", armyB2: r.armyB2 || "",
      kind: r.kind || "friendly", pageId: r.pageId || "",
    });
    setShowRp(true);
  };
  const closeRp = () => { setShowRp(false); setPlayedFx(null); setEditingRp(null); setRp(blankReport()); };

  const addReport = async () => {
    setErr("");
    if (!rp.playerA.trim() || !rp.playerB.trim()) { setErr("Name both combatants."); return; }
    const a = canonName(rp.playerA), b = canonName(rp.playerB);
    if (!a || !b) { setErr("“" + (a ? rp.playerB : rp.playerA).trim() + "” isn’t a registered member — pick a name from the list."); return; }
    let a2 = "", b2 = "";
    if (rp.doubles) {
      if (!rp.playerA2.trim() || !rp.playerB2.trim()) { setErr("A doubles game needs a partner on each side."); return; }
      a2 = canonName(rp.playerA2); b2 = canonName(rp.playerB2);
      if (!a2 || !b2) { setErr("“" + (a2 ? rp.playerB2 : rp.playerA2).trim() + "” isn’t a registered member — pick a name from the list."); return; }
      const team = [a, a2, b, b2];
      if (new Set(team).size !== team.length) { setErr("Each of the four players must be different."); return; }
    }
    const clean = { ...rp, playerA: a, playerB: b, playerA2: a2, playerB2: b2 };
    const res = editingRp
      ? await db.reports.update(editingRp, clean)
      : await db.reports.add({ ...clean, filedBy: user.name });
    if (res.error) { setErr("Filing failed — the record was not saved. " + (res.error.message || "Try again.")); return; }
    // Strike the played fixture only once the report is safely filed. Best
    // effort: RLS lets a member delete a fixture they're named in (see
    // supabase/fixtures-played.sql); anything else stays for the Marshal.
    if (playedFx) await db.fixtures.remove(playedFx);
    await reload.reports();
    if (playedFx) await reload.fixtures();
    closeRp();
  };
  const delReport = async (r) => {
    if (!(user.isAdmin || r.filedBy === user.name)) return;
    if (!confirm("Strike this battle from the record? It affects the ladder.")) return;
    await db.reports.remove(r.id);
    await reload.reports();
  };

  const setShame = (i, field, val) => {
    const s = [...rp.shame]; s[i] = { ...s[i], [field]: val }; setRp({ ...rp, shame: s });
  };

  const sortedFixtures = [...fixtures].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const sortedReports = [...reports].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.created - a.created);
  const ladder = computeStandings(reports);
  const pairLadder = doublesLadder(reports);

  return (
    <div>
      <H icon={CalendarDays} right={user.isAdmin && <B small kind="gold" onClick={openAddFx}><Plus size={12} /> Schedule battle</B>}>
        Scheduled battles
      </H>
      {sortedFixtures.length === 0 ? (
        <Empty>Nothing scheduled. {user.isAdmin ? "Sort it out, Grand Marshal." : "Pester the Grand Marshal."}</Empty>
      ) : (() => {
        const fxCard = (f) => (
          <Card key={f.id} className="flex items-center justify-between gap-3 p-3">
            <div>
              <p className="f-disp text-sm font-bold"><FxSide f={f} side="playerA" pages={pages} memberNames={memberNames} navigate={navigate} /> <span className="text-red-900">vs</span> <FxSide f={f} side="playerB" pages={pages} memberNames={memberNames} navigate={navigate} /></p>
              <p className="text-xs italic text-stone-500">{fmtDate(f.date)} · {competitionLabel(pages, f)}{f.points ? " · " + f.points + " pts" : ""}{f.scenario ? " · " + f.scenario : ""}{f.notes ? " · " + f.notes : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => openPlayedFx(f)} title="This game has been played — file the result" className="text-stone-400 hover:text-red-900"><Swords size={14} /></button>
              {user.isAdmin && (
                <>
                  <button onClick={() => openEditFx(f)} title="Edit this fixture" className="text-stone-400 hover:text-amber-700"><Pencil size={14} /></button>
                  <button onClick={() => delFixture(f.id)} title="Delete this fixture" className="text-stone-400 hover:text-red-800"><Trash2 size={14} /></button>
                </>
              )}
            </div>
          </Card>
        );
        // Group by competition first, then by round, so two leagues both running
        // "Round 1" no longer collapse under a single shared header. Rounds carry
        // a pageId (set by the scheduler); friendlies and roundless fixtures fall
        // through to "Other battles".
        const comps = new Map(); // pageId|"_" -> { page, rounds: { [round]: fixtures[] } }
        const noRound = [];
        for (const f of sortedFixtures) {
          if (f.round == null) { noRound.push(f); continue; }
          const key = f.pageId || "_";
          if (!comps.has(key)) comps.set(key, { page: pages.find((p) => p.id === f.pageId) || null, rounds: {} });
          const c = comps.get(key);
          (c.rounds[f.round] = c.rounds[f.round] || []).push(f);
        }
        const compEntries = [...comps.values()].sort((a, b) => (a.page?.title || "~").localeCompare(b.page?.title || "~"));
        const showCompHeads = compEntries.length > 1; // only label competitions when more than one is live
        const roundBlock = (page, k, fixtures) => {
          const note = page?.info?.rounds?.[k];
          return (
            <div key={(page?.id || "_") + ":" + k}>
              <p className="f-disp mb-1 border-b border-amber-700/40 pb-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-800">Round {k}</p>
              {user.isAdmin && page ? (
                <input
                  defaultValue={note || ""}
                  placeholder="Add a note for this round (e.g. 750 pts · special rules)…"
                  onBlur={(e) => { if ((e.target.value || "").trim() !== (note || "")) saveRoundNote(page, k, e.target.value); }}
                  className="field mb-2 w-full px-2 py-1 text-[11px] italic"
                />
              ) : note ? (
                <p className="mb-2 text-[11px] italic text-stone-600">{note}</p>
              ) : null}
              <div className="space-y-2">{fixtures.map(fxCard)}</div>
            </div>
          );
        };
        return (
          <div className="space-y-4">
            {compEntries.map((c) => {
              const rkeys = Object.keys(c.rounds).map(Number).sort((a, b) => a - b);
              return (
                <div key={c.page?.id || "_"} className="space-y-3">
                  {showCompHeads && (
                    <p className="f-black text-base leading-tight text-red-950">{c.page ? c.page.title : "Other fixtures"}</p>
                  )}
                  {rkeys.map((k) => roundBlock(c.page, k, c.rounds[k]))}
                </div>
              );
            })}
            {noRound.length > 0 && (
              <div>
                {comps.size > 0 && <p className="f-disp mb-2 border-b border-amber-700/40 pb-0.5 text-[11px] font-bold uppercase tracking-widest text-amber-800">Other battles</p>}
                <div className="space-y-2">{noRound.map(fxCard)}</div>
              </div>
            )}
          </div>
        );
      })()}

      <H icon={Swords} right={<B small kind="gold" onClick={openAddRp}><Plus size={12} /> File battle report</B>}>
        Battle reports
      </H>
      {sortedReports.length === 0 ? (
        <Empty>The chronicles are empty. File the first report and shape history in your favour.</Empty>
      ) : (
        <div className="space-y-3">
          {sortedReports.map((r) => {
            const sideName = (side) => {
              const lead = side === "A" ? r.playerA : r.playerB;
              const mate = side === "A" ? r.playerA2 : r.playerB2;
              return r.doubles && mate ? lead + " & " + mate : lead;
            };
            // Combined armies for a side — "Empire & Skaven" when both doubles
            // partners recorded theirs, otherwise whichever is known.
            const sideArmies = (side) => {
              const lead = side === "A" ? r.armyA : r.armyB;
              const mate = r.doubles ? (side === "A" ? r.armyA2 : r.armyB2) : "";
              return [lead, mate].filter(Boolean).join(" & ");
            };
            const winName = r.winner === "A" ? sideName("A") : r.winner === "B" ? sideName("B") : null;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="f-disp text-sm font-bold">
                      <span className={r.winner === "A" ? "text-red-900" : ""}>{sideName("A")}</span>
                      {sideArmies("A") ? <span className="font-normal italic text-stone-500"> ({sideArmies("A")})</span> : null}
                      <span className="px-1.5 text-stone-400">vs</span>
                      <span className={r.winner === "B" ? "text-red-900" : ""}>{sideName("B")}</span>
                      {sideArmies("B") ? <span className="font-normal italic text-stone-500"> ({sideArmies("B")})</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {fmtDate(r.date)} · {r.points} pts · {winName ? (MARGIN_LABEL[r.margin] || "Victory") + ": " + winName : "Bloody draw"}{r.score ? " · " + r.score : ""}{r.kind ? " · " + competitionLabel(pages, r) : ""}{r.doubles ? " · Doubles" : ""}{r.ranked === false ? " · Casual" : ""}
                    </p>
                  </div>
                  {(user.isAdmin || r.filedBy === user.name) && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button onClick={() => openEditRp(r)} title="Correct this report" className="text-stone-400 hover:text-amber-700"><Pencil size={14} /></button>
                      <button onClick={() => delReport(r)} title="Strike this report" className="text-stone-400 hover:text-red-800"><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
                {r.moment && (
                  <p className="mt-2 border-l-2 border-amber-600 pl-3 text-sm italic text-stone-700">
                    Moment of the match: {r.moment}
                  </p>
                )}
                {(r.shame || []).filter((s) => s.player).length > 0 && (
                  <p className="mt-2 text-xs text-stone-600">
                    <Skull size={11} className="mr-1 inline text-red-900" />
                    {r.shame.filter((s) => s.player).map((s) => s.player + " rolled " + s.ones + " ones" + (s.note ? " (" + s.note + ")" : "")).join("; ")}
                  </p>
                )}
                <p className="mt-2 text-right text-[10px] italic text-stone-400">Filed by {r.filedBy}</p>
              </Card>
            );
          })}
        </div>
      )}

      <H icon={Trophy}>Full standings</H>
      {ladder.length === 0 ? <Empty>Standings appear once reports are filed.</Empty> : (
        <Card className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="f-disp flex gap-2 border-b border-stone-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">
              <span className="w-8">#</span><span className="flex-1">Player</span>
              <span className="w-10">P</span><span className="w-10">W</span><span className="w-10">D</span><span className="w-10">L</span>
              <span className="w-12">Pts</span><span className="w-14 text-right">Might</span>
            </div>
            {ladder.map((r, i) => (
              <div key={r.name} className={"flex items-center gap-2 px-3 py-2 text-sm " + (i % 2 ? "bg-stone-100/60" : "")}>
                <span className="f-disp w-8 font-bold text-stone-400">{i + 1}</span>
                <span className="f-disp flex-1 font-bold">{r.name}</span>
                <span className="w-10">{r.p}</span><span className="w-10">{r.w}</span>
                <span className="w-10">{r.d}</span><span className="w-10">{r.l}</span>
                <span className="w-12 font-bold">{r.pts}</span>
                <span className="w-14 text-right font-bold text-red-900">{r.elo}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pairLadder.length > 0 && (
        <>
          <H icon={Medal}>Doubles pairs</H>
          <Card className="overflow-x-auto">
            <div className="min-w-[360px]">
              <div className="f-disp flex gap-2 border-b border-stone-300 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-stone-500">
                <span className="w-8">#</span><span className="flex-1">Pair</span>
                <span className="w-10">P</span><span className="w-10">W</span><span className="w-10">D</span><span className="w-10">L</span>
              </div>
              {pairLadder.map((r, i) => (
                <div key={r.pair} className={"flex items-center gap-2 px-3 py-2 text-sm " + (i % 2 ? "bg-stone-100/60" : "")}>
                  <span className="f-disp w-8 font-bold text-stone-400">{i + 1}</span>
                  <span className="f-disp flex-1 font-bold">{r.pair}</span>
                  <span className="w-10">{r.p}</span><span className="w-10 font-bold text-green-800">{r.w}</span>
                  <span className="w-10">{r.d}</span><span className="w-10 text-red-900">{r.l}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {showFx && (
        <Modal title={editingFx ? "Edit fixture" : "Schedule a battle"} onClose={closeFx}>
          <div className="space-y-3">
            <MemberPicker members={memberNames} placeholder="Combatant A" value={fx.playerA} onChange={(v) => setFx({ ...fx, playerA: v })} />
            <MemberPicker members={memberNames} placeholder="Combatant B" value={fx.playerB} onChange={(v) => setFx({ ...fx, playerB: v })} />
            <div className="grid grid-cols-2 gap-3">
              {fx.date ? (
                <Inp type="date" value={fx.date} onChange={(e) => setFx({ ...fx, date: e.target.value })} />
              ) : (
                <div className="f-body flex w-full items-center rounded-sm border border-amber-800/40 px-3 py-2 text-sm italic text-stone-500">Date to be confirmed</div>
              )}
              <Inp placeholder="Points (e.g. 1500)" value={fx.points} onChange={(e) => setFx({ ...fx, points: e.target.value })} />
            </div>
            <label className="f-body flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={!fx.date} onChange={(e) => setFxTbc(e.target.checked)} />
              Date to be confirmed (TBC)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Sel value={fx.kind} onChange={(e) => setFx({ ...fx, kind: e.target.value, pageId: "" })}>
                <option value="friendly">Friendly</option>
                <option value="league">League</option>
                <option value="cup">Cup</option>
              </Sel>
              {fx.kind !== "friendly" ? (
                <Sel value={fx.pageId} onChange={(e) => setFx({ ...fx, pageId: e.target.value })}>
                  <option value="">— which {fx.kind === "league" ? "league" : "cup"}? —</option>
                  {pages.filter((p) => p.kind === fx.kind).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </Sel>
              ) : <div />}
            </div>
            <Inp placeholder="Scenario (e.g. Dawn Attack)" value={fx.scenario} onChange={(e) => setFx({ ...fx, scenario: e.target.value })} />
            <Inp placeholder="Notes (venue, etc.)" value={fx.notes} onChange={(e) => setFx({ ...fx, notes: e.target.value })} />
            {err && <p className="f-body text-sm font-bold text-red-800">{err}</p>}
            <B onClick={saveFixture}><Plus size={14} /> {editingFx ? "Save changes" : "Schedule"}</B>
          </div>
        </Modal>
      )}

      {showRp && (
        <Modal title={editingRp ? "Edit battle report" : playedFx ? "Record the result" : "File a battle report"} onClose={closeRp}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <MemberPicker members={memberNames} placeholder={rp.doubles ? "Side A — player 1" : "Combatant A"} value={rp.playerA} onChange={(v) => setRp({ ...rp, playerA: v })} />
              <MemberPicker members={memberNames} placeholder={rp.doubles ? "Side B — player 1" : "Combatant B"} value={rp.playerB} onChange={(v) => setRp({ ...rp, playerB: v })} />
              <Sel value={rp.armyA} onChange={(e) => setRp({ ...rp, armyA: e.target.value })}>
                <option value="">{rp.doubles ? "— Army: A player 1 —" : "— Army A —"}</option>
                {ARMIES.map((a) => <option key={a}>{a}</option>)}
              </Sel>
              <Sel value={rp.armyB} onChange={(e) => setRp({ ...rp, armyB: e.target.value })}>
                <option value="">{rp.doubles ? "— Army: B player 1 —" : "— Army B —"}</option>
                {ARMIES.map((a) => <option key={a}>{a}</option>)}
              </Sel>
              {rp.doubles && (
                <>
                  <MemberPicker members={memberNames} placeholder="Side A — player 2" value={rp.playerA2} onChange={(v) => setRp({ ...rp, playerA2: v })} />
                  <MemberPicker members={memberNames} placeholder="Side B — player 2" value={rp.playerB2} onChange={(v) => setRp({ ...rp, playerB2: v })} />
                  <Sel value={rp.armyA2} onChange={(e) => setRp({ ...rp, armyA2: e.target.value })}>
                    <option value="">— Army: A player 2 —</option>
                    {ARMIES.map((a) => <option key={a}>{a}</option>)}
                  </Sel>
                  <Sel value={rp.armyB2} onChange={(e) => setRp({ ...rp, armyB2: e.target.value })}>
                    <option value="">— Army: B player 2 —</option>
                    {ARMIES.map((a) => <option key={a}>{a}</option>)}
                  </Sel>
                </>
              )}
              <Inp type="date" value={rp.date} onChange={(e) => setRp({ ...rp, date: e.target.value })} />
              <Inp placeholder="Points" value={rp.points} onChange={(e) => setRp({ ...rp, points: e.target.value })} />
            </div>
            <label className="f-body flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={rp.doubles} onChange={(e) => setRp({ ...rp, doubles: e.target.checked })} />
              Doubles (2v2) — add a partner on each side; scoring stays the same for everyone
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Sel value={rp.kind} onChange={(e) => setRp({ ...rp, kind: e.target.value, pageId: "" })}>
                <option value="friendly">Friendly</option>
                <option value="league">League</option>
                <option value="cup">Cup</option>
              </Sel>
              {rp.kind !== "friendly" ? (
                <Sel value={rp.pageId} onChange={(e) => setRp({ ...rp, pageId: e.target.value })}>
                  <option value="">— which {rp.kind === "league" ? "league" : "cup"}? —</option>
                  {pages.filter((p) => p.kind === rp.kind).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </Sel>
              ) : <div />}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Sel value={rp.winner} onChange={(e) => setRp({ ...rp, winner: e.target.value })}>
                <option value="A">Victory: Side A</option>
                <option value="B">Victory: Side B</option>
                <option value="draw">Draw</option>
              </Sel>
              {rp.winner !== "draw" ? (
                <Sel value={rp.margin} onChange={(e) => setRp({ ...rp, margin: e.target.value })}>
                  <option value="marginal">Marginal victory</option>
                  <option value="victory">Victory</option>
                  <option value="defiant">Defiant victory</option>
                </Sel>
              ) : <div />}
            </div>
            <Inp placeholder="Result detail (e.g. Massacre, +840 VP)" value={rp.score} onChange={(e) => setRp({ ...rp, score: e.target.value })} />
            <label className="f-body flex items-center gap-2 text-sm text-stone-700">
              <input type="checkbox" checked={!rp.ranked} onChange={(e) => setRp({ ...rp, ranked: !e.target.checked })} />
              Casual game — keep it out of Might, league points &amp; records
            </label>
            <TA rows={2} placeholder="Moment of the match…" value={rp.moment} onChange={(e) => setRp({ ...rp, moment: e.target.value })} />
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Hall of Infamy entries (optional)</p>
              {rp.shame.map((s, i) => (
                <div key={i} className="mb-2 grid grid-cols-3 gap-2">
                  <MemberPicker members={memberNames} placeholder="Player" value={s.player} onChange={(v) => setShame(i, "player", v)} />
                  <Inp type="number" placeholder="Ones rolled" value={s.ones} onChange={(e) => setShame(i, "ones", e.target.value)} />
                  <Inp placeholder="Context" value={s.note} onChange={(e) => setShame(i, "note", e.target.value)} />
                </div>
              ))}
              <B small kind="ghost" onClick={() => setRp({ ...rp, shame: [...rp.shame, { player: "", ones: "", note: "" }] })}>
                <Skull size={12} /> Add shame
              </B>
            </div>
            {err && <p className="f-body text-sm font-bold text-red-800">{err}</p>}
            <B onClick={addReport}>{editingRp ? <><Save size={14} /> Save changes</> : <><Swords size={14} /> File report</>}</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   GALLERY — match photos + painting gallery with votes
   ============================================================ */
function GalleryTab({ ctx }) {
  const { user, photosIdx, db, reload } = ctx;
  const [view, setView] = useState("match");
  const [images, setImages] = useState({});
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lbId, setLbId] = useState(null);
  const fileRef = useRef(null);
  const lb = lbId ? photosIdx.find((p) => p.id === lbId) : null;

  const shown = [...photosIdx].filter((p) => p.kind === view).sort((a, b) => b.created - a.created);

  useEffect(() => {
    const next = {};
    for (const p of shown) next[p.id] = photoUrl(p.storagePath);
    setImages(next);
  }, [view, photosIdx.length]);

  const upload = async (file) => {
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const data = await compressImage(file);
      if (data.length > 1800000) { setErr("That image is enormous even after squashing. Try a smaller one."); setBusy(false); return; }
      const res = await db.photos.add({ dataURL: data, caption: caption.trim(), uploader: user.name, kind: view });
      if (res.error) { setErr("Upload failed. " + (res.error.message || "The vaults may be full.")); setBusy(false); return; }
      await reload.photosIdx();
      setCaption("");
    } catch (e) {
      setErr("Could not read that file. Is it actually an image?");
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const delPhoto = async (p) => {
    if (!(user.isAdmin || p.uploader === user.name)) return;
    if (!confirm("Burn this photograph for everyone?")) return;
    await db.photos.remove(p);
    await reload.photosIdx();
  };

  const renamePhoto = async (p, caption) => {
    if (!(user.isAdmin || p.uploader === user.name)) return;
    await db.photos.setCaption(p.id, caption);
    await reload.photosIdx();
  };

  const toggleVote = async (p) => {
    const votes = p.votes || [];
    const next = votes.includes(user.name) ? votes.filter((v) => v !== user.name) : [...votes, user.name];
    await db.photos.setVotes(p.id, next);
    await reload.photosIdx();
  };
  const addComment = async (p, text) => {
    const next = [...(p.comments || []), { id: uid(), by: user.name, text, at: Date.now() }];
    await db.photos.setComments(p.id, next);
    await reload.photosIdx();
  };
  const delComment = async (p, cid) => {
    await db.photos.setComments(p.id, (p.comments || []).filter((c) => c.id !== cid));
    await reload.photosIdx();
  };

  const paintings = photosIdx.filter((p) => p.kind === "painting");
  const motm = paintings.length
    ? [...paintings].sort((a, b) => (b.votes || []).length - (a.votes || []).length)[0]
    : null;

  return (
    <div>
      <H icon={Camera}>The Gallery</H>
      <div className="mb-4 flex gap-2">
        <B small kind={view === "match" ? "primary" : "ghost"} onClick={() => setView("match")}>Battle photos</B>
        <B small kind={view === "painting" ? "primary" : "ghost"} onClick={() => setView("painting")}>Painting hall</B>
      </div>

      {view === "painting" && motm && (motm.votes || []).length > 0 && (
        <Card className="mb-4 flex items-center gap-3 border-amber-600 bg-amber-100/60 p-3">
          <Crown size={18} className="shrink-0 text-amber-700" />
          <p className="text-sm">
            <span className="f-disp font-bold">Miniature of the moment:</span>{" "}
            {motm.caption || "Untitled"} by {motm.uploader} ({(motm.votes || []).length} votes)
          </p>
        </Card>
      )}

      <Card className="mb-5 p-3">
        <p className="f-disp mb-2 text-xs font-bold uppercase tracking-wide text-stone-600">
          Add to the {view === "match" ? "battle archive" : "painting hall"}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Inp placeholder="Caption (e.g. Trev's cannon misfiring, turn 1)" value={caption} onChange={(e) => setCaption(e.target.value)} />
          <label className="f-disp inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-amber-700 bg-amber-600 px-4 py-2 text-sm text-stone-900 hover:bg-amber-500">
            <Upload size={14} /> {busy ? "Squashing…" : "Choose photo"}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={busy}
              onChange={(e) => upload(e.target.files && e.target.files[0])} />
          </label>
        </div>
        <p className="mt-1.5 text-[11px] italic text-stone-500">Photos are shrunk to fit the archive. Phone snaps are fine.</p>
        {err && <p className="mt-1 text-sm text-red-800">{err}</p>}
      </Card>

      {shown.length === 0 ? (
        <Empty>{view === "match" ? "No battle photographs yet." : "No painted miniatures submitted yet. Bare plastic is heresy."}</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shown.map((p) => (
            <Card key={p.id} className="group overflow-hidden">
              <button className="block w-full" onClick={() => setLbId(p.id)}>
                {images[p.id]
                  ? <img src={images[p.id]} alt={p.caption || "League photo"} className="h-40 w-full object-cover sm:h-48" />
                  : <div className="flex h-40 items-center justify-center text-xs text-stone-400 sm:h-48">Loading…</div>}
              </button>
              <div className="flex items-center justify-between gap-1 px-2.5 py-2">
                <div className="min-w-0">
                  <p className="truncate text-xs">{p.caption || "Untitled"}</p>
                  <p className="text-[10px] italic text-stone-500">{p.uploader}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button onClick={() => setLbId(p.id)} className="flex items-center gap-0.5 text-xs text-stone-500 hover:text-red-900" title="Comments">
                    <MessageSquare size={12} /> {(p.comments || []).length}
                  </button>
                  {view === "painting" && (
                    <button onClick={() => toggleVote(p)}
                      className={"flex items-center gap-0.5 text-xs " + ((p.votes || []).includes(user.name) ? "font-bold text-red-900" : "text-stone-500 hover:text-red-900")}>
                      <ThumbsUp size={12} /> {(p.votes || []).length}
                    </button>
                  )}
                  {(user.isAdmin || p.uploader === user.name) && (
                    <>
                      <button onClick={() => setLbId(p.id)} className="text-stone-400 hover:text-amber-700" title="Rename"><Pencil size={12} /></button>
                      <button onClick={() => delPhoto(p)} className="text-stone-400 hover:text-red-800" title="Delete"><Trash2 size={12} /></button>
                    </>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {lb && (
        <PhotoLightbox
          photo={lb}
          src={images[lb.id] || photoUrl(lb.storagePath)}
          user={user}
          onClose={() => setLbId(null)}
          onComment={addComment}
          onDelComment={delComment}
          onRename={renamePhoto}
          onVote={lb.kind === "painting" ? toggleVote : undefined}
        />
      )}
    </div>
  );
}

/* ============================================================
   LIBRARY — rules, rulings and links (PDFs live on Drive)
   ============================================================ */
function RulesTab({ ctx }) {
  const { user, rules, db, reload } = ctx;
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", link: "" });
  const [open, setOpen] = useState(null);

  const add = async () => {
    if (!draft.title.trim()) return;
    await db.rules.add({ title: draft.title, body: draft.body, link: draft.link });
    await reload.rules();
    setDraft({ title: "", body: "", link: "" });
    setShow(false);
  };
  const del = async (r) => {
    if (!user.isAdmin) return;
    if (!confirm("Remove \u201C" + r.title + "\u201D from the library?")) return;
    await db.rules.remove(r.id);
    await reload.rules();
  };

  return (
    <div>
      <H icon={BookOpen} right={user.isAdmin && <B small kind="gold" onClick={() => setShow(true)}><Plus size={12} /> Add entry</B>}>
        The Library
      </H>
      <Card className="mb-4 border-amber-600 bg-amber-100/60 p-3">
        <p className="text-sm">
          <span className="f-disp font-bold">A note on tomes:</span> this archive can't hold whole PDFs, so upload
          rulebooks to a shared Google Drive folder and paste the link into an entry here. Use the text field for
          house rules, errata and rulings so they're searchable on the spot.
        </p>
      </Card>
      {rules.length === 0 ? (
        <Empty>The library shelves are bare. {user.isAdmin ? "Add the first entry above." : ""}</Empty>
      ) : (
        <div className="space-y-2">
          {rules.map((r) => (
            <Card key={r.id} className="overflow-hidden">
              <button className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() => setOpen(open === r.id ? null : r.id)}>
                <span className="f-disp text-sm font-bold">{r.title}</span>
                <ChevronRight size={14} className={"shrink-0 text-stone-400 transition-transform " + (open === r.id ? "rotate-90" : "")} />
              </button>
              {open === r.id && (
                <div className="border-t border-stone-200 px-4 py-3">
                  {r.body && <p className="whitespace-pre-wrap text-sm">{r.body}</p>}
                  {r.link && (
                    <a href={r.link} target="_blank" rel="noreferrer"
                      className="f-disp mt-2 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-red-900 underline">
                      <LinkIcon size={12} /> Open document
                    </a>
                  )}
                  {user.isAdmin && (
                    <div className="mt-3"><B small kind="danger" onClick={() => del(r)}><Trash2 size={12} /> Remove</B></div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {show && (
        <Modal title="Add to the library" onClose={() => setShow(false)}>
          <div className="space-y-3">
            <Inp placeholder="Title (e.g. House rule: cannon bounce on buildings)" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <TA rows={5} placeholder="The ruling, house rule or summary…" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
            <Inp placeholder="Link to PDF on Drive (optional)" value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} />
            <B onClick={add}><Plus size={14} /> Add entry</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   HERALD — FAQ
   ============================================================ */
function FaqTab({ ctx }) {
  const { user, faq, db, reload } = ctx;
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ q: "", a: "" });
  const [open, setOpen] = useState(null);

  const add = async () => {
    if (!draft.q.trim()) return;
    await db.faqs.add({ q: draft.q, a: draft.a });
    await reload.faq();
    setDraft({ q: "", a: "" });
    setShow(false);
  };
  const del = async (f) => {
    if (!user.isAdmin) return;
    await db.faqs.remove(f.id);
    await reload.faq();
  };

  return (
    <div>
      <div className="mb-6 rounded-sm border-2 border-amber-700 bg-amber-100/50 p-4 shadow-sm">
        <h2 className="f-disp flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-red-950">
          <Trophy size={18} className="text-amber-700" /> What is Might?
        </h2>
        <div className="rule-line mb-3 mt-1" />
        <p className="f-body text-sm text-stone-700">
          Might is a <span className="font-bold">skill rating</span> (an ELO-style system, borrowed from chess) — it answers
          “who's the best general?”, separate from how often you turn up.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-stone-700">
          <li>Everyone starts at <span className="f-disp font-bold text-red-900">1200</span>.</li>
          <li>Win and it rises, lose and it falls; a draw barely moves it.</li>
          <li><span className="font-bold">Beat a higher-rated foe</span> and you gain more; lose to a lower-rated one and you drop more.</li>
          <li>Victory margin weights the swing — <span className="italic">Marginal ×0.75 · Victory ×1 · Defiant ×1.25</span>.</li>
          <li><span className="font-bold">Casual</span> games (ticked when filing) don't touch Might, league points or records.</li>
        </ul>
        <div className="mt-3 rounded-sm border border-amber-700/40 bg-white/60 p-3 text-sm text-stone-700">
          <p className="f-disp text-[11px] font-bold uppercase tracking-widest text-amber-800">Worked example</p>
          <p className="mt-1">Two equal 1200-rated generals clash. The winner climbs to <span className="font-bold text-red-900">1216</span> and the loser slips to <span className="font-bold text-red-900">1184</span> — a defiant victory would push it a little further still.</p>
        </div>
        <p className="mt-2 text-[11px] italic text-stone-500">
          Separate from league points (Win 3 / Draw 1) and from your army rank, which simply counts games played.
        </p>
      </div>

      <div className="mb-6 rounded-sm border-2 border-amber-700 bg-amber-100/50 p-4 shadow-sm">
        <h2 className="f-disp flex items-center gap-2 text-lg font-bold uppercase tracking-wide text-red-950">
          <Shield size={18} className="text-amber-700" /> Climbing the ranks
        </h2>
        <div className="rule-line mb-3 mt-1" />
        <p className="f-body text-sm text-stone-700">
          Your <span className="font-bold">rank</span> is a badge of <span className="font-bold">dedication, not skill</span> — it rewards
          turning up and rolling dice. Every battle you file counts as a game played: win or lose, draw, or even a <span className="italic">casual</span> bout.
        </p>
        <ul className="mt-2 space-y-1 text-sm text-stone-700">
          <li>There are <span className="f-disp font-bold text-red-900">ten ranks</span>, and every army has its own. You begin at the bottom and climb as your games with that army mount.</li>
          <li>Each ladder is themed to its army's lore — an Empire general rises from Stableboy to Lord-General of the Empire; a Dwarf from Beardling to King under the Mountain.</li>
          <li>Your ranks build <span className="font-bold">separately</span> — ten battles with the Empire and twenty with the Dwarfs earns a different rank in each.</li>
          <li>Your headline rank is the army you've <span className="font-bold">set as your own</span>; not yet fielded it, and your most-fought army stands in until you do.</li>
          <li>Your rank — and how many games to the next — shows on your profile and the Muster Roll.</li>
        </ul>
        <div className="mt-3 rounded-sm border border-amber-700/40 bg-white/60 p-3">
          <p className="f-disp text-[11px] font-bold uppercase tracking-widest text-amber-800">The promotion ladder — Empire example</p>
          <div className="mt-1.5 grid grid-cols-1 gap-x-5 gap-y-0.5 sm:grid-cols-2">
            {RANK_TITLES["The Empire"].map((title, i) => (
              <div key={title} className="flex items-baseline justify-between gap-2 border-b border-amber-700/15 py-0.5">
                <span className="f-disp text-sm text-stone-800">{i + 1}. {title}</span>
                <span className="shrink-0 text-[11px] font-bold text-amber-800">{RANK_THRESHOLDS[i] === 0 ? "start" : RANK_THRESHOLDS[i] + " games"}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-2 text-[11px] italic text-stone-500">
          Separate from Might (your skill rating) and from league points — rank simply counts the battles you've fought.
        </p>
      </div>

      <H icon={HelpCircle} right={user.isAdmin && <B small kind="gold" onClick={() => setShow(true)}><Plus size={12} /> Add question</B>}>
        The Herald — frequently bellowed questions
      </H>
      {faq.length === 0 ? (
        <Empty>No questions answered yet. Presumably everyone knows the rules perfectly. Sure.</Empty>
      ) : (
        <div className="space-y-2">
          {faq.map((f) => (
            <Card key={f.id} className="overflow-hidden">
              <button className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() => setOpen(open === f.id ? null : f.id)}>
                <span className="f-disp text-sm font-bold">{f.q}</span>
                <ChevronRight size={14} className={"shrink-0 text-stone-400 transition-transform " + (open === f.id ? "rotate-90" : "")} />
              </button>
              {open === f.id && (
                <div className="border-t border-stone-200 px-4 py-3">
                  <p className="whitespace-pre-wrap text-sm">{f.a || "No answer recorded."}</p>
                  {user.isAdmin && (
                    <div className="mt-3"><B small kind="danger" onClick={() => del(f)}><Trash2 size={12} /> Remove</B></div>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      {show && (
        <Modal title="Add a question" onClose={() => setShow(false)}>
          <div className="space-y-3">
            <Inp placeholder="The question" value={draft.q} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
            <TA rows={4} placeholder="The answer" value={draft.a} onChange={(e) => setDraft({ ...draft, a: e.target.value })} />
            <B onClick={add}><Plus size={14} /> Add</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   THE COUNCIL — house rule proposals, votes, and the gavel
   ============================================================ */
function CouncilTab({ ctx }) {
  const { user, users, proposals, db, reload } = ctx;
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ title: "", detail: "" });
  const memberCount = Object.keys(users).length;

  const sealed = proposals.filter((p) => p.status === "sealed").sort((a, b) => (b.sealedAt || 0) - (a.sealedAt || 0));
  const open = proposals.filter((p) => p.status === "open").sort((a, b) => b.created - a.created);
  const struck = proposals.filter((p) => p.status === "struck").sort((a, b) => (b.struckAt || 0) - (a.struckAt || 0));

  const propose = async () => {
    if (!draft.title.trim()) return;
    await db.proposals.add({ title: draft.title.trim(), detail: draft.detail.trim(), proposedBy: user.name });
    await reload.proposals();
    setDraft({ title: "", detail: "" });
    setShow(false);
  };

  const vote = async (p, dir) => {
    const votes = { ...(p.votes || {}) };
    if (votes[user.name] === dir) delete votes[user.name];
    else votes[user.name] = dir;
    await db.proposals.setVotes(p.id, votes);
    await reload.proposals();
  };

  const seal = async (p) => {
    if (!user.isAdmin) return;
    if (!confirm("Bring down the gavel and seal \u201C" + p.title + "\u201D into law?")) return;
    await db.proposals.seal(p.id, user.name);
    await reload.proposals();
  };
  const strike = async (p) => {
    if (!user.isAdmin) return;
    if (!confirm("Strike down \u201C" + p.title + "\u201D?")) return;
    await db.proposals.strike(p.id);
    await reload.proposals();
  };
  const remove = async (p) => {
    if (!(user.isAdmin || (p.proposedBy === user.name && p.status === "open"))) return;
    if (!confirm("Remove this motion entirely?")) return;
    await db.proposals.remove(p.id);
    await reload.proposals();
  };

  const tally = (p) => {
    const vs = Object.values(p.votes || {});
    return { ayes: vs.filter((v) => v === "aye").length, nays: vs.filter((v) => v === "nay").length };
  };
  const voterNames = (p, dir) =>
    Object.entries(p.votes || {}).filter(([, v]) => v === dir).map(([n]) => n).join(", ") || "nobody";

  const Seal = () => (
    <div className="flex h-14 w-14 shrink-0 -rotate-12 items-center justify-center rounded-full bg-green-800 text-amber-100 shadow-md ring-2 ring-green-900">
      <div className="text-center leading-none">
        <Gavel size={13} className="mx-auto" />
        <span className="f-disp mt-0.5 block text-[6.5px] font-bold tracking-widest">RATIFIED</span>
      </div>
    </div>
  );

  const TallyBar = ({ p }) => {
    const { ayes, nays } = tally(p);
    const total = ayes + nays;
    const pct = total ? Math.round((ayes / total) * 100) : 50;
    return (
      <div>
        <div className="flex justify-between text-[11px] font-bold">
          <span className="text-green-800" title={"Ayes: " + voterNames(p, "aye")}>Aye {ayes}</span>
          <span className="text-stone-400">{total}/{memberCount} voted</span>
          <span className="text-red-900" title={"Nays: " + voterNames(p, "nay")}>Nay {nays}</span>
        </div>
        <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-stone-200">
          <div className="bg-green-700" style={{ width: pct + "%" }} />
          <div className="bg-red-800" style={{ width: (100 - pct) + "%" }} />
        </div>
      </div>
    );
  };

  return (
    <div>
      <H icon={Gavel} right={<B small kind="gold" onClick={() => setShow(true)}><Plus size={12} /> Table a motion</B>}>
        The Council
      </H>
      <p className="mb-5 text-sm italic text-stone-600">
        House rules and league decisions are settled here. Any member may table a motion and cast a vote.
        Only the Grand Marshal wields the gavel.
      </p>

      <H icon={Gavel}>Before the council</H>
      {open.length === 0 ? (
        <Empty>No motions on the table. Surely someone wants to ban something Dan does.</Empty>
      ) : (
        <div className="space-y-3">
          {open.map((p) => {
            const myVote = (p.votes || {})[user.name];
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="f-disp text-sm font-bold">{p.title}</p>
                    {p.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{p.detail}</p>}
                    <p className="mt-1 text-[11px] italic text-stone-500">Tabled by {p.proposedBy}</p>
                  </div>
                  {(user.isAdmin || p.proposedBy === user.name) && (
                    <button onClick={() => remove(p)} className="shrink-0 text-stone-400 hover:text-red-800"><Trash2 size={13} /></button>
                  )}
                </div>
                <div className="mt-3"><TallyBar p={p} /></div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <B small kind={myVote === "aye" ? "primary" : "ghost"} onClick={() => vote(p, "aye")}>
                    <ThumbsUp size={12} /> Aye
                  </B>
                  <B small kind={myVote === "nay" ? "danger" : "ghost"} onClick={() => vote(p, "nay")}>
                    <ThumbsDown size={12} /> Nay
                  </B>
                  {user.isAdmin && (
                    <span className="ml-auto flex gap-2">
                      <B small kind="gold" onClick={() => seal(p)} title="Seal into law"><Gavel size={12} /> Seal into law</B>
                      <B small kind="danger" onClick={() => strike(p)}>Strike down</B>
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <H icon={Scroll}>Laws of the league</H>
      {sealed.length === 0 ? (
        <Empty>No laws ratified yet. Anarchy reigns.</Empty>
      ) : (
        <div className="space-y-3">
          {sealed.map((p) => {
            const { ayes, nays } = tally(p);
            return (
              <Card key={p.id} className="flex items-start gap-3 border-green-700 bg-green-50 p-4">
                <Seal />
                <div className="min-w-0 flex-1">
                  <p className="f-disp text-sm font-bold">{p.title}</p>
                  {p.detail && <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{p.detail}</p>}
                  <p className="mt-1.5 text-[11px] italic text-stone-500">
                    Carried {ayes}–{nays} · proposed by {p.proposedBy} · sealed by {p.sealedBy}
                  </p>
                </div>
                {user.isAdmin && (
                  <button onClick={() => remove(p)} className="shrink-0 text-stone-400 hover:text-red-800" title="Repeal entirely">
                    <Trash2 size={13} />
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {struck.length > 0 && (
        <>
          <H icon={Skull}>Struck down</H>
          <div className="space-y-2">
            {struck.map((p) => {
              const { ayes, nays } = tally(p);
              return (
                <Card key={p.id} className="flex items-center justify-between gap-2 border-red-800 bg-red-50/70 p-3">
                  <p className="text-sm line-through">{p.title} <span className="text-[11px] italic no-underline">({ayes}–{nays})</span></p>
                  {user.isAdmin && (
                    <button onClick={() => remove(p)} className="shrink-0 text-stone-400 hover:text-red-800"><Trash2 size={13} /></button>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}

      {show && (
        <Modal title="Table a motion" onClose={() => setShow(false)}>
          <div className="space-y-3">
            <Inp placeholder="The motion (e.g. Special characters banned below 2,000 pts)" value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            <TA rows={4} placeholder="The case for it…" value={draft.detail}
              onChange={(e) => setDraft({ ...draft, detail: e.target.value })} />
            <B onClick={propose}><Gavel size={14} /> Put it to the council</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   PHOTO LIGHTBOX — enlarge a photo + comments (shared)
   ============================================================ */
function PhotoLightbox({ photo, src, user, onClose, onComment, onDelComment, onVote, onRename }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [cap, setCap] = useState(photo.caption || "");
  const comments = photo.comments || [];
  const canRename = onRename && (photo.uploader === user.name || user.isAdmin);
  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setText("");
    await onComment(photo, t);
  };
  const saveCap = async () => { await onRename(photo, cap.trim()); setEditing(false); };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 p-4" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-amber-800/40 bg-stone-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-2 border-b border-stone-700 px-3 py-2">
          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="flex items-center gap-2">
                <input value={cap} onChange={(e) => setCap(e.target.value)} autoFocus placeholder="Name this photo…"
                  onKeyDown={(e) => { if (e.key === "Enter") saveCap(); if (e.key === "Escape") setEditing(false); }}
                  className="field min-w-0 flex-1 rounded-sm border border-amber-800/40 px-2 py-1 text-sm" />
                <B small kind="gold" onClick={saveCap}><Save size={12} /> Save</B>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <p className="f-disp truncate text-sm font-bold text-amber-100">{photo.caption || "Untitled"}</p>
                {canRename && (
                  <button onClick={() => { setCap(photo.caption || ""); setEditing(true); }} title="Rename this photo"
                    className="shrink-0 text-stone-400 hover:text-amber-200"><Pencil size={13} /></button>
                )}
              </div>
            )}
            <p className="truncate text-[11px] italic text-stone-400">{photo.uploader}</p>
          </div>
          <button onClick={onClose} className="shrink-0 text-stone-400 hover:text-amber-200"><X size={18} /></button>
        </div>
        {src && <img src={src} alt={photo.caption || ""} className="max-h-[50vh] w-full bg-black object-contain" />}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          <div className="flex items-center justify-between">
            <p className="f-disp text-[11px] font-bold uppercase tracking-widest text-stone-400">Comments</p>
            {onVote && (
              <button onClick={() => onVote(photo)}
                className={"flex items-center gap-1 text-xs " + ((photo.votes || []).includes(user.name) ? "font-bold text-amber-300" : "text-stone-400 hover:text-amber-200")}>
                <ThumbsUp size={13} /> {(photo.votes || []).length}
              </button>
            )}
          </div>
          {comments.length === 0 ? (
            <p className="text-xs italic text-stone-500">No comments yet. Be the first to weigh in.</p>
          ) : (
            <div className="space-y-1.5">
              {comments.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2">
                  <p className="text-sm text-stone-200"><span className="f-disp font-bold text-amber-200">{c.by}</span> {c.text}</p>
                  {(c.by === user.name || user.isAdmin) && (
                    <button onClick={() => onDelComment(photo, c.id)} className="shrink-0 text-stone-500 hover:text-red-400"><X size={12} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Add a comment…" className="field flex-1 rounded-sm border border-amber-800/40 px-2 py-1.5 text-sm" />
            <B small kind="gold" onClick={submit}>Post</B>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   HALL OF FAME — past champions & cup winners (admin-managed)
   ============================================================ */
function FameTab({ ctx }) {
  const { user, laurels, pages, memberNames, db, reload } = ctx;
  const navigate = useNavigate();
  const CHAMP = "Champion of the Old World";
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ competition: CHAMP, customComp: "", winner: "", year: "", note: "" });

  const compOptions = [CHAMP, ...pages.filter((p) => p.kind === "cup").map((p) => p.title), ...pages.filter((p) => p.kind === "league").map((p) => p.title)];

  const add = async () => {
    const competition = draft.competition === "__custom" ? draft.customComp.trim() : draft.competition;
    if (!competition || !draft.winner.trim()) return;
    await db.laurels.add({ competition, winner: draft.winner.trim(), year: draft.year.trim(), note: draft.note.trim() });
    await reload.laurels();
    setDraft({ competition: CHAMP, customComp: "", winner: "", year: "", note: "" });
    setShow(false);
  };
  const del = async (l) => {
    if (!user.isAdmin) return;
    if (!confirm("Remove this entry from the Hall of Fame?")) return;
    await db.laurels.remove(l.id);
    await reload.laurels();
  };

  const groups = {};
  for (const l of laurels) (groups[l.competition] = groups[l.competition] || []).push(l);
  const comps = Object.keys(groups).sort((a, b) => (a === CHAMP ? -1 : b === CHAMP ? 1 : a.localeCompare(b)));
  const linkFor = (name) => (memberNames || []).find((n) => n.toLowerCase() === (name || "").toLowerCase());

  return (
    <div>
      <H icon={Medal} right={user.isAdmin && <B small kind="gold" onClick={() => setShow(true)}><Plus size={12} /> Record a winner</B>}>
        The Hall of Fame
      </H>
      <p className="mb-5 max-w-2xl text-sm italic text-stone-600">
        The enshrined victors of seasons past — champions of the league and winners of the great tournaments.
      </p>

      {laurels.length === 0 ? (
        <Empty>{user.isAdmin ? "No laurels recorded yet. Enshrine the first champion." : "The halls await their first hero."}</Empty>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {comps.map((comp) => {
            const rows = [...groups[comp]].sort((a, b) => (b.year || "").localeCompare(a.year || "") || b.created - a.created);
            return (
              <Card key={comp} className="overflow-hidden">
                <div className="flex items-center gap-2 border-b border-stone-300 bg-stone-900 px-4 py-2.5">
                  <Crown size={14} className="shrink-0 text-amber-400" />
                  <h3 className="f-disp text-sm font-bold uppercase tracking-wide text-amber-200">{comp}</h3>
                </div>
                <div className="divide-y divide-stone-200">
                  {rows.map((l) => {
                    const m = linkFor(l.winner);
                    return (
                      <div key={l.id} className="flex items-center justify-between gap-2 px-4 py-2">
                        <div className="min-w-0">
                          <p className="f-disp text-sm font-bold">
                            {m
                              ? <button onClick={() => navigate("/member/" + encodeURIComponent(m))} className="text-left hover:text-red-900 hover:underline">{l.winner}</button>
                              : l.winner}
                          </p>
                          {l.note && <p className="text-[11px] italic text-stone-500">{l.note}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {l.year && <span className="f-disp text-xs font-bold uppercase tracking-wide text-amber-800">{l.year}</span>}
                          {user.isAdmin && <button onClick={() => del(l)} className="text-stone-400 hover:text-red-800"><Trash2 size={13} /></button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {show && (
        <Modal title="Record a winner" onClose={() => setShow(false)}>
          <div className="space-y-3">
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Trophy / competition</p>
              <Sel value={draft.competition} onChange={(e) => setDraft({ ...draft, competition: e.target.value })}>
                {compOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                <option value="__custom">Custom…</option>
              </Sel>
            </div>
            {draft.competition === "__custom" && (
              <Inp placeholder="Competition name" value={draft.customComp} onChange={(e) => setDraft({ ...draft, customComp: e.target.value })} />
            )}
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Winner</p>
              <Inp list="fame-members" placeholder="Winner's name" value={draft.winner} onChange={(e) => setDraft({ ...draft, winner: e.target.value })} />
              <datalist id="fame-members">{(memberNames || []).map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <Inp placeholder="Year / season (e.g. 2526, or Spring 2025)" value={draft.year} onChange={(e) => setDraft({ ...draft, year: e.target.value })} />
            <Inp placeholder="Note (optional, e.g. beat Dane in the final)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            <B kind="gold" onClick={add}><Medal size={14} /> Enshrine</B>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   ADMIN — the Grand Marshal's chambers (admins only)
   ============================================================ */
/* Placeholder members — admin tracks a player's record before they have an
   account, then links the placeholder to their account once they sign up. */
function PlaceholderManager({ ctx }) {
  const { users, placeholders, memberNames, reports, db, reload, reloadAll } = ctx;
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [faction, setFaction] = useState("The Empire");
  const [surname, setSurname] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [linking, setLinking] = useState(null); // the placeholder being linked, or null
  const [linkTo, setLinkTo] = useState("");

  const takenNames = new Set((memberNames || []).map((n) => n.toLowerCase()));
  const accounts = Object.values(users).map((u) => u.name).sort((a, b) => a.localeCompare(b));
  const games = gamesPlayedMap(reports);

  const add = async () => {
    setErr("");
    const n = name.trim();
    if (!n) { setErr("Give the placeholder a name."); return; }
    if (takenNames.has(n.toLowerCase())) { setErr("“" + n + "” is already on the muster roll — pick a different name."); return; }
    setBusy("add");
    const res = await db.placeholders.add({ name: n, faction, surname: surname.trim(), note: note.trim() });
    if (res && res.error) { setErr(res.error.message || "Could not add placeholder."); setBusy(""); return; }
    await reload.placeholders();
    setName(""); setFaction("The Empire"); setSurname(""); setNote(""); setBusy("");
  };
  const setPhFaction = async (id, f) => { await db.placeholders.update(id, { faction: f }); await reload.placeholders(); };
  const remove = async (p) => {
    if (!confirm("Remove placeholder “" + p.name + "”?\n\nTheir battle history stays in the records under that name; it simply stops being tracked as a player.")) return;
    setBusy(p.id);
    await db.placeholders.remove(p.id);
    await reload.placeholders();
    setBusy("");
  };
  const startLink = (p) => { setErr(""); setLinkTo(""); setLinking(p); };
  const doLink = async () => {
    if (!linking || !linkTo) return;
    setBusy(linking.id); setErr("");
    const res = await db.placeholders.merge(linking.id, linkTo);
    if (res && res.error) { setErr(res.error.message || "Could not link placeholder."); setBusy(""); return; }
    setLinking(null); setLinkTo("");
    await reloadAll(); // a merge rewrites the name across many tables
    setBusy("");
  };

  return (
    <>
      <H icon={UserPlus}>Placeholder members</H>
      <p className="mb-3 max-w-2xl text-sm italic text-stone-600">
        Track a player's record before they sign up. Placeholders appear in the muster roll, the pickers and the ladder just like members. When the player makes an account, link the placeholder to it to carry the whole history over.
      </p>

      <Card className="mb-3 space-y-2 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <Inp placeholder="Name (e.g. Ollie)" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
          <Sel value={faction} onChange={(e) => setFaction(e.target.value)}>
            {ARMIES.map((a) => <option key={a}>{a}</option>)}
          </Sel>
          <Inp placeholder="Surname (optional, e.g. Breach)" value={surname} onChange={(e) => setSurname(e.target.value)} />
          <Inp placeholder="Note (optional — only the Grand Marshal sees it)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {err && !linking && <p className="f-body text-sm font-bold text-red-800">{err}</p>}
        <B kind="gold" onClick={add} disabled={busy === "add"}><UserPlus size={14} /> {busy === "add" ? "Adding…" : "Add placeholder"}</B>
      </Card>

      {placeholders.length > 0 && (
        <Card className="divide-y divide-stone-200">
          {placeholders.map((p) => {
            const n = games[p.name] || 0;
            return (
              <div key={p.id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="f-disp flex items-center gap-1.5 text-sm font-bold">
                    <button onClick={() => navigate("/member/" + encodeURIComponent(p.name))} className="truncate text-left hover:text-red-900 hover:underline">{p.name}</button>
                    <span className="shrink-0 rounded-sm bg-stone-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">Unclaimed</span>
                  </p>
                  <p className="text-[11px] italic text-stone-500">{n} game{n === 1 ? "" : "s"} tracked{p.note ? " · " + p.note : ""}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select value={p.faction} onChange={(e) => setPhFaction(p.id, e.target.value)} title="Set this placeholder's army"
                    className="f-body rounded-sm border border-stone-300 bg-white px-1.5 py-1 text-xs">
                    {ARMIES.map((a) => <option key={a}>{a}</option>)}
                  </select>
                  <B small kind="ghost" onClick={() => startLink(p)} disabled={accounts.length === 0}><LinkIcon size={12} /> Link to member</B>
                  <button onClick={() => remove(p)} disabled={busy === p.id}
                    className="inline-flex items-center gap-1 rounded-sm border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50 disabled:opacity-50">
                    <UserX size={12} /> {busy === p.id ? "…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {linking && (
        <Modal title={"Link “" + linking.name + "” to a member"} onClose={() => { setLinking(null); setErr(""); }}>
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              Every battle, standing and honour recorded under <span className="font-bold">{linking.name}</span> will be carried onto the chosen member's account, and the placeholder removed. This cannot be undone.
            </p>
            <Sel value={linkTo} onChange={(e) => setLinkTo(e.target.value)}>
              <option value="">— choose the member —</option>
              {accounts.map((nm) => <option key={nm} value={nm}>{nm}</option>)}
            </Sel>
            {err && <p className="f-body text-sm font-bold text-red-800">{err}</p>}
            <B kind="gold" onClick={doLink} disabled={!linkTo || busy === linking.id}><LinkIcon size={14} /> {busy === linking.id ? "Linking…" : "Link & carry history over"}</B>
          </div>
        </Modal>
      )}
    </>
  );
}

function AdminTab({ ctx }) {
  const { user, users, fixtures, reports, pages, proposals, champions, laurels, honours, availability, quotes, faq, rules, photosIdx, emblems, siteName, siteTagline, db, reload, reloadAll, refreshUsers, refreshUser } = ctx;
  const navigate = useNavigate();
  const [showEmblems, setShowEmblems] = useState(false);
  const [busy, setBusy] = useState("");
  const [nameDraft, setNameDraft] = useState(siteName);
  const [taglineDraft, setTaglineDraft] = useState(siteTagline);
  const [nameSaved, setNameSaved] = useState(false);
  const [renaming, setRenaming] = useState(null);   // member being renamed (or null)
  const [renameTo, setRenameTo] = useState("");
  const [renameErr, setRenameErr] = useState("");

  if (!user.isAdmin) return <Empty>The Grand Marshal's chambers are barred to you.</Empty>;

  const saveMasthead = async () => {
    await db.settings.set("site_name", nameDraft.trim() || "The Old World League");
    await db.settings.set("site_tagline", taglineDraft.trim() || "WHFB 7th Edition · By decree of the Grand Marshal");
    await reload.settings();
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1800);
  };

  const setArmy = async (id, faction) => { await db.profiles.update(id, { faction }); await refreshUsers(); };
  const toggleAdmin = async (id, val) => { await db.profiles.setAdmin(id, val); await refreshUsers(); };
  const removeMember = async (id, name) => {
    if (!confirm("Remove " + name + " entirely?\n\nTheir account and profile are deleted. Their battle history stays in the records. This cannot be undone.")) return;
    setBusy(id);
    const res = await db.profiles.remove(id);
    if (res && res.error) alert("Could not remove member: " + (res.error.message || "unknown error"));
    await refreshUsers();
    setBusy("");
  };

  const startRename = (u) => { setRenameErr(""); setRenameTo(u.name); setRenaming(u); };
  const doRename = async () => {
    if (!renaming) return;
    const newName = renameTo.trim();
    if (!newName || newName === renaming.name) return;
    setBusy(renaming.id); setRenameErr("");
    const { error } = await db.profiles.rename(renaming.name, newName);
    if (error) { setRenameErr(error.message || "Could not rename that member."); setBusy(""); return; }
    // A rename rewrites many collections, so re-pull everything; refreshUser in
    // case the Grand Marshal renamed themselves.
    await reloadAll();
    await refreshUser();
    setBusy(""); setRenaming(null);
  };

  const exportData = () => {
    const dump = {
      exportedAt: new Date().toISOString(),
      members: Object.values(users), fixtures, battleReports: reports, pages, proposals,
      champions, laurels, honours, availability, quotes, faqs: faq, library: rules,
      photos: photosIdx, emblems,
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "old-world-league-backup-" + today() + ".json"; a.click();
    URL.revokeObjectURL(url);
  };

  const stat = (label, n) => (
    <div className="rounded-sm border border-stone-300 bg-white/60 px-3 py-2 text-center">
      <p className="f-black text-2xl leading-none text-red-950">{n}</p>
      <p className="f-disp mt-1 text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
    </div>
  );

  const memberList = Object.entries(users);

  return (
    <div>
      <H icon={Settings}>The Grand Marshal's Chambers</H>
      <p className="mb-5 max-w-2xl text-sm italic text-stone-600">Controls reserved for the Grand Marshal. Tread carefully.</p>

      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat("Members", memberList.length)}
        {stat("Battles filed", reports.length)}
        {stat("Leagues & cups", pages.length)}
        {stat("Photos", photosIdx.length)}
      </div>

      <H icon={Pencil}>Masthead</H>
      <Card className="space-y-3 p-3">
        <div>
          <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Name</p>
          <Inp value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} placeholder="The Old World League"
            onKeyDown={(e) => e.key === "Enter" && saveMasthead()} />
        </div>
        <div>
          <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Tagline</p>
          <Inp value={taglineDraft} onChange={(e) => setTaglineDraft(e.target.value)} placeholder="WHFB 7th Edition · By decree of the Grand Marshal"
            onKeyDown={(e) => e.key === "Enter" && saveMasthead()} />
          <p className="mt-1.5 text-[11px] italic text-stone-500">The small line under the title, on every page. Leave either field blank to reset it to the default.</p>
        </div>
        <B kind="gold" onClick={saveMasthead}><Save size={14} /> {nameSaved ? "Saved ✓" : "Save masthead"}</B>
      </Card>

      <H icon={Shield}>Members</H>
      <Card className="divide-y divide-stone-200">
        {memberList.map(([id, u]) => (
          <div key={id} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="f-disp flex items-center gap-1.5 text-sm font-bold">
              <button onClick={() => navigate("/member/" + encodeURIComponent(u.name))} className="truncate text-left hover:text-red-900 hover:underline">{u.name}</button>
              {u.isAdmin && <Gavel size={11} className="shrink-0 text-amber-700" title="Grand Marshal" />}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={u.faction} onChange={(e) => setArmy(id, e.target.value)} title="Set this member's army"
                className="f-body rounded-sm border border-stone-300 bg-white px-1.5 py-1 text-xs">
                {ARMIES.map((a) => <option key={a}>{a}</option>)}
              </select>
              <B small kind="ghost" onClick={() => startRename(u)} title="Change this member's username"><Pencil size={12} /> Rename</B>
              {u.name !== user.name && (
                <>
                  <B small kind="ghost" onClick={() => toggleAdmin(id, !u.isAdmin)}>{u.isAdmin ? "Demote" : "Promote"}</B>
                  <button onClick={() => removeMember(id, u.name)} disabled={busy === id}
                    className="inline-flex items-center gap-1 rounded-sm border border-red-300 px-2 py-1 text-xs text-red-800 hover:bg-red-50 disabled:opacity-50">
                    <UserX size={12} /> {busy === id ? "Removing…" : "Remove"}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>

      <PlaceholderManager ctx={ctx} />

      <H icon={Award}>Tools</H>
      <div className="flex flex-wrap gap-2">
        <B kind="ghost" onClick={() => setShowEmblems(true)}><Shield size={14} /> Army emblems</B>
        <B kind="ghost" onClick={exportData}><Download size={14} /> Backup / export data</B>
      </div>
      <p className="mt-2 text-[11px] italic text-stone-500">The backup is a JSON snapshot (no photo images) you can keep off-site.</p>

      {showEmblems && <EmblemManager ctx={ctx} onClose={() => setShowEmblems(false)} />}

      {renaming && (
        <Modal title={"Rename " + renaming.name} onClose={() => { setRenaming(null); setRenameErr(""); }}>
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              Every battle, standing, vote and honour recorded under <span className="font-bold">{renaming.name}</span> will be carried onto the new name. Their login (email &amp; password) is unaffected.
            </p>
            <Inp value={renameTo} onChange={(e) => setRenameTo(e.target.value)} placeholder={renaming.name} maxLength={40}
              onKeyDown={(e) => e.key === "Enter" && doRename()} />
            {renameErr && <p className="f-body text-sm font-bold text-red-800">{renameErr}</p>}
            <B kind="gold" onClick={doRename} disabled={busy === renaming.id || !renameTo.trim() || renameTo.trim() === renaming.name}>
              <Pencil size={14} /> {busy === renaming.id ? "Renaming…" : "Rename & carry history over"}
            </B>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ============================================================
   SOCIAL BANNER — the next gathering (home page)
   ============================================================ */
function SocialBanner({ ctx }) {
  const { user, settings, memberNames, db, reload } = ctx;
  const social = (settings.next_social && typeof settings.next_social === "object") ? settings.next_social : {};
  const has = !!(social.date || social.host || social.location);
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ host: "", location: "", date: "", note: "" });

  const open = () => {
    setDraft({ host: social.host || "", location: social.location || "", date: social.date || "", note: social.note || "" });
    setShow(true);
  };
  const save = async () => {
    await db.settings.set("next_social", { host: draft.host.trim(), location: draft.location.trim(), date: draft.date, note: draft.note.trim() });
    await reload.settings();
    notify("gathering");
    setShow(false);
  };
  const clear = async () => {
    if (!confirm("Clear the next gathering?")) return;
    await db.settings.set("next_social", {});
    await reload.settings();
    setShow(false);
  };

  if (!has && !user.isAdmin) return null;

  return (
    <>
      {has ? (
        <div className="mb-6 flex items-start gap-4 rounded-sm border-2 border-amber-600 bg-gradient-to-r from-amber-100 to-amber-50 p-4 shadow-sm">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-sm bg-stone-900 text-amber-200 ring-2 ring-amber-700">
            <CalendarDays size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="f-disp text-[11px] font-bold uppercase tracking-widest text-amber-800">Next gathering</p>
            <p className="f-black text-2xl leading-tight text-red-950">{social.date ? relDay(social.date) : "Date to be confirmed"}</p>
            <p className="text-sm text-stone-700">
              {social.date && <span className="font-medium">{fmtDate(social.date)}</span>}
              {social.host && <span>{social.date ? " · " : ""}{social.host} is hosting</span>}
              {social.location && <span>{(social.date || social.host) ? " · " : ""}{social.location}</span>}
            </p>
            {social.note && <p className="mt-0.5 text-xs italic text-stone-600">{social.note}</p>}
          </div>
          {user.isAdmin && (
            <button onClick={open} title="Edit the next gathering"
              className="shrink-0 rounded-sm border border-stone-300 bg-white/70 p-1.5 text-stone-500 hover:text-red-900"><Pencil size={16} /></button>
          )}
        </div>
      ) : (
        <button onClick={open}
          className="mb-6 flex w-full items-center justify-center gap-2 rounded-sm border-2 border-dashed border-amber-600/60 bg-amber-50/40 p-3 text-sm text-amber-800 hover:bg-amber-100/60">
          <CalendarDays size={16} /> Set the next gathering
        </button>
      )}

      {show && (
        <Modal title="The next gathering" onClose={() => setShow(false)}>
          <div className="space-y-3">
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Date</p>
              <Inp type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
            </div>
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Host (optional)</p>
              <Inp list="social-hosts" placeholder="e.g. Ollie — leave blank if there's no host" value={draft.host} onChange={(e) => setDraft({ ...draft, host: e.target.value })} />
              <datalist id="social-hosts">{(memberNames || []).map((n) => <option key={n} value={n} />)}</datalist>
            </div>
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Location</p>
              <Inp placeholder="e.g. Ollie's place, or out hunting for games at Firestorm" value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} />
            </div>
            <Inp placeholder="Note (optional, e.g. bring 1,000 pt armies)" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            <div className="flex gap-2">
              <B kind="gold" onClick={save}><Save size={14} /> Save</B>
              {has && <B kind="ghost" onClick={clear}><Trash2 size={14} /> Clear</B>}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
