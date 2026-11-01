import { create } from "zustand";
import type {
  AppProfile, AutomationRule, ConnEvent, DnsEvent, FwRule, ListCategory, Notif,
  PageId, Policy, RuntimeApp, Settings, ToastMsg, AICategory,
} from "./core";
import { APP_CATALOG, BUNDLED_LISTS } from "./catalog";
import { uid } from "./core";

const LS_KEY = "privacyguard.v1";

interface Persisted {
  settings: Settings;
  policies: Record<string, { policy: Policy; tempUntil: number | null; category: AICategory; userClassified: boolean }>;
  customApps: AppProfile[];
  fwRules: FwRule[];
  automation: AutomationRule[];
  allowlist: string[];
  denylist: string[];
  customList: string[];
  listEnabled: Record<ListCategory, boolean>;
  listUpdated: Record<ListCategory, number | null>;
  pendingAllowedIds: string[];
  seenNotifications: number;
}

export interface Counters {
  upTotal: number;
  downTotal: number;
  blockedTotal: number;
  allowedTotal: number;
  adsBlocked: number;
  trackersBlocked: number;
  sessionStart: number;
}

interface Store {
  page: PageId;
  search: string;
  booted: boolean;
  drawerConn: ConnEvent | null;
  notifOpen: boolean;
  installGuideOpen: boolean;
  setInstallGuideOpen: (b: boolean) => void;

  settings: Settings;
  apps: Record<string, RuntimeApp>;
  fwRules: FwRule[];
  automation: AutomationRule[];
  autoLog: { ts: number; text: string }[];
  allowlist: string[];
  denylist: string[];
  lists: Record<ListCategory, Set<string>>;
  listCounts: Record<ListCategory, number>;

  connEvents: ConnEvent[];
  dnsEvents: DnsEvent[];
  counters: Counters;
  series: number[]; // events per second, last 90
  blockedSeries: number[];
  notifs: Notif[];
  toasts: ToastMsg[];
  online: boolean;
  lastFlush: number;
  pendingApprovals: ConnEvent[];

  setPage: (p: PageId) => void;
  setSearch: (s: string) => void;
  setBooted: () => void;
  openConn: (c: ConnEvent | null) => void;
  setNotifOpen: (b: boolean) => void;

  updateSettings: (p: Partial<Settings>) => void;
  setPolicy: (appId: string, policy: Policy, tempUntil?: number | null) => void;
  classifyApp: (appId: string, cat: AICategory) => void;
  addCustomApp: (a: AppProfile) => void;
  addFwRule: (r: Omit<FwRule, "id" | "created" | "hits">) => void;
  removeFwRule: (id: string) => void;
  addAutomation: (r: Omit<AutomationRule, "id" | "hits" | "lastFired">) => void;
  updateAutomation: (id: string, p: Partial<AutomationRule>) => void;
  removeAutomation: (id: string) => void;
  setListEnabled: (c: ListCategory, on: boolean) => void;
  setList: (c: ListCategory, domains: string[], updated?: number | null) => void;
  addToList: (which: "allowlist" | "denylist" | "customList", domain: string) => void;
  removeFromList: (which: "allowlist" | "denylist" | "customList", domain: string) => void;

  pushConn: (e: ConnEvent) => void;
  pushDns: (e: DnsEvent) => void;
  pushSeries: (allowed: number, blocked: number) => void;
  bumpCounters: (p: Partial<Counters>) => void;
  updateAppStats: (appId: string, e: ConnEvent) => void;
  notify: (n: Omit<Notif, "id" | "ts" | "read">, toast?: boolean) => void;
  markNotifsRead: () => void;
  pushAutoLog: (text: string) => void;
  approveEvent: (e: ConnEvent) => void;
  setOnline: (b: boolean) => void;
  resetAll: () => void;
}

function defaultSettings(): Settings {
  return {
    theme: "dark",
    monitoring: true,
    firewallOn: true,
    dnsFiltering: true,
    adBlocking: true,
    trackerBlocking: true,
    strictMode: false,
    aiPrivacyMode: true,
    localAiOnly: false,
    demoTraffic: true,
    demoRate: 32,
    retentionDays: 14,
    dnsProvider: "google",
    notifications: true,
    listEnabled: { ads: true, trackers: true, analytics: true, telemetry: true, malware: true, custom: true },
    listUpdated: { ads: null, trackers: null, analytics: null, telemetry: null, malware: null, custom: null },
    remoteListCount: 0,
    autoDailyReport: true,
    autoCleanup: true,
  };
}

function buildApps(persisted?: Persisted): Record<string, RuntimeApp> {
  const out: Record<string, RuntimeApp> = {};
  const all = [...APP_CATALOG, ...(persisted?.customApps ?? [])];
  for (const a of all) {
    const saved = persisted?.policies[a.id];
    out[a.id] = {
      ...a,
      pid: 0,
      policy: saved?.policy ?? defaultPolicy(a),
      tempUntil: saved?.tempUntil ?? null,
      firstSeen: 0,
      lastSeen: null,
      attempts: 0,
      allowed: 0,
      blocked: 0,
      bytesUp: 0,
      bytesDown: 0,
      dests: {},
      category: saved?.category ?? a.category,
      userClassified: saved?.userClassified ?? false,
      active: false,
    };
  }
  return out;
}

function defaultPolicy(a: AppProfile): Policy {
  if (a.id === "unknown-proc") return "block";
  return "allow";
}

function buildLists(persisted?: Persisted): Record<ListCategory, Set<string>> {
  const cats: ListCategory[] = ["ads", "trackers", "analytics", "telemetry", "malware", "custom"];
  const out = {} as Record<ListCategory, Set<string>>;
  for (const c of cats) {
    const base = c === "custom" ? (persisted?.customList ?? []) : BUNDLED_LISTS[c];
    out[c] = new Set(base.map((d) => d.trim().toLowerCase()));
  }
  try {
    const remote = localStorage.getItem("pg.remotehosts");
    if (remote) for (const d of parseHosts(remote)) out.ads.add(d);
  } catch { /* ignore */ }
  return out;
}

export function parseHosts(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parts = t.split(/\s+/);
    if (parts.length >= 2 && (parts[0] === "0.0.0.0" || parts[0] === "127.0.0.1")) {
      const d = parts[1].toLowerCase();
      if (d && d !== "localhost" && !d.includes(":")) out.push(d);
    }
  }
  return out;
}

function loadPersisted(): Persisted | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as Persisted) : null;
  } catch {
    return null;
  }
}

const _persisted = loadPersisted();

function listCountOf(lists: Record<ListCategory, Set<string>>): Record<ListCategory, number> {
  const out = {} as Record<ListCategory, number>;
  (Object.keys(lists) as ListCategory[]).forEach((k) => (out[k] = lists[k].size));
  return out;
}

export const useStore = create<Store>()((set, get) => {
  const persist = () => {
    const s = get();
    const p: Persisted = {
      settings: s.settings,
      policies: Object.fromEntries(
        Object.values(s.apps).map((a) => [a.id, { policy: a.policy, tempUntil: a.tempUntil, category: a.category, userClassified: a.userClassified }])
      ),
      customApps: Object.values(s.apps)
        .filter((a) => !APP_CATALOG.some((c) => c.id === a.id))
        .map((a) => ({ id: a.id, name: a.name, exe: a.exe, path: a.path, publisher: a.publisher, category: a.category, ai: a.ai, pid: 0, knownDomains: a.knownDomains, weight: a.weight })),
      fwRules: s.fwRules,
      automation: s.automation,
      allowlist: s.allowlist,
      denylist: s.denylist,
      customList: Array.from(s.lists.custom),
      listEnabled: s.settings.listEnabled,
      listUpdated: s.settings.listUpdated,
      pendingAllowedIds: [],
      seenNotifications: 0,
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(p));
    } catch { /* storage full — events live in IDB anyway */ }
  };

  const lists = buildLists(_persisted ?? undefined);

  return {
    page: "dashboard",
    search: "",
    booted: false,
    drawerConn: null,
    notifOpen: false,
    installGuideOpen: false,
    setInstallGuideOpen: (installGuideOpen) => set({ installGuideOpen }),

    settings: _persisted?.settings ?? defaultSettings(),
    apps: buildApps(_persisted ?? undefined),
    fwRules: _persisted?.fwRules ?? [
      { id: ridLocal("fw"), target: "app", appId: "unknown-proc", value: "*", port: "*", proto: "any", action: "blocked", note: "Unknown application — default deny", created: Date.now(), hits: 0 },
      { id: ridLocal("fw"), target: "app", appId: "ollama", value: "*", port: "*", proto: "any", action: "allowed", note: "Ollama local inference server", created: Date.now(), hits: 0 },
    ],
    automation: _persisted?.automation ?? [
      { id: ridLocal("auto"), name: "Block unknown external servers for coding agents", enabled: true, whenApp: "claude-code", whenDest: "blocklisted", whenDomain: "", thenAction: "block", schedule: "always", hourFrom: 0, hourTo: 24, hits: 0, lastFired: null },
      { id: ridLocal("auto"), name: "Always allow Ollama on localhost", enabled: true, whenApp: "ollama", whenDest: "localhost", whenDomain: "", thenAction: "allow", schedule: "always", hourFrom: 0, hourTo: 24, hits: 0, lastFired: null },
      { id: ridLocal("auto"), name: "Notify when an unknown app goes online", enabled: true, whenApp: "unknown-proc", whenDest: "internet", whenDomain: "", thenAction: "notify", schedule: "always", hourFrom: 0, hourTo: 24, hits: 0, lastFired: null },
    ],
    autoLog: [],
    allowlist: _persisted?.allowlist ?? ["api.github.com", "cdn.jsdelivr.net"],
    denylist: _persisted?.denylist ?? [],
    lists,
    listCounts: listCountOf(lists),

    connEvents: [],
    dnsEvents: [],
    counters: { upTotal: 0, downTotal: 0, blockedTotal: 0, allowedTotal: 0, adsBlocked: 0, trackersBlocked: 0, sessionStart: Date.now() },
    series: new Array(90).fill(0),
    blockedSeries: new Array(90).fill(0),
    notifs: [],
    toasts: [],
    online: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastFlush: Date.now(),
    pendingApprovals: [],

    setPage: (p) => set({ page: p, drawerConn: null }),
    setSearch: (search) => set({ search }),
    setBooted: () => set({ booted: true }),
    openConn: (drawerConn) => set({ drawerConn }),
    setNotifOpen: (notifOpen) => set({ notifOpen }),

    updateSettings: (p) => {
      set((s) => ({ settings: { ...s.settings, ...p } }));
      persist();
    },
    setPolicy: (appId, policy, tempUntil = null) => {
      set((s) => ({ apps: { ...s.apps, [appId]: { ...s.apps[appId], policy, tempUntil } } }));
      persist();
    },
    classifyApp: (appId, cat) => {
      set((s) => ({
        apps: { ...s.apps, [appId]: { ...s.apps[appId], category: cat, userClassified: true, ai: cat.includes("ai") } },
      }));
      persist();
    },
    addCustomApp: (a) => {
      set((s) => ({ apps: { ...s.apps, [a.id]: { ...a, policy: "allow", tempUntil: null, firstSeen: 0, lastSeen: null, attempts: 0, allowed: 0, blocked: 0, bytesUp: 0, bytesDown: 0, dests: {}, userClassified: true, active: false } } }));
      persist();
    },
    addFwRule: (r) => {
      set((s) => ({ fwRules: [{ ...r, id: ridLocal("fw"), created: Date.now(), hits: 0 }, ...s.fwRules] }));
      persist();
    },
    removeFwRule: (id) => { set((s) => ({ fwRules: s.fwRules.filter((r) => r.id !== id) })); persist(); },
    addAutomation: (r) => { set((s) => ({ automation: [{ ...r, id: ridLocal("auto"), hits: 0, lastFired: null }, ...s.automation] })); persist(); },
    updateAutomation: (id, p) => { set((s) => ({ automation: s.automation.map((r) => (r.id === id ? { ...r, ...p } : r)) })); persist(); },
    removeAutomation: (id) => { set((s) => ({ automation: s.automation.filter((r) => r.id !== id) })); persist(); },
    setListEnabled: (c, on) => {
      set((s) => ({ settings: { ...s.settings, listEnabled: { ...s.settings.listEnabled, [c]: on } } }));
      persist();
    },
    setList: (c, domains, updated = null) => {
      set((s) => {
        const lists2 = { ...s.lists, [c]: new Set(domains.map((d) => d.toLowerCase())) };
        const listCounts = { ...s.listCounts, [c]: lists2[c].size };
        return {
          lists: lists2, listCounts,
          settings: { ...s.settings, listUpdated: { ...s.settings.listUpdated, [c]: updated ?? Date.now() } },
        };
      });
      persist();
    },
    addToList: (which, domain) => {
      domain = domain.trim().toLowerCase();
      if (!domain) return;
      if (which === "customList") {
        const s = get();
        if (s.lists.custom.has(domain)) return;
        const set2 = new Set(s.lists.custom);
        set2.add(domain);
        set({ lists: { ...s.lists, custom: set2 }, listCounts: { ...s.listCounts, custom: set2.size } });
      } else {
        set((s) => (s[which].includes(domain) ? {} : { [which]: [...s[which], domain] }) as never);
      }
      persist();
    },
    removeFromList: (which, domain) => {
      if (which === "customList") {
        const s = get();
        const set2 = new Set(s.lists.custom);
        set2.delete(domain);
        set({ lists: { ...s.lists, custom: set2 }, listCounts: { ...s.listCounts, custom: set2.size } });
      } else {
        set((s) => ({ [which]: s[which].filter((d) => d !== domain) }) as never);
      }
      persist();
    },

    pushConn: (e) => set((s) => ({ connEvents: [e, ...s.connEvents].slice(0, 700) })),
    pushDns: (e) => set((s) => ({ dnsEvents: [e, ...s.dnsEvents].slice(0, 500) })),
    pushSeries: (allowed, blocked) =>
      set((s) => ({
        series: [...s.series.slice(1), allowed],
        blockedSeries: [...s.blockedSeries.slice(1), blocked],
      })),
    bumpCounters: (p) => set((s) => ({ counters: { ...s.counters, ...p } })),
    updateAppStats: (appId, e) =>
      set((s) => {
        const a = s.apps[appId];
        if (!a) return {};
        const dests = { ...a.dests };
        const key = e.domain ?? e.destIp;
        dests[key] = (dests[key] ?? 0) + 1;
        const keys = Object.keys(dests);
        if (keys.length > 14) {
          keys.sort((x, y) => dests[x] - dests[y]);
          delete dests[keys[0]];
        }
        const blocked = e.verdict === "blocked";
        return {
          apps: {
            ...s.apps,
            [appId]: {
              ...a,
              lastSeen: e.ts,
              firstSeen: a.firstSeen || e.ts,
              active: true,
              attempts: a.attempts + 1,
              allowed: a.allowed + (blocked ? 0 : 1),
              blocked: a.blocked + (blocked ? 1 : 0),
              bytesUp: a.bytesUp + e.bytesUp,
              bytesDown: a.bytesDown + e.bytesDown,
              dests,
            },
          },
        };
      }),
    notify: (n, toast = true) => {
      const full: Notif = { ...n, id: uid(), ts: Date.now(), read: false };
      set((s) => ({
        notifs: [full, ...s.notifs].slice(0, 120),
        toasts: toast && s.settings.notifications ? [...s.toasts, { id: full.id, kind: n.kind, title: n.title, body: n.body }] : s.toasts,
      }));
      if (toast && get().settings.notifications) {
        setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== full.id) })), 6000);
      }
    },
    markNotifsRead: () => set((s) => ({ notifs: s.notifs.map((n) => ({ ...n, read: true })) })),
    pushAutoLog: (text) => set((s) => ({ autoLog: [{ ts: Date.now(), text }, ...s.autoLog].slice(0, 80) })),
    approveEvent: (e) => set((s) => ({ pendingApprovals: s.pendingApprovals.filter((p) => p.id !== e.id) })),
    setOnline: (online) => set({ online }),
    resetAll: () => {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem("pg.remotehosts");
      location.reload();
    },
  };
});

function ridLocal(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}
