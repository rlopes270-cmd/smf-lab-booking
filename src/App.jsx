// SMF Lab Booking — v3.3 (M1)
// - Calendar: fix range highlight includes start day (TZ-safe)
// - Calendar: weekend darker + FR holidays marked "Closed"
// - Calendar: event labels bigger, "CODE — Title" (title emphasized)
// - Dashboard: clearer date badge + "Reset dates" action
// - Sorting: apply only on "Refresh" click (no auto resort)

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getFrenchHolidaySet } from "./utils/holidaysFR";
import { parseYMD, fmtISO } from "./utils/dateSafe";

// ---------- UI color helpers ----------
const C = {
  g: "bg-gray-300 text-gray-800",
  y: "bg-yellow-200 text-yellow-900",
  n: "bg-green-200 text-green-800",
  r: "bg-red-200 text-red-900",
};

// ---------- i18n ----------
const T = {
  en: {
    title: "SMF Test Facility Scheduler (v3.3)",
    nav: { dash: "Dashboard", cal: "Calendar", ana: "Analytics", arc: "Archive", adm: "Admin" },
    lang: "Language",
    role: "Role",
    roles: { super: "Super Admin", admin: "Admin", op: "Operator", cli: "Client", vw: "Viewer" },
    kpi: { ongo: "Ongoing", plan: "Planned", util: "Utilization (30d)", days: "Booked days (30d)" },
    test: {
      rv: "Request validation",
      cr: "Contract Review",
      pre: "PRE",
      ts: "Test setup",
      sch: "Scheduling",
      rep: "Test report",
      st_o: "Ongoing",
      st_c: "Closed",
      close: "Close & Archive",
      reopen: "Reopen",
      rq: "Requester",
      div: "Division",
      pbs: "PBS",
      sd: "Set dates",
      pick: "Pick from calendar",
      start: "Start",
      end: "End",
      save: "Save",
      cancel: "Cancel",
      ops: "Operators",
      assign: "Assign operators",
    },
    cal: { nb: "New block", type: "Type", types: { m: "Maintenance", b: "Blackout", l: "Operator leave" } },
    tour: {
      start: "Start tour",
      next: "Next",
      back: "Back",
      done: "Done",
      skip: "Skip",
      steps: [
        { t: "Language & Role", b: "Switch interface language and preview role permissions.", s: "#lang-select" },
        { t: "Navigation", b: "Tabs for Dashboard, Calendar, Analytics, Archive, Admin.", s: "#tabs" },
        { t: "Filters & Sorting", b: "Filter and sort tests.", s: "#controls" },
        { t: "Calendar", b: "Month view with test titles/codes and internal blocks.", s: "#calendar" },
      ],
    },
    search: "Search…",
    flt: { mine: "My tests", cr: "CR = Approved" },
    sort: { lbl: "Sort", d: "By upcoming date", p: "By progress", n: "By name" },
    ana: { byC: "Tests by Client", byD: "Tests by Division" },
    conflict: "Conflict: dates overlap with other tests or blocks",
  },
  it: {
    title: "Scheduler SMF Test Facility (v3.3)",
    nav: { dash: "Dashboard", cal: "Calendario", ana: "Analytics", arc: "Archivio", adm: "Admin" },
    lang: "Lingua",
    role: "Ruolo",
    roles: { super: "Super Admin", admin: "Admin", op: "Operatore", cli: "Cliente", vw: "Viewer" },
    kpi: { ongo: "Test in corso", plan: "Pianificati", util: "Utilizzo (30gg)", days: "Giorni prenotati (30gg)" },
    test: {
      rv: "Validazione richiesta",
      cr: "Contract Review",
      pre: "PRE",
      ts: "Setup di test",
      sch: "Calendarizzazione",
      rep: "Test report",
      st_o: "In corso",
      st_c: "Chiuso",
      close: "Chiudi e Archivia",
      reopen: "Riapri",
      rq: "Richiedente",
      div: "Divisione",
      pbs: "PBS",
      sd: "Imposta date",
      pick: "Seleziona dal calendario",
      start: "Inizio",
      end: "Fine",
      save: "Salva",
      cancel: "Annulla",
      ops: "Operatori",
      assign: "Assegna operatori",
    },
    cal: { nb: "Nuovo blocco", type: "Tipo", types: { m: "Manutenzione", b: "Blackout", l: "Ferie operatore" } },
    tour: {
      start: "Avvia tour",
      next: "Avanti",
      back: "Indietro",
      done: "Fine",
      skip: "Salta",
      steps: [
        { t: "Lingua e Ruolo", b: "Cambia lingua e simula i permessi.", s: "#lang-select" },
        { t: "Navigazione", b: "Tab: Dashboard, Calendario, Analytics, Archivio, Admin.", s: "#tabs" },
        { t: "Filtri & Ordinamento", b: "Filtra e ordina i test.", s: "#controls" },
        { t: "Calendario", b: "Vista mese con titoli/codici e blocchi.", s: "#calendar" },
      ],
    },
    search: "Cerca…",
    flt: { mine: "Miei test", cr: "CR = Approvato" },
    sort: { lbl: "Ordina", d: "Per data in arrivo", p: "Per avanzamento", n: "Per nome" },
    ana: { byC: "Test per Cliente", byD: "Test per Divisione" },
    conflict: "Conflitto: le date si sovrappongono con altri test o blocchi",
  },
};

const ST = ["REQUEST_VALIDATION", "CONTRACT_REVIEW", "PRE", "TEST_SETUP", "SCHEDULING", "TEST_REPORT"];
const L = (l) => ({
  REQUEST_VALIDATION: T[l].test.rv,
  CONTRACT_REVIEW: T[l].test.cr,
  PRE: T[l].test.pre,
  TEST_SETUP: T[l].test.ts,
  SCHEDULING: T[l].test.sch,
  TEST_REPORT: T[l].test.rep,
});

// ---------- utilities ----------
const today = new Date();
const add = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const fmt = (d) => (d ? fmtISO(new Date(d)) : "");
const days = (a, b) =>
  Math.max(0, Math.round((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24)) + 1);

// ---------- sample data ----------
const U = [
  { id: 1, n: "You (Super Admin)", r: "SuperAdmin" },
  { id: 2, n: "Alice Admin", r: "Admin" },
  { id: 3, n: "Oscar Operator", r: "Operator" },
  { id: 4, n: "Olivia Operator", r: "Operator" },
  { id: 5, n: "Carlo Client", r: "Client" },
];

const D = [
  {
    id: "T-001",
    name: "EMC Radiated Immunity (Pump #12)",
    rq: "Carlo Client",
    rqR: "Client",
    rqD: "Div-A",
    pbs: "PBS-8277VD",
    st: "Ongoing",
    ar: false,
    steps: {
      REQUEST_VALIDATION: "DONE",
      CONTRACT_REVIEW: "APPROVED",
      PRE: "NO",
      TEST_SETUP: "STARTED",
      SCHEDULING: "ON_HOLD",
      TEST_REPORT: "NOT_SUBMITTED",
    },
    dates: { start: add(today, 10), end: add(today, 11) },
    ops: [],
  },
  {
    id: "T-002",
    name: "Magnetic Static Field – Valve A23",
    rq: "Carlo Client",
    rqR: "Client",
    rqD: "Div-A",
    pbs: "PBS-9012AB",
    st: "Ongoing",
    ar: false,
    steps: {
      REQUEST_VALIDATION: "DONE",
      CONTRACT_REVIEW: "UNDER_REVIEW",
      PRE: "NA",
      TEST_SETUP: "NOT_STARTED",
      SCHEDULING: "ON_HOLD",
      TEST_REPORT: "NOT_SUBMITTED",
    },
    dates: { start: add(today, 18), end: add(today, 18) },
    ops: ["Olivia Operator"],
  },
  {
    id: "T-003",
    name: "Transformer Thermal Test",
    rq: "Internal R&D",
    rqR: "Client",
    rqD: "Div-B",
    pbs: "PBS-5544XY",
    st: "Closed",
    ar: true,
    steps: {
      REQUEST_VALIDATION: "DONE",
      CONTRACT_REVIEW: "APPROVED",
      PRE: "APPROVED",
      TEST_SETUP: "COMPLETED",
      SCHEDULING: "PLANNED",
      TEST_REPORT: "APPROVED",
    },
    dates: { start: add(today, -30), end: add(today, -29) },
    ops: ["Olivia Operator", "Oscar Operator"],
  },
];

const BL = [
  { id: "B-01", t: "m", title: "Chiller maintenance", s: add(today, 5), e: add(today, 5) },
  { id: "B-02", t: "b", title: "Power outage", s: add(today, 15), e: add(today, 15) },
  { id: "B-03", t: "l", title: "Operator leave", s: add(today, 20), e: add(today, 22) },
];

// ---------- helpers ----------
const cStep = (k, v, setup) => {
  switch (k) {
    case "REQUEST_VALIDATION": return v === "DONE" ? C.n : C.g;
    case "CONTRACT_REVIEW": return v === "APPROVED" ? C.n : v === "REJECTED" ? C.r : v === "UNDER_REVIEW" ? C.y : C.g;
    case "PRE": return ["NO", "NA", "APPROVED"].includes(v) ? C.n : v === "UNDER_REVIEW" ? C.y : C.g;
    case "TEST_SETUP": return v === "COMPLETED" ? C.n : v === "STARTED" ? C.y : C.g;
    case "SCHEDULING": return !setup ? C.y : v === "PLANNED" ? C.n : C.g;
    case "TEST_REPORT": return v === "APPROVED" ? C.n : v === "UNDER_REVIEW" ? C.y : C.g;
    default: return C.g;
  }
};

const grid = (base) => {
  const f = new Date(base.getFullYear(), base.getMonth(), 1);
  const s = new Date(f);
  const off = (s.getDay() + 6) % 7; // Monday first
  s.setDate(s.getDate() - off);
  const arr = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(s);
    d.setDate(s.getDate() + i);
    arr.push(d);
  }
  return arr;
};

const over = (aS, aE, bS, bE) => {
  if (!aS || !aE || !bS || !bE) return false;
  const A = [new Date(aS), new Date(aE)];
  const B = [new Date(bS), new Date(bE)];
  A[0].setHours(0, 0, 0, 0);
  A[1].setHours(0, 0, 0, 0);
  B[0].setHours(0, 0, 0, 0);
  B[1].setHours(0, 0, 0, 0);
  return A[0] <= B[1] && B[0] <= A[1];
};

// ---------- main ----------
export default function App() {
  const [lang, setLang] = useState("en");
  const t = T[lang];
  const [role, setRole] = useState("SuperAdmin");
  const [tab, setTab] = useState("dashboard");
  const [tests, setTests] = useState(D);
  const [blocks, setBlocks] = useState(BL);
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);
  const [crOk, setCrOk] = useState(false);

  // NEW: selected vs applied sort + manual refresh
  const [sortSel, setSortSel] = useState("d");
  const [sortApplied, setSortApplied] = useState("d");
  const [refreshTick, setRefreshTick] = useState(0);

  const [m, setM] = useState(new Date());
  const [tour, setTour] = useState(false);
  const [step, setStep] = useState(0);

  // FR holidays (this year + next), used by Calendar
  const holidaysFR = useMemo(() => getFrenchHolidaySet(), []);

  const ongoing = useMemo(() => tests.filter((x) => !x.ar), [tests]);
  const archived = useMemo(() => tests.filter((x) => x.ar), [tests]);

  const list = useMemo(() => {
    const qq = q.trim().toLowerCase();
    let arr = ongoing.filter((x) => {
      const mt = !qq || [x.name, x.id, x.pbs, x.rq].some((s) => String(s).toLowerCase().includes(qq));
      const mi = !mine || String(x.rq).toLowerCase().includes("carlo");
      const cr = !crOk || x.steps.CONTRACT_REVIEW === "APPROVED";
      return mt && mi && cr;
    });
    arr = arr.slice();
    const sort = sortApplied;
    if (sort === "d") {
      arr.sort((a, b) => {
        const at = a.steps.TEST_SETUP === "COMPLETED" && a.steps.SCHEDULING === "PLANNED" && a.dates?.start ? new Date(a.dates.start).getTime() : Infinity;
        const bt = b.steps.TEST_SETUP === "COMPLETED" && b.steps.SCHEDULING === "PLANNED" && b.dates?.start ? new Date(b.dates.start).getTime() : Infinity;
        return at - bt;
      });
    } else if (sort === "p") {
      arr.sort((a, b) => prog(b) - prog(a));
    } else {
      arr.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }
    return arr;
  }, [ongoing, q, mine, crOk, sortApplied, refreshTick]);

  const kpi = useMemo(() => {
    const planned = ongoing.filter((t) => t.steps.SCHEDULING === "PLANNED" && t.steps.TEST_SETUP === "COMPLETED");
    const days30 = planned.reduce((s, t) => {
      if (!t.dates?.start) return s;
      const st = new Date(t.dates.start);
      const en = new Date(t.dates.end || t.dates.start);
      const h = add(today, 30);
      const S = st < today ? today : st;
      const E = en > h ? h : en;
      if (S > E) return s;
      return s + days(S, E);
    }, 0);
    return { ongoing: ongoing.length, planned: planned.length, util: Math.round(Math.min(100, (days30 / 30) * 100)), days30 };
  }, [ongoing]);

  function updStep(id, k, v) {
    setTests((p) => p.map((t) => (t.id !== id ? t : { ...t, steps: { ...t.steps, [k]: v } })));
  }

  function setDates(id, s, e) {
    if (!(role === "Admin" || role === "SuperAdmin")) return;
    const S = parseYMD(s);
    const E = parseYMD(e);
    setTests((p) =>
      p.map((t) => {
        if (t.id !== id) return t;
        const setup = t.steps.TEST_SETUP === "COMPLETED";
        const steps = { ...t.steps };
        if (setup && S && E) steps.SCHEDULING = "PLANNED";
        return { ...t, dates: { start: S, end: E }, steps };
      })
    );
  }

  // NEW: reset dates
  function resetDates(id) {
    if (!(role === "Admin" || role === "SuperAdmin")) return;
    setTests((p) =>
      p.map((t) => {
        if (t.id !== id) return t;
        const steps = { ...t.steps };
        steps.SCHEDULING = "ON_HOLD";
        return { ...t, dates: { start: null, end: null }, steps };
      })
    );
  }

  function closeArc(id) {
    if (role !== "Admin" && role !== "SuperAdmin") return;
    setTests((p) => p.map((t) => (t.id === id ? { ...t, ar: true, st: "Closed" } : t)));
  }
  function reopen(id) {
    if (role !== "SuperAdmin") return;
    setTests((p) => p.map((t) => (t.id === id ? { ...t, ar: false, st: "Ongoing" } : t)));
  }
  function addBlock(tp) {
    if (role !== "Admin" && role !== "SuperAdmin")) return;
    const title = prompt(`${t.cal.type}: ${tp}`) || tp;
    const s = prompt("Start (YYYY-MM-DD)", fmt(add(new Date(), 3)));
    const e = prompt("End (YYYY-MM-DD)", fmt(add(new Date(), 3)));
    if (!s || !e) return;
    setBlocks((p) => p.concat({ id: "B-" + (p.length + 1), t: tp, title, s: parseYMD(s), e: parseYMD(e) }));
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-slate-50">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl md:text-3xl font-bold">{t.title}</h1>
        <div className="flex items-center gap-2">
          <Sel id="lang-select" lab={t.lang} val={lang} on={setLang} opts={[{ l: "EN", v: "en" }, { l: "IT", v: "it" }]} />
          <Sel
            id="role-select"
            lab={t.role}
            val={role}
            on={setRole}
            opts={[
              { l: T[lang].roles.super, v: "SuperAdmin" },
              { l: T[lang].roles.admin, v: "Admin" },
              { l: T[lang].roles.op, v: "Operator" },
              { l: T[lang].roles.cli, v: "Client" },
              { l: T[lang].roles.vw, v: "Viewer" },
            ]}
          />
          <Tabs
            id="tabs"
            items={[
              { k: "dashboard", l: t.nav.dash },
              { k: "calendar", l: t.nav.cal },
              { k: "analytics", l: t.nav.ana },
              { k: "archive", l: t.nav.arc },
              { k: "admin", l: t.nav.adm },
            ]}
            act={tab}
            on={setTab}
          />
          <button onClick={() => { setTour(true); setStep(0); }} className="ml-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">
            {T[lang].tour.start}
          </button>
        </div>
      </div>

      {tab === "dashboard" && (
        <Dash
          lang={lang}
          role={role}
          list={list}
          all={tests}
          k={kpi}
          q={q}
          setQ={setQ}
          mine={mine}
          setMine={setMine}
          crOk={crOk}
          setCrOk={setCrOk}
          sortSel={sortSel}
          setSortSel={setSortSel}
          applySort={() => { setSortApplied(sortSel); setRefreshTick(v => v + 1); }}
          updStep={updStep}
          closeArc={closeArc}
          reopen={reopen}
          setDates={setDates}
          resetDates={resetDates}
          blocks={blocks}
        />
      )}
      {tab === "calendar" && <Cal lang={lang} role={role} m={m} setM={setM} tests={ongoing} blocks={blocks} addBlock={addBlock} holidaysFR={holidaysFR} />}
      {tab === "analytics" && <Ana lang={lang} tests={tests} />}
      {tab === "archive" && <Arc lang={lang} role={role} tests={archived} reopen={reopen} />}
      {tab === "admin" && <Adm lang={lang} role={role} users={U} blocks={blocks} addBlock={addBlock} />}

      <Spot lang={lang} open={tour} setOpen={setTour} step={step} setStep={setStep} />
    </div>
  );
}

function prog(t) {
  const s = t.steps, c = ST.map((k) => cStep(k, s[k], s.TEST_SETUP === "COMPLETED"));
  return Math.round((c.filter((x) => x.includes("green")).length / ST.length) * 100);
}

function KPI({ t, v }) {
  return (
    <div className="p-4 rounded-2xl bg-white shadow-sm">
      <div className="text-sm text-slate-500">{t}</div>
      <div className="text-2xl font-bold">{v}</div>
    </div>
  );
}

function Srch({ v, on, ph }) {
  return <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} className="px-3 py-2 rounded-xl bg-white shadow-sm w-full md:w-72 border border-slate-200" />;
}

function Tog({ lab, chk, on }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input type="checkbox" checked={chk} onChange={(e) => on(e.target.checked)} />
      <span>{lab}</span>
    </label>
  );
}

function Sel({ id, lab, val, on, opts }) {
  return (
    <div id={id} className="flex items-center gap-2 text-sm">
      <span className="text-slate-600">{lab}</span>
      <select value={val} onChange={(e) => on(e.target.value)} className="px-2 py-2 rounded-xl bg-white shadow-sm border border-slate-200">
        {opts.map((o) => (
          <option key={o.v} value={o.v}>{o.l}</option>
        ))}
      </select>
    </div>
  );
}

function Tabs({ id, items, act, on }) {
  return (
    <div id={id} className="flex rounded-2xl bg-white shadow-sm overflow-hidden">
      {items.map((it) => (
        <button key={it.k} onClick={() => on(it.k)} className={`px-3 py-2 text-sm ${act === it.k ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"}`}>
          {it.l}
        </button>
      ))}
    </div>
  );
}

function Dash({ lang, role, list, all, k, q, setQ, mine, setMine, crOk, setCrOk, sortSel, setSortSel, applySort, updStep, closeArc, reopen, setDates, resetDates, blocks }) {
  const tt = T[lang];
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <KPI t={tt.kpi.ongo} v={all.filter((t) => !t.ar).length} />
        <KPI t={tt.kpi.plan} v={all.filter((t) => !t.ar && t.steps.SCHEDULING === "PLANNED" && t.steps.TEST_SETUP === "COMPLETED").length} />
        <KPI t={tt.kpi.util} v={k.util + "%"} />
        <KPI t={tt.kpi.days} v={k.days30} />
      </div>

      <div id="controls" className="flex flex-wrap items-center gap-2 mb-3">
        <Srch v={q} on={setQ} ph={tt.search} />
        <Tog lab={tt.flt.mine} chk={mine} on={setMine} />
        <Tog lab={tt.flt.cr} chk={crOk} on={setCrOk} />
        <Sel lab={tt.sort.lbl} val={sortSel} on={setSortSel} opts={[{ l: tt.sort.d, v: "d" }, { l: tt.sort.p, v: "p" }, { l: tt.sort.n, v: "n" }]} />
        <button onClick={applySort} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-sm">Refresh</button>
      </div>

      <div id="testlist" className="space-y-3">
        {list.map((t) => (
          <Row
            key={t.id}
            lang={lang}
            t={t}
            role={role}
            updStep={updStep}
            closeArc={() => closeArc(t.id)}
            reopen={() => reopen(t.id)}
            setDates={(s, e) => setDates(t.id, s, e)}
            resetDates={() => resetDates(t.id)}
            all={all}
            blocks={blocks}
          />
        )) || <div className="text-slate-500 italic">No data</div>}
      </div>
    </div>
  );
}

function Row({ lang, t, role, updStep, closeArc, reopen, setDates, resetDates, all, blocks }) {
  const lab = L(lang),
    setup = t.steps.TEST_SETUP === "COMPLETED",
    p = prog(t),
    [dOpen, setDOpen] = useState(false),
    [oOpen, setOOpen] = useState(false);

  const defs = {
    REQUEST_VALIDATION: ["DONE", "NOT_DONE"],
    CONTRACT_REVIEW: ["NOT_SUBMITTED", "UNDER_REVIEW", "REJECTED", "APPROVED"],
    PRE: ["NOT_SUBMITTED", "YES", "NO", "NA", "UNDER_REVIEW", "APPROVED"],
    TEST_SETUP: ["NOT_STARTED", "STARTED", "COMPLETED"],
    SCHEDULING: [setup ? "PLANNED" : "ON_HOLD"],
    TEST_REPORT: ["NOT_SUBMITTED", "UNDER_REVIEW", "APPROVED"],
  };

  const avail = (s, e) => {
    const others = all.filter((x) => x.id !== t.id && !x.ar && x.steps.SCHEDULING === "PLANNED");
    const conflT = others.some((o) => over(s, e, o.dates?.start, o.dates?.end));
    const conflB = blocks.some((b) => over(s, e, b.s, b.e));
    return !conflT && !conflB;
  };

  return (
    <div className="p-4 rounded-2xl bg-white shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <div className="font-semibold">
            {t.name} <span className="text-slate-400">({t.id})</span>
          </div>
          <div className="text-xs text-slate-500">
            {t.rq} - {t.rqR} · {t.rqD} · PBS: {t.pbs}
          </div>
          {t.ops?.length > 0 && <div className="text-xs text-slate-600 mt-1">{T[lang].test.ops}: {t.ops.join(", ")}</div>}
        </div>
        <div className="text-sm font-medium text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
          {fmt(t.dates?.start)} → {fmt(t.dates?.end)}
        </div>
      </div>

      <div className="mt-3 grid md:grid-cols-6 gap-2">
        {ST.map((k) => {
          const v = k === "SCHEDULING" && !setup ? "ON_HOLD" : t.steps[k];
          const col = cStep(k, v, setup);
          return (
            <div key={k} className="flex flex-col gap-1">
              <div className="text-xs text-slate-500">{lab[k]}</div>
              <div className={`px-2 py-1 rounded-lg text-xs font-medium ${col}`}>{v}</div>
              <div className="text-xs">
                {k !== "SCHEDULING" ? (
                  <select className="mt-1 w-full border border-slate-200 rounded-lg text-xs p-1" value={t.steps[k]} onChange={(e) => updStep(t.id, k, e.target.value)}>
                    {defs[k].map((o) => (<option key={o} value={o}>{o}</option>))}
                  </select>
                ) : (
                  <div className="text-[10px] italic text-slate-500">
                    {!setup ? (lang === "en" ? "On hold until setup completed" : "In attesa finché setup completato") : lang === "en" ? "Switch to PLANNED by setting dates" : "Passa a PLANNED impostando le date"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 w-full h-3 bg-slate-200 rounded-xl overflow-hidden">
        <div className="h-3 bg-green-500" style={{ width: p + "%" }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        {(role === "Admin" || role === "SuperAdmin") && (
          <>
            <button onClick={() => setDOpen(true)} className="px-3 py-1 rounded-xl bg-slate-900 text-white">🗓 {T[lang].test.sd}</button>
            <button onClick={resetDates} className="px-3 py-1 rounded-xl bg-slate-100 text-slate-700 border border-slate-200" title={lang === "en" ? "Clear scheduled dates" : "Rimuovi le date programmate"}>⟳ Reset dates</button>
            <button onClick={() => setOOpen(true)} className="px-3 py-1 rounded-xl bg-blue-200 text-blue-900">👥 {T[lang].test.assign}</button>
          </>
        )}
        {t.ar ? (
          <button onClick={reopen} disabled={role !== "SuperAdmin"} className={`px-3 py-1 rounded-xl ${role !== "SuperAdmin" ? "bg-slate-200 text-slate-500" : "bg-emerald-200 text-emerald-900"}`}>
            {role !== "SuperAdmin" ? "(Super Admin) " : ""}{T[lang].test.reopen}
          </button>
        ) : (
          <button onClick={closeArc} disabled={!(role === "Admin" || role === "SuperAdmin")} className={`px-3 py-1 rounded-xl ${!(role === "Admin" || role === "SuperAdmin") ? "bg-slate-200 text-slate-500" : "bg-red-200 text-red-900"}`}>
            {!(role === "Admin" || role === "SuperAdmin") ? "(Admin) " : ""}{T[lang].test.close}
          </button>
        )}
      </div>

      <AnimatePresence>
        {dOpen && (
          <DateModal lang={lang} t={t} onClose={() => setDOpen(false)} onSave={(s, e) => { setDates(s, e); setDOpen(false); }} all={all} blocks={blocks} avail={avail} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {oOpen && <OpsModal lang={lang} t={t} onClose={() => setOOpen(false)} onSave={(ops) => { t.ops = ops; setOOpen(false); }} />}
      </AnimatePresence>
    </div>
  );
}

function DateModal({ lang, t, onClose, onSave, all, blocks, avail }) {
  const tt = T[lang];
  const [mm, setMM] = useState(new Date());
  const [s, setS] = useState(t.dates?.start ? fmt(t.dates.start) : "");
  const [e, setE] = useState(t.dates?.end ? fmt(t.dates.end) : "");
  const cells = useMemo(() => grid(mm), [mm]);

  const dis = (d) =>
    all.some((o) => o.id !== t.id && !o.ar && o.steps.SCHEDULING === "PLANNED" && over(d, d, o.dates?.start, o.dates?.end)) ||
    blocks.some((b) => over(d, d, b.s, b.e));

  // Inclusive start, TZ-safe, backward selection supported
  const pick = (d) => {
    const ds = fmtISO(d);
    if (!s) { setS(ds); setE(ds); return; }
    const sd = parseYMD(s);
    if (d < sd) { setS(ds); setE(s); return; }
    setE(ds);
  };

  const ok = s && e && avail(parseYMD(s), parseYMD(e));

  return (
    <motion.div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bg-white rounded-2xl shadow-xl p-4 w-[92%] max-w-2xl" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="font-semibold mb-2">{tt.test.sd} — {t.id}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-2 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <button className="px-2 py-1 rounded bg-slate-100" onClick={() => setMM(new Date(mm.getFullYear(), mm.getMonth() - 1, 1))}>←</button>
              <div className="text-sm font-semibold">{mm.toLocaleString(lang === "en" ? "en-GB" : "it-IT", { month: "long", year: "numeric" })}</div>
              <button className="px-2 py-1 rounded bg-slate-100" onClick={() => setMM(new Date(mm.getFullYear(), mm.getMonth() + 1, 1))}>→</button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-[11px] text-slate-500 mb-1">
              {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((d) => (<div key={d} className="text-center">{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {cells.map((d, i) => {
                const inM = d.getMonth() === mm.getMonth();
                const disd = dis(d);
                const sel = s && e && d >= parseYMD(s) && d <= parseYMD(e);
                return (
                  <button key={i} disabled={!inM || disd} onClick={() => pick(d)} className={`h-9 rounded text-[11px] border ${sel ? "bg-emerald-200 border-emerald-300" : disd ? "bg-slate-100 text-slate-400 border-slate-100" : "bg-white hover:bg-slate-50 border-slate-200"}`}>
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 text-xs text-slate-500">{lang === "en" ? "Unavailable dates are disabled." : "Le date non disponibili sono disattivate."}</div>
          </div>

          <div>
            <label className="text-sm">
              {tt.test.start}
              <input type="date" className="mt-1 w-full border border-slate-200 rounded-lg p-2" value={s} onChange={(e) => setS(e.target.value)} />
            </label>
            <label className="text-sm block mt-2">
              {tt.test.end}
              <input type="date" className="mt-1 w-full border border-slate-200 rounded-lg p-2" value={e} onChange={(e) => setE(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="mt-3 flex justify-between items-center">
          {!ok && s && e && <div className="text-xs text-red-600">{T[lang].conflict}</div>}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-100">{tt.test.cancel}</button>
            <button onClick={() => onSave(s, e)} disabled={!ok} className={`px-3 py-2 rounded-xl ${!ok ? "bg-slate-200 text-slate-500" : "bg-slate-900 text-white"}`}>{tt.test.save}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function OpsModal({ lang, t, onClose, onSave }) {
  const [sel, setSel] = useState(t.ops || []);
  const [extra, setExtra] = useState("");
  const ops = U.filter((u) => u.r === "Operator");
  const tog = (n) => setSel((p) => (p.includes(n) ? p.filter((x) => x !== n) : p.concat(n)));

  return (
    <motion.div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="bg-white rounded-2xl shadow-xl p-4 w-[92%] max-w-md" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}>
        <div className="font-semibold mb-2">{T[lang].test.assign} — {t.id}</div>
        <div className="space-y-2">
          {ops.map((o) => (
            <label key={o.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sel.includes(o.n)} onChange={() => tog(o.n)} />
              <span>{o.n}</span>
            </label>
          ))}
          <div className="text-xs text-slate-500 mt-2">{lang === "en" ? "Add external operator (optional):" : "Aggiungi operatore esterno (opzionale):"}</div>
          <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder={lang === "en" ? "Full name" : "Nome e cognome"} className="w-full border border-slate-200 rounded-lg p-2" />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-xl bg-slate-100">{T[lang].test.cancel}</button>
          <button onClick={() => { const fin = extra.trim() ? Array.from(new Set(sel.concat(extra.trim()))) : sel; onSave(fin); }} className="px-3 py-2 rounded-xl bg-slate-900 text-white">{T[lang].test.save}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Ana({ lang, tests }) {
  const by = (f) => {
    const m = new Map();
    tests.forEach((x) => { const k = f(x) || "-"; m.set(k, (m.get(k) || 0) + 1); });
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const c = by((x) => x.rq);
  const d = by((x) => x.rqD);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="p-3 rounded-2xl bg-white shadow-sm">
        <h3 className="font-semibold mb-2">{T[lang].ana.byC}</h3>
        <ul className="space-y-1 text-sm">
          {c.map(([k, v]) => (<li key={k} className="flex justify-between"><span>{k}</span><span className="text-slate-500">{v}</span></li>))}
        </ul>
      </div>
      <div className="p-3 rounded-2xl bg-white shadow-sm">
        <h3 className="font-semibold mb-2">{T[lang].ana.byD}</h3>
        <ul className="space-y-1 text-sm">
          {d.map(([k, v]) => (<li key={k} className="flex justify-between"><span>{k}</span><span className="text-slate-500">{v}</span></li>))}
        </ul>
      </div>
    </div>
  );
}

function Arc({ lang, role, tests, reopen }) {
  return (
    <div className="mt-2">
      {tests.map((t) => (
        <div key={t.id} className="p-4 rounded-2xl bg-white shadow-sm mb-3">
          <div className="font-semibold">{t.name} <span className="text-slate-400">({t.id})</span></div>
          <div className="text-xs text-slate-500">{t.rq} - PBS: {t.pbs}</div>
          <div className="mt-2">
            <button onClick={() => reopen(t.id)} disabled={role !== "SuperAdmin"} className={`px-3 py-1 rounded-xl ${role !== "SuperAdmin" ? "bg-slate-200 text-slate-500" : "bg-emerald-200 text-emerald-900"}`}>
              {role !== "SuperAdmin" ? "(Super Admin) " : ""}{T[lang].test.reopen}
            </button>
          </div>
        </div>
      )) || <div className="text-slate-500 italic">{lang === "en" ? "Archive is empty" : "Archivio vuoto"}</div>}
    </div>
  );
}

function Adm({ lang, role, users, blocks, addBlock }) {
  return (
    <div className="mt-2 grid gap-3 md:grid-cols-2">
      <div className="p-3 rounded-2xl bg-white shadow-sm">
        <h3 className="font-semibold mb-2">Users</h3>
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="text-sm flex items-center justify-between">
              <span>{u.n} — {u.r}</span>
              <div className="flex gap-2">
                <button className={`px-2 py-1 rounded-lg ${role !== "SuperAdmin" ? "bg-slate-200 text-slate-400" : "bg-slate-900 text-white"}`} disabled={role !== "SuperAdmin"}>Make Admin</button>
                <button className={`px-2 py-1 rounded-lg ${role !== "SuperAdmin" ? "bg-slate-200 text-slate-400" : "bg-red-200 text-red-900"}`} disabled={role !== "SuperAdmin"}>Revoke Admin</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="p-3 rounded-2xl bg-white shadow-sm">
        <h3 className="font-semibold mb-2">Blocks</h3>
        <ul className="space-y-1 mb-2">
          {blocks.map((b) => (
            <li key={b.id} className="text-sm flex justify-between">
              <span>{b.title} — {b.t}</span>
              <span className="text-slate-500">{fmt(b.s)} → {fmt(b.e)}</span>
            </li>
          ))}
        </ul>
        {(role === "Admin" || role === "SuperAdmin") && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{T[lang].cal.nb}:</span>
            <button onClick={() => addBlock("m")} className="px-3 py-1 rounded-lg bg-amber-200">{T[lang].cal.types.m}</button>
            <button onClick={() => addBlock("b")} className="px-3 py-1 rounded-lg bg-red-200">{T[lang].cal.types.b}</button>
            <button onClick={() => addBlock("l")} className="px-3 py-1 rounded-lg bg-blue-200">{T[lang].cal.types.l}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Cal({ lang, role, m, setM, tests, blocks, addBlock, holidaysFR }) {
  const t = T[lang];
  const cells = useMemo(() => grid(m), [m]);
  const name = m.toLocaleString(lang === "en" ? "en-GB" : "it-IT", { month: "long", year: "numeric" });

  const onDay = (d) => {
    const sd = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const te = [], be = [];
    const iso = fmtISO(d);
    const isHoliday = holidaysFR?.has?.(iso);

    tests.forEach((tt) => {
      if (!tt.dates?.start || !tt.dates?.end) return;
      const s = new Date(tt.dates.start), e = new Date(tt.dates.end), c = new Date(s);
      for (; c <= e; c.setDate(c.getDate() + 1)) if (sd(c, d)) { te.push({ id: tt.id, t: tt.name }); break; }
    });
    blocks.forEach((b) => {
      const s = new Date(b.s), e = new Date(b.e), c = new Date(s);
      for (; c <= e; c.setDate(c.getDate() + 1)) if (sd(c, d)) { be.push({ id: b.id, t: b.title }); break; }
    });
    return { te, be, isHoliday };
  };

  return (
    <div id="calendar" className="p-3 rounded-2xl bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <button className="px-3 py-1 rounded-xl bg-slate-100" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() - 1, 1))}>←</button>
        <div className="font-semibold">{name}</div>
        <button className="px-3 py-1 rounded-xl bg-slate-100" onClick={() => setM(new Date(m.getFullYear(), m.getMonth() + 1, 1))}>→</button>
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs mb-2 text-slate-500">
        {"Mon Tue Wed Thu Fri Sat Sun".split(" ").map((d) => (<div key={d} className="text-center">{d}</div>))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((d, i) => {
          const inM = d.getMonth() === m.getMonth();
          const { te, be, isHoliday } = onDay(d);
          const dow = d.getDay(); // 0 Sun, 6 Sat
          const isWeekend = dow === 0 || dow === 6;
          return (
            <div
              key={i}
              className={`h-24 p-1 rounded-lg border ${
                inM
                  ? isHoliday
                    ? "bg-red-50 border-red-200"
                    : isWeekend
                      ? "bg-slate-100 border-slate-200"
                      : "bg-slate-50 border-slate-200"
                  : "bg-slate-100 border-slate-100 opacity-60"
              }`}
              title={isHoliday ? (lang === "en" ? "Closed (FR Holiday)" : "Chiuso (Festività FR)") : undefined}
            >
              <div className={`text-[11px] text-right ${isHoliday ? "text-red-600 font-semibold" : "text-slate-500"}`}>{d.getDate()}</div>
              <div className="mt-1 flex flex-col gap-1 overflow-hidden">
                {te.map((ev) => (
                  <span key={ev.id} className="text-xs px-1 rounded bg-emerald-200 text-emerald-900 truncate" title={`${ev.id} — ${ev.t}`}>
                    <span className="font-medium">{ev.id}</span> — <strong>{ev.t}</strong>
                  </span>
                ))}
                {be.map((ev) => (
                  <span key={ev.id} className="text-xs px-1 rounded bg-amber-200 text-amber-900 truncate" title={`${ev.t}`}>
                    {ev.t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {(role === "Admin" || role === "SuperAdmin") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">{t.cal.nb}:</span>
          <button onClick={() => addBlock("m")} className="px-3 py-1 rounded-lg bg-amber-200">{t.cal.types.m}</button>
          <button onClick={() => addBlock("b")} className="px-3 py-1 rounded-lg bg-red-200">{t.cal.types.b}</button>
          <button onClick={() => addBlock("l")} className="px-3 py-1 rounded-lg bg-blue-200">{t.cal.types.l}</button>
        </div>
      )}
    </div>
  );
}

function Spot({ lang, open, setOpen, step, setStep }) {
  const s = T[lang].tour.steps;
  const [target, setT] = useState(null);
  useEffect(() => {
    if (!open) return;
    const el = s[step]?.s ? document.querySelector(s[step].s) : null;
    setT(el ? el.getBoundingClientRect() : null);
  }, [open, step, lang]);
  if (!open) return null;
  const pad = 12, rx = target ? target.left + window.scrollX - pad : 0, ry = target ? target.top + window.scrollY - pad : 0, rw = target ? target.width + pad * 2 : 0, rh = target ? target.height + pad * 2 : 0;
  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <svg className="fixed inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="hole">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {target && <rect x={rx} y={ry} width={rw} height={rh} rx="12" ry="12" fill="black" />}
            </mask>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#hole)" />
        </svg>
        <div className="fixed z-[60]" style={{ left: target ? rx : 24, top: target ? ry + rh + 16 : 24, maxWidth: 420 }}>
          <div className="bg-white rounded-2xl shadow-xl p-4">
            <div className="font-semibold mb-1">{s[step]?.t}</div>
            <div className="text-sm text-slate-600 mb-3">{s[step]?.b}</div>
            <div className="flex justify-between gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl bg-slate-100">{T[lang].tour.skip}</button>
              <div className="flex gap-2">
                <button onClick={() => setStep(Math.max(0, step - 1))} className="px-3 py-2 rounded-xl bg-slate-100">{T[lang].tour.back}</button>
                <button onClick={() => (step < s.length - 1 ? setStep(step + 1) : setOpen(false))} className="px-3 py-2 rounded-xl bg-slate-900 text-white">
                  {step < s.length - 1 ? T[lang].tour.next : T[lang].tour.done}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
