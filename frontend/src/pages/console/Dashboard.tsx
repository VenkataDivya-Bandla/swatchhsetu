import { Link } from "react-router-dom";
import { formatMinutes } from "../../api";
import { ErrorNote } from "../../components/ui";
import { usePoll } from "../../components/usePoll";

type Summary = {
  total_facilities: number; verified: number; overdue: number; water_unavailable: number; unavailable: number;
  open_issues: number; open_by_priority: Record<string, number>; reports_today: number; workers_on_shift: number;
  tasks_open: number; tasks_overdue: number; awaiting_verification: number; help_open: number; crowded: number;
  zones: { code: string; name: string; facilities: number; verified: number; overdue: number; open_p1: number; oldest_open_min: number | null }[];
  attention: { kind: string; text: string; breached?: boolean; issue_id?: number; facility_id?: number; help_id?: number }[];
};

function Tile({ label, value, sub, tone, to }: { label: string; value: number | string; sub?: string; tone?: string; to: string }) {
  return (
    <Link to={to} className="panel block p-4 hover:border-river">
      <p className="label">{label}</p>
      <p className={`mt-1 text-[30px] font-bold leading-none ${tone || ""}`}>{value}</p>
      {sub && <p className="mt-2 text-[13px] text-ink-muted">{sub}</p>}
    </Link>
  );
}

const KIND_DOT: Record<string, string> = { issue: "bg-st-issue", overdue: "bg-st-overdue", repeat: "bg-marigold", help: "bg-marigold-deep", queue: "bg-st-maintenance" };

export default function Dashboard() {
  const { data: d, error, updated } = usePoll<Summary>("/api/dashboard/summary");
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-[26px] font-bold">Operations dashboard</h1>
          <p className="text-[14px] text-ink-muted">All zones{d && ` · ${d.total_facilities} toilets, ${d.unavailable} closed · ${d.workers_on_shift} workers, ${d.tasks_open} on a task`} · updates every 15 s{updated && ` · ${updated.toLocaleTimeString()}`}</p>
        </div>
      </div>
      {error && d && <ErrorNote message={`Showing data from ${updated?.toLocaleTimeString()}. ${error}`} />}
      {!d && !error && <p className="text-ink-muted">Loading…</p>}
      {!d && error && <ErrorNote message={error} />}
      {d && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Tile label="Toilets usable now" value={d.verified} sub={`of ${d.total_facilities} · checked recently`} tone="text-st-verified" to="/console/map" />
            <Tile label="Not checked recently" value={d.overdue} sub="send someone to check" tone={d.overdue ? "text-st-overdue" : ""} to="/console/facilities" />
            <Tile label="Problems open" value={d.open_issues} sub={d.open_by_priority.P1 ? `${d.open_by_priority.P1} urgent` : "none urgent"} tone={d.open_by_priority.P1 ? "text-st-issue" : ""} to="/console/issues" />
            <Tile label="Fixes to confirm" value={d.awaiting_verification} sub="a second person must check" to="/console/issues" />
            <Tile label="Need help or crowded" value={d.help_open + d.crowded} sub={`${d.help_open} help · ${d.crowded} crowded`} tone={d.help_open + d.crowded ? "text-marigold-deep" : ""} to="/console/help" />
            <Tile label="No water" value={d.water_unavailable} tone={d.water_unavailable ? "text-st-issue" : ""} to="/console/map" />
          </div>
          <div className="grid gap-6 lg:grid-cols-5">
            <section className="panel p-5 lg:col-span-3">
              <h2 className="text-[17px] font-semibold">Attention now</h2>
              {d.attention.length === 0 ? (
                <p className="mt-3 text-[14px] text-ink-muted">Nothing needs attention. Every facility is checked and no issue is late.</p>
              ) : (
                <ul className="mt-3 divide-y divide-line">
                  {d.attention.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 py-2.5">
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${KIND_DOT[a.kind]}`} />
                      <Link to={a.help_id ? "/console/help" : a.issue_id ? `/console/issues?id=${a.issue_id}` : `/console/facilities?id=${a.facility_id}`} className="text-[15px] hover:text-river">
                        {a.text}{a.breached && <span className="ml-2 rounded bg-st-issue px-1.5 py-0.5 text-[11px] font-bold text-white">late</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="panel overflow-x-auto p-5 lg:col-span-2">
              <h2 className="text-[17px] font-semibold">Zones</h2>
              <table className="mt-3 w-full text-[14px]">
                <thead className="text-left text-ink-muted">
                  <tr><th className="py-1 font-medium">Zone</th><th className="font-medium">Verified</th><th className="font-medium">Overdue</th><th className="font-medium">P1</th><th className="font-medium">Oldest open</th></tr>
                </thead>
                <tbody>
                  {d.zones.map((z) => (
                    <tr key={z.code} className="border-t border-line">
                      <td className="py-2 font-medium">{z.name}</td>
                      <td>{z.verified}/{z.facilities}</td>
                      <td className={z.overdue ? "font-semibold text-st-overdue" : ""}>{z.overdue}</td>
                      <td className={z.open_p1 ? "font-semibold text-st-issue" : ""}>{z.open_p1}</td>
                      <td>{formatMinutes(z.oldest_open_min)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
