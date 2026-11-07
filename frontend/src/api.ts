export type Role = "admin" | "supervisor" | "worker";
export type User = { id: number; name: string; username: string; role: Role; zone_id: number | null };
export type Status = "verified" | "issue" | "maintenance" | "unavailable" | "overdue";

export type Facility = {
  id: number; code: string; name_en: string; name_te: string;
  zone: { id: number; code: string; name_en: string };
  lat: number; lng: number; kind: string; operator: string; accessible: boolean;
  verify_window_min: number; unavailable_reason: string | null; reopen_at: string | null;
  last_verified_at: string | null; public_token?: string; staff_token?: string;
  status: Status; verified_age_min: number | null; overdue: boolean; water_ok: boolean; open_issue_count: number;
  queue: { level: "short" | "long" | "full"; age_min: number } | null;
};

export type Person = { id: number; name: string; username: string; role: Role } | null;
export type Issue = {
  id: number; category: string; priority: "P1" | "P2" | "P3"; state: string; source: string; report_count: number;
  facility: { id: number; code: string; name_en: string; name_te: string; zone_code: string };
  created_at: string; ack_at: string | null; assigned_at: string | null; started_at: string | null;
  resolved_at: string | null; closed_at: string | null;
  assignee: Person; resolver: Person; verifier: Person;
  resolution_note: string | null; resolved_offline: boolean; reopened_count: number; invalid_reason: string | null;
  minutes_to_resolve_due: number; ack_breached: boolean; resolve_breached: boolean; escalation_level: number;
};

const KEY = "ss_session";

export function session(): { token: string; user: User } | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}
export function setSession(s: { token: string; user: User }) {
  localStorage.setItem(KEY, JSON.stringify(s));
}
export function clearSession() {
  localStorage.removeItem(KEY);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const s = session();
  if (s) headers.Authorization = `Bearer ${s.token}`;
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method || (opts.body ? "POST" : "GET"),
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "No network connection.");
  }
  if (!res.ok) {
    let msg = res.status === 401
      ? "Could not reach the app's sign-in. On Codespaces, reopen the link from the Ports tab or make port 8000 public, then refresh."
      : `Request failed (${res.status}).`;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") msg = j.detail;
    } catch {
      /* keep default */
    }
    if (res.status === 401 && s) clearSession();
    throw new ApiError(res.status, msg);
  }
  const type = res.headers.get("content-type") || "";
  return (type.includes("json") ? res.json() : res.text()) as Promise<T>;
}

export async function downloadAuthed(path: string, filename: string) {
  const s = session();
  const res = await fetch(path, { headers: s ? { Authorization: `Bearer ${s.token}` } : {} });
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ago(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return formatMinutes(m) + " ago";
}

export function formatMinutes(m: number | null): string {
  if (m === null) return "—";
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min`;
}

export function clock(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function deviceKey(): string {
  let k = localStorage.getItem("ss_device");
  if (!k) {
    k = crypto.randomUUID();
    localStorage.setItem("ss_device", k);
  }
  return k;
}

export async function compressPhoto(file: File, max = 800): Promise<string> {
  const url = URL.createObjectURL(file);
  const img = new Image();
  await new Promise((ok, fail) => {
    img.onload = ok;
    img.onerror = fail;
    img.src = url;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(url);
  return canvas.toDataURL("image/jpeg", 0.6); // EXIF (including location) is dropped by re-encoding
}
