import { useState } from "react";
import { Link } from "react-router-dom";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { type Facility, type Status } from "../../api";
import { ErrorNote, Freshness, StatusPill } from "../../components/ui";
import { usePoll } from "../../components/usePoll";
import { STATUS } from "../../status";

const ORDER: Status[] = ["verified", "issue", "maintenance", "unavailable", "overdue"];

export default function MapView() {
  const { data, error } = usePoll<Facility[]>("/api/facilities");
  const [hide, setHide] = useState<Set<Status>>(new Set());
  const [waterOnly, setWaterOnly] = useState(false);
  const shown = (data || []).filter((f) => !hide.has(f.status) && (!waterOnly || !f.water_ok));
  const toggle = (s: Status) => setHide((h) => { const n = new Set(h); n.has(s) ? n.delete(s) : n.add(s); return n; });

  return (
    <div className="space-y-4">
      <h1 className="text-[26px] font-bold">Facility map</h1>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {ORDER.map((s) => (
          <button key={s} onClick={() => toggle(s)} aria-pressed={!hide.has(s)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${hide.has(s) ? "border-line bg-white text-ink-muted line-through" : "bg-white"}`}
            style={hide.has(s) ? {} : { borderColor: STATUS[s].hex, color: STATUS[s].hex }}>
            {STATUS[s].label} · {(data || []).filter((f) => f.status === s).length}
          </button>
        ))}
        <button onClick={() => setWaterOnly(!waterOnly)} aria-pressed={waterOnly}
          className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${waterOnly ? "border-st-issue text-st-issue" : "border-line"}`}>
          No water only
        </button>
      </div>
      {error && <ErrorNote message={error} />}
      <div className="panel overflow-hidden">
        <MapContainer center={[17.0003, 81.7815]} zoom={15} style={{ height: "68vh", minHeight: 380 }} scrollWheelZoom>
          <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {shown.map((f) => (
            <CircleMarker key={f.id} center={[f.lat, f.lng]} radius={f.status === "issue" || f.status === "maintenance" ? 13 : 10}
              pathOptions={{ color: STATUS[f.status].hex, fillColor: STATUS[f.status].hex, fillOpacity: f.status === "overdue" ? 0.15 : 0.7, weight: 3, dashArray: f.status === "overdue" ? "4 4" : undefined }}>
              <Popup>
                <div className="space-y-1.5 text-[13px]">
                  <p className="text-[15px] font-semibold">{f.name_en}</p>
                  <p className="text-ink-muted">{f.code} · {f.zone.name_en} · {f.operator}</p>
                  <StatusPill status={f.status} small />
                  <p>Last checked: <Freshness age={f.verified_age_min} windowMin={f.verify_window_min} /></p>
                  {!f.water_ok && <p className="font-semibold text-st-issue">No water</p>}
                  {f.queue && <p className={f.queue.level === "short" ? "" : "font-semibold text-marigold-deep"}>Queue: {f.queue.level} ({f.queue.age_min} min ago)</p>}
                  {f.open_issue_count > 0 && <p>{f.open_issue_count} open issue(s)</p>}
                  <Link to={`/console/facilities?id=${f.id}`} className="text-river underline">View history</Link>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>
      <p className="text-[13px] text-ink-muted">Facility positions are synthetic. A dashed ring means nobody has verified the facility within its window.</p>
    </div>
  );
}
