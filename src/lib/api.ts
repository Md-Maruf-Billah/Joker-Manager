import type {
  AddTournamentBootstrapData,
  AdminAdjustmentPayload,
  AdminBootstrapData,
  ClearTvAnnouncementPayload,
  CreateStaffPayload,
  CreateTournamentPayload,
  CreateWaitlistEntriesPayload,
  DashboardData,
  DrawBootstrapData,
  EditRunPayload,
  HistoryBootstrapData,
  JokerData,
  LoginBootstrapData,
  MarkEntrySeatedPayload,
  PushTvAnnouncementPayload,
  ReorderWaitlistEntriesPayload,
  RemoveWaitlistEntryPayload,
  SaveWaitlistGamePayload,
  SetStaffActivePayload,
  SetStaffPinPayload,
  StaffListItem,
  StaffSession,
  SubmitDrawPayload,
  TvDisplayData,
  TvMessage,
  UpsertTournamentTypePayload,
  VoidRunPayload,
  WaitlistBoardData,
  WaitlistBootstrapData,
  WaitlistEntry,
  WaitlistGame
} from "../types";
import { appError } from "./errors";
import { mockApi } from "./mockApi";
import { mockWaitlistApi } from "./mockWaitlistApi";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string | undefined;
const API_CACHE_PREFIX = "joker-manager-api-cache:";
const REFRESH_PARAM = "__jm_refresh";

const MUTATING_PATHS = new Set([
  "/api/tournament-types/save",
  "/api/tournament/create",
  "/api/draw/submit",
  "/api/run/edit",
  "/api/run/void",
  "/api/admin/adjustment",
  "/api/admin/staff/create",
  "/api/admin/staff/set-pin",
  "/api/admin/staff/set-active",
  "/api/admin/tv-message/push",
  "/api/admin/tv-message/clear",
  "/api/waitlist/entries/create",
  "/api/waitlist/entries/seat",
  "/api/waitlist/entries/remove",
  "/api/waitlist/entries/reorder",
  "/api/waitlist/games/save"
]);

const inFlightReads = new Map<string, Promise<unknown>>();

type RequestOptions = {
  bypassCache?: boolean;
};

type CachedSnapshot<T> = {
  data: T;
  storedAt: string;
};

function localStorageOrNull() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function cachedKey(path: string) {
  return `${API_CACHE_PREFIX}${path}`;
}

function readCachedData<T>(path: string): T | null {
  const storage = localStorageOrNull();
  const raw = storage?.getItem(cachedKey(path));

  if (!raw) {
    return null;
  }

  try {
    return (JSON.parse(raw) as CachedSnapshot<T>).data;
  } catch {
    storage?.removeItem(cachedKey(path));
    return null;
  }
}

function rememberCachedData<T>(path: string, data: T) {
  const storage = localStorageOrNull();
  try {
    storage?.setItem(
      cachedKey(path),
      JSON.stringify({
        data,
        storedAt: new Date().toISOString()
      } satisfies CachedSnapshot<T>)
    );
  } catch {
    // Cache failure should never block the operational workflow.
  }
}

function clearCachedReads() {
  const storage = localStorageOrNull();
  if (!storage) {
    return;
  }

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (key?.startsWith(API_CACHE_PREFIX)) {
      storage.removeItem(key);
    }
  }
}

function withRefreshParam(path: string) {
  const [base, query = ""] = path.split("?");
  const params = new URLSearchParams(query);
  params.set(REFRESH_PARAM, "1");
  const nextQuery = params.toString();
  return nextQuery ? `${base}?${nextQuery}` : base;
}

async function performRequest<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw appError("JM-API-001", "API base URL is not configured.");
  }

  const method = (init?.method ?? "GET").toUpperCase();
  const requestPath = method === "GET" && options.bypassCache ? withRefreshParam(path) : path;
  const response = await fetch(`${API_BASE_URL}${requestPath}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const payload = (await response.json()) as { ok: boolean; data?: T; error?: string };

  if (!response.ok || !payload.ok) {
    if (payload.error?.startsWith("[")) {
      throw new Error(payload.error);
    }

    throw appError("JM-API-002", payload.error ?? "Request failed.");
  }

  const data = payload.data as T;

  if (method === "GET") {
    rememberCachedData(path, data);
  } else if (MUTATING_PATHS.has(path)) {
    clearCachedReads();
  }

  return data;
}

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();

  if (method !== "GET") {
    return performRequest<T>(path, init, options);
  }

  const readKey = `${path}:${options.bypassCache ? "refresh" : "cache"}`;
  const existing = inFlightReads.get(readKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise = performRequest<T>(path, init, options);
  inFlightReads.set(readKey, promise);

  try {
    return await promise;
  } finally {
    inFlightReads.delete(readKey);
  }
}

export const api = {
  cachedDashboard(): DashboardData | null {
    return readCachedData<DashboardData>("/api/dashboard");
  },
  cachedTv(): TvDisplayData | null {
    return readCachedData<TvDisplayData>("/api/tv");
  },
  cachedAddTournamentBootstrap(): AddTournamentBootstrapData | null {
    return readCachedData<AddTournamentBootstrapData>("/api/bootstrap/add-tournament");
  },
  cachedDrawBootstrap(): DrawBootstrapData | null {
    return readCachedData<DrawBootstrapData>("/api/bootstrap/draw");
  },
  cachedHistoryBootstrap(): HistoryBootstrapData | null {
    return readCachedData<HistoryBootstrapData>("/api/bootstrap/history");
  },
  cachedAdminBootstrap(): AdminBootstrapData | null {
    return readCachedData<AdminBootstrapData>("/api/bootstrap/admin");
  },
  cachedWaitlistBootstrap(): WaitlistBootstrapData | null {
    return readCachedData<WaitlistBootstrapData>("/api/waitlist/bootstrap");
  },
  cachedWaitlistBoard(): WaitlistBoardData | null {
    return readCachedData<WaitlistBoardData>("/api/waitlist/board");
  },
  verifyPin(staffName: string, pin: string): Promise<StaffSession> {
    if (!API_BASE_URL) {
      return mockApi.verifyPin(staffName, pin);
    }

    return request<StaffSession>("/api/auth/verify-pin", {
      method: "POST",
      body: JSON.stringify({ staffName, pin })
    });
  },
  async loginBootstrap(staffName: string, pin: string): Promise<LoginBootstrapData> {
    if (!API_BASE_URL) {
      const [session, dashboard] = await Promise.all([mockApi.verifyPin(staffName, pin), mockApi.dashboard()]);
      return { session, dashboard };
    }

    const data = await request<LoginBootstrapData>("/api/auth/login-bootstrap", {
      method: "POST",
      body: JSON.stringify({ staffName, pin })
    });
    rememberCachedData("/api/dashboard", data.dashboard);
    return data;
  },
  dashboard(options?: RequestOptions) {
    if (!API_BASE_URL) {
      return mockApi.dashboard();
    }

    return request("/api/dashboard", undefined, options);
  },
  tournamentTypes(includeInactive = false, options?: RequestOptions) {
    if (!API_BASE_URL) {
      return mockApi.tournamentTypes(includeInactive);
    }

    return request(`/api/tournament-types${includeInactive ? "?includeInactive=true" : ""}`, undefined, options);
  },
  async addTournamentBootstrap(options?: RequestOptions): Promise<AddTournamentBootstrapData> {
    if (!API_BASE_URL) {
      const [tournamentTypes, dashboard] = await Promise.all([mockApi.tournamentTypes(), mockApi.dashboard()]);
      return { tournamentTypes, dashboard };
    }

    return request("/api/bootstrap/add-tournament", undefined, options);
  },
  async drawBootstrap(options?: RequestOptions): Promise<DrawBootstrapData> {
    if (!API_BASE_URL) {
      const [pendingRun, cards] = await Promise.all([mockApi.pendingDraw(), mockApi.cards()]);
      return { pendingRun, cards };
    }

    return request("/api/bootstrap/draw", undefined, options);
  },
  async historyBootstrap(options?: RequestOptions): Promise<HistoryBootstrapData> {
    if (!API_BASE_URL) {
      const [runs, dashboard] = await Promise.all([mockApi.history(), mockApi.dashboard()]);
      return { runs, dashboard };
    }

    return request("/api/bootstrap/history", undefined, options);
  },
  async adminBootstrap(options?: RequestOptions): Promise<AdminBootstrapData> {
    if (!API_BASE_URL) {
      const [dashboard, audit, tournamentTypes, staffList, tvMessage] = await Promise.all([
        mockApi.dashboard(),
        mockApi.auditLog(),
        mockApi.tournamentTypes(true),
        mockApi.staffList(),
        mockApi.tvMessage()
      ]);
      return { dashboard, audit, tournamentTypes, staffList, tvMessage };
    }

    return request("/api/bootstrap/admin", undefined, options);
  },
  saveTournamentType(payload: UpsertTournamentTypePayload) {
    if (!API_BASE_URL) {
      return mockApi.saveTournamentType(payload);
    }

    return request("/api/tournament-types/save", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createTournament(payload: CreateTournamentPayload) {
    if (!API_BASE_URL) {
      return mockApi.createTournament(payload);
    }

    return request("/api/tournament/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  pendingDraw() {
    if (!API_BASE_URL) {
      return mockApi.pendingDraw();
    }

    return request("/api/draw/pending");
  },
  cards() {
    if (!API_BASE_URL) {
      return mockApi.cards();
    }

    return request("/api/cards");
  },
  submitDraw(payload: SubmitDrawPayload) {
    if (!API_BASE_URL) {
      return mockApi.submitDraw(payload);
    }

    return request("/api/draw/submit", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  history() {
    if (!API_BASE_URL) {
      return mockApi.history();
    }

    return request("/api/history");
  },
  editRun(payload: EditRunPayload) {
    if (!API_BASE_URL) {
      return mockApi.editRun(payload);
    }

    return request("/api/run/edit", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  voidRun(payload: VoidRunPayload) {
    if (!API_BASE_URL) {
      return mockApi.voidRun(payload);
    }

    return request("/api/run/void", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  auditLog() {
    if (!API_BASE_URL) {
      return mockApi.auditLog();
    }

    return request("/api/admin/audit-log");
  },
  exportBackup(): Promise<JokerData | Record<string, unknown>> {
    if (!API_BASE_URL) {
      return mockApi.exportBackup();
    }

    return request("/api/admin/export-backup");
  },
  tv(options?: RequestOptions) {
    if (!API_BASE_URL) {
      return mockApi.tv();
    }

    return request("/api/tv", undefined, options);
  },
  adminAdjustment(payload: AdminAdjustmentPayload) {
    if (!API_BASE_URL) {
      return mockApi.adminAdjustment(payload);
    }

    return request("/api/admin/adjustment", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  staffList(): Promise<StaffListItem[]> {
    if (!API_BASE_URL) {
      return mockApi.staffList();
    }

    return request("/api/admin/staff");
  },
  createStaff(payload: CreateStaffPayload) {
    if (!API_BASE_URL) {
      return mockApi.createStaff(payload);
    }

    return request("/api/admin/staff/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  setStaffPin(payload: SetStaffPinPayload) {
    if (!API_BASE_URL) {
      return mockApi.setStaffPin(payload);
    }

    return request("/api/admin/staff/set-pin", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  setStaffActive(payload: SetStaffActivePayload) {
    if (!API_BASE_URL) {
      return mockApi.setStaffActive(payload);
    }

    return request("/api/admin/staff/set-active", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  pushTvAnnouncement(payload: PushTvAnnouncementPayload): Promise<TvMessage> {
    if (!API_BASE_URL) {
      return mockApi.pushTvAnnouncement(payload);
    }

    return request<TvMessage>("/api/admin/tv-message/push", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  clearTvAnnouncement(payload: ClearTvAnnouncementPayload): Promise<TvMessage> {
    if (!API_BASE_URL) {
      return mockApi.clearTvAnnouncement(payload);
    }

    return request<TvMessage>("/api/admin/tv-message/clear", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  waitlistBootstrap(options?: RequestOptions): Promise<WaitlistBootstrapData> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.waitlistBootstrap();
    }

    return request<WaitlistBootstrapData>("/api/waitlist/bootstrap", undefined, options);
  },
  waitlistBoard(options?: RequestOptions): Promise<WaitlistBoardData> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.waitlistBoard();
    }

    return request<WaitlistBoardData>("/api/waitlist/board", undefined, options);
  },
  createWaitlistEntries(payload: CreateWaitlistEntriesPayload): Promise<WaitlistEntry[]> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.createWaitlistEntries(payload);
    }

    return request<WaitlistEntry[]>("/api/waitlist/entries/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  markEntrySeated(payload: MarkEntrySeatedPayload): Promise<WaitlistEntry> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.markEntrySeated(payload);
    }

    return request<WaitlistEntry>("/api/waitlist/entries/seat", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  removeWaitlistEntry(payload: RemoveWaitlistEntryPayload): Promise<WaitlistEntry> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.removeWaitlistEntry(payload);
    }

    return request<WaitlistEntry>("/api/waitlist/entries/remove", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  reorderWaitlistEntries(payload: ReorderWaitlistEntriesPayload): Promise<WaitlistEntry[]> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.reorderWaitlistEntries(payload);
    }

    return request<WaitlistEntry[]>("/api/waitlist/entries/reorder", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  saveWaitlistGame(payload: SaveWaitlistGamePayload): Promise<WaitlistGame> {
    if (!API_BASE_URL) {
      return mockWaitlistApi.saveWaitlistGame(payload);
    }

    return request<WaitlistGame>("/api/waitlist/games/save", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};
