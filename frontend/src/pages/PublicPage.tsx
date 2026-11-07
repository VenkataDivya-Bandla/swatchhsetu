import { useCallback, useEffect, useRef, useState } from "react";
import Guide from "../components/Guide";
import { Link, useParams } from "react-router-dom";
import { api, ApiError, compressPhoto, deviceKey, type Facility } from "../api";
import { Icon } from "../components/icons";
import { BIG_TILES, PUB, SMALL_TILES, SPEECH_LANG, TILE_ICON, type Lang, type Status } from "../i18n";

type Near = {
  code: string; name_en: string; name_te: string; public_token: string; lat: number; lng: number;
  distance_m: number; bearing: number; has_men: boolean; has_women: boolean; accessible: boolean; verified_age_min: number | null;
  queue: { level: "short" | "long" | "full"; age_min: number } | null;
};
type Card = Facility & {
  has_men: boolean; has_women: boolean; free: boolean;
  recently_closed_issue: { id: number; category: string } | null; open_categories: string[]; nearby: Near[];
};
type Result = { ref_no: string; merged: boolean };

const LOOK: Record<Status, { icon: string; hex: string; soft: string }> = {
  verified: { icon: "tick", hex: "#2E7D4F", soft: "#E8F3EC" },
  issue: { icon: "alert", hex: "#C2410C", soft: "#FDEEE6" },
  maintenance: { icon: "wrench", hex: "#2563EB", soft: "#E8EFFD" },
  unavailable: { icon: "cross", hex: "#4B5563", soft: "#EEF0F2" },
  overdue: { icon: "clock", hex: "#7C3AED", soft: "#F1EBFD" },
};

function chime() {
  try {
    const ctx = new AudioContext();
    [660, 880].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.16 + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.16);
      o.stop(ctx.currentTime + i * 0.16 + 0.26);
    });
  } catch { /* sound is a bonus */ }
  navigator.vibrate?.([120, 60, 120]);
}

/** Telugu by default in Andhra Pradesh; the visitor's own choice is remembered. */
function initialLang(): Lang {
  const saved = localStorage.getItem("ss_lang") as Lang | null;
  return saved && saved in PUB ? saved : "te";
}

const QUEUE_LOOK: Record<string, { people: number; hex: string }> = {
  short: { people: 1, hex: "#2E7D4F" }, long: { people: 2, hex: "#9A6A00" }, full: { people: 3, hex: "#C2410C" },
};

function QueueChip({ q, L, small = false }: { q: { level: "short" | "long" | "full"; age_min: number }; L: (typeof PUB)["te"]; small?: boolean }) {
  const look = QUEUE_LOOK[q.level];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full bg-white font-bold ring-1 ${small ? "px-2 py-0.5 text-[12px]" : "px-3 py-1.5 text-[15px]"}`}
      style={{ color: look.hex, boxShadow: `inset 0 0 0 1.5px ${look.hex}55` }} data-testid="queue">
      <span className="flex">{Array.from({ length: look.people }).map((_, i) => <Icon key={i} name="person" className={small ? "-mr-1 h-4 w-4" : "-mr-1.5 h-5 w-5"} strokeWidth={2.4} />)}</span>
      <span className="ml-1">{L.queue[q.level]}</span>
      {!small && <span className="font-normal text-ink-muted">· {L.queueAgo(L.minutes(q.age_min))}</span>}
    </span>
  );
}

/** Hold to talk, let go to send: the same habit as a WhatsApp voice message. Stops by itself after 30 seconds. */
function VoiceButton({ L, disabled, onAudio }: { L: (typeof PUB)["te"]; disabled: boolean; onAudio: (dataUrl: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const r = useRef<{ rec: MediaRecorder | null; held: boolean; started: number; cancel: boolean }>({ rec: null, held: false, started: 0, cancel: false });

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSecs((x) => { if (x >= 29) stop(); return x + 1; }), 1000);
    return () => clearInterval(id);
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  async function begin() {
    if (disabled || r.current.rec) return;
    setNote(null);
    r.current.held = true;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      r.current.held = false;
      setNote(L.micDenied);
      return;
    }
    if (!r.current.held) { // finger lifted while the permission prompt was open
      stream.getTracks().forEach((t) => t.stop());
      setNote(L.tooShort);
      return;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) => window.MediaRecorder?.isTypeSupported?.(m));
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      r.current.rec = null;
      setRecording(false);
      if (r.current.cancel) { setNote(L.tooShort); return; }
      const fr = new FileReader();
      fr.onload = () => onAudio(String(fr.result));
      fr.readAsDataURL(new Blob(chunks, { type: rec.mimeType || "audio/webm" }));
    };
    r.current = { rec, held: true, started: Date.now(), cancel: false };
    rec.start();
    setSecs(0);
    setRecording(true);
    navigator.vibrate?.(60);
  }
  function stop() {
    r.current.held = false;
    const rec = r.current.rec;
    if (!rec || rec.state !== "recording") return;
    r.current.cancel = Date.now() - r.current.started < 1000; // under a second is almost always an accidental tap
    rec.stop();
  }

  return (
    <div>
      <button
        onPointerDown={(e) => { e.preventDefault(); begin(); }} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop}
        onContextMenu={(e) => e.preventDefault()} disabled={disabled && !recording} data-testid="voice"
        className={`flex w-full touch-none select-none items-center gap-4 rounded-2xl border-2 p-4 text-left disabled:opacity-60 ${recording ? "scale-[0.99] border-st-issue bg-orange-50" : "border-river bg-white"}`}>
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-white ${recording ? "animate-pulse bg-st-issue" : "bg-river"}`}>
          <Icon name="mic" className="h-9 w-9" strokeWidth={2.2} />
        </span>
        <span className="min-w-0">
          <span className="block text-[18px] font-bold leading-tight">{recording ? `${L.release} 0:${String(secs).padStart(2, "0")}` : L.hold}</span>
          {!recording && <span className="mt-0.5 block text-[14px] text-ink-muted">{L.holdHint}</span>}
        </span>
      </button>
      {note && <p className="mt-2 text-[14px] font-medium text-st-issue">{note}</p>}
    </div>
  );
}

function Amenities({ men, women, accessible, free, size = "h-7 w-7" }: { men: boolean; women: boolean; accessible: boolean; free?: boolean; size?: string }) {
  return (
    <span className="flex items-center gap-2 text-ink" aria-label={[women && "women", men && "men", accessible && "wheelchair access", free && "free"].filter(Boolean).join(", ")}>
      {women && <span className="rounded-lg bg-pink-50 p-1 text-pink-700"><Icon name="women" className={size} /></span>}
      {men && <span className="rounded-lg bg-sky-50 p-1 text-sky-700"><Icon name="men" className={size} /></span>}
      {accessible && <span className="rounded-lg bg-river-light p-1 text-river"><Icon name="wheelchair" className={size} /></span>}
      {free && <span className="rounded-lg bg-green-50 px-2 py-1 text-[13px] font-bold text-st-verified">₹0</span>}
    </span>
  );
}

export default function PublicPage() {
  const { token = "" } = useParams();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const L = PUB[lang];
  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem("ss_lang", l); window.speechSynthesis?.cancel(); };
  const [big, setBig] = useState(localStorage.getItem("ss_big") === "1");
  const [card, setCard] = useState<Card | null>(null);
  const [loadErr, setLoadErr] = useState<"offline" | "inactive" | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [offlineCat, setOfflineCat] = useState<string | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const [result, setResult] = useState<(Result & { category: string }) | null>(null);
  const [answered, setAnswered] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const [extra, setExtra] = useState({ comment: "", phone: "", photo: null as string | null });
  const [extraSaved, setExtraSaved] = useState(false);

  const load = useCallback(() => {
    api<Card>(`/api/public/f/${token}`)
      .then((c) => { setCard(c); setLoadErr(null); })
      .catch((e: ApiError) => setLoadErr(e.status === 0 ? "offline" : "inactive"));
  }, [token]);
  useEffect(load, [load]);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const report = useCallback(async (category: string, audio?: string) => {
    setSending(category);
    setSendErr(null);
    try {
      const r = await api<Result>(`/api/public/f/${token}/reports`, { body: { category, lang, device_key: deviceKey(), audio: audio || null } });
      setResult({ ...r, category: audio ? "voice" : category });
      setUndoLeft(5);
      setNotice(null);
      setOfflineCat(null);
      chime();
      window.scrollTo({ top: 0 });
      load();
    } catch (e) {
      if ((e as ApiError).status === 0) setOfflineCat(category);
      else setSendErr((e as Error).message);
    } finally {
      setSending(null);
    }
  }, [token, lang, load]);

  // retry a report made without signal as soon as the phone is back online
  useEffect(() => {
    if (!offlineCat) return;
    const retry = () => report(offlineCat);
    window.addEventListener("online", retry);
    const id = setInterval(() => navigator.onLine && retry(), 10000);
    return () => { window.removeEventListener("online", retry); clearInterval(id); };
  }, [offlineCat, report]);

  function speak() {
    if (!card || !("speechSynthesis" in window)) { setNoVoice(true); return; }
    const age = card.verified_age_min;
    const fresh = age === null ? L.neverChecked : card.overdue ? L.notChecked(L.minutes(age)) : L.checked(L.minutes(age));
    const parts = result
      ? [L.sent, L.sentSub]
      : [L.status[card.status], L.advice[card.status], fresh, card.water_ok ? "" : L.waterOff,
         card.nearby.length && card.status !== "verified" ? `${L.nearbyTitle}: ${card.nearby[0].distance_m} m ${L.dirs[Math.round(card.nearby[0].bearing / 45) % 8]}` : "",
         L.tapProblem];
    const u = new SpeechSynthesisUtterance(parts.filter(Boolean).join(". "));
    u.lang = SPEECH_LANG[lang];
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
    if (voice) u.voice = voice;
    setNoVoice(!voice && lang !== "en");
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  useEffect(() => {
    if (undoLeft <= 0) return;
    const id = setTimeout(() => setUndoLeft((x) => x - 1), 1000);
    return () => clearTimeout(id);
  }, [undoLeft]);

  async function undo() {
    if (!result) return;
    try {
      await api(`/api/public/reports/${result.ref_no}/withdraw`, { body: { device_key: deviceKey() } });
      setResult(null);
      setUndoLeft(0);
      setNotice(L.undone);
      load();
    } catch (e) {
      setSendErr((e as Error).message);
    }
  }

  async function answer(fixed: boolean) {
    if (!card?.recently_closed_issue) return;
    try {
      await api(`/api/public/issues/${card.recently_closed_issue.id}/feedback`, { body: { fixed, device_key: deviceKey() } });
    } catch { /* window may have closed */ }
    setAnswered(true);
    load();
  }

  async function saveExtra() {
    if (!result) return;
    try {
      await api(`/api/public/reports/${result.ref_no}`, {
        method: "PATCH",
        body: { device_key: deviceKey(), comment: extra.comment || null, phone: extra.phone || null, photo: extra.photo },
      });
      setExtraSaved(true);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const name = card ? (lang === "en" ? card.name_en : card.name_te) : "";
  const look = card ? LOOK[card.status] : null;
  const age = card?.verified_age_min ?? null;
  const freshness = card ? (age === null ? L.neverChecked : card.overdue ? L.notChecked(L.minutes(age)) : L.checked(L.minutes(age))) : "";
  const shareText = card ? `${name} (${card.code}): ${L.status[card.status]}. ${window.location.href}` : "";
  const showNearbyFirst = card && card.status !== "verified" && card.nearby.length > 0;

  const nearby = card && (
    <section className="mt-6" aria-labelledby="near">
      <h2 id="near" className="flex items-center gap-2 text-[18px] font-bold"><Icon name="map" className="h-5 w-5 text-river" />{L.nearbyTitle}</h2>
      {card.nearby.length === 0 ? <p className="mt-2 text-[15px] text-ink-muted">{L.nearbyNone}</p> : (
        <ul className="mt-3 space-y-2.5">
          {card.nearby.map((n) => (
            <li key={n.code} className="panel flex items-center gap-3 p-3" data-testid="nearby">
              <span className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full bg-st-verified text-white" title={L.dirs[Math.round(n.bearing / 45) % 8]}>
                <Icon name="arrow" className="h-7 w-7" strokeWidth={2.6} style={{ transform: `rotate(${n.bearing}deg)` }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[20px] font-bold leading-tight">{n.distance_m < 1000 ? `${n.distance_m} m` : `${(n.distance_m / 1000).toFixed(1)} km`}
                  <span className="ml-1.5 text-[14px] font-medium text-ink-muted">{L.dirs[Math.round(n.bearing / 45) % 8]}</span></span>
                <span className="block truncate text-[14px]">{lang === "en" ? n.name_en : n.name_te}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2"><Amenities men={n.has_men} women={n.has_women} accessible={n.accessible} size="h-5 w-5" />
                  {n.queue && <QueueChip q={n.queue} L={L} small />}</span>
              </span>
              <span className="flex shrink-0 flex-col gap-1.5">
                <a className="btn-primary px-3 py-2 text-[14px]" target="_blank" rel="noreferrer"
                  href={`https://www.google.com/maps/dir/?api=1&destination=${n.lat},${n.lng}&travelmode=walking`}>{L.directions}</a>
                <Link className="btn-quiet px-3 py-2 text-[14px]" to={`/f/${n.public_token}`} onClick={() => { setResult(null); window.scrollTo({ top: 0 }); }}>
                  <Icon name="tick" className="h-4 w-4 text-st-verified" />{n.code}
                </Link>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <div className="min-h-screen bg-paper" lang={lang}>
      <div className="bg-marigold-light px-4 py-1.5 text-center text-[13px] font-medium text-marigold-deep">{L.demo}</div>
      <main className="mx-auto max-w-md px-4 pb-16 pt-3" style={big ? { zoom: 1.2 } : undefined}>
        <header className="flex items-center justify-between gap-2">
          <img src="/icon.svg" alt="SwachhSetu" className="h-8 w-8" />
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-line bg-white text-[14px]" role="group" aria-label="Language">
              {(["te", "hi", "en"] as Lang[]).map((l) => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l}
                  className={`px-2.5 py-1.5 font-semibold ${lang === l ? "bg-river text-white" : "text-ink"}`}>{PUB[l].name}</button>
              ))}
            </div>
            <button onClick={() => { setBig(!big); localStorage.setItem("ss_big", big ? "0" : "1"); }} aria-pressed={big} aria-label={L.bigText}
              className={`rounded-lg border px-2.5 py-1.5 text-[15px] font-bold ${big ? "border-river bg-river text-white" : "border-line bg-white"}`}>A+</button>
          </div>
        </header>

        {loadErr && !card && (
          <div className="panel mt-10 p-5 text-center">
            <Icon name={loadErr === "offline" ? "phone" : "cross"} className="mx-auto h-12 w-12 text-ink-muted" />
            <p className="mt-3 font-semibold">{loadErr === "offline" ? L.offline : L.inactive}</p>
            <button className="btn-quiet mt-4" onClick={load}>↻</button>
          </div>
        )}

        {card && look && !result && (
          <>
            <Guide storageKey="ss_guide_pub" slides={L.guide} labels={L} />
            <section className="mt-3 rounded-2xl border-2 p-3" style={{ borderColor: look.hex, background: look.soft, borderStyle: card.status === "overdue" ? "dashed" : "solid" }} data-testid="status">
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white" style={{ background: look.hex }}>
                  <Icon name={look.icon} className="h-9 w-9" strokeWidth={3} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[20px] font-bold leading-tight" style={{ color: look.hex }}>{L.status[card.status]}</p>
                  <p className="text-[13px] text-ink-muted">{freshness}</p>
                </div>
                <button onClick={speak} className="flex shrink-0 flex-col items-center rounded-xl bg-white px-3 py-1.5 text-[13px] font-bold text-river ring-1 ring-line" data-testid="listen" aria-label={L.listen}>
                  <Icon name="speaker" className="h-6 w-6" />{L.listen}
                </button>
              </div>
              {card.status !== "verified" && <p className="mt-2 text-[15px] font-medium">{L.advice[card.status]}</p>}
              {(!card.water_ok || card.queue) && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!card.water_ok && (
                    <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[15px] font-bold text-st-issue">
                      <Icon name="dropOff" className="h-6 w-6" strokeWidth={2.4} />{L.waterOff}
                    </span>
                  )}
                  {card.queue && <QueueChip q={card.queue} L={L} />}
                </div>
              )}
              {noVoice && <p className="mt-2 text-[13px] text-ink-muted">{L.noVoice}</p>}
            </section>

            {showNearbyFirst && nearby}

            <section className="mt-5" aria-labelledby="tap">
              <h2 id="tap" className="text-[18px] font-bold">{L.tapProblem}</h2>
              {offlineCat && (
                <p role="alert" className="mt-2 rounded-lg bg-marigold-light px-3 py-2 text-[14px] text-marigold-deep">
                  {L.offline} {L.helpline} <b>{card.code}</b>.
                </p>
              )}
              {notice && <p role="status" className="mt-2 rounded-lg bg-paper px-3 py-2 text-[14px] font-medium ring-1 ring-line">{notice}</p>}
              {sendErr && <p role="alert" className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-[14px] text-st-issue">{sendErr}</p>}
              <div className="mt-3 grid grid-cols-2 gap-3">
                {BIG_TILES.map((c) => {
                  const unsafe = c === "unsafe";
                  return (
                    <button key={c} onClick={() => report(c)} disabled={!!sending} data-testid={`report-tile-${c}`}
                      className={`flex min-h-[116px] flex-col items-center justify-center gap-2 rounded-2xl border-2 bg-white p-3 text-center active:scale-[0.98] disabled:opacity-60 ${unsafe ? "border-st-issue/60" : card.open_categories.includes(c) ? "border-marigold" : "border-line"}`}>
                      <Icon name={TILE_ICON[c]} className={`h-14 w-14 ${unsafe ? "text-st-issue" : "text-river"}`} strokeWidth={1.8} />
                      <span className="text-[16px] font-bold leading-tight">{sending === c ? "…" : L.cat[c]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3"><VoiceButton L={L} disabled={!!sending} onAudio={(a) => report("other", a)} /></div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {SMALL_TILES.map((c) => (
                  <button key={c} onClick={() => report(c)} disabled={!!sending} data-testid={`report-tile-${c}`}
                    className="flex items-center justify-center gap-2 rounded-xl border border-line bg-white px-3 py-3 font-semibold">
                    <Icon name={TILE_ICON[c]} className="h-6 w-6 text-river" />{L.cat[c]}
                  </button>
                ))}
              </div>
            </section>

            {card.recently_closed_issue && (
              <section className="panel mt-5 p-4" data-testid="fixed-question">
                {answered ? <p className="flex items-center gap-2 font-semibold"><Icon name="tick" className="h-6 w-6 text-st-verified" />{L.thanks}</p> : (
                  <>
                    <p className="text-[17px] font-semibold">{L.fixedQ}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <button className="flex flex-col items-center gap-1 rounded-xl border-2 border-st-verified bg-white py-3 font-bold text-st-verified" onClick={() => answer(true)}>
                        <Icon name="tick" className="h-9 w-9" strokeWidth={3} />{L.yes}</button>
                      <button className="flex flex-col items-center gap-1 rounded-xl border-2 border-st-issue bg-white py-3 font-bold text-st-issue" onClick={() => answer(false)} data-testid="not-fixed">
                        <Icon name="cross" className="h-9 w-9" strokeWidth={3} />{L.no}</button>
                    </div>
                  </>
                )}
              </section>
            )}

            {!showNearbyFirst && nearby}

            <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-line">
              <div className="min-w-0">
                <p className="truncate text-[16px] font-bold">{name}</p>
                <p className="text-[13px] text-ink-muted">{card.code}</p>
              </div>
              <Amenities men={card.has_men} women={card.has_women} accessible={card.accessible} free={card.free} size="h-6 w-6" />
            </div>
            <a className="btn-quiet mt-3 w-full" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}>
              <Icon name="share" className="h-5 w-5" />{L.share}
            </a>
          </>
        )}

        {card && result && (
          <section className="mt-5" data-testid="report-sent">
            <div className="flex flex-col items-center rounded-2xl bg-white p-6 text-center ring-1 ring-line">
              <span className="flex h-28 w-28 items-center justify-center rounded-full bg-st-verified text-white">
                <Icon name="tick" className="h-16 w-16" strokeWidth={3} />
              </span>
              <p className="mt-4 text-[26px] font-bold">{L.sent}</p>
              <p className="mt-1 flex items-center gap-2 text-[16px]"><Icon name={result.category === "voice" ? "mic" : TILE_ICON[result.category]} className="h-6 w-6 text-river" />{result.category === "voice" ? L.voiceCat : L.cat[result.category]} · {card.code}</p>
              <p className="mt-1 text-[16px]">{L.sentSub}</p>
              {result.merged && <p className="mt-2 text-[14px] text-ink-muted">{L.merged}</p>}
              <p className="mt-3 text-[13px] text-ink-muted">{L.ref}: <span className="font-semibold tracking-wide" data-testid="ref">{result.ref_no}</span></p>
              <button onClick={speak} className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 font-bold text-river ring-1 ring-line"><Icon name="speaker" className="h-5 w-5" />{L.listen}</button>
            </div>
            {undoLeft > 0 && (
              <button onClick={undo} data-testid="undo"
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink/20 bg-white py-3 text-[16px] font-bold">
                <Icon name="back" className="h-5 w-5" />{L.undo(undoLeft)}
              </button>
            )}

            {result.category === "unsafe" && (
              <div className="mt-4 rounded-2xl border-2 border-st-issue bg-orange-50 p-4" data-testid="helplines">
                <p className="text-[17px] font-bold text-st-issue">{L.unsafeTitle}</p>
                <div className="mt-3 grid grid-cols-2 gap-2.5">
                  <a href="tel:112" className="flex flex-col items-center rounded-xl bg-st-issue py-3 text-white"><Icon name="phone" className="h-7 w-7" /><span className="text-[22px] font-bold">112</span><span className="text-[13px]">{L.police}</span></a>
                  <a href="tel:181" className="flex flex-col items-center rounded-xl bg-white py-3 text-st-issue ring-2 ring-st-issue"><Icon name="phone" className="h-7 w-7" /><span className="text-[22px] font-bold">181</span><span className="text-[13px]">{L.women}</span></a>
                </div>
              </div>
            )}

            <details className="panel mt-4 p-4" data-testid="add-more">
              <summary className="cursor-pointer text-[15px] font-semibold text-river">{L.addMore}</summary>
              <div className="mt-3 space-y-3">
              {extraSaved ? <p className="flex items-center gap-2 font-semibold text-st-verified"><Icon name="tick" className="h-5 w-5" />{L.saved}</p> : (
                <>
                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-3">
                    <Icon name="camera" className="h-7 w-7 text-river" /><span className="font-semibold">{L.addPhoto}</span>
                    <input type="file" accept="image/*" capture="environment" className="sr-only"
                      onChange={async (e) => { const f = e.target.files?.[0]; if (f) setExtra({ ...extra, photo: await compressPhoto(f) }); }} />
                    {extra.photo && <img src={extra.photo} alt="" className="ml-auto h-12 w-12 rounded-lg object-cover" />}
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                    <Icon name="comment" className="h-7 w-7 shrink-0 text-river" />
                    <input className="w-full py-1.5 text-[15px] outline-none" placeholder={L.addComment} maxLength={140} value={extra.comment} onChange={(e) => setExtra({ ...extra, comment: e.target.value })} />
                  </label>
                  <label className="flex items-center gap-3 rounded-xl border border-line px-3 py-2">
                    <Icon name="phone" className="h-7 w-7 shrink-0 text-river" />
                    <input className="w-full py-1.5 text-[15px] outline-none" placeholder={L.addPhone} inputMode="tel" maxLength={14} value={extra.phone} onChange={(e) => setExtra({ ...extra, phone: e.target.value })} />
                  </label>
                  {(extra.photo || extra.comment || extra.phone) && <button className="btn-primary w-full py-3" onClick={saveExtra}>{L.save}</button>}
                </>
              )}
              </div>
            </details>

            {card.nearby.length > 0 && nearby}

            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <button className="btn-quiet py-3" onClick={() => { setResult(null); setExtra({ comment: "", phone: "", photo: null }); setExtraSaved(false); }}>
                <Icon name="back" className="h-5 w-5" />{L.back}
              </button>
              <a className="btn-quiet py-3" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}><Icon name="share" className="h-5 w-5" />WhatsApp</a>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
