import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, clock, type Facility, type Issue } from "../../api";
import { ErrorNote, Freshness, StatusPill } from "../../components/ui";
import { usePoll } from "../../components/usePoll";
import { CATEGORY_EN } from "../../i18n";
import { STATE_LABEL } from "../../status";

type History = {
  facility: Facility;
  inspections: { id: number; worker: string; passed: boolean; water_ok: boolean; device_time: string; offline: boolean; flagged: boolean; flag_reason: string | null }[];
  issues: Issue[];
};

export default function Facilities() {
  const { data, error, reload } = usePoll<Facility[]>("/api/facilities");
  const [params, setParams] = useSearchParams();
  const id = Number(params.get("id")) || null;
  const [h, setH] = useState<History | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setH(null); return; }
    api<History>(`/api/facilities/${id}/history`).then(setH).catch((e) => setErr(e.message));
  }, [id, data]);

  async function availability(f: Facility, unavailable: boolean) {
    const reason = unavailable ? window.prompt("Why is this facility closed? (for example: flooding, locked, structural)") : null;
    if (unavailable && !reason) return;
    try {
      await api(`/api/facilities/${f.id}/availability`, { method: "PATCH", body: { unavailable, reason, reopen_in_hours: unavailable ? 3 : null } });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-bold">Facilities</h1>
      <ErrorNote message={error || err} />
      <div className="panel overflow-x-auto">
        <table className="w-full text-[14px]">
          <thead className="border-b border-line text-left text-ink-muted">
            <tr><th className="px-4 py-2.5 font-medium">Facility</th><th className="font-medium">Zone</th><th className="font-medium">Status</th><th className="font-medium">Last verified</th><th className="font-medium">Water</th><th className="font-medium">Operator</th><th className="pr-4" /></tr>
          </thead>
          <tbody>
            {(data || []).map((f) => (
              <tr key={f.id} className={`border-b border-line last:border-0 ${id === f.id ? "bg-river-light" : ""}`}>
                <td className="px-4 py-2.5"><button className="text-left hover:text-river" onClick={() => setParams({ id: String(f.id) })}><span className="font-semibold">{f.code}</span> {f.name_en}</button></td>
                <td>{f.zone.code}</td>
                <td><StatusPill status={f.status} small /></td>
                <td><Freshness age={f.verified_age_min} windowMin={f.verify_window_min} /></td>
                <td className={f.water_ok ? "" : "font-semibold text-st-issue"}>{f.water_ok ? "Yes" : "No"}</td>
                <td className="text-ink-muted">{f.operator}</td>
                <td className="pr-4 text-right">
                  {f.status === "unavailable"
                    ? <button className="text-[13px] text-river hover:underline" onClick={() => availability(f, false)}>Reopen</button>
                    : <button className="text-[13px] text-ink-muted hover:text-st-issue" onClick={() => availability(f, true)}>Mark closed</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {h && (
        <section className="grid gap-5 lg:grid-cols-2">
          <div className="panel p-5">
            <h2 className="text-[17px] font-semibold">Inspections · {h.facility.code}</h2>
            <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto text-[14px]">
              {h.inspections.map((x) => (
                <li key={x.id} className="flex justify-between gap-2 py-1.5">
                  <span>{new Date(x.device_time).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {x.worker}</span>
                  <span className={x.passed ? "text-st-verified" : "font-semibold text-st-issue"}>
                    {x.passed ? "Passed" : "Failed"}{x.offline && <span className="text-ink-muted font-normal"> · offline</span>}{x.flagged && <span className="text-st-overdue"> · flagged</span>}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="panel p-5">
            <h2 className="text-[17px] font-semibold">Issues · {h.issues.length} total</h2>
            <ul className="mt-3 max-h-96 divide-y divide-line overflow-y-auto text-[14px]">
              {h.issues.map((i) => (
                <li key={i.id} className="flex justify-between gap-2 py-1.5">
                  <span>{CATEGORY_EN[i.category]} · {new Date(i.created_at).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="text-ink-muted">{STATE_LABEL[i.state]}{i.closed_at && ` ${clock(i.closed_at)}`}{i.verifier && ` · by ${i.verifier.name}`}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}
