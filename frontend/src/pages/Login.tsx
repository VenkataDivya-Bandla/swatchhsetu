import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, setSession, type User } from "../api";
import { DemoStrip, ErrorNote, Wordmark } from "../components/ui";

const DEMO = [
  { u: "ravi", who: "Supervisor" },
  { u: "lakshmi", who: "Supervisor" },
  { u: "eswar", who: "Worker, City" },
  { u: "durga", who: "Worker, South" },
  { u: "anil", who: "Worker, North" },
  { u: "admin", who: "Admin" },
];

export default function Login() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ token: string; user: User }>("/api/auth/login", { body: { username, pin } });
      setSession(r);
      const next = params.get("next");
      nav(next && next !== "/login" ? next : r.user.role === "worker" ? "/w" : "/console", { replace: true });
    } catch (x) {
      setErr((x as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <DemoStrip />
      <main className="mx-auto max-w-sm px-5 py-12">
        <Wordmark />
        <h1 className="mt-8 text-[24px] font-bold">Staff sign in</h1>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="label">Username</span>
            <input className="field mt-1" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
          </label>
          <label className="block">
            <span className="label">PIN</span>
            <input className="field mt-1" type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} autoComplete="current-password" required />
          </label>
          <ErrorNote message={err} />
          <button className="btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="mt-8">
          <p className="label">Demo accounts, PIN 1234</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO.map((d) => (
              <button key={d.u} type="button" className="rounded-full border border-line bg-white px-3 py-1.5 text-[13px] hover:border-river"
                onClick={() => { setUsername(d.u); setPin("1234"); }}>
                <span className="font-semibold">{d.u}</span> <span className="text-ink-muted">{d.who}</span>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
