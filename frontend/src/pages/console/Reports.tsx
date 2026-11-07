import { useState } from "react";
import { api, clock, downloadAuthed } from "../../api";
import { ErrorNote } from "../../components/ui";
import { usePoll } from "../../components/usePoll";
import { ACTION_LABEL } from "../../status";

type Summary = {
  window_hours: number; inspections: number; inspections_offline: number; inspections_flagged: number;
  freshness_now_pct: number | null; issues_created: number; issues_closed: number; median_ack_min: number | null;
  median_close_min: number | null; median_p1_close_min: number | null; independent_verification_pct: number | null;
  reopen_pct: number | null; repeat_issues: { facility: string; category: string; count: number }[];
  workers: { name: string; inspections: number; offline_inspections: number; flagged: number; fixes: number; verifications: number }[];
};
type AuditRow = { id: number; at: string; actor: string; action: string; entity: string; entity_id: number | null; hash: string };

function Metric({ label, value, unit = "" }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="panel p-4">
      <p className="label">{label}</p>
      <p className="mt-1 text-[26px] font-bold">{value === null ? "—" : `${value}${unit}`}</p>
    </div>
  );
}

export default function Reports() {
  const { data: r, error } = usePoll<Summary>("/api/reports/summary?hours=72", 30000);
  const { data: trail, reload } = usePoll<AuditRow[]>("/api/audit?limit=60", 15000);
  const [chain, setChain] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function verifyChain() {
    const v = await api<{ valid: boolean; rows_checked: number; chain_head?: string }>("/api/audit/verify");
    setChain(v.valid ? `Intact: ${v.rows_checked} rows checked. Chain head ${v.chain_head?.slice(0, 16)}…` : `Broken: tampering detected after ${v.rows_checked} rows.`);
  }
  async function reset() {
    if (!window.confirm("Restore the original demo data? All changes made during this session will be lost.")) return;
    const res = await api<{ message: string }>("/api/demo/reset", { method: "POST" });
    setNote(res.message);
    reload();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold">Reports and audit</h1>
          <p className="text-[14px] text-ink-muted">Last 72 hours · synthetic data</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-quiet" onClick={() => downloadAuthed("/api/reports/issues.csv", "swachhsetu-issues.csv")}>Download issues CSV</button>
          <button className="btn-quiet" onClick={() => window.print()}>Print or save as PDF</button>
          <button className="btn-danger" onClick={reset}>Reset demo data</button>
        </div>
      </div>
      <ErrorNote message={error} />
      {note && <p className="rounded-lg bg-green-50 px-3 py-2 text-[14px] text-st-verified">{note}</p>}
      {r && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label="Facilities verified within window now" value={r.freshness_now_pct} unit="%" />
            <Metric label="Median time to acknowledge" value={r.median_ack_min} unit=" min" />
            <Metric label="Median time to verified closure" value={r.median_close_min} unit=" min" />
            <Metric label="Median P1 closure" value={r.median_p1_close_min} unit=" min" />
            <Metric label="Closures verified by a second person" value={r.independent_verification_pct} unit="%" />
            <Metric label="Issues reopened" value={r.reopen_pct} unit="%" />
            <Metric label="Inspections (offline / flagged)" value={r.inspections} unit={` (${r.inspections_offline} / ${r.inspections_flagged})`} />
            <Metric label="Issues created / closed" value={r.issues_created} unit={` / ${r.issues_closed}`} />
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="panel overflow-x-auto p-5">
              <h2 className="text-[17px] font-semibold">Worker task history</h2>
              <table className="mt-3 w-full text-[14px]">
                <thead className="text-left text-ink-muted"><tr><th className="py-1 font-medium">Worker</th><th className="font-medium">Inspections</th><th className="font-medium">Offline</th><th className="font-medium">Flagged</th><th className="font-medium">Fixes</th><th className="font-medium">Verified</th></tr></thead>
                <tbody>{r.workers.map((w) => (
                  <tr key={w.name} className="border-t border-line"><td className="py-1.5 font-medium">{w.name}</td><td>{w.inspections}</td><td>{w.offline_inspections}</td><td>{w.flagged}</td><td>{w.fixes}</td><td>{w.verifications}</td></tr>
                ))}</tbody>
              </table>
            </section>
            <section className="panel p-5">
              <h2 className="text-[17px] font-semibold">Repeat issues</h2>
              {r.repeat_issues.length === 0 ? <p className="mt-3 text-[14px] text-ink-muted">No facility had three or more issues of one kind.</p> : (
                <ul className="mt-3 space-y-1 text-[14px]">{r.repeat_issues.map((x) => <li key={x.facility + x.category}><b>{x.facility}</b> · {x.count} “{x.category}” issues</li>)}</ul>
              )}
            </section>
          </div>
        </>
      )}
      <section className="panel p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold">Audit trail</h2>
          <button className="btn-quiet" onClick={verifyChain}>Check audit chain</button>
        </div>
        {chain && <p className={`mt-2 text-[14px] font-medium ${chain.startsWith("Intact") ? "text-st-verified" : "text-st-issue"}`}>{chain}</p>}
        <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto text-[14px]">
          {(trail || []).map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-1.5">
              <span><span className="font-medium">{ACTION_LABEL[a.action] || a.action}</span> · {a.entity} {a.entity_id ?? ""} · {a.actor}</span>
              <span className="text-ink-muted">{clock(a.at)} · #{a.hash}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
