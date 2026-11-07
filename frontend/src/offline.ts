import { openDB, type DBSchema } from "idb";
import { api } from "./api";

export type OutboxRecord = {
  client_uuid: string;
  kind: "inspection" | "start" | "resolve" | "help" | "queue";
  help_kind?: string;
  queue_level?: "short" | "long" | "full";
  device_time: string;
  offline: boolean;
  staff_token?: string;
  scan_method?: "qr" | "manual";
  issue_id?: number;
  answers?: Record<string, boolean>;
  note?: string;
  photo?: string;
  label: string; // shown in the outbox, not sent
  created: number;
};
export type SyncResult = { client_uuid: string; result: string; detail: string | null; label?: string };

interface SwachhDB extends DBSchema {
  outbox: { key: string; value: OutboxRecord; indexes: { created: number } };
  cache: { key: string; value: unknown };
}

const dbp = openDB<SwachhDB>("swachhsetu", 1, {
  upgrade(db) {
    const s = db.createObjectStore("outbox", { keyPath: "client_uuid" });
    s.createIndex("created", "created");
    db.createObjectStore("cache");
  },
});

function notify() {
  window.dispatchEvent(new Event("ss-outbox"));
}

export async function queue(rec: Omit<OutboxRecord, "client_uuid" | "created" | "offline" | "device_time">) {
  const full: OutboxRecord = {
    ...rec,
    client_uuid: crypto.randomUUID(),
    created: Date.now(),
    device_time: new Date().toISOString(),
    offline: !navigator.onLine,
  };
  await (await dbp).put("outbox", full); // saved on the phone before anything is shown as done
  notify();
  return full;
}

export async function outbox(): Promise<OutboxRecord[]> {
  return (await dbp).getAllFromIndex("outbox", "created");
}

export async function cacheSet(key: string, value: unknown) {
  await (await dbp).put("cache", value, key);
}
export async function cacheGet<T>(key: string): Promise<T | undefined> {
  return (await (await dbp).get("cache", key)) as T | undefined;
}

let syncing = false;
export async function syncNow(): Promise<SyncResult[] | null> {
  if (syncing || !navigator.onLine) return null;
  syncing = true;
  try {
    const items = (await outbox()).slice(0, 50);
    if (!items.length) return [];
    const records = items.map(({ label: _l, created: _c, ...r }) => r);
    const res = await api<{ results: SyncResult[] }>("/api/sync/batch", { body: { records } });
    const db = await dbp;
    const labels = Object.fromEntries(items.map((i) => [i.client_uuid, i.label]));
    for (const r of res.results) await db.delete("outbox", r.client_uuid);
    const results = res.results.map((r) => ({ ...r, label: labels[r.client_uuid] }));
    const log = ((await cacheGet<SyncResult[]>("syncLog")) || []).slice(0, 30);
    await cacheSet("syncLog", [...results.reverse(), ...log]);
    notify();
    return results;
  } catch {
    return null; // still offline or server unreachable: records stay in the outbox
  } finally {
    syncing = false;
  }
}
