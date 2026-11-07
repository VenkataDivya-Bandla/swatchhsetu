import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { type Facility } from "../../api";
import { usePoll } from "../../components/usePoll";

function Qr({ text, label }: { text: string; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => { QRCode.toDataURL(text, { margin: 1, width: 220, color: { dark: "#1E2A32" } }).then(setSrc); }, [text]);
  return (
    <figure className="text-center">
      {src && <img src={src} alt={`${label} QR code`} className="mx-auto h-36 w-36" />}
      <figcaption className="mt-1 text-[12px] text-ink-muted">{label}</figcaption>
    </figure>
  );
}

export default function QrSheet() {
  const { data } = usePoll<Facility[]>("/api/facilities", 60000);
  const origin = window.location.origin;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-[26px] font-bold">QR codes</h1>
          <p className="max-w-2xl text-[14px] text-ink-muted">
            The public code goes on the entrance sign. The staff code goes inside the attendant cabin; scanning it with a phone
            camera opens the field app for that facility. Codes point to {origin}.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/console/signs" className="btn-primary">Printable signs with instructions</Link>
          <button className="btn-quiet" onClick={() => window.print()}>Print this sheet</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(data || []).map((f) => (
          <div key={f.id} className="panel break-inside-avoid p-4">
            <p className="font-semibold">{f.code} · {f.name_en}</p>
            <p className="text-[13px] text-ink-muted">{f.name_te}</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Qr text={`${origin}/f/${f.public_token}`} label="Public · report a problem" />
              <Qr text={`${origin}/w/s/${f.staff_token}`} label={`Staff · code ${f.staff_token}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
