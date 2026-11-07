import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ago, api, clock, type Issue } from "../../api";
import { Empty, ErrorNote, Priority } from "../../components/ui";
import { usePoll } from "../../components/usePoll";
import { CATEGORY_EN } from "../../i18n";
import { ACTION_LABEL, STATE_LABEL } from "../../status";

type Detail = Issue & {
  reports: { ref_no: string; comment: string | null; lang: string; created_at: string; has_audio: boolean }[];
  timeline: { at: string; actor: string; action: string; detail: Record<string, unknown> }[];
};
type Worker = { id: number; name: string; zone_id: number | null; open_tasks: number };

function Timer({ i }: { i: Issue }) {
  if (["closed", "invalid", "awaiting_verification"].includes(i.state)) return <span className="text-ink-muted">—</span>;
  const m = i.minutes_to_resolve_due;
  return m < 0
    ? <span className="font-semibold text-st-issue">late by {Math.abs(m)} min</span>
    : <span>{m} min left</span>;
}

export default function Issues() {
  const [params, setParams] = useSearchParams();
  const [scope, setScope] = useState<"open" | "closed" | "all">("open");
  const { data, error, reload } = usePoll<Issue[]>(`/api/issues?scope=${scope}`, 10000);
  const selected = Number(params.get("id")) || null;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [worker, setWorker] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api<Worker[]>("/api/users?role=worker").then(setWorkers).catch(() => {}); }, []);
  useEffect(() => {
    if (!selected) { setDetail(null); return; }
    api<Detail>(`/api/issues/${selected}`).then(setDetail).catch((e) => setErr(e.message));
  }, [selected, data]);

  async function act(path: string, body?: unknown, done?: string) {
    setErr(null);
    setMsg(null);
    try {
      await api(`/api/issues/${selected}/${path}`, { method: "POST", body });
      setMsg(done || "Saved.");
      setReason("");
      setCode("");
      setWorker("");
      reload();
      api<Worker[]>("/api/users?role=worker").then(setWorkers).catch(() => {});
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[26px] font-bold">Problems</h1>
        <div className="flex overflow-hidden rounded-lg border border-line bg-white text-[14px]">
          {(["open", "closed", "all"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 font-semibold capitalize ${scope === s ? "bg-river text-white" : ""}`}>{s}</button>
          ))}
        </div>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="grid gap-5 xl:grid-cols-5">
        <div className="panel overflow-x-auto xl:col-span-3">
          {data && data.length === 0 ? (
            <div className="p-5"><Empty title="No issues here">New public reports appear in this list within seconds.</Empty></div>
          ) : (
            <table className="w-full text-[14px]">
              <thead className="border-b border-line text-left text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Priority</th><th className="font-medium">Facility</th><th className="font-medium">Problem</th>
                  <th className="font-medium">Reports</th><th className="font-medium">State</th><th className="font-medium">Assignee</th><th className="pr-4 font-medium">Timer</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((i) => (
                  <tr key={i.id} onClick={() => setParams({ id: String(i.id) })}
                    className={`cursor-pointer border-b border-line last:border-0 hover:bg-paper ${selected === i.id ? "bg-river-light" : ""}`}>
                    <td className="px-4 py-2.5"><Priority p={i.priority} /></td>
                    <td><span className="font-medium">{i.facility.code}</span> <span className="text-ink-muted">{i.facility.name_en}</span></td>
                    <td>{CATEGORY_EN[i.category]}</td>
                    <td>{i.report_count || "—"}</td>
                    <td>{STATE_LABEL[i.state]}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {["new", "acknowledged", "reopened"].includes(i.state) ? (
                        <select className="rounded-md border border-line bg-white px-1.5 py-1 text-[13px]" value="" data-testid="quick-assign"
                          aria-label={`Assign ${i.facility.code}`}
                          onChange={async (e) => {
                            try {
                              await api(`/api/issues/${i.id}/assign`, { body: { worker_id: Number(e.target.value) } });
                              reload();
                              api<Worker[]>("/api/users?role=worker").then(setWorkers).catch(() => {});
                            } catch (x) { setErr((x as Error).message); }
                          }}>
                          <option value="">Assign…</option>
                          {workers.map((w) => <option key={w.id} value={w.id}>{w.name} ({w.open_tasks})</option>)}
                        </select>
                      ) : (i.assignee?.name || "—")}
                    </td>
                    <td className="pr-4"><Timer i={i} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="xl:col-span-2">
          {!detail ? (
            <Empty title="Select an issue">Its timeline, evidence and next actions appear here.</Empty>
          ) : (
            <div className="panel space-y-4 p-5">
              <div>
                <div className="flex items-center gap-2"><Priority p={detail.priority} /><span className="text-[13px] text-ink-muted">Issue #{detail.id}</span></div>
                <h2 className="mt-1 text-[20px] font-bold">{CATEGORY_EN[detail.category]} at {detail.facility.code}</h2>
                <p className="text-[14px] text-ink-muted">{detail.facility.name_en} · {STATE_LABEL[detail.state]} · opened {ago(detail.created_at)}</p>
              </div>
              {detail.resolution_note && (
                <p className="rounded-lg bg-paper px-3 py-2 text-[14px]">
                  Fix by {detail.resolver?.name}: “{detail.resolution_note}”{detail.resolved_offline && <span className="text-ink-muted"> · captured offline</span>}
                </p>
              )}
              <ErrorNote message={err} />
              {msg && <p className="rounded-lg bg-green-50 px-3 py-2 text-[14px] text-st-verified">{msg}</p>}

              <div className="space-y-3">
                {["new", "reopened"].includes(detail.state) && (
                  <button className="btn-quiet" onClick={() => act("acknowledge", undefined, "Acknowledged.")}>Acknowledge</button>
                )}
                {["new", "acknowledged", "reopened", "assigned", "in_progress"].includes(detail.state) && (
                  <div className="flex gap-2">
                    <select className="field" value={worker} onChange={(e) => setWorker(e.target.value)} aria-label="Worker">
                      <option value="">Choose a worker…</option>
                      {workers.map((w) => <option key={w.id} value={w.id}>{w.name} · {w.open_tasks} open task(s)</option>)}
                    </select>
                    <button className="btn-primary" disabled={!worker} onClick={() => act("assign", { worker_id: Number(worker) }, "Assigned.")}>
                      {detail.assignee ? "Reassign" : "Assign"}
                    </button>
                  </div>
                )}
                {["new", "acknowledged", "reopened"].includes(detail.state) && (
                  <div className="flex gap-2">
                    <input className="field" placeholder="Reason, e.g. duplicate or prank" value={reason} onChange={(e) => setReason(e.target.value)} />
                    <button className="btn-danger" disabled={!reason.trim()} onClick={() => act("invalid", { reason }, "Marked invalid.")}>Mark invalid</button>
                  </div>
                )}
                {detail.state === "awaiting_verification" && (
                  <div className="rounded-lg border border-line p-3">
                    <p className="text-[14px] font-semibold">Verify on site</p>
                    <p className="text-[13px] text-ink-muted">Enter the staff code printed inside the toilet. The person who made the fix cannot verify it.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input className="field w-36 uppercase" placeholder="Staff code" value={code} onChange={(e) => setCode(e.target.value)} />
                      <button className="btn-primary" disabled={!code} onClick={() => act("verify", { staff_token: code, confirmed: true }, "Verified and closed.")}>Confirm fix</button>
                      <button className="btn-danger" disabled={!code} onClick={() => act("verify", { staff_token: code, confirmed: false }, "Sent back to the worker.")}>Not fixed</button>
                    </div>
                  </div>
                )}
              </div>

              {detail.reports.length > 0 && (
                <div>
                  <p className="label">Public reports</p>
                  <ul className="mt-1 text-[14px]">
                    {detail.reports.map((r) => (
                      <li key={r.ref_no} className="py-0.5">
                        {r.ref_no} · {clock(r.created_at)} · {({ te: "Telugu", hi: "Hindi", en: "English" } as Record<string, string>)[r.lang] || r.lang}{r.comment && ` · “${r.comment}”`}
                        {r.has_audio && (audio[r.ref_no]
                          ? <audio controls autoPlay src={audio[r.ref_no]} className="mt-1 h-9 w-full" data-testid="voice-player" />
                          : <button className="ml-2 rounded-md bg-river-light px-2 py-0.5 text-[13px] font-semibold text-river" data-testid="play-voice"
                              onClick={async () => { const a = await api<{ audio: string }>(`/api/reports/${r.ref_no}/audio`); setAudio((x) => ({ ...x, [r.ref_no]: a.audio })); }}>
                              ▶ Play voice complaint</button>)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="label">Timeline</p>
                <ol className="mt-2 space-y-2 border-l-2 border-line pl-4 text-[14px]">
                  {detail.timeline.map((t, k) => (
                    <li key={k}>
                      <span className="font-medium">{ACTION_LABEL[t.action] || t.action}</span>
                      <span className="text-ink-muted"> · {t.actor} · {clock(t.at)}</span>
                      {"worker" in t.detail && <span className="text-ink-muted"> · {String(t.detail.worker)}</span>}
                      {t.detail.offline === true && <span className="text-ink-muted"> · offline</span>}
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
