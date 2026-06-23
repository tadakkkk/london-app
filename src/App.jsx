import { useState, useEffect, useCallback, useRef } from "react";

/* ──────────────────────────────────────────────────────────
   juhyun · london exchange assistant  (v3 · light · notebook)
   grid paper + pen-blue. now with weather + dual clock.
   one "current city" drives the day line, weather and clock.
   ────────────────────────────────────────────────────────── */

const mem = {};
const store = {
  async get(k) {
    if (typeof window !== "undefined" && window.storage) {
      try { const r = await window.storage.get(k); return r ? JSON.parse(r.value) : null; } catch { return null; }
    }
    if (typeof localStorage !== "undefined") {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
    }
    return mem[k] ?? null;
  },
  async set(k, v) {
    if (typeof window !== "undefined" && window.storage) {
      try { await window.storage.set(k, JSON.stringify(v), false); return; } catch (e) { /* fall through */ }
    }
    if (typeof localStorage !== "undefined") {
      try { localStorage.setItem(k, JSON.stringify(v)); return; } catch (e) { /* fall through */ }
    }
    mem[k] = v;
  },
};

/* europe events seeded by month (recurring annual highlights · verify exact dates each year) */
const EVENTS_BY_MONTH = {
  "01": ["vienna new year's concert", "venice carnival begins (late jan)", "northern lights season · lapland / tromsø"],
  "02": ["venice carnival", "nice carnival", "snow season · lapland"],
  "03": ["keukenhof tulips open · netherlands (mid–late mar)", "paris cherry blossoms (late mar)", "st patrick's · dublin (mar 17)"],
  "04": ["keukenhof tulips peak", "seville feria · spain", "easter markets across europe"],
  "05": ["keukenhof until early may", "eurovision", "cannes film festival (mid may)"],
  "06": ["midsummer · nordics (~jun 21)", "italy / greece season opens", "long white nights up north"],
  "07": ["running of the bulls · pamplona (jul 6–14)", "avignon festival", "mediterranean peak"],
  "08": ["edinburgh fringe", "la tomatina · spain (last wed)", "notting hill carnival · london (late aug)"],
  "09": ["oktoberfest · munich (mid sep–early oct)", "london design festival", "grape harvest season"],
  "10": ["oktoberfest ends (early oct)", "autumn colours", "halloween events"],
  "11": ["día de los muertos · spain (nov 1–2)", "christmas markets begin (late nov · vienna, strasbourg)", "bonfire night · uk (nov 5)"],
  "12": ["christmas markets peak · vienna, prague, strasbourg, cologne, geneva", "santa / lapland season", "new year's eve"],
};

const DAILY = [
  { id: "diary", label: "diary", sub: "타닥타닥", link: "diary" },
  { id: "shorts", label: "shorts", sub: "reels", link: "shorts" },
  { id: "ledger", label: "ledger", sub: "가계부", link: "ledger" },
  { id: "workout", label: "workout", sub: "30–50 min" },
  { id: "email", label: "email 소정", sub: "", link: "email" },
];

const WORKOUTS = [
  { t: "mat · full body", m: 35, l: ["warm up 5'", "squat / glute bridge / plank / bird-dog / lunge", "3 rounds, 40s on 20s off", "cool down 5'"] },
  { t: "mat · core + lower", m: 30, l: ["warm up 4'", "dead bug / side plank / wall sit / donkey kick", "3 rounds", "stretch 5'"] },
  { t: "run · easy", m: 40, l: ["zone 2, talk-pace", "out 20' / back 20'", "walk the last 3'"] },
  { t: "run · intervals", m: 32, l: ["jog 8' warm up", "1' hard / 2' easy × 6", "jog 6' cool down"] },
  { t: "mat · upper + posture", m: 30, l: ["band pull-apart / pike push-up / superman", "wall angels", "3 rounds, then stretch"] },
  { t: "walk + mobility", m: 45, l: ["brisk walk 30' (around bloomsbury)", "hip + shoulder mobility 15'"] },
];

const IDEAS = [
  { t: "one hob, one pot — what i cooked", f: "what i eat" },
  { t: "the smoke alarm went off again", f: "vlog" },
  { t: "tried to say a full sentence at tesco", f: "story" },
  { t: "what i actually brought from korea", f: "what i have" },
  { t: "my night routine in a dorm room", f: "routine" },
  { t: "laundry day · the washstation app", f: "vlog" },
  { t: "ate standing up again", f: "vlog" },
  { t: "morning before a 9am class", f: "routine" },
  { t: "i ordered something i couldn't pronounce", f: "story" },
  { t: "groceries for the week, one bag", f: "what i have" },
  { t: "rainy day, didn't leave the room", f: "vlog" },
  { t: "korean food, british ingredients", f: "what i eat" },
];

const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = () => fmtDate(new Date());
const monthKey = () => todayKey().slice(0, 7);
const uid = () => (window.crypto?.randomUUID?.() || String(Date.now() + Math.random()));

const HOME = { name: "seoul", tz: "Asia/Seoul" };
const DEFAULT_SETTINGS = {
  name: "juhyun", city: "london",
  geo: { lat: 51.5074, lon: -0.1278, tz: "Europe/London" },
  startDate: "2026-09-14",
  links: { diary: "", blog: "", notion: "", shorts: "", ledger: "", email: "" },
  events: [],
};

const SITE_MAP = [
  { keys: ["타닥타닥", "일기", "diary"], link: "diary", label: "타닥타닥" },
  { keys: ["블로그", "blog"], link: "blog", label: "blog" },
  { keys: ["노션", "notion"], link: "notion", label: "notion" },
  { keys: ["쇼츠", "릴스", "reels", "shorts"], link: "shorts", label: "shorts" },
  { keys: ["가계부", "ledger"], link: "ledger", label: "가계부" },
];
const OPEN_WORDS = ["열어", "틀어", "켜", "띄워", "open", "열어줘", "들어가"];

/* ── weather helpers (open-meteo, no key, CORS-ok) ── */
function wmo(code) {
  if (code === 0) return { d: "clear", rain: false };
  if ([1, 2, 3].includes(code)) return { d: "cloudy", rain: false };
  if ([45, 48].includes(code)) return { d: "fog", rain: false };
  if ([51, 53, 55, 56, 57].includes(code)) return { d: "drizzle", rain: true };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { d: "rain", rain: true };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { d: "snow", rain: true };
  if ([95, 96, 99].includes(code)) return { d: "storm", rain: true };
  return { d: "—", rain: false };
}
async function geocode(name) {
  const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`);
  const j = await r.json();
  if (!j.results || !j.results.length) return null;
  const x = j.results[0];
  return { name: x.name.toLowerCase(), lat: x.latitude, lon: x.longitude, tz: x.timezone };
}
async function getWeather(lat, lon) {
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=precipitation_probability_max&forecast_days=1&timezone=auto`;
  const r = await fetch(u);
  const j = await r.json();
  const code = j.current.weather_code;
  const temp = Math.round(j.current.temperature_2m);
  const pp = j.daily?.precipitation_probability_max?.[0] ?? 0;
  const { d, rain } = wmo(code);
  return { temp, desc: d, umbrella: rain || pp >= 50 };
}

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("today");
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [logs, setLogs] = useState({});
  const [blogDone, setBlogDone] = useState({});
  const [monthlyx, setMonthlyx] = useState({});

  useEffect(() => {
    (async () => {
      const s = await store.get("settings");
      const lg = await store.get("logs");
      const bl = await store.get("blog");
      const mx = await store.get("monthlyx");
      if (s) setSettings({ ...DEFAULT_SETTINGS, ...s, geo: { ...DEFAULT_SETTINGS.geo, ...(s.geo || {}) }, links: { ...DEFAULT_SETTINGS.links, ...(s.links || {}) } });
      if (lg) setLogs(lg);
      if (bl) setBlogDone(bl);
      if (mx) setMonthlyx(mx);
      setLoaded(true);
    })();
  }, []);

  const saveLogs = useCallback((next) => { setLogs(next); store.set("logs", next); }, []);
  const saveSettings = useCallback((next) => { setSettings(next); store.set("settings", next); }, []);
  const saveBlog = useCallback((next) => { setBlogDone(next); store.set("blog", next); }, []);
  const saveMonthlyx = useCallback((next) => { setMonthlyx(next); store.set("monthlyx", next); }, []);

  const tk = todayKey();
  const todayLog = logs[tk] || {};
  const extras = todayLog.extra || [];
  const doneCount = DAILY.filter((d) => todayLog[d.id]).length;
  const extrasPending = extras.some((e) => !e.done);
  const allClear = doneCount === DAILY.length && !extrasPending;

  const writeDay = (mut) => { const day = { ...(logs[tk] || {}) }; mut(day); saveLogs({ ...logs, [tk]: day }); };
  const toggle = (id) => writeDay((d) => { d[id] = !d[id]; });
  const addExtra = (text) => { const v = (text || "").trim(); if (!v) return; writeDay((d) => { d.extra = [...(d.extra || []), { id: uid(), label: v, done: false }]; }); };
  const toggleExtra = (id) => writeDay((d) => { d.extra = (d.extra || []).map((e) => e.id === id ? { ...e, done: !e.done } : e); });
  const removeExtra = (id) => writeDay((d) => { d.extra = (d.extra || []).filter((e) => e.id !== id); });
  const setEmoji = (emoji) => writeDay((d) => { d.emoji = emoji; });

  const mKey = monthKey();
  const monthItems = monthlyx[mKey] || [];
  const writeMonth = (arr) => saveMonthlyx({ ...monthlyx, [mKey]: arr });
  const addMonthly = (text) => { const v = (text || "").trim(); if (!v) return; writeMonth([...monthItems, { id: uid(), label: v, done: false }]); };
  const toggleMonthly = (id) => writeMonth(monthItems.map((e) => e.id === id ? { ...e, done: !e.done } : e));
  const removeMonthly = (id) => writeMonth(monthItems.filter((e) => e.id !== id));

  const start = new Date(settings.startDate + "T00:00:00");
  const now = new Date();
  const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNum = Math.floor((today0 - start) / 86400000) + 1;

  const openLink = (key) => { const url = settings.links[key]; if (url) window.open(url, "_blank", "noopener"); else setTab("more"); };

  if (!loaded) return (<div className="jx-root"><Style /><div className="jx-loading">loading…</div></div>);

  return (
    <div className="jx-root">
      <Style />
      <div className="jx-shell">
        {tab === "today" && (
          <Today settings={settings} dayNum={dayNum} todayLog={todayLog} extras={extras}
            doneCount={doneCount} extrasPending={extrasPending} allClear={allClear}
            toggle={toggle} addExtra={addExtra} toggleExtra={toggleExtra} removeExtra={removeExtra} openLink={openLink}
            blogDone={!!blogDone[monthKey()]} toggleBlog={() => saveBlog({ ...blogDone, [monthKey()]: !blogDone[monthKey()] })}
            emoji={todayLog.emoji || ""} setEmoji={setEmoji}
            monthItems={monthItems} addMonthly={addMonthly} toggleMonthly={toggleMonthly} removeMonthly={removeMonthly} />
        )}
        {tab === "stats" && <Dashboard logs={logs} blogDone={blogDone} />}
        {tab === "more" && <More settings={settings} saveSettings={saveSettings} />}
        {tab === "today" && <Voice openLink={openLink} addExtra={addExtra} links={settings.links} goSettings={() => setTab("more")} />}

        <nav className="jx-nav">
          {[["today", "today"], ["stats", "dashboard"], ["more", "more"]].map(([id, label]) => (
            <button key={id} className={"jx-navbtn" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </div>
    </div>
  );
}

/* ── analog clock ── */
function AnalogClock({ label, tz }) {
  const [, tick] = useState(0);
  useEffect(() => { const i = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(i); }, []);
  const now = new Date();
  let h = 0, m = 0, sec = 0, dig = "--:--";
  try {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "numeric", second: "numeric", hour12: false }).formatToParts(now);
    const g = (t) => +p.find((x) => x.type === t).value;
    h = g("hour") % 12; m = g("minute"); sec = g("second");
    dig = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  } catch {}
  const hand = (ang, len) => {
    const r = (ang - 90) * Math.PI / 180;
    return { x2: 50 + len * Math.cos(r), y2: 50 + len * Math.sin(r) };
  };
  const hh = hand(h * 30 + m * 0.5, 22);
  const mm = hand(m * 6 + sec * 0.1, 31);
  const ss = hand(sec * 6, 35);
  const ticks = Array.from({ length: 12 }, (_, k) => {
    const r = (k * 30 - 90) * Math.PI / 180;
    return { x1: 50 + 41 * Math.cos(r), y1: 50 + 41 * Math.sin(r), x2: 50 + 45 * Math.cos(r), y2: 50 + 45 * Math.sin(r), big: k % 3 === 0 };
  });
  return (
    <div className="jx-clockface">
      <svg viewBox="0 0 100 100" width="58" height="58" aria-hidden="true">
        <circle cx="50" cy="50" r="47" fill="var(--surface)" stroke="var(--line)" strokeWidth="1.5" />
        {ticks.map((t, k) => (<line key={k} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--muted)" strokeWidth={t.big ? 1.6 : 0.8} />))}
        <line x1="50" y1="50" x2={hh.x2} y2={hh.y2} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        <line x1="50" y1="50" x2={mm.x2} y2={mm.y2} stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
        <line x1="50" y1="50" x2={ss.x2} y2={ss.y2} stroke="var(--blue)" strokeWidth="1" strokeLinecap="round" />
        <circle cx="50" cy="50" r="2.4" fill="var(--blue)" />
      </svg>
      <span className="jx-clbl">{label}</span>
      <span className="jx-cdig">{dig}</span>
    </div>
  );
}

/* ── strip: two clocks + weather ── */
function Strip({ settings }) {
  const [w, setW] = useState({ loading: true });
  useEffect(() => {
    let alive = true; setW({ loading: true });
    getWeather(settings.geo.lat, settings.geo.lon)
      .then((r) => alive && setW(r)).catch(() => alive && setW({ error: true }));
    return () => { alive = false; };
  }, [settings.geo.lat, settings.geo.lon]);
  const city = settings.city || "here";
  return (
    <div className="jx-strip">
      <div className="jx-clocks">
        <AnalogClock label={HOME.name} tz={HOME.tz} />
        <AnalogClock label={city} tz={settings.geo.tz} />
      </div>
      <p className="jx-weather">
        {w.loading ? `${city} · …`
          : w.error ? `${city} · weather loads on deploy`
            : <>{city} · {w.temp}° · {w.desc}{w.umbrella && <span className="jx-umb"> · umbrella</span>}</>}
      </p>
    </div>
  );
}

/* ── today ── */
function Today({ settings, dayNum, todayLog, extras, doneCount, extrasPending, allClear, toggle, addExtra, toggleExtra, removeExtra, openLink, blogDone, toggleBlog, emoji, setEmoji, monthItems, addMonthly, toggleMonthly, removeMonthly }) {
  const [newTask, setNewTask] = useState("");
  const [newMonth, setNewMonth] = useState("");
  const [pick, setPick] = useState(false);
  const EMOJIS = ["🌧️","☀️","🌫️","😮‍💨","😵","🍜","☕","📮","🎬","💻","🏃","😴","🧺","🥲","🙂","🔥","✈️","🛒"];
  const d = new Date();
  const dateLabel = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short", year: "numeric" }).toLowerCase();
  const hero = `day ${dayNum} in ${settings.city}`;

  let status;
  if (allClear) status = "see you tomorrow";
  else if (doneCount === DAILY.length && extrasPending) status = "almost · extras left";
  else if (doneCount === 0 && extras.length === 0) status = "nothing done yet";
  else status = `${doneCount} of ${DAILY.length} done`;

  const submit = () => { addExtra(newTask); setNewTask(""); };

  return (
    <section className="jx-page">
      <div className="jx-top">
        <p className="jx-eyebrow">{dateLabel}</p>
        <button className="jx-notion" onClick={() => openLink("notion")}>notion ↗</button>
      </div>
      <Strip settings={settings} />
      <div className="jx-herorow">
        <h1 className="jx-hero">{hero}</h1>
        <button className={"jx-emoji" + (emoji ? " set" : "")} onClick={() => setPick((v) => !v)}>{emoji || "＋"}</button>
      </div>
      {pick && (
        <div className="jx-emojipick">
          {EMOJIS.map((e) => (<button key={e} onClick={() => { setEmoji(e); setPick(false); }}>{e}</button>))}
          <button className="jx-eclear" onClick={() => { setEmoji(""); setPick(false); }}>clear</button>
        </div>
      )}
      <p className={"jx-status" + (allClear ? " done" : "")}>{status}</p>

      <ul className="jx-list">
        {DAILY.map((t) => {
          const done = !!todayLog[t.id];
          return (
            <li key={t.id} className={"jx-row" + (done ? " done" : "")}>
              <Check done={done} onClick={() => toggle(t.id)} />
              <button className="jx-rowmain" onClick={() => toggle(t.id)}>
                <span className="jx-rowlabel">{t.label}</span>
                {t.sub && <span className="jx-rowsub">{t.sub}</span>}
              </button>
              {t.link && <button className="jx-jump" onClick={() => openLink(t.link)}>open ↗</button>}
            </li>
          );
        })}
      </ul>

      <div className="jx-extra">
        <p className="jx-extrahd">today only</p>
        {extras.length > 0 && (
          <ul className="jx-list thin">
            {extras.map((e) => (
              <li key={e.id} className={"jx-row" + (e.done ? " done" : "")}>
                <Check done={e.done} onClick={() => toggleExtra(e.id)} />
                <button className="jx-rowmain" onClick={() => toggleExtra(e.id)}><span className="jx-rowlabel">{e.label}</span></button>
                <button className="jx-jump muted" onClick={() => removeExtra(e.id)}>remove</button>
              </li>
            ))}
          </ul>
        )}
        <div className="jx-addrow">
          <input value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="add a task for today" onKeyDown={(e) => e.key === "Enter" && submit()} />
          <button onClick={submit}>add</button>
        </div>
      </div>

      <div className="jx-monthsec">
        <p className="jx-extrahd">this month</p>
        <div className={"jx-monthly" + (blogDone ? " done" : "")}>
          <span className="jx-mtoggle" onClick={toggleBlog}>
            <Check done={blogDone} onClick={toggleBlog} small />
            <span className="jx-mlabel">blog post</span>
          </span>
          <span className="jx-jump" onClick={() => openLink("blog")}>open ↗</span>
        </div>
        {monthItems.map((it) => (
          <div key={it.id} className={"jx-monthly" + (it.done ? " done" : "")}>
            <span className="jx-mtoggle" onClick={() => toggleMonthly(it.id)}>
              <Check done={it.done} onClick={() => toggleMonthly(it.id)} small />
              <span className="jx-mlabel">{it.label}</span>
            </span>
            <button className="jx-jump muted" onClick={() => removeMonthly(it.id)}>remove</button>
          </div>
        ))}
        <div className="jx-addrow">
          <input value={newMonth} onChange={(e) => setNewMonth(e.target.value)} placeholder="add a goal for this month" onKeyDown={(e) => e.key === "Enter" && (addMonthly(newMonth), setNewMonth(""))} />
          <button onClick={() => { addMonthly(newMonth); setNewMonth(""); }}>add</button>
        </div>
      </div>
    </section>
  );
}

function Check({ done, onClick, small }) {
  return (
    <button className={"jx-check" + (done ? " on" : "") + (small ? " sm" : "")} aria-pressed={done} onClick={(e) => { e.stopPropagation(); onClick(); }}>
      {done && (
        <svg viewBox="0 0 24 24" width={small ? 11 : 13} height={small ? 11 : 13} aria-hidden="true">
          <path d="M4 12.5l5 5L20 6" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

/* ── voice ── */
function Voice({ openLink, addExtra, links, goSettings }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState(null);
  const recRef = useRef(null);
  const handle = (text) => {
    const low = text.toLowerCase();
    const wantsOpen = OPEN_WORDS.some((w) => low.includes(w));
    const site = SITE_MAP.find((s) => s.keys.some((k) => low.includes(k.toLowerCase())));
    if (wantsOpen && site) {
      if (links[site.link]) { window.open(links[site.link], "_blank", "noopener"); setResult({ type: "open", label: site.label, link: site.link }); }
      else setResult({ type: "nolink", label: site.label });
    } else { addExtra(text); setResult({ type: "task", text }); }
  };
  const toggle = () => {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setResult({ type: "error", msg: "음성은 배포 후 작동해" }); return; }
    let rec; try { rec = new SR(); } catch { setResult({ type: "error", msg: "마이크를 못 켰어" }); return; }
    rec.lang = "ko-KR"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e) => handle(e.results[0][0].transcript);
    rec.onerror = () => { setListening(false); setResult({ type: "error", msg: "안 들렸어. 다시" }); };
    rec.onend = () => setListening(false);
    try { rec.start(); setListening(true); setResult(null); recRef.current = rec; } catch { setResult({ type: "error", msg: "마이크 권한 확인해줘" }); }
  };
  return (
    <>
      {result && (
        <div className="jx-vcard">
          {result.type === "task" && <p>added: <b>{result.text}</b></p>}
          {result.type === "open" && (<p>opening {result.label}. <button onClick={() => openLink(result.link)}>open ↗</button></p>)}
          {result.type === "nolink" && (<p>{result.label} url not set. <button onClick={goSettings}>set it</button></p>)}
          {result.type === "error" && <p>{result.msg}</p>}
          <button className="jx-vclose" onClick={() => setResult(null)}>×</button>
        </div>
      )}
      <button className={"jx-fab" + (listening ? " on" : "")} onClick={toggle} aria-label="voice">
        {listening ? <span className="jx-pulse" /> : (
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </>
  );
}

/* ── dashboard ── */
function Dashboard({ logs, blogDone }) {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const log = logs[fmtDate(d)] || {};
    const count = DAILY.filter((t) => log[t.id]).length;
    days.push({ d: d.toLocaleDateString("en-GB", { weekday: "short" }).toLowerCase()[0], count });
  }
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const log = logs[fmtDate(d)] || {};
    const full = DAILY.every((t) => log[t.id]);
    if (full) streak++; else if (i === 0) continue; else break;
  }
  const mk = monthKey();
  const shortsThisMonth = Object.entries(logs).filter(([k, v]) => k.startsWith(mk) && v.shorts).length;
  const workoutThisMonth = Object.entries(logs).filter(([k, v]) => k.startsWith(mk) && v.workout).length;
  return (
    <section className="jx-page">
      <p className="jx-eyebrow">dashboard</p>
      <h1 className="jx-hero">{streak} day streak</h1>
      <p className="jx-status">full days in a row</p>
      <div className="jx-week">
        {days.map((day, i) => (
          <div key={i} className="jx-weekcol">
            <div className="jx-bar"><div className="jx-barfill" style={{ height: `${(day.count / DAILY.length) * 100}%` }} /></div>
            <span className="jx-weeklbl">{day.d}</span>
          </div>
        ))}
      </div>
      <p className="jx-cap">last 7 days · fill = tasks done</p>
      <div className="jx-stats">
        <Stat n={shortsThisMonth} label="shorts this month" />
        <Stat n={workoutThisMonth} label="workouts this month" />
        <Stat n={blogDone[mk] ? "1" : "0"} label="blog post this month" />
      </div>
    </section>
  );
}
function Stat({ n, label }) { return (<div className="jx-stat"><span className="jx-statn">{n}</span><span className="jx-statl">{label}</span></div>); }

/* ── more ── */
function More({ settings, saveSettings }) {
  const [workout, setWorkout] = useState(null);
  const [idea, setIdea] = useState(null);
  const [evt, setEvt] = useState("");
  const [cityInput, setCityInput] = useState(settings.city);
  const [geoStatus, setGeoStatus] = useState("");
  const setLink = (k, v) => saveSettings({ ...settings, links: { ...settings.links, [k]: v } });
  const setField = (k, v) => saveSettings({ ...settings, [k]: v });
  const rollWorkout = () => setWorkout(WORKOUTS[Math.floor(Math.random() * WORKOUTS.length)]);
  const rollIdea = () => setIdea(IDEAS[Math.floor(Math.random() * IDEAS.length)]);
  const addEvent = () => { const v = evt.trim(); if (!v) return; setField("events", [...(settings.events || []), v]); setEvt(""); };
  const rmEvent = (i) => setField("events", settings.events.filter((_, idx) => idx !== i));
  const seedEvents = EVENTS_BY_MONTH[monthKey().slice(5, 7)] || [];

  const setCity = async () => {
    const name = cityInput.trim(); if (!name) return;
    setGeoStatus("finding…");
    try {
      const g = await geocode(name);
      if (!g) { setGeoStatus("not found"); saveSettings({ ...settings, city: name.toLowerCase() }); return; }
      saveSettings({ ...settings, city: g.name, geo: { lat: g.lat, lon: g.lon, tz: g.tz } });
      setCityInput(g.name); setGeoStatus("set");
    } catch { setGeoStatus("offline · saved name only"); saveSettings({ ...settings, city: name.toLowerCase() }); }
  };
  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoStatus("no location here"); return; }
    setGeoStatus("locating…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        saveSettings({ ...settings, geo: { lat: pos.coords.latitude, lon: pos.coords.longitude, tz } });
        setGeoStatus("using your location · set the name above");
      },
      () => setGeoStatus("location blocked here · works on deploy")
    );
  };

  return (
    <section className="jx-page">
      <p className="jx-eyebrow">more</p>

      <div className="jx-card">
        <div className="jx-cardhead"><span>workout pick</span><button className="jx-roll" onClick={rollWorkout}>{workout ? "again ↻" : "pick"}</button></div>
        {workout ? (<div><p className="jx-wtitle">{workout.t} · {workout.m} min</p><ul className="jx-wlist">{workout.l.map((x, i) => <li key={i}>{x}</li>)}</ul></div>)
          : (<p className="jx-empty">mat at the dorm, or a run. tap pick.</p>)}
      </div>

      <div className="jx-card">
        <div className="jx-cardhead"><span>next reel idea</span><button className="jx-roll" onClick={rollIdea}>{idea ? "again ↻" : "pick"}</button></div>
        {idea ? (<p className="jx-idea">{idea.t} <span className="jx-tag">[{idea.f}]</span></p>) : (<p className="jx-empty">stuck on today's short. tap pick.</p>)}
      </div>

      <div className="jx-card">
        <div className="jx-cardhead"><span>europe · this month</span></div>
        {seedEvents.length > 0 && (
          <ul className="jx-seedlist">{seedEvents.map((e, i) => (<li key={i}><span className="jx-seeddot" />{e}</li>))}</ul>
        )}
        <p className="jx-sublabel">your notes</p>
        {settings.events && settings.events.length > 0 ? (
          <ul className="jx-evlist">{settings.events.map((e, i) => (<li key={i}><span>{e}</span><button onClick={() => rmEvent(i)} className="jx-rm">remove</button></li>))}</ul>
        ) : (<p className="jx-empty">add your own below.</p>)}
        <div className="jx-evadd">
          <input value={evt} onChange={(e) => setEvt(e.target.value)} placeholder="e.g. christmas market, vienna" onKeyDown={(e) => e.key === "Enter" && addEvent()} />
          <button onClick={addEvent}>add</button>
        </div>
      </div>

      <div className="jx-card">
        <div className="jx-cardhead"><span>current city</span></div>
        <p className="jx-empty" style={{ marginBottom: 8 }}>sets the day line, weather and the away clock — all at once.</p>
        <div className="jx-evadd">
          <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="london, paris, lisbon…" onKeyDown={(e) => e.key === "Enter" && setCity()} />
          <button onClick={setCity}>set</button>
        </div>
        <button className="jx-loc" onClick={useMyLocation}>use my location (weather)</button>
        {geoStatus && <p className="jx-geostatus">{geoStatus}</p>}
      </div>

      <div className="jx-card">
        <div className="jx-cardhead"><span>settings</span></div>
        <div className="jx-field"><label>name</label><input value={settings.name} onChange={(e) => setField("name", e.target.value)} /></div>
        <div className="jx-field"><label>day 1 date</label><input type="date" value={settings.startDate} onChange={(e) => setField("startDate", e.target.value)} /></div>
        <p className="jx-sublabel">links — paste your own urls</p>
        {[["diary", "타닥타닥 / diary"], ["blog", "blog"], ["notion", "notion"], ["shorts", "reels / shorts"], ["ledger", "가계부"], ["email", "email 소정"]].map(([k, label]) => (
          <div className="jx-field" key={k}><label>{label}</label><input value={settings.links[k]} onChange={(e) => setLink(k, e.target.value)} placeholder="https://…" /></div>
        ))}
      </div>
      <p className="jx-foot">saved automatically</p>
    </section>
  );
}

/* ── styles (light · notebook) ── */
function Style() {
  return (
    <style>{`
    .jx-root{
      --paper:#FBFBF6; --grid:#E9EAEE; --surface:#FFFFFF; --ink:#1A1A1F; --muted:#9A9A92;
      --blue:#5479B0; --blue-soft:#E9EEF7; --line:#E6E6DE;
      --mono: ui-monospace,'SF Mono','Cascadia Code','Roboto Mono',Menlo,Consolas,'Apple SD Gothic Neo',monospace;
      --sans: -apple-system,BlinkMacSystemFont,'Segoe UI','Pretendard','Apple SD Gothic Neo','Malgun Gothic',Roboto,sans-serif;
      min-height:100%;
      background-color:var(--paper);
      background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);
      background-size:26px 26px;
      color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;
    }
    .jx-loading{font-family:var(--mono);color:var(--muted);padding:80px 0;text-align:center;font-size:13px;}
    .jx-shell{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column;position:relative;}
    .jx-page{flex:1;padding:34px 26px 26px;}

    .jx-top{display:flex;justify-content:space-between;align-items:center;}
    .jx-eyebrow{font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:var(--muted);margin:0;}
    .jx-notion{font-family:var(--mono);font-size:11px;color:var(--blue);background:none;border:none;cursor:pointer;padding:2px;}

    .jx-strip{margin:14px 0 22px;}
    .jx-clocks{display:flex;gap:22px;margin-bottom:12px;}
    .jx-clockface{display:flex;flex-direction:column;align-items:center;gap:3px;}
    .jx-clbl{font-family:var(--mono);font-size:10px;color:var(--ink);text-transform:lowercase;margin-top:2px;}
    .jx-cdig{font-family:var(--mono);font-size:10px;color:var(--muted);}
    .jx-weather{font-family:var(--mono);font-size:12px;color:var(--muted);margin:0;}
    .jx-weather .jx-umb{color:var(--blue);}

    .jx-hero{font-family:var(--mono);font-weight:500;font-size:26px;line-height:1.25;letter-spacing:-.01em;margin:0;text-transform:lowercase;color:var(--blue);}
    .jx-herorow{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;}
    .jx-hero{flex:1;}
    .jx-emoji{flex:none;width:40px;height:40px;border-radius:11px;border:1px dashed var(--line);background:var(--surface);font-size:22px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);}
    .jx-emoji.set{border-style:solid;border-color:var(--blue-soft);}
    .jx-emojipick{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px;padding:12px;background:var(--surface);border:1px solid var(--line);border-radius:11px;}
    .jx-emojipick button{font-size:20px;width:36px;height:36px;border:none;background:transparent;border-radius:8px;cursor:pointer;}
    .jx-emojipick button:hover{background:var(--blue-soft);}
    .jx-emojipick .jx-eclear{font-family:var(--mono);font-size:11px;width:auto;padding:0 12px;color:var(--muted);}
    .jx-status{font-family:var(--mono);font-size:13px;color:var(--muted);margin:8px 0 28px;}
    .jx-status.done{color:var(--blue);}

    .jx-list{list-style:none;margin:0;padding:0;border-top:1px solid var(--line);}
    .jx-list.thin{border-top:1px dashed var(--line);}
    .jx-row{display:flex;align-items:center;gap:13px;padding:14px 2px;border-bottom:1px solid var(--line);}
    .jx-list.thin .jx-row{border-bottom:1px dashed var(--line);}
    .jx-check{flex:none;width:22px;height:22px;border-radius:50%;border:1.5px solid #C7C7BD;background:transparent;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,border-color .15s;padding:0;}
    .jx-check.sm{width:18px;height:18px;}
    .jx-check.on{background:var(--blue);border-color:var(--blue);}
    .jx-rowmain{flex:1;display:flex;align-items:baseline;gap:9px;background:none;border:none;text-align:left;cursor:pointer;padding:0;font-family:var(--sans);}
    .jx-rowlabel{font-size:16px;color:var(--ink);transition:color .15s;}
    .jx-row.done .jx-rowlabel{color:var(--muted);text-decoration:line-through;text-decoration-color:var(--line);}
    .jx-rowsub{font-family:var(--mono);font-size:11px;color:var(--muted);}
    .jx-jump{flex:none;font-family:var(--mono);font-size:11px;color:var(--blue);background:none;border:none;cursor:pointer;padding:4px 2px;}
    .jx-jump.muted{color:var(--muted);}

    .jx-extra{margin-top:24px;}
    .jx-extrahd{font-family:var(--mono);font-size:11px;color:var(--muted);letter-spacing:.04em;margin:0 0 4px;}
    .jx-addrow{display:flex;gap:7px;margin-top:12px;}
    .jx-addrow input{flex:1;font-family:var(--sans);font-size:14px;padding:10px 12px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--ink);}
    .jx-addrow input::placeholder{color:var(--muted);}
    .jx-addrow button{font-family:var(--mono);font-size:12px;padding:0 16px;background:var(--blue);color:#fff;border:none;border-radius:9px;cursor:pointer;}

    .jx-monthsec{margin-top:24px;}
    .jx-monthsec .jx-addrow{margin-top:10px;}
    .jx-monthly{width:100%;display:flex;justify-content:space-between;align-items:center;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:13px 14px;margin-bottom:8px;box-sizing:border-box;}
    .jx-monthly.done{border-color:var(--blue-soft);background:var(--blue-soft);}
    .jx-mtoggle{display:flex;align-items:center;gap:11px;cursor:pointer;}
    .jx-mlabel{font-family:var(--mono);font-size:12px;color:var(--ink);}

    .jx-week{display:flex;gap:9px;align-items:flex-end;height:120px;margin:28px 0 8px;}
    .jx-weekcol{flex:1;display:flex;flex-direction:column;align-items:center;gap:8px;height:100%;}
    .jx-bar{flex:1;width:100%;background:var(--surface);border:1px solid var(--line);border-radius:6px;display:flex;align-items:flex-end;overflow:hidden;}
    .jx-barfill{width:100%;background:var(--blue);border-radius:0 0 5px 5px;transition:height .3s;}
    .jx-weeklbl{font-family:var(--mono);font-size:11px;color:var(--muted);}
    .jx-cap{font-family:var(--mono);font-size:11px;color:var(--muted);margin:0 0 28px;}
    .jx-stats{border-top:1px solid var(--line);}
    .jx-stat{display:flex;align-items:baseline;justify-content:space-between;padding:16px 2px;border-bottom:1px solid var(--line);}
    .jx-statn{font-family:var(--mono);font-size:24px;color:var(--ink);}
    .jx-statl{font-family:var(--mono);font-size:12px;color:var(--muted);}

    .jx-card{background:var(--surface);border:1px solid var(--line);border-radius:12px;padding:16px;margin-bottom:14px;}
    .jx-cardhead{display:flex;justify-content:space-between;align-items:center;font-family:var(--mono);font-size:12px;color:var(--ink);}
    .jx-roll{font-family:var(--mono);font-size:11px;color:var(--blue);background:var(--blue-soft);border:none;border-radius:7px;padding:6px 11px;cursor:pointer;}
    .jx-empty{font-family:var(--mono);font-size:12px;color:var(--muted);margin:12px 0 0;line-height:1.5;}
    .jx-wtitle{font-family:var(--mono);font-size:14px;color:var(--blue);margin:13px 0 8px;}
    .jx-wlist{list-style:none;margin:0;padding:0;}
    .jx-wlist li{font-size:13px;color:var(--ink);padding:4px 0;border-bottom:1px dashed var(--line);}
    .jx-wlist li:last-child{border:none;}
    .jx-idea{font-size:15px;margin:13px 0 0;line-height:1.4;}
    .jx-tag{font-family:var(--mono);font-size:11px;color:var(--muted);}
    .jx-seedlist{list-style:none;margin:12px 0 4px;padding:0;}
    .jx-seedlist li{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--ink);padding:6px 0;border-bottom:1px dashed var(--line);}
    .jx-seeddot{width:5px;height:5px;border-radius:50%;background:var(--blue);flex:none;}
    .jx-evlist{list-style:none;margin:12px 0 0;padding:0;}
    .jx-evlist li{display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:7px 0;border-bottom:1px dashed var(--line);}
    .jx-rm{font-family:var(--mono);font-size:10px;color:var(--muted);background:none;border:none;cursor:pointer;}
    .jx-evadd{display:flex;gap:7px;margin-top:12px;}
    .jx-evadd input{flex:1;font-family:var(--sans);font-size:13px;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);}
    .jx-evadd input::placeholder{color:var(--muted);}
    .jx-evadd button{font-family:var(--mono);font-size:12px;padding:0 14px;background:var(--ink);color:#fff;border:none;border-radius:8px;cursor:pointer;}
    .jx-loc{margin-top:10px;width:100%;font-family:var(--mono);font-size:12px;color:var(--blue);background:var(--blue-soft);border:none;border-radius:8px;padding:10px;cursor:pointer;}
    .jx-geostatus{font-family:var(--mono);font-size:11px;color:var(--muted);margin:8px 0 0;}
    .jx-field{margin-top:11px;}
    .jx-field label{display:block;font-family:var(--mono);font-size:11px;color:var(--muted);margin-bottom:5px;}
    .jx-field input{width:100%;box-sizing:border-box;font-family:var(--sans);font-size:13px;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:var(--paper);color:var(--ink);}
    .jx-field input::placeholder{color:var(--muted);}
    .jx-sublabel{font-family:var(--mono);font-size:11px;color:var(--muted);margin:18px 0 2px;}
    .jx-foot{font-family:var(--mono);font-size:11px;color:var(--muted);text-align:center;margin:6px 0 0;}

    .jx-fab{position:fixed;bottom:74px;right:18px;width:54px;height:54px;border-radius:50%;background:var(--blue);color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(84,121,176,.34);z-index:20;}
    .jx-fab.on{background:var(--ink);}
    .jx-pulse{width:16px;height:16px;border-radius:50%;background:#fff;animation:jxpulse 1s ease-in-out infinite;}
    @keyframes jxpulse{0%,100%{transform:scale(.7);opacity:.6;}50%{transform:scale(1);opacity:1;}}
    .jx-vcard{position:fixed;bottom:140px;right:18px;max-width:288px;background:var(--surface);border:1px solid var(--line);border-radius:11px;padding:12px 30px 12px 14px;font-family:var(--mono);font-size:12px;color:var(--ink);box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:20;line-height:1.5;}
    .jx-vcard b{color:var(--blue);font-weight:500;}
    .jx-vcard button{font-family:var(--mono);font-size:12px;color:var(--blue);background:none;border:none;cursor:pointer;padding:0;text-decoration:underline;}
    .jx-vclose{position:absolute;top:8px;right:9px;color:var(--muted)!important;text-decoration:none!important;font-size:14px!important;}
    @media(min-width:470px){.jx-fab{right:calc(50vw - 215px + 16px);}.jx-vcard{right:calc(50vw - 215px + 16px);}}

    .jx-nav{position:sticky;bottom:0;display:flex;background:rgba(251,251,246,.9);backdrop-filter:blur(8px);border-top:1px solid var(--line);z-index:10;}
    .jx-navbtn{flex:1;font-family:var(--mono);font-size:12px;padding:15px 0;background:none;border:none;color:var(--muted);cursor:pointer;}
    .jx-navbtn.on{color:var(--ink);}

    input:focus-visible,button:focus-visible{outline:2px solid var(--blue);outline-offset:2px;}
    @media (prefers-reduced-motion: reduce){*{transition:none!important;animation:none!important;}}
    `}</style>
  );
}
