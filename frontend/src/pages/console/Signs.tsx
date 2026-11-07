import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { type Facility } from "../../api";
import { Icon } from "../../components/icons";
import { usePoll } from "../../components/usePoll";

/** One printable A4 sign per facility. Teaches scanning in pictures, and helps people without phones. */

function distance(a: Facility, b: Facility) {
  const r = 6371000, p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1, dl = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}
function bearing(a: Facility, b: Facility) {
  const p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180, dl = ((b.lng - a.lng) * Math.PI) / 180;
  const x = Math.sin(dl) * Math.cos(p2), y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
const fmt = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);

const STEPS = [
  { icon: "camera", te: "కెమెరా తెరవండి", hi: "कैमरा खोलें", en: "Open the camera" },
  { icon: "scan", te: "కోడ్ వైపు చూపండి", hi: "कोड की ओर करें", en: "Point at the code" },
  { icon: "hand", te: "వచ్చిన లింక్ నొక్కండి", hi: "आया लिंक दबाएँ", en: "Tap the link" },
];

function Sign({ f, all }: { f: Facility; all: Facility[] }) {
  const [qr, setQr] = useState("");
  const url = `${window.location.origin}/f/${f.public_token}`;
  useEffect(() => { QRCode.toDataURL(url, { margin: 1, width: 600, color: { dark: "#1E2A32" } }).then(setQr); }, [url]);
  const near = all.filter((o) => o.id !== f.id && o.status !== "unavailable")
    .map((o) => ({ o, d: distance(f, o), b: bearing(f, o) })).sort((x, y) => x.d - y.d).slice(0, 2);

  return (
    <article className="mx-auto mb-8 flex w-[760px] max-w-full flex-col overflow-hidden rounded-2xl border-2 border-ink bg-white print:mb-0 print:h-[277mm] print:w-full print:rounded-none print:border-0"
      style={{ breakAfter: "page" }} data-testid="sign">
      <header className="bg-river px-6 py-4 text-white">
        <p className="text-[30px] font-bold leading-tight">సమస్య ఉందా? స్కాన్ చేయండి</p>
        <p className="text-[22px] font-semibold">समस्या है? स्कैन करें · Problem here? Scan</p>
      </header>

      <div className="flex items-start justify-between gap-4 px-6 pt-4">
        <div>
          <p className="text-[22px] font-bold leading-tight">{f.name_te}</p>
          <p className="text-[16px] text-ink-muted">{f.name_en}</p>
        </div>
        <div className="text-right">
          <p className="text-[12px] text-ink-muted">కోడ్ · कोड · Code</p>
          <p className="text-[40px] font-bold leading-none tracking-wide">{f.code}</p>
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] items-center gap-5 px-6 pt-4">
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <div key={s.icon} className="flex items-center gap-3">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-river-light text-river">
                <Icon name={s.icon} className="h-10 w-10" strokeWidth={2} />
              </span>
              <span className="text-[24px] font-bold text-river">{i + 1}</span>
              <span className="leading-tight">
                <span className="block text-[17px] font-bold">{s.te}</span>
                <span className="block text-[14px]">{s.hi} · {s.en}</span>
              </span>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-xl bg-orange-50 px-3 py-2">
            <Icon name="payX" className="h-9 w-9 shrink-0 text-st-issue" />
            <span className="text-[13px] leading-tight"><b>GPay / PhonePe తో తెరవదు</b><br />GPay / PhonePe से नहीं खुलेगा · will not open it</span>
          </div>
        </div>
        {qr && <img src={qr} alt={`QR code for ${f.code}`} className="h-[260px] w-[260px] rounded-xl border-4 border-ink p-1" />}
      </div>

      <div className="mx-6 mt-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
          <Icon name="speaker" className="h-9 w-9 shrink-0 text-river" />
          <span className="text-[13px] leading-tight"><b>పేజీ మాట్లాడుతుంది, మాటలతో ఫిర్యాదు చేయవచ్చు</b><br />पेज बोलता है, बोलकर शिकायत करें · The page speaks; you can complain by voice</span>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
          <Icon name="attendant" className="h-9 w-9 shrink-0 text-river" />
          <span className="text-[13px] leading-tight"><b>ఫోన్ లేదా? సిబ్బందికి చెప్పండి</b><br />फ़ोन नहीं? कर्मचारी को बताएँ · No phone? Tell the attendant<br />
            <span className="font-semibold">RMC helpline: [number to be added] · code {f.code}</span></span>
        </div>
      </div>

      <div className="mx-6 mt-4 rounded-xl bg-paper px-4 py-3">
        <p className="text-[15px] font-bold">ఇతర మరుగుదొడ్లు · दूसरे शौचालय · Other toilets</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {near.map(({ o, d, b }) => (
            <div key={o.id} className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                <Icon name="arrow" className="h-7 w-7" strokeWidth={2.6} style={{ transform: `rotate(${b}deg)` }} />
              </span>
              <span className="leading-tight">
                <span className="block text-[20px] font-bold">{fmt(d)}</span>
                <span className="block text-[13px]">{o.code} · {o.name_te}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-muted">Arrow direction assumes the sign faces north; set it when the sign is mounted.</p>
      </div>

      <footer className="mt-auto flex items-center justify-between px-6 py-3 text-[11px] text-ink-muted">
        <span>SwachhSetu · Rajamahendravaram Municipal Corporation</span>
        <span>DEMO — synthetic data</span>
      </footer>
    </article>
  );
}

export default function Signs() {
  const { data } = usePoll<Facility[]>("/api/facilities", 60000);
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-[26px] font-bold">Printable signs</h1>
          <p className="max-w-2xl text-[14px] text-ink-muted">
            One A4 sign per facility, for the entrance. It teaches scanning in pictures, says that payment apps will not open it,
            tells people without phones what to do, and points to the two nearest toilets. Print on weather-resistant stock.
          </p>
        </div>
        <button className="btn-primary" onClick={() => window.print()}>Print all signs</button>
      </div>
      {(data || []).map((f) => <Sign key={f.id} f={f} all={data || []} />)}
    </div>
  );
}
