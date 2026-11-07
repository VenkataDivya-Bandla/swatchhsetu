import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { DemoStrip, Wordmark } from "../components/ui";

type Link_ = { code: string; name_en: string; public_token: string };

export default function Landing() {
  const [links, setLinks] = useState<Link_[]>([]);
  useEffect(() => {
    api<Link_[]>("/api/public/demo-facilities").then(setLinks).catch(() => setLinks([]));
  }, []);
  return (
    <div className="min-h-screen">
      <DemoStrip />
      <main className="mx-auto max-w-3xl px-5 py-10">
        <Wordmark />
        <h1 className="mt-8 text-[34px] font-bold leading-tight tracking-tight">
          A toilet shows green only if someone checked it recently, and a fix counts only when someone else confirms it.
        </h1>
        <p className="mt-4 max-w-2xl text-[17px] text-ink-muted">
          Working prototype for RTIH PS-06, Smart Sanitation and Public Toilet Monitoring, prepared for
          Rajamahendravaram Municipal Corporation ahead of Godavari Pushkaralu 2027.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/login" className="btn-primary">Staff sign in</Link>
          {links[8] && <Link to={`/f/${links[8].public_token}`} className="btn-quiet">Open a public QR page</Link>}
        </div>

        <section className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="panel p-5">
            <h2 className="font-semibold">Demo accounts (PIN 1234)</h2>
            <dl className="mt-3 space-y-1.5 text-[14px]">
              <div className="flex justify-between"><dt>ravi</dt><dd className="text-ink-muted">Supervisor, South and City</dd></div>
              <div className="flex justify-between"><dt>lakshmi</dt><dd className="text-ink-muted">Supervisor, North</dd></div>
              <div className="flex justify-between"><dt>eswar, durga, anil…</dt><dd className="text-ink-muted">Workers</dd></div>
              <div className="flex justify-between"><dt>admin</dt><dd className="text-ink-muted">Administrator</dd></div>
            </dl>
          </div>
          <div className="panel p-5">
            <h2 className="font-semibold">Public QR pages</h2>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[14px]">
              {links.map((l) => (
                <li key={l.code}><Link className="text-river underline-offset-2 hover:underline" to={`/f/${l.public_token}`}>{l.code}</Link></li>
              ))}
            </ul>
          </div>
        </section>
        <p className="mt-10 text-[13px] text-ink-muted">
          All facilities, people and records are fictional. No RMC data is used. Not a live municipal service.
        </p>
      </main>
    </div>
  );
}
