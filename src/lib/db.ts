// PrivacyGuard — embedded local database.
// Schema mirrors the native build's SQLite layout 1:1, stored in IndexedDB so
// everything stays on-device. No cloud backend, no telemetry — ever.

export interface StoredConn {
  ts: number; appId: string; appName: string; destIp: string; domain: string | null;
  port: number; proto: string; up: number; down: number; verdict: string;
  reasons: string; scope: string; sim: 0 | 1;
}
export interface StoredDns {
  ts: number; appName: string; domain: string; rtype: string; status: string;
  answers: string; latency: number; cached: 0 | 1; blockedBy: string | null; sim: 0 | 1;
}

const DB_NAME = "privacyguard";
const DB_VER = 1;

let db: IDBDatabase | null = null;

export function initDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("events")) {
        const s = d.createObjectStore("events", { autoIncrement: true });
        s.createIndex("ts", "ts");
      }
      if (!d.objectStoreNames.contains("dns")) {
        const s = d.createObjectStore("dns", { autoIncrement: true });
        s.createIndex("ts", "ts");
      }
      if (!d.objectStoreNames.contains("kv")) d.createObjectStore("kv");
      if (!d.objectStoreNames.contains("notifs")) {
        const s = d.createObjectStore("notifs", { autoIncrement: true });
        s.createIndex("ts", "ts");
      }
      if (!d.objectStoreNames.contains("reports")) {
        const s = d.createObjectStore("reports", { autoIncrement: true });
        s.createIndex("ts", "ts");
      }
    };
    req.onsuccess = () => { db = req.result; resolve(); };
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!db) return reject(new Error("db not ready"));
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    const r = fn(s);
    t.oncomplete = () => resolve(r.result);
    t.onerror = () => reject(t.error);
  });
}

/* ---- buffered event writes: the engine streams events, we flush in batches ---- */
let eventBuf: StoredConn[] = [];
let dnsBuf: StoredDns[] = [];

export function bufferEvent(e: StoredConn) { eventBuf.push(e); }
export function bufferDns(e: StoredDns) { dnsBuf.push(e); }

export async function flush(): Promise<void> {
  if (!db) { eventBuf = []; dnsBuf = []; return; }
  const evs = eventBuf; eventBuf = [];
  const dns = dnsBuf; dnsBuf = [];
  if (!evs.length && !dns.length) return;
  await new Promise<void>((resolve, reject) => {
    const t = db!.transaction(["events", "dns"], "readwrite");
    for (const e of evs) t.objectStore("events").add(e);
    for (const d of dns) t.objectStore("dns").add(d);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function allEvents(): Promise<StoredConn[]> {
  return tx("events", "readonly", (s) => s.getAll() as IDBRequest<StoredConn[]>);
}
export async function allDns(): Promise<StoredDns[]> {
  return tx("dns", "readonly", (s) => s.getAll() as IDBRequest<StoredDns[]>);
}
export async function countStore(store: string): Promise<number> {
  return tx(store, "readonly", (s) => s.count());
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const v = await tx("kv", "readonly", (s) => s.get(key) as IDBRequest<T>);
  return v === null ? undefined : v;
}
export async function kvSet(key: string, value: unknown): Promise<void> {
  await tx("kv", "readwrite", (s) => s.put(value as never, key));
}

export interface StoredNotif { ts: number; kind: string; title: string; body: string }
export async function saveNotif(n: StoredNotif): Promise<void> {
  await tx("notifs", "readwrite", (s) => s.add(n as never));
}
export async function allNotifs(): Promise<StoredNotif[]> {
  return tx("notifs", "readonly", (s) => s.getAll() as IDBRequest<StoredNotif[]>);
}

export interface StoredReport { ts: number; label: string; payload: string }
export async function saveReport(r: StoredReport): Promise<void> {
  await tx("reports", "readwrite", (s) => s.add(r as never));
}
export async function allReports(): Promise<StoredReport[]> {
  return tx("reports", "readonly", (s) => s.getAll() as IDBRequest<StoredReport[]>);
}

export async function clearStore(store: string): Promise<void> {
  await tx(store, "readwrite", (s) => s.clear());
}

export async function pruneEvents(olderThan: number): Promise<void> {
  if (!db) return;
  await new Promise<void>((resolve, reject) => {
    const t = db!.transaction(["events", "dns"], "readwrite");
    for (const storeName of ["events", "dns"] as const) {
      const idx = t.objectStore(storeName).index("ts");
      const range = IDBKeyRange.upperBound(olderThan);
      const cur = idx.openCursor(range);
      cur.onsuccess = () => {
        const c = cur.result;
        if (c) { c.delete(); c.continue(); }
      };
    }
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function wipeAll(): Promise<void> {
  for (const s of ["events", "dns", "notifs", "reports", "kv"]) await clearStore(s);
}
