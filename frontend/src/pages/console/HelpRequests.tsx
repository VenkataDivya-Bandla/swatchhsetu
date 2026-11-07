import { useState } from "react";
import { api, clock, formatMinutes } from "../../api";
import { Icon } from "../../components/icons";
import { Empty, ErrorNote } from "../../components/ui";
import { usePoll } from "../../components/usePoll";
import { HELP_ICON } from "../../i18n";

type Help = {
  id: number; kind: string; label: string; note: string | null; state: "open" | "acknowledged" | "done";
  facility: { id: number; code: string; name_en: string }; requested_by: { name: string } | null;
  handled_by: { name: string } | null; created_at: string; ack_at: string | null; done_at: string | null; age_min: number;
};

const STATE: Record<string, string> = { open: "New", acknowledged: "On the way", done: "Done" };

export default function HelpRequests() {
  const [scope, setScope] = useState<"open" | "all">("open");
  const { data, error, reload } = usePoll<Help[]>(`/api/help?scope=${scope}`, 10000);
  const [err, setErr] = useState<string | null>(null);
  async function act(id: number, action: "acknowledge" | "done") {
    try {
      await api(`/api/help/${id}/${action}`, { method: "POST" });
      reload();
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-bold">Help requests</h1>
          <p className="max-w-2xl text-[14px] text-ink-muted">Things workers cannot fix themselves: water supply, plumbing, supplies, crowding. Route them to the right team so workers are not blamed for them.</p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-line bg-white text-[14px]">
          {(["open", "all"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 font-semibold capitalize ${scope === s ? "bg-river text-white" : ""}`}>{s}</button>
          ))}
        </div>
      </div>
      <ErrorNote message={error || err} />
      {data && data.length === 0 && <Empty title="No open help requests">When a worker taps “I need help”, it appears here within seconds.</Empty>}
      <ul className="grid gap-3 md:grid-cols-2">
        {(data || []).map((h) => (
          <li key={h.id} className={`panel flex gap-4 p-4 ${h.state === "open" ? "border-marigold" : ""}`} data-testid="help-card">
            <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${h.state === "done" ? "bg-paper text-ink-muted" : "bg-marigold-light text-marigold-deep"}`}>
              <Icon name={HELP_ICON[h.kind]} className="h-8 w-8" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] font-bold">{h.label} · {h.facility.code}</p>
              <p className="text-[14px] text-ink-muted">{h.facility.name_en} · asked by {h.requested_by?.name} · {formatMinutes(h.age_min)} ago</p>
              {h.note && <p className="mt-1 text-[14px]">“{h.note}”</p>}
              <p className="mt-1 text-[13px]">
                <span className="font-semibold">{STATE[h.state]}</span>
                {h.handled_by && <span className="text-ink-muted"> · {h.handled_by.name}</span>}
                {h.done_at && <span className="text-ink-muted"> · {clock(h.done_at)}</span>}
              </p>
              <div className="mt-3 flex gap-2">
                {h.state === "open" && <button className="btn-quiet py-1.5" onClick={() => act(h.id, "acknowledge")}>Acknowledge</button>}
                {h.state !== "done" && <button className="btn-primary py-1.5" onClick={() => act(h.id, "done")}>Mark done</button>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
