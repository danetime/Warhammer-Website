import { useState, useEffect, useRef } from "react";
import {
  Swords, Trophy, Scroll, Camera, HelpCircle, Beer, Crown, Plus, Trash2,
  Pencil, LogOut, Upload, ThumbsUp, ThumbsDown, X, Shield, Skull, CalendarDays, Save,
  BookOpen, Link as LinkIcon, ChevronRight, Gavel
} from "lucide-react";
import { supabase } from "./lib/supabaseClient";

/* ============================================================
   THE OLD WORLD LEAGUE — a private hub for a WHFB 7th ed group
   Shared data lives in window.storage (shared scope).
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
`;

/* ---------- storage helpers (window.storage, shared scope) ---------- */
const sget = async (key, shared = true) => {
  try {
    const r = await window.storage.get(key, shared);
    return r && r.value ? JSON.parse(r.value) : null;
  } catch (e) { return null; }
};
const sset = async (key, val, shared = true) => {
  try { await window.storage.set(key, JSON.stringify(val), shared); return true; }
  catch (e) { console.error("storage set failed", key, e); return false; }
};
const sdel = async (key, shared = true) => {
  try { await window.storage.delete(key, shared); } catch (e) {}
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* Not real security. Keeps casual snooping out, nothing more. */
const hashPw = (s) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return "h" + (h >>> 0).toString(36);
};

const today = () => new Date().toISOString().slice(0, 10);

/* ---------- profiles (Supabase) -> the shape the UI expects ----------
   The DB stores snake_case; the UI expects { name, faction, isAdmin }. */
const mapProfile = (p) =>
  p ? { id: p.id, name: p.display_name, faction: p.faction, isAdmin: p.is_admin, joined: p.joined } : null;

async function loadProfiles() {
  const { data, error } = await supabase
    .from("profiles").select("*").order("joined", { ascending: true });
  if (error || !data) return {};
  const out = {};
  for (const p of data) out[p.id] = mapProfile(p);
  return out;
}

async function fetchProfile(id) {
  if (!id) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  return mapProfile(data);
}

/* ---------- armies of the Old World + their table colours ---------- */
const ARMIES = ["The Empire","Bretonnia","Dwarfs","High Elves","Dark Elves","Wood Elves",
  "Orcs & Goblins","Skaven","Vampire Counts","Tomb Kings","Warriors of Chaos","Daemons of Chaos",
  "Beastmen","Lizardmen","Ogre Kingdoms","Chaos Dwarfs","Dogs of War"];

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
  for (const r of reports) {
    const a = (r.playerA || "").trim(), b = (r.playerB || "").trim();
    if (a) m[a] = (m[a] || 0) + 1;
    if (b && b !== a) m[b] = (m[b] || 0) + 1;
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

const fmtDate = (d) => {
  if (!d) return "TBC";
  try {
    return new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
  } catch (e) { return d; }
};

/* ---------- ELO + records from battle reports ---------- */
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
    const A = (r.playerA || "").trim(), B = (r.playerB || "").trim();
    if (!A || !B || A === B) continue;
    ensure(A); ensure(B);
    const ea = 1 / (1 + Math.pow(10, (elo[B] - elo[A]) / 400));
    const sa = r.winner === "A" ? 1 : r.winner === "B" ? 0 : 0.5;
    const K = 32;
    elo[A] = Math.round(elo[A] + K * (sa - ea));
    elo[B] = Math.round(elo[B] + K * ((1 - sa) - (1 - ea)));
    rec[A].p++; rec[B].p++;
    if (r.winner === "A") { rec[A].w++; rec[B].l++; rec[A].pts += 3; }
    else if (r.winner === "B") { rec[B].w++; rec[A].l++; rec[B].pts += 3; }
    else { rec[A].d++; rec[B].d++; rec[A].pts++; rec[B].pts++; }
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

/* ---------- image compression for the gallery ---------- */
function compressImage(file, maxDim = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Not a valid image"));
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", quality));
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
    className={"f-body w-full rounded-sm border border-stone-400 bg-white/80 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 " + (props.className || "")}
  />
);
const TA = (props) => (
  <textarea
    {...props}
    className={"f-body w-full rounded-sm border border-stone-400 bg-white/80 px-3 py-2 text-sm text-stone-900 placeholder-stone-400 " + (props.className || "")}
  />
);
const Sel = ({ children, ...props }) => (
  <select {...props} className="f-body w-full rounded-sm border border-stone-400 bg-white/80 px-2 py-2 text-sm text-stone-900">
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

/* ============================================================
   LOGIN GATE
   First soul to register becomes Grand Marshal (admin).
   ============================================================ */
function LoginGate({ users, onAuthed, refreshUsers }) {
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
        const prof = await fetchProfile(data.user.id);
        if (!prof) { setErr("Enlisted, but no muster-roll profile was created. Run supabase/auth.sql, then try again."); setBusy(false); return; }
        await refreshUsers();
        onAuthed(prof);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: mail, password: pw });
        if (error) { setErr("No such name, or the watchword is wrong."); setBusy(false); return; }
        const prof = await fetchProfile(data.user.id);
        if (!prof) { setErr("Signed in, but your profile is missing. The Grand Marshal must run supabase/auth.sql."); setBusy(false); return; }
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
          <h1 className="f-black text-5xl font-bold text-red-950">The Old World League</h1>
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
   APP SHELL
   ============================================================ */
export default function App() {
  const [booted, setBooted] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState({});
  const [tab, setTab] = useState("home");
  const [fixtures, setFixtures] = useState([]);
  const [reports, setReports] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [faq, setFaq] = useState([]);
  const [rules, setRules] = useState([]);
  const [pages, setPages] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [champions, setChampions] = useState([]);
  const [photosIdx, setPhotosIdx] = useState([]);

  const refreshUsers = async () => {
    const us = await loadProfiles();
    setUsers(us);
    return us;
  };

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await refreshUsers();
      if (session?.user) setUser(await fetchProfile(session.user.id));
      // The rest still loads via window.storage until Step 4 swaps it for Supabase.
      const [fx, rp, qt, fq, rl, pg, px, pr, ch] = await Promise.all([
        sget("wh-fixtures"), sget("wh-reports"), sget("wh-quotes"), sget("wh-faq"),
        sget("wh-rules"), sget("wh-pages"), sget("wh-photos-idx"), sget("wh-proposals"),
        sget("wh-champions"),
      ]);
      setFixtures(fx || []); setReports(rp || []); setQuotes(qt || []);
      setFaq(fq || []); setRules(rl || []); setPages(pg || []); setPhotosIdx(px || []);
      setProposals(pr || []); setChampions(ch || []);
      setBooted(true);
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(async () => {
        setUser(session?.user ? await fetchProfile(session.user.id) : null);
      }, 0);
    });
    return () => subscription.unsubscribe();
  }, []);

  const save = {
    fixtures: async (v) => { setFixtures(v); await sset("wh-fixtures", v); },
    reports: async (v) => { setReports(v); await sset("wh-reports", v); },
    quotes: async (v) => { setQuotes(v); await sset("wh-quotes", v); },
    faq: async (v) => { setFaq(v); await sset("wh-faq", v); },
    rules: async (v) => { setRules(v); await sset("wh-rules", v); },
    pages: async (v) => { setPages(v); await sset("wh-pages", v); },
    proposals: async (v) => { setProposals(v); await sset("wh-proposals", v); },
    champions: async (v) => { setChampions(v); await sset("wh-champions", v); },
    photosIdx: async (v) => { setPhotosIdx(v); await sset("wh-photos-idx", v); },
  };

  const logout = async () => { await supabase.auth.signOut(); setUser(null); };

  if (!booted) {
    return (
      <div className="parchment f-disp flex min-h-screen items-center justify-center text-stone-600">
        <style>{FONT_CSS}</style>Unfurling the banners…
      </div>
    );
  }
  if (!user) return <LoginGate users={users} onAuthed={setUser} refreshUsers={refreshUsers} />;

  const memberNames = Object.values(users).map((u) => u.name);
  const ctx = { user, users, memberNames, fixtures, reports, quotes, faq, rules, pages, proposals, champions, photosIdx, save, refreshUsers };

  const tabs = [
    { id: "home", label: "Town Square", icon: Beer },
    { id: "league", label: "League", icon: Trophy },
    { id: "cup", label: "Grand Tourney", icon: Crown },
    { id: "council", label: "Council", icon: Gavel },
    { id: "battles", label: "Battles", icon: Swords },
    { id: "gallery", label: "Gallery", icon: Camera },
    { id: "rules", label: "Library", icon: BookOpen },
    { id: "faq", label: "Herald", icon: HelpCircle },
  ];

  return (
    <div className="parchment f-body min-h-screen text-stone-900">
      <style>{FONT_CSS}</style>
      <header className="border-b-4 border-amber-700 bg-stone-900 text-amber-100">
        <div className="mx-auto max-w-5xl px-4 pb-3 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="f-black text-3xl leading-none text-amber-200 sm:text-4xl">The Old World League</h1>
              <p className="f-disp mt-1 text-[10px] uppercase tracking-widest text-amber-500/80 sm:text-xs">
                WHFB 7th Edition · By decree of the Grand Marshal
              </p>
            </div>
            <div className="text-right">
              <p className="f-disp text-xs text-amber-200">
                {user.name} {user.isAdmin && <Crown size={12} className="ml-1 inline text-amber-400" />}
              </p>
              <p className="text-[11px] italic text-stone-400">{user.faction}</p>
              <button onClick={logout} className="f-disp mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-stone-400 hover:text-amber-300">
                <LogOut size={11} /> Sign out
              </button>
            </div>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={"f-disp flex shrink-0 items-center gap-1.5 rounded-sm px-3 py-1.5 text-xs uppercase tracking-wide transition-colors " +
                  (tab === t.id ? "bg-amber-600 text-stone-900" : "text-amber-100/80 hover:bg-stone-800")}>
                <t.icon size={13} /> {t.label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6">
        {tab === "home" && <HomeTab ctx={ctx} go={setTab} />}
        {tab === "league" && <PagesTab ctx={ctx} kind="league" />}
        {tab === "cup" && <PagesTab ctx={ctx} kind="cup" />}
        {tab === "council" && <CouncilTab ctx={ctx} />}
        {tab === "battles" && <BattlesTab ctx={ctx} />}
        {tab === "gallery" && <GalleryTab ctx={ctx} />}
        {tab === "rules" && <RulesTab ctx={ctx} />}
        {tab === "faq" && <FaqTab ctx={ctx} />}
      </main>
      <footer className="border-t border-stone-300 py-4 text-center">
        <p className="f-disp text-[10px] uppercase tracking-widest text-stone-400">
          Sigmar protects · No Age of Sigmar beyond this point
        </p>
      </footer>
    </div>
  );
}

/* ============================================================
   HOME — Town Square
   ============================================================ */
function HomeTab({ ctx, go }) {
  const { user, users, fixtures, reports, quotes, champions, photosIdx, save, refreshUsers } = ctx;
  const [newQuote, setNewQuote] = useState("");
  const [saidBy, setSaidBy] = useState("");
  const [thumbs, setThumbs] = useState({});
  const [showAward, setShowAward] = useState(false);
  const [awardWho, setAwardWho] = useState("");
  const [awardSeason, setAwardSeason] = useState("");

  const ladder = computeStandings(reports);
  const shame = shameBoard(reports);
  const games = gamesPlayedMap(reports);
  const currentChamp = champions.find((c) => c.isCurrent) || null;
  const pastChamps = champions.filter((c) => !c.isCurrent).sort((a, b) => (b.awardedAt || 0) - (a.awardedAt || 0));
  const upcoming = [...fixtures]
    .filter((f) => !f.date || f.date >= today())
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
    .slice(0, 3);
  const recentPhotos = [...photosIdx].sort((a, b) => b.created - a.created).slice(0, 2);
  const recentQuotes = [...quotes].sort((a, b) => b.created - a.created).slice(0, 4);

  useEffect(() => {
    (async () => {
      const out = {};
      for (const p of recentPhotos) {
        const d = await sget("wh-photo-" + p.id);
        if (d) out[p.id] = d.data;
      }
      setThumbs(out);
    })();
  }, [photosIdx.length]);

  const addQuote = async () => {
    const text = newQuote.trim();
    if (!text) return;
    await save.quotes([{ id: uid(), text, saidBy: saidBy.trim() || "Unknown", addedBy: user.name, created: Date.now() }, ...quotes]);
    setNewQuote(""); setSaidBy("");
  };
  const delQuote = async (q) => {
    if (!(user.isAdmin || q.addedBy === user.name)) return;
    await save.quotes(quotes.filter((x) => x.id !== q.id));
  };
  const toggleAdmin = async (id) => {
    const target = users[id];
    if (!target) return;
    await supabase.from("profiles").update({ is_admin: !target.isAdmin }).eq("id", id);
    await refreshUsers();
  };

  const awardChampion = async () => {
    if (!awardWho.trim() || !awardSeason.trim()) return;
    const retired = champions.map((c) => (c.isCurrent ? { ...c, isCurrent: false } : c));
    await save.champions([
      { id: uid(), member: awardWho.trim(), season: awardSeason.trim(), awardedAt: Date.now(), isCurrent: true },
      ...retired,
    ]);
    setAwardWho(""); setAwardSeason(""); setShowAward(false);
  };
  const abdicate = async () => {
    if (!confirm("Strip the current champion of the crown? They keep their place in the Roll of Honour.")) return;
    await save.champions(champions.map((c) => (c.isCurrent ? { ...c, isCurrent: false } : c)));
  };

  const medal = (i) => ["bg-amber-500 text-stone-900", "bg-stone-400 text-stone-900", "bg-amber-800 text-amber-100"][i] || "bg-stone-200 text-stone-600";

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
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
                  <p className="f-disp text-sm font-bold text-stone-900">{f.playerA} <span className="text-red-900">vs</span> {f.playerB}</p>
                  <p className="text-xs italic text-stone-500">{f.points ? f.points + " pts" : "Points TBC"}{f.notes ? " · " + f.notes : ""}</p>
                </div>
                <p className="f-disp shrink-0 text-xs uppercase tracking-wide text-amber-800">{fmtDate(f.date)}</p>
              </Card>
            ))}
          </div>
        )}

        <H icon={Trophy}>The Ladder</H>
        {ladder.length === 0 ? (
          <Empty>No ranked battles yet. File a battle report and claim the top spot before Dan does.</Empty>
        ) : (
          <Card className="divide-y divide-stone-200">
            {ladder.slice(0, 6).map((r, i) => (
              <div key={r.name} className="flex items-center gap-3 px-3 py-2">
                <span className={"f-disp flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold " + medal(i)}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="f-disp truncate text-sm font-bold">{r.name}</p>
                  <p className="text-[11px] text-stone-500">P{r.p} · W{r.w} D{r.d} L{r.l} · {r.pts} pts</p>
                </div>
                <p className="f-disp text-sm font-bold text-red-900">{r.elo}</p>
              </div>
            ))}
          </Card>
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
                {thumbs[p.id]
                  ? <img src={thumbs[p.id]} alt={p.caption || "League photo"} className="h-40 w-full object-cover" />
                  : <div className="flex h-40 items-center justify-center text-xs text-stone-400">Loading…</div>}
                <p className="truncate px-3 py-2 text-xs italic text-stone-600">{p.caption || "Untitled"} — {p.uploader}</p>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <H icon={Beer}>Tavern Talk</H>
        <Card className="p-3">
          <div className="space-y-3">
            {recentQuotes.length === 0 && <Empty>Nothing quotable said yet. Unlikely, knowing this lot.</Empty>}
            {recentQuotes.map((q) => (
              <div key={q.id} className="group relative border-l-2 border-amber-600 pl-3">
                <p className="text-sm italic">"{q.text}"</p>
                <p className="mt-0.5 text-[11px] text-stone-500">— {q.saidBy}</p>
                {(user.isAdmin || q.addedBy === user.name) && (
                  <button onClick={() => delQuote(q)} className="absolute right-0 top-0 hidden text-stone-400 hover:text-red-800 group-hover:block">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-stone-200 pt-3">
            <Inp placeholder="What was said…" value={newQuote} onChange={(e) => setNewQuote(e.target.value)} />
            <Inp placeholder="Who said it" value={saidBy} onChange={(e) => setSaidBy(e.target.value)} />
            <B small kind="gold" onClick={addQuote}><Plus size={12} /> Record it</B>
          </div>
        </Card>

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
          Muster Roll
        </H>
        <Card className="divide-y divide-stone-200">
          {Object.entries(users).map(([key, u]) => {
            const rk = rankFor(u.faction, games[u.name] || 0);
            const isChamp = currentChamp && currentChamp.member === u.name;
            return (
              <div key={key} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0">
                  <p className="f-disp flex items-center gap-1.5 text-sm font-bold">
                    <span className="truncate">{u.name}</span>
                    {isChamp && <Crown size={12} className="shrink-0 text-amber-600" title="Champion of the Old World" />}
                    {u.isAdmin && <Gavel size={10} className="shrink-0 text-stone-400" title="Grand Marshal (admin)" />}
                  </p>
                  <p className="text-[11px] italic text-stone-500" title={rk.isMax ? "Top rank reached" : rk.toNext + " more game(s) to " + (RANK_TITLES[u.faction] || RANK_TITLES["The Empire"])[rk.tier]}>
                    {rk.title} · {u.faction}
                  </p>
                </div>
                {user.isAdmin && u.name !== user.name && (
                  <B small kind="ghost" onClick={() => toggleAdmin(key)}>{u.isAdmin ? "Demote" : "Promote"}</B>
                )}
              </div>
            );
          })}
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
    </div>
  );
}

/* ============================================================
   LEAGUE / CUP PAGES — admin-managed tables and brackets
   ============================================================ */
function PagesTab({ ctx, kind }) {
  const { user, pages, save } = ctx;
  const mine = pages.filter((p) => p.kind === kind);
  const [editingId, setEditingId] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
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
    await save.pages([...pages, { id: uid(), kind, title: t, rows, created: Date.now() }]);
    setNewTitle(""); setTpl("blank"); setShowNew(false);
  };
  const updatePage = async (pg) => { await save.pages(pages.map((p) => (p.id === pg.id ? pg : p))); };
  const deletePage = async (id) => { await save.pages(pages.filter((p) => p.id !== id)); setEditingId(null); };

  return (
    <div>
      <H icon={kind === "league" ? Trophy : Crown}
        right={isAdmin && <B small kind="gold" onClick={() => setShowNew(true)}><Plus size={12} /> New {label}</B>}>
        {kind === "league" ? "The League" : "The Grand Tourney"}
      </H>
      {mine.length === 0 && (
        <Empty>
          {isAdmin ? "No " + label + "s yet. Create one above, Grand Marshal." : "The Grand Marshal has not posted any " + label + "s yet."}
        </Empty>
      )}
      <div className="space-y-6">
        {mine.map((pg) => (
          <PageBlock key={pg.id} pg={pg} kind={kind} isAdmin={isAdmin}
            editing={editingId === pg.id}
            onEdit={() => setEditingId(pg.id)}
            onDone={() => setEditingId(null)}
            onChange={updatePage}
            onDelete={() => deletePage(pg.id)}
            blankRow={blankRow} />
        ))}
      </div>
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

function PageBlock({ pg, kind, isAdmin, editing, onEdit, onDone, onChange, onDelete, blankRow }) {
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

  const cols = kind === "league"
    ? [["player", "Player", "flex-1"], ["army", "Army", "w-36"], ["p", "P", "w-10"], ["w", "W", "w-10"], ["d", "D", "w-10"], ["l", "L", "w-10"], ["pts", "Pts", "w-12"]]
    : [["round", "Round", "w-28"], ["a", "Combatant A", "flex-1"], ["b", "Combatant B", "flex-1"], ["score", "Result", "w-24"]];

  const sortedRows = kind === "league" && !editing
    ? [...pg.rows].sort((a, b) => (parseInt(b.pts) || 0) - (parseInt(a.pts) || 0))
    : pg.rows;

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
                  {cols.map(([f, lab, w]) =>
                    editing ? (
                      f === "army" ? (
                        <select key={f} value={r[f] || ""} onChange={(e) => setRow(r.id, f, e.target.value)}
                          className={"f-body rounded-sm border border-stone-300 bg-white px-1 py-1 text-sm " + w}>
                          <option value="">— army —</option>
                          {ARMIES.map((a) => <option key={a}>{a}</option>)}
                        </select>
                      ) : (
                        <input key={f} value={r[f]} onChange={(e) => setRow(r.id, f, e.target.value)}
                          className={"f-body rounded-sm border border-stone-300 bg-white px-2 py-1 text-sm " + w} />
                      )
                    ) : f === "army" ? (
                      <span key={f} className={"f-body truncate text-xs italic text-stone-600 " + w}>{r[f] || ""}</span>
                    ) : (
                      <span key={f} className={"f-body text-sm " + w + (f === "player" || f === "a" || f === "b" ? " font-medium" : f === "pts" ? " font-bold text-red-900" : "")}>{r[f]}</span>
                    )
                  )}
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
   BATTLES — fixtures (admin) + battle reports (anyone)
   ============================================================ */
function BattlesTab({ ctx }) {
  const { user, memberNames, fixtures, reports, save } = ctx;
  const [showFx, setShowFx] = useState(false);
  const [showRp, setShowRp] = useState(false);
  const [fx, setFx] = useState({ playerA: "", playerB: "", date: today(), points: "1500", notes: "" });
  const blankReport = () => ({
    playerA: "", playerB: "", armyA: "", armyB: "", date: today(), points: "1500",
    winner: "A", score: "", moment: "", shame: [],
  });
  const [rp, setRp] = useState(blankReport());

  const addFixture = async () => {
    if (!fx.playerA.trim() || !fx.playerB.trim()) return;
    await save.fixtures([...fixtures, { ...fx, id: uid(), created: Date.now() }]);
    setFx({ playerA: "", playerB: "", date: today(), points: "1500", notes: "" });
    setShowFx(false);
  };
  const delFixture = async (id) => { await save.fixtures(fixtures.filter((f) => f.id !== id)); };

  const addReport = async () => {
    if (!rp.playerA.trim() || !rp.playerB.trim()) return;
    await save.reports([{ ...rp, id: uid(), filedBy: user.name, created: Date.now() }, ...reports]);
    setRp(blankReport());
    setShowRp(false);
  };
  const delReport = async (r) => {
    if (!(user.isAdmin || r.filedBy === user.name)) return;
    if (!confirm("Strike this battle from the record? It affects the ladder.")) return;
    await save.reports(reports.filter((x) => x.id !== r.id));
  };

  const setShame = (i, field, val) => {
    const s = [...rp.shame]; s[i] = { ...s[i], [field]: val }; setRp({ ...rp, shame: s });
  };

  const PlayerInput = ({ value, onChange, placeholder }) => (
    <div>
      <Inp list="wh-members" placeholder={placeholder} value={value} onChange={onChange} />
    </div>
  );

  const sortedFixtures = [...fixtures].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  const sortedReports = [...reports].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.created - a.created);
  const ladder = computeStandings(reports);

  return (
    <div>
      <datalist id="wh-members">{memberNames.map((n) => <option key={n} value={n} />)}</datalist>

      <H icon={CalendarDays} right={user.isAdmin && <B small kind="gold" onClick={() => setShowFx(true)}><Plus size={12} /> Schedule battle</B>}>
        Scheduled battles
      </H>
      {sortedFixtures.length === 0 ? (
        <Empty>Nothing scheduled. {user.isAdmin ? "Sort it out, Grand Marshal." : "Pester the Grand Marshal."}</Empty>
      ) : (
        <div className="space-y-2">
          {sortedFixtures.map((f) => (
            <Card key={f.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="f-disp text-sm font-bold">{f.playerA} <span className="text-red-900">vs</span> {f.playerB}</p>
                <p className="text-xs italic text-stone-500">{fmtDate(f.date)} · {f.points} pts{f.notes ? " · " + f.notes : ""}</p>
              </div>
              {user.isAdmin && (
                <button onClick={() => delFixture(f.id)} className="text-stone-400 hover:text-red-800"><Trash2 size={14} /></button>
              )}
            </Card>
          ))}
        </div>
      )}

      <H icon={Swords} right={<B small kind="gold" onClick={() => setShowRp(true)}><Plus size={12} /> File battle report</B>}>
        Battle reports
      </H>
      {sortedReports.length === 0 ? (
        <Empty>The chronicles are empty. File the first report and shape history in your favour.</Empty>
      ) : (
        <div className="space-y-3">
          {sortedReports.map((r) => {
            const winName = r.winner === "A" ? r.playerA : r.winner === "B" ? r.playerB : null;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="f-disp text-sm font-bold">
                      <span className={r.winner === "A" ? "text-red-900" : ""}>{r.playerA}</span>
                      {r.armyA ? <span className="font-normal italic text-stone-500"> ({r.armyA})</span> : null}
                      <span className="px-1.5 text-stone-400">vs</span>
                      <span className={r.winner === "B" ? "text-red-900" : ""}>{r.playerB}</span>
                      {r.armyB ? <span className="font-normal italic text-stone-500"> ({r.armyB})</span> : null}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {fmtDate(r.date)} · {r.points} pts · {winName ? "Victory: " + winName : "Bloody draw"}{r.score ? " · " + r.score : ""}
                    </p>
                  </div>
                  {(user.isAdmin || r.filedBy === user.name) && (
                    <button onClick={() => delReport(r)} className="shrink-0 text-stone-400 hover:text-red-800"><Trash2 size={14} /></button>
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
              <span className="w-12">Pts</span><span className="w-14 text-right">ELO</span>
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

      {showFx && (
        <Modal title="Schedule a battle" onClose={() => setShowFx(false)}>
          <div className="space-y-3">
            <PlayerInput placeholder="Combatant A" value={fx.playerA} onChange={(e) => setFx({ ...fx, playerA: e.target.value })} />
            <PlayerInput placeholder="Combatant B" value={fx.playerB} onChange={(e) => setFx({ ...fx, playerB: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Inp type="date" value={fx.date} onChange={(e) => setFx({ ...fx, date: e.target.value })} />
              <Inp placeholder="Points (e.g. 1500)" value={fx.points} onChange={(e) => setFx({ ...fx, points: e.target.value })} />
            </div>
            <Inp placeholder="Notes (venue, scenario…)" value={fx.notes} onChange={(e) => setFx({ ...fx, notes: e.target.value })} />
            <B onClick={addFixture}><Plus size={14} /> Schedule</B>
          </div>
        </Modal>
      )}

      {showRp && (
        <Modal title="File a battle report" onClose={() => setShowRp(false)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <PlayerInput placeholder="Combatant A" value={rp.playerA} onChange={(e) => setRp({ ...rp, playerA: e.target.value })} />
              <PlayerInput placeholder="Combatant B" value={rp.playerB} onChange={(e) => setRp({ ...rp, playerB: e.target.value })} />
              <Inp placeholder="Army A (e.g. The Empire)" value={rp.armyA} onChange={(e) => setRp({ ...rp, armyA: e.target.value })} />
              <Inp placeholder="Army B" value={rp.armyB} onChange={(e) => setRp({ ...rp, armyB: e.target.value })} />
              <Inp type="date" value={rp.date} onChange={(e) => setRp({ ...rp, date: e.target.value })} />
              <Inp placeholder="Points" value={rp.points} onChange={(e) => setRp({ ...rp, points: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Sel value={rp.winner} onChange={(e) => setRp({ ...rp, winner: e.target.value })}>
                <option value="A">Victory: Combatant A</option>
                <option value="B">Victory: Combatant B</option>
                <option value="draw">Draw</option>
              </Sel>
              <Inp placeholder="Result (e.g. Massacre, +840 VP)" value={rp.score} onChange={(e) => setRp({ ...rp, score: e.target.value })} />
            </div>
            <TA rows={2} placeholder="Moment of the match…" value={rp.moment} onChange={(e) => setRp({ ...rp, moment: e.target.value })} />
            <div>
              <p className="f-disp mb-1 text-xs font-bold uppercase tracking-wide text-stone-600">Hall of Infamy entries (optional)</p>
              {rp.shame.map((s, i) => (
                <div key={i} className="mb-2 grid grid-cols-3 gap-2">
                  <Inp list="wh-members" placeholder="Player" value={s.player} onChange={(e) => setShame(i, "player", e.target.value)} />
                  <Inp type="number" placeholder="Ones rolled" value={s.ones} onChange={(e) => setShame(i, "ones", e.target.value)} />
                  <Inp placeholder="Context" value={s.note} onChange={(e) => setShame(i, "note", e.target.value)} />
                </div>
              ))}
              <B small kind="ghost" onClick={() => setRp({ ...rp, shame: [...rp.shame, { player: "", ones: "", note: "" }] })}>
                <Skull size={12} /> Add shame
              </B>
            </div>
            <B onClick={addReport}><Swords size={14} /> File report</B>
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
  const { user, photosIdx, save } = ctx;
  const [view, setView] = useState("match");
  const [images, setImages] = useState({});
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const fileRef = useRef(null);

  const shown = [...photosIdx].filter((p) => p.kind === view).sort((a, b) => b.created - a.created);

  useEffect(() => {
    let alive = true;
    (async () => {
      for (const p of shown) {
        if (images[p.id]) continue;
        const d = await sget("wh-photo-" + p.id);
        if (d && alive) setImages((prev) => ({ ...prev, [p.id]: d.data }));
      }
    })();
    return () => { alive = false; };
  }, [view, photosIdx.length]);

  const upload = async (file) => {
    if (!file) return;
    setErr(""); setBusy(true);
    try {
      const data = await compressImage(file);
      if (data.length > 1800000) { setErr("That image is enormous even after squashing. Try a smaller one."); setBusy(false); return; }
      const id = uid();
      const ok = await sset("wh-photo-" + id, { data });
      if (!ok) { setErr("Upload failed. The vaults may be full."); setBusy(false); return; }
      const entry = { id, caption: caption.trim(), uploader: user.name, kind: view, votes: [], created: Date.now() };
      await save.photosIdx([entry, ...photosIdx]);
      setImages((prev) => ({ ...prev, [id]: data }));
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
    await sdel("wh-photo-" + p.id);
    await save.photosIdx(photosIdx.filter((x) => x.id !== p.id));
  };

  const toggleVote = async (p) => {
    const votes = p.votes || [];
    const next = votes.includes(user.name) ? votes.filter((v) => v !== user.name) : [...votes, user.name];
    await save.photosIdx(photosIdx.map((x) => (x.id === p.id ? { ...x, votes: next } : x)));
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
              <button className="block w-full" onClick={() => setLightbox(p)}>
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
                  {view === "painting" && (
                    <button onClick={() => toggleVote(p)}
                      className={"flex items-center gap-0.5 text-xs " + ((p.votes || []).includes(user.name) ? "font-bold text-red-900" : "text-stone-500 hover:text-red-900")}>
                      <ThumbsUp size={12} /> {(p.votes || []).length}
                    </button>
                  )}
                  {(user.isAdmin || p.uploader === user.name) && (
                    <button onClick={() => delPhoto(p)} className="text-stone-400 hover:text-red-800"><Trash2 size={12} /></button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/90 p-4" onClick={() => setLightbox(null)}>
          <div className="max-h-full max-w-3xl">
            {images[lightbox.id] && <img src={images[lightbox.id]} alt={lightbox.caption || ""} className="max-h-[80vh] w-auto rounded-sm" />}
            <p className="f-disp mt-2 text-center text-sm text-amber-100">
              {lightbox.caption || "Untitled"} — {lightbox.uploader}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   LIBRARY — rules, rulings and links (PDFs live on Drive)
   ============================================================ */
function RulesTab({ ctx }) {
  const { user, rules, save } = ctx;
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ title: "", body: "", link: "" });
  const [open, setOpen] = useState(null);

  const add = async () => {
    if (!draft.title.trim()) return;
    await save.rules([{ ...draft, id: uid(), addedBy: user.name, created: Date.now() }, ...rules]);
    setDraft({ title: "", body: "", link: "" });
    setShow(false);
  };
  const del = async (r) => {
    if (!user.isAdmin) return;
    if (!confirm("Remove \u201C" + r.title + "\u201D from the library?")) return;
    await save.rules(rules.filter((x) => x.id !== r.id));
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
  const { user, faq, save } = ctx;
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ q: "", a: "" });
  const [open, setOpen] = useState(null);

  const add = async () => {
    if (!draft.q.trim()) return;
    await save.faq([...faq, { ...draft, id: uid(), created: Date.now() }]);
    setDraft({ q: "", a: "" });
    setShow(false);
  };
  const del = async (f) => {
    if (!user.isAdmin) return;
    await save.faq(faq.filter((x) => x.id !== f.id));
  };

  return (
    <div>
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
  const { user, users, proposals, save } = ctx;
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState({ title: "", detail: "" });
  const memberCount = Object.keys(users).length;

  const sealed = proposals.filter((p) => p.status === "sealed").sort((a, b) => (b.sealedAt || 0) - (a.sealedAt || 0));
  const open = proposals.filter((p) => p.status === "open").sort((a, b) => b.created - a.created);
  const struck = proposals.filter((p) => p.status === "struck").sort((a, b) => (b.struckAt || 0) - (a.struckAt || 0));

  const propose = async () => {
    if (!draft.title.trim()) return;
    await save.proposals([
      { id: uid(), title: draft.title.trim(), detail: draft.detail.trim(), proposedBy: user.name, created: Date.now(), votes: {}, status: "open" },
      ...proposals,
    ]);
    setDraft({ title: "", detail: "" });
    setShow(false);
  };

  const vote = async (p, dir) => {
    const votes = { ...(p.votes || {}) };
    if (votes[user.name] === dir) delete votes[user.name];
    else votes[user.name] = dir;
    await save.proposals(proposals.map((x) => (x.id === p.id ? { ...x, votes } : x)));
  };

  const seal = async (p) => {
    if (!user.isAdmin) return;
    if (!confirm("Bring down the gavel and seal \u201C" + p.title + "\u201D into law?")) return;
    await save.proposals(proposals.map((x) => (x.id === p.id ? { ...x, status: "sealed", sealedAt: Date.now(), sealedBy: user.name } : x)));
  };
  const strike = async (p) => {
    if (!user.isAdmin) return;
    if (!confirm("Strike down \u201C" + p.title + "\u201D?")) return;
    await save.proposals(proposals.map((x) => (x.id === p.id ? { ...x, status: "struck", struckAt: Date.now() } : x)));
  };
  const remove = async (p) => {
    if (!(user.isAdmin || (p.proposedBy === user.name && p.status === "open"))) return;
    if (!confirm("Remove this motion entirely?")) return;
    await save.proposals(proposals.filter((x) => x.id !== p.id));
  };

  const tally = (p) => {
    const vs = Object.values(p.votes || {});
    return { ayes: vs.filter((v) => v === "aye").length, nays: vs.filter((v) => v === "nay").length };
  };
  const voterNames = (p, dir) =>
    Object.entries(p.votes || {}).filter(([, v]) => v === dir).map(([n]) => n).join(", ") || "nobody";

  const Seal = () => (
    <div className="flex h-14 w-14 shrink-0 -rotate-12 items-center justify-center rounded-full bg-red-800 text-amber-100 shadow-md ring-2 ring-red-950">
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

      <H icon={Scroll}>Laws of the league</H>
      {sealed.length === 0 ? (
        <Empty>No laws ratified yet. Anarchy reigns.</Empty>
      ) : (
        <div className="space-y-3">
          {sealed.map((p) => {
            const { ayes, nays } = tally(p);
            return (
              <Card key={p.id} className="flex items-start gap-3 border-amber-700 bg-amber-100/50 p-4">
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

      {struck.length > 0 && (
        <>
          <H icon={Skull}>Struck down</H>
          <div className="space-y-2">
            {struck.map((p) => {
              const { ayes, nays } = tally(p);
              return (
                <Card key={p.id} className="flex items-center justify-between gap-2 p-3 opacity-60">
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
