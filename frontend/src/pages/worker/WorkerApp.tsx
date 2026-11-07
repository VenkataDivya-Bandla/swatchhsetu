import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, clearSession, compressPhoto, formatMinutes, session, type Facility, type Issue } from "../../api";
import { Icon } from "../../components/icons";
import { ErrorNote, Priority } from "../../components/ui";
import { CATEGORY_EN, CHECKLIST, HELP_ICON, PUB, WORK, type WLang } from "../../i18n";

const cat = (c: string, lang: WLang) => (lang === "te" ? PUB.te.cat[c] : CATEGORY_EN[c]) || c;
import { cacheGet, cacheSet, outbox, queue, syncNow, type OutboxRecord, type SyncResult } from "../../offline";
const Scanner = lazy(() => import("./Scanner")); // the QR decoder loads only when Scan is tapped
import Guide from "../../components/Guide";
import { STATUS } from "../../status";

type Tasks = { generated_at: string; repairs: Issue[]; verifications: Issue[]; inspections_due: Facility[]; facilities: Facility[] };
type Local = Record<number, "started" | "resolved">;
type W = (typeof WORK)["te"];

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); };
  }, []);
  return on;
}

function useOutbox() {
  const [items, setItems] = useState<OutboxRecord[]>([]);
  const [log, setLog] = useState<SyncResult[]>([]);
  const refresh = useCallback(async () => {
    setItems(await outbox());
    setLog((await cacheGet<SyncResult[]>("syncLog")) || []);
  }, []);
  useEffect(() => {
    refresh();
    window.addEventListener("ss-outbox", refresh);
    return () => window.removeEventListener("ss-outbox", refresh);
  }, [refresh]);
  return { items, log };
}

function useTasks(online: boolean) {
  const [tasks, setTasks] = useState<Tasks | null>(null);
  const [local, setLocal] = useState<Local>({});
  const load = useCallback(async () => {
    const cached = await cacheGet<Tasks>("tasks");
    if (cached) setTasks(cached);
    setLocal((await cacheGet<Local>("local")) || {});
    if (!navigator.onLine) return;
    try {
      await syncNow();
      const fresh = await api<Tasks>("/api/me/tasks");
      setTasks(fresh);
      await cacheSet("tasks", fresh);
      if ((await outbox()).length === 0) { await cacheSet("local", {}); setLocal({}); }
    } catch { /* keep cached copy */ }
  }, []);
  useEffect(() => { load(); }, [load, online]);
  useEffect(() => {
    const id = setInterval(load, 20000);
    window.addEventListener("ss-outbox", load);
    return () => { clearInterval(id); window.removeEventListener("ss-outbox", load); };
  }, [load]);
  const mark = async (id: number, v: "started" | "resolved") => {
    const next = { ...local, [id]: v };
    setLocal(next);
    await cacheSet("local", next);
  };
  return { tasks, local, mark, reload: load };
}

export default function WorkerApp() {
  const s = session()!;
  const online = useOnline();
  const { items } = useOutbox();
  const t = useTasks(online);
  const nav = useNavigate();
  const [lang, setLangState] = useState<WLang>((localStorage.getItem("ss_wlang") as WLang) || "te");
  const setLang = (l: WLang) => { setLangState(l); localStorage.setItem("ss_wlang", l); };
  const w = WORK[lang];
  const [scanning, setScanning] = useState(false);

  return (
    <div className="min-h-screen bg-paper" lang={lang}>
      <div className="bg-marigold-light px-4 py-1 text-center text-[12px] font-medium text-marigold-deep">Demo — synthetic data</div>
      <header className="sticky top-0 z-10 bg-river text-white">
        <div className="mx-auto flex max-w-md items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="text-[17px] font-bold">{s.user.name}</p>
            <span className={`mt-0.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold ${online ? "bg-white/15" : "bg-marigold text-ink"}`} data-testid="net">
              <span className={`h-2 w-2 rounded-full ${online ? "bg-green-300" : "bg-ink"}`} />{online ? w.online : w.offline}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg bg-white/15 text-[13px]">
              {(["te", "en"] as WLang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} className={`px-2.5 py-1.5 font-bold ${lang === l ? "bg-white text-river" : ""}`}>
                  {l === "te" ? "తెలుగు" : "EN"}
                </button>
              ))}
            </div>
            <button className="rounded-lg px-2 py-1.5 text-[13px] font-semibold text-white/90 underline" onClick={() => { clearSession(); nav("/login"); }}>{w.signOut}</button>
          </div>
        </div>
        {!online && <p className="bg-ink px-4 py-2 text-center text-[14px]">{w.offlineBanner}</p>}
        <nav className="mx-auto flex max-w-md">
          <NavLink to="/w" end className={({ isActive }) => `flex-1 py-2.5 text-center text-[15px] font-bold ${isActive ? "border-b-[3px] border-marigold" : "text-white/80"}`}>{w.tasks}</NavLink>
          <NavLink to="/w/outbox" data-testid="outbox-tab" className={({ isActive }) => `flex-1 py-2.5 text-center text-[15px] font-bold ${isActive ? "border-b-[3px] border-marigold" : "text-white/80"}`}>
            {w.outbox}{items.length > 0 && <span className="ml-1.5 rounded-full bg-marigold px-1.5 text-[12px] text-ink">{items.length}</span>}
          </NavLink>
          {s.user.role !== "worker" && <Link to="/console" className="flex-1 py-2.5 text-center text-[15px] font-bold text-white/80">Console</Link>}
        </nav>
      </header>
      <main className="mx-auto max-w-md px-4 py-4">
        <Guide storageKey="ss_guide_worker" slides={w.guide} labels={{ next: w.gNext, start: w.gStart, skip: w.gSkip }} />
        <button onClick={() => setScanning(true)} data-testid="worker-scan"
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-ink py-5 text-[22px] font-bold text-white shadow-sm active:scale-[0.99]">
          <Icon name="scan" className="h-9 w-9" strokeWidth={2.4} />{w.scan}
        </button>
        {items.length > 0 && (
          <Link to="/w/outbox" className="mb-4 flex items-center gap-2 rounded-xl border border-marigold bg-marigold-light px-3 py-2.5 text-[15px] font-semibold text-marigold-deep">
            <Icon name="clock" className="h-5 w-5" />{w.pending(items.length)}
          </Link>
        )}
        <Routes>
          <Route index element={<TaskList t={t} w={w} lang={lang} />} />
          <Route path="outbox" element={<Outbox online={online} w={w} />} />
          <Route path="s/:code" element={<ScanScreen t={t} online={online} w={w} lang={lang} />} />
        </Routes>
      </main>
      {scanning && (
        <Suspense fallback={<div className="fixed inset-0 z-30 bg-ink" />}>
          <Scanner title={w.scan} hint={w.scanCamera} cancel={w.cancel} failText={w.scanNoCamera}
            onClose={() => setScanning(false)} onCode={(code) => { setScanning(false); nav(`/w/s/${code}`); }} />
        </Suspense>
      )}
    </div>
  );
}

function TaskList({ t, w, lang }: { t: ReturnType<typeof useTasks>; w: W; lang: WLang }) {
  const [code, setCode] = useState("");
  const nav = useNavigate();
  if (!t.tasks) return <p className="text-ink-muted">…</p>;
  const { repairs, verifications, inspections_due } = t.tasks;
  const fname = (f: { name_en: string; name_te: string }) => (lang === "te" ? f.name_te : f.name_en);

  const nextRepair = [...repairs].filter((i) => t.local[i.id] !== "resolved").sort((a, b) => a.minutes_to_resolve_due - b.minutes_to_resolve_due)[0];
  const nextCheck = verifications[0];
  const nextInspect = inspections_due.find((f) => f.overdue) || null;
  const next = nextRepair
    ? { icon: "wrench", tone: "border-st-issue bg-orange-50", code: nextRepair.facility.code, name: fname(nextRepair.facility),
        what: cat(nextRepair.category, lang), when: nextRepair.minutes_to_resolve_due >= 0 ? w.due_in(nextRepair.minutes_to_resolve_due) : w.late_by(-nextRepair.minutes_to_resolve_due) }
    : nextCheck
      ? { icon: "tick", tone: "border-river bg-river-light", code: nextCheck.facility.code, name: fname(nextCheck.facility), what: w.checkFix, when: w.fixedBy(nextCheck.resolver?.name || "") }
      : nextInspect
        ? { icon: "clock", tone: "border-st-overdue bg-violet-50", code: nextInspect.code, name: fname(nextInspect), what: w.statusLabel.overdue,
            when: nextInspect.verified_age_min === null ? w.never : formatMinutes(nextInspect.verified_age_min) }
        : null;

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl border-2 p-4 ${next ? next.tone : "border-line bg-white"}`} data-testid="next-task">
        <p className="text-[13px] font-bold uppercase tracking-wide text-ink-muted">{w.nextTask}</p>
        {next ? (
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white"><Icon name={next.icon} className="h-8 w-8 text-ink" /></span>
            <span className="min-w-0">
              <span className="block text-[22px] font-bold leading-tight">{next.code} · {next.what}</span>
              <span className="block truncate text-[14px]">{next.name}</span>
              <span className="block text-[14px] font-semibold">{next.when}</span>
            </span>
          </div>
        ) : <p className="mt-1 text-[16px] font-semibold">{w.nothingNext}</p>}
        {next && <p className="mt-2 flex items-center gap-1.5 text-[14px] font-medium"><Icon name="scan" className="h-5 w-5" />{w.goScan}</p>}
      </section>
      <section>
        <h2 className="text-[16px] font-bold">{w.repairs}</h2>
        {repairs.length === 0 ? <p className="mt-2 text-[14px] text-ink-muted">{w.noRepairs}</p> : (
          <ul className="mt-2 space-y-2">
            {repairs.map((i) => (
              <li key={i.id} className="panel flex items-center gap-3 p-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-st-issue"><Icon name="wrench" className="h-7 w-7" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><Priority p={i.priority} /><span className="font-bold">{i.facility.code}</span></span>
                  <span className="block truncate text-[14px]">{fname(i.facility)} · {cat(i.category, lang)}</span>
                  <span className={`block text-[13px] ${i.minutes_to_resolve_due < 0 ? "font-bold text-st-issue" : "text-ink-muted"}`}>
                    {t.local[i.id] === "resolved" ? w.waiting : i.minutes_to_resolve_due >= 0 ? w.due_in(i.minutes_to_resolve_due) : w.late_by(-i.minutes_to_resolve_due)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {verifications.length > 0 && (
        <section>
          <h2 className="text-[16px] font-bold">{w.toVerify}</h2>
          <ul className="mt-2 space-y-2">
            {verifications.map((i) => (
              <li key={i.id} className="panel flex items-center gap-3 p-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-river-light text-river"><Icon name="tick" className="h-7 w-7" /></span>
                <span><span className="block font-bold">{i.facility.code} · {cat(i.category, lang)}</span>
                  <span className="block text-[14px] text-ink-muted">{w.fixedBy(i.resolver?.name || "")}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h2 className="text-[16px] font-bold">{w.due}</h2>
        <ul className="mt-2 space-y-2">
          {inspections_due.map((f) => (
            <li key={f.id} className="panel flex items-center justify-between gap-2 p-3">
              <span className="min-w-0"><span className="font-bold">{f.code}</span> <span className="text-[14px] text-ink-muted">{fname(f)}</span></span>
              <span className={`flex shrink-0 items-center gap-1 text-[14px] ${f.overdue ? "font-bold text-st-overdue" : "text-ink-muted"}`}>
                <Icon name="clock" className="h-4 w-4" />{f.verified_age_min === null ? w.never : formatMinutes(f.verified_age_min)}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-xl border border-dashed border-line p-3">
        <p className="label">{w.typeCode}</p>
        <div className="mt-1.5 flex gap-2">
          <input className="field uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABC123" maxLength={6} />
          <button className="btn-quiet" disabled={code.length < 6} onClick={() => nav(`/w/s/${code.toUpperCase()}?m=manual`)}>{w.open}</button>
        </div>
        <p className="mt-1.5 text-[12px] text-ink-muted">{w.typedFlag}</p>
      </section>
    </div>
  );
}

function ScanScreen({ t, online, w, lang }: { t: ReturnType<typeof useTasks>; online: boolean; w: W; lang: WLang }) {
  const { code = "" } = useParams();
  const [params] = useSearchParams();
  const method = params.get("m") === "manual" ? "manual" : "qr";
  const staff = code.toUpperCase();
  const me = session()!.user;
  const facility = t.tasks?.facilities.find((f) => f.staff_token === staff) || null;
  const [awaiting, setAwaiting] = useState<Issue[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"main" | "checklist" | "help">("main");
  const [confirmOk, setConfirmOk] = useState(false);
  useEffect(() => {
    if (!confirmOk) return;
    const id = setTimeout(() => setConfirmOk(false), 4000);
    return () => clearTimeout(id);
  }, [confirmOk]);
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({});
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [fixNote, setFixNote] = useState("");
  const [fixPhoto, setFixPhoto] = useState<string | null>(null);

  const loadAwaiting = useCallback(async () => {
    if (!facility) return;
    if (navigator.onLine) {
      try {
        const h = await api<{ issues: Issue[] }>(`/api/facilities/${facility.id}/history`);
        setAwaiting(h.issues.filter((i) => i.state === "awaiting_verification"));
        return;
      } catch { /* fall back to cache */ }
    }
    setAwaiting((t.tasks?.verifications || []).filter((i) => i.facility.id === facility.id));
  }, [facility, t.tasks]);
  useEffect(() => { loadAwaiting(); }, [loadAwaiting, online]);

  if (!t.tasks) return <p className="text-ink-muted">…</p>;
  if (!facility) return <ErrorNote message={w.unknownCode(staff)} />;

  const repairs = t.tasks.repairs.filter((i) => i.facility.id === facility.id);
  const done = (text: string) => { setMsg(`${text} ${navigator.onLine ? w.sent : w.savedPhone}`); setErr(null); setMode("main"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  async function start(i: Issue) {
    await queue({ kind: "start", issue_id: i.id, label: `Started repair · ${i.facility.code}` });
    await t.mark(i.id, "started");
    await syncNow();
    done(w.repairStarted);
  }
  async function resolve(i: Issue) {
    if (t.local[i.id] !== "started" && i.state === "assigned") {
      await queue({ kind: "start", issue_id: i.id, label: `Started repair · ${i.facility.code}` });
    }
    await queue({ kind: "resolve", issue_id: i.id, note: fixNote || undefined, photo: fixPhoto || undefined, label: `Marked fixed · ${i.facility.code}` });
    await t.mark(i.id, "resolved");
    setFixNote("");
    setFixPhoto(null);
    await syncNow();
    done(w.fixRecorded);
  }
  async function verify(i: Issue, confirmed: boolean) {
    if (!navigator.onLine) { setErr(w.verifyNeedsNet); return; }
    try {
      await api(`/api/issues/${i.id}/verify`, { body: { staff_token: staff, confirmed } });
      setMsg(confirmed ? w.confirmed : w.sentBack);
      setErr(null);
      loadAwaiting();
      t.reload();
    } catch (e) {
      const m = (e as Error).message;
      setErr(m.includes("Another person must verify") ? w.selfBlocked : m);
    }
  }
  async function inspect(all: boolean) {
    const full = Object.fromEntries(CHECKLIST.map((c) => [c.key, all ? true : answers[c.key] === true]));
    await queue({ kind: "inspection", staff_token: staff, scan_method: method, answers: full, note: note || undefined, photo: photo || undefined, label: `Inspection · ${facility!.code}` });
    setAnswers({});
    setNote("");
    setPhoto(null);
    await syncNow();
    done(w.inspectDone);
  }
  async function setQueue(level: "short" | "long" | "full") {
    await queue({ kind: "queue", staff_token: staff, queue_level: level, label: `Queue ${level} · ${facility!.code}` });
    await syncNow();
    done(`${w.queueSaved} ${w.queue[level]}.`);
  }
  async function help(kind: string) {
    await queue({ kind: "help", staff_token: staff, help_kind: kind, label: `Help: ${kind} · ${facility!.code}` });
    await syncNow();
    done(`${w.help[kind]}. ${w.helpSent}`);
  }

  const openRepairHere = repairs.some((i) => t.local[i.id] !== "resolved");
  const allAnswered = CHECKLIST.every((c) => answers[c.key] !== undefined);
  const anyNo = CHECKLIST.some((c) => answers[c.key] === false);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[23px] font-bold leading-tight">{lang === "te" ? facility.name_te : facility.name_en}</h1>
        <p className="text-[14px] text-ink-muted">{facility.code} · {method === "qr" ? "QR" : "⌨"} {staff}</p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] font-bold"
          style={{ color: STATUS[facility.status].hex, borderColor: STATUS[facility.status].hex + "55", background: STATUS[facility.status].hex + "12" }}>
          <span className="h-2 w-2 rounded-full" style={{ background: STATUS[facility.status].hex }} />{w.statusLabel[facility.status]}
        </span>
      </div>
      {msg && (
        <p role="status" data-testid="worker-msg" className="flex items-start gap-2 rounded-xl border border-st-verified/30 bg-green-50 px-3 py-3 text-[16px] font-semibold text-st-verified">
          <Icon name="tick" className="h-6 w-6 shrink-0" strokeWidth={3} />{msg}
        </p>
      )}
      {err && <div data-testid="worker-error"><ErrorNote message={err} /></div>}

      {repairs.map((i) => (
        <section key={i.id} className="panel border-2 border-st-issue/40 p-4">
          <div className="flex items-center gap-2"><Priority p={i.priority} /><Icon name="wrench" className="h-6 w-6 text-st-issue" /><h2 className="text-[17px] font-bold">{cat(i.category, lang)}</h2></div>
          {t.local[i.id] === "resolved" ? <p className="mt-2 text-[15px] text-ink-muted">{w.waiting}</p> : (
            <div className="mt-3 space-y-3">
              {i.state === "assigned" && t.local[i.id] !== "started" && (
                <button className="btn-quiet w-full py-3.5 text-[16px]" onClick={() => start(i)}>{w.start}</button>
              )}
              <textarea className="field" rows={2} placeholder={w.fixNote} value={fixNote} onChange={(e) => setFixNote(e.target.value)} data-testid="fix-note" />
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line bg-white px-3 py-3">
                <Icon name="camera" className="h-7 w-7 text-river" /><span className="font-semibold">{w.photo}</span>
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFixPhoto(await compressPhoto(f)); }} />
                {fixPhoto && <img src={fixPhoto} alt="" className="ml-auto h-10 w-10 rounded object-cover" />}
              </label>
              <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-st-verified py-4 text-[19px] font-bold text-white" onClick={() => resolve(i)} data-testid="mark-fixed">
                <Icon name="tick" className="h-7 w-7" strokeWidth={3} />{w.fixed}
              </button>
            </div>
          )}
        </section>
      ))}

      {awaiting.map((i) => (
        <section key={i.id} className="panel border-2 border-river p-4">
          <h2 className="flex items-center gap-2 text-[17px] font-bold"><Icon name="tick" className="h-6 w-6 text-river" />{w.checkFix}: {cat(i.category, lang)}</h2>
          <p className="mt-1 text-[14px] text-ink-muted">{w.fixedBy(`${i.resolver?.name ?? ""}${i.resolver?.id === me.id ? " " + w.you : ""}`)}</p>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <button className="flex flex-col items-center gap-1 rounded-xl bg-st-verified py-3 font-bold text-white" onClick={() => verify(i, true)} data-testid="confirm-fix">
              <Icon name="tick" className="h-8 w-8" strokeWidth={3} />{w.confirm}</button>
            <button className="flex flex-col items-center gap-1 rounded-xl border-2 border-st-issue bg-white py-3 font-bold text-st-issue" onClick={() => verify(i, false)}>
              <Icon name="cross" className="h-8 w-8" strokeWidth={3} />{w.notFixed}</button>
          </div>
        </section>
      ))}

      {mode === "main" && (
        <section className="space-y-3">
          {openRepairHere ? (
            <p className="flex items-center gap-2 rounded-xl bg-paper px-3 py-3 text-[15px] font-semibold ring-1 ring-line" data-testid="finish-repair-first">
              <Icon name="wrench" className="h-6 w-6 text-st-issue" />{w.finishRepair}
            </p>
          ) : (
            <button onClick={() => (confirmOk ? (setConfirmOk(false), inspect(true)) : setConfirmOk(true))} data-testid="all-ok"
              className={`flex w-full items-center justify-center gap-3 rounded-2xl py-6 text-[22px] font-bold text-white shadow-sm active:scale-[0.99] ${confirmOk ? "bg-st-verified ring-4 ring-marigold" : "bg-st-verified"}`}>
              <Icon name="tick" className="h-10 w-10" strokeWidth={3} />{confirmOk ? w.tapConfirm : w.allOk}
            </button>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setMode("checklist")} data-testid="something-wrong"
              className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-st-issue bg-white py-4 text-[16px] font-bold text-st-issue">
              <Icon name="alert" className="h-9 w-9" />{w.wrong}
            </button>
            <button onClick={() => setMode("help")} data-testid="need-help"
              className="flex flex-col items-center gap-1.5 rounded-2xl border-2 border-marigold bg-white py-4 text-[16px] font-bold text-marigold-deep">
              <Icon name="help" className="h-9 w-9" />{w.needHelp}
            </button>
          </div>
          <div className="rounded-2xl border border-line bg-white p-3">
            <p className="text-[15px] font-bold">{w.queueQ}</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {(["short", "long", "full"] as const).map((lv, i) => (
                <button key={lv} onClick={() => setQueue(lv)} data-testid={`queue-${lv}`}
                  className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 text-[14px] font-bold ${facility.queue?.level === lv ? "border-river bg-river-light" : "border-line"}`}
                  style={{ color: ["#2E7D4F", "#9A6A00", "#C2410C"][i] }}>
                  <span className="flex">{Array.from({ length: i + 1 }).map((_, k) => <Icon key={k} name="person" className="-mr-1.5 h-7 w-7" strokeWidth={2.4} />)}</span>
                  {w.queue[lv]}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {mode === "help" && (
        <section className="panel p-4">
          <h2 className="flex items-center gap-2 text-[17px] font-bold"><Icon name="help" className="h-6 w-6 text-marigold-deep" />{w.needHelp}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {Object.keys(w.help).map((k) => (
              <button key={k} onClick={() => help(k)} data-testid={`help-${k}`}
                className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-line bg-white py-4 text-[15px] font-bold">
                <Icon name={HELP_ICON[k]} className="h-10 w-10 text-marigold-deep" />{w.help[k]}
              </button>
            ))}
          </div>
          <button className="btn-quiet mt-3 w-full" onClick={() => setMode("main")}>{w.cancel}</button>
        </section>
      )}

      {mode === "checklist" && (
        <section className="panel p-4">
          <ul className="space-y-2.5">
            {CHECKLIST.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-river-light text-river"><Icon name={c.icon} className="h-7 w-7" /></span>
                  <span className="min-w-0"><span className="block text-[16px] font-semibold leading-tight">{lang === "te" ? c.te : c.en}</span>
                    <span className="block text-[12px] text-ink-muted">{lang === "te" ? c.en : c.te}</span></span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {[true, false].map((v) => (
                    <button key={String(v)} onClick={() => setAnswers({ ...answers, [c.key]: v })} aria-pressed={answers[c.key] === v} aria-label={`${c.en}: ${v ? "yes" : "no"}`}
                      className={`flex h-14 w-14 items-center justify-center rounded-xl border-2 ${answers[c.key] === v ? (v ? "border-st-verified bg-st-verified text-white" : "border-st-issue bg-st-issue text-white") : "border-line bg-white text-ink-muted"}`}>
                      <Icon name={v ? "tick" : "cross"} className="h-7 w-7" strokeWidth={3} />
                    </button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          {anyNo && (
            <div className="mt-4 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-3">
                <Icon name="camera" className="h-7 w-7 text-river" /><span className="font-semibold">{w.photo}</span>
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setPhoto(await compressPhoto(f)); }} />
                {photo && <img src={photo} alt="" className="ml-auto h-10 w-10 rounded object-cover" />}
              </label>
              <textarea className="field" rows={2} placeholder={w.noProblemNote} value={note} onChange={(e) => setNote(e.target.value)} />
              <p className="text-[13px] text-ink-muted">{w.eachNo}</p>
            </div>
          )}
          <div className="mt-4 grid grid-cols-3 gap-2">
            <button className="btn-quiet" onClick={() => setMode("main")}>{w.cancel}</button>
            <button className="btn-primary col-span-2 py-3.5 text-[16px]" disabled={!allAnswered} onClick={() => inspect(false)} data-testid="submit-inspection">{w.submit}</button>
          </div>
        </section>
      )}
      <Link to="/w" className="block py-2 text-center text-[15px] font-semibold text-river">{w.back}</Link>
    </div>
  );
}

function Outbox({ online, w }: { online: boolean; w: W }) {
  const { items, log } = useOutbox();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">{w.outbox} · {items.length}</h2>
          <button className="btn-quiet py-1.5" disabled={!online || busy || items.length === 0} onClick={async () => { setBusy(true); await syncNow(); setBusy(false); }}>{w.sendNow}</button>
        </div>
        {items.length === 0 ? (
          <p className="mt-2 flex items-center gap-2 text-[15px] text-st-verified" data-testid="outbox-empty"><Icon name="tick" className="h-5 w-5" strokeWidth={3} />{w.allSent}</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {items.map((r) => (
              <li key={r.client_uuid} className="panel flex items-center gap-3 p-3 text-[14px]">
                <Icon name="clock" className="h-6 w-6 text-marigold-deep" />
                <span><span className="block font-semibold">{r.label}</span>
                  <span className="text-ink-muted">{new Date(r.device_time).toLocaleTimeString()}{r.offline && " · offline"}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-[16px] font-bold">{w.recent}</h2>
        {log.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white text-[14px]">
            {log.map((r) => (
              <li key={r.client_uuid} className="flex justify-between gap-2 px-3 py-2">
                <span>{r.label}</span>
                <span className={r.result === "ok" || r.result === "duplicate" ? "text-st-verified" : r.result === "late" ? "text-marigold-deep" : "text-st-issue"}>
                  {r.result === "ok" ? w.received : r.result === "duplicate" ? w.dup : r.result === "late" ? w.late : `${w.refused}: ${r.detail}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
