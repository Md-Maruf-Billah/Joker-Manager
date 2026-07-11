import type {
  AdminAdjustmentPayload,
  ClearTvAnnouncementPayload,
  CreateStaffPayload,
  CreateTournamentPayload,
  EditRunPayload,
  JokerData,
  PushTvAnnouncementPayload,
  SetStaffActivePayload,
  SetStaffPinPayload,
  StaffSession,
  SubmitDrawPayload,
  UpsertTournamentTypePayload,
  VoidRunPayload
} from "../types";
import {
  applyAdminAdjustment,
  clearTvAnnouncement,
  createInitialData,
  createStaff,
  createTournamentRun,
  editRun,
  getCards,
  getDashboardData,
  getPendingRun,
  getStaffList,
  getTvDisplayData,
  getTvMessage,
  normalizeData,
  pushTvAnnouncement,
  setStaffActive,
  setStaffPin,
  submitDrawResult,
  upsertTournamentType,
  verifyPin,
  voidRun
} from "./joker";

const STORE_KEY = "joker-jackpot-demo-data";
const SESSION_KEY = "joker-jackpot-session";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadMockData(): JokerData {
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) {
    const initial = createInitialData();
    window.localStorage.setItem(STORE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = normalizeData(JSON.parse(raw) as JokerData);
    window.localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const initial = createInitialData();
    window.localStorage.setItem(STORE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function saveMockData(data: JokerData) {
  window.localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

function withData<T>(handler: (data: JokerData) => T) {
  const data = loadMockData();
  const result = handler(data);
  saveMockData(data);
  return Promise.resolve(clone(result));
}

export function getStoredSession(): StaffSession | null {
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }

  const session = JSON.parse(raw) as StaffSession;
  if (Date.parse(session.expiresAt) < Date.now()) {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }

  return session;
}

export function storeSession(session: StaffSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
}

export function resetMockData() {
  const initial = createInitialData();
  saveMockData(initial);
  return initial;
}

export const mockApi = {
  async verifyPin(staffName: string, pin: string) {
    return withData((data) => {
      const staff = verifyPin(data, staffName, pin);
      return {
        staffName: staff.staffName,
        role: staff.role,
        expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
      } satisfies StaffSession;
    });
  },
  async dashboard() {
    return withData((data) => getDashboardData(data));
  },
  async tournamentTypes(includeInactive = false) {
    return withData((data) => data.tournamentTypes.filter((type) => includeInactive || type.active));
  },
  async saveTournamentType(payload: UpsertTournamentTypePayload) {
    return withData((data) => upsertTournamentType(data, payload));
  },
  async createTournament(payload: CreateTournamentPayload) {
    return withData((data) => createTournamentRun(data, payload));
  },
  async pendingDraw() {
    return withData((data) => getPendingRun(data));
  },
  async cards() {
    return withData((data) => getCards(data));
  },
  async submitDraw(payload: SubmitDrawPayload) {
    return withData((data) => submitDrawResult(data, payload));
  },
  async history() {
    return withData((data) => [...data.runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  },
  async editRun(payload: EditRunPayload) {
    return withData((data) => editRun(data, payload));
  },
  async voidRun(payload: VoidRunPayload) {
    return withData((data) => voidRun(data, payload));
  },
  async auditLog() {
    return withData((data) => [...data.auditLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
  },
  async exportBackup() {
    return withData((data) => data);
  },
  async tv() {
    return withData((data) => getTvDisplayData(data));
  },
  async adminAdjustment(payload: AdminAdjustmentPayload) {
    return withData((data) => applyAdminAdjustment(data, payload));
  },
  async staffList() {
    return withData((data) => getStaffList(data));
  },
  async createStaff(payload: CreateStaffPayload) {
    return withData((data) => createStaff(data, payload));
  },
  async setStaffPin(payload: SetStaffPinPayload) {
    return withData((data) => setStaffPin(data, payload));
  },
  async setStaffActive(payload: SetStaffActivePayload) {
    return withData((data) => setStaffActive(data, payload));
  },
  async tvMessage() {
    return withData((data) => getTvMessage(data));
  },
  async pushTvAnnouncement(payload: PushTvAnnouncementPayload) {
    return withData((data) => pushTvAnnouncement(data, payload));
  },
  async clearTvAnnouncement(payload: ClearTvAnnouncementPayload) {
    return withData((data) => clearTvAnnouncement(data, payload));
  }
};
