import type {
  CreateWaitlistEntriesPayload,
  MarkEntrySeatedPayload,
  ReorderWaitlistEntriesPayload,
  RemoveWaitlistEntryPayload,
  SaveWaitlistGamePayload,
  SetGameRunningPayload,
  WaitlistData
} from "../types";
import { loadMockData } from "./mockApi";
import { verifyPin } from "./joker";
import {
  createInitialWaitlistData,
  createWaitlistEntries,
  getWaitlistBoard,
  getWaitlistBootstrap,
  markEntrySeated,
  normalizeWaitlistData,
  removeWaitlistEntry,
  reorderWaitlistEntries,
  saveWaitlistGame,
  setGameRunning
} from "./waitlist";

const WAITLIST_STORE_KEY = "joker-manager-waitlist-demo-data";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function loadMockWaitlistData(): WaitlistData {
  const raw = window.localStorage.getItem(WAITLIST_STORE_KEY);
  if (!raw) {
    const initial = createInitialWaitlistData();
    window.localStorage.setItem(WAITLIST_STORE_KEY, JSON.stringify(initial));
    return initial;
  }

  try {
    const parsed = normalizeWaitlistData(JSON.parse(raw) as WaitlistData);
    window.localStorage.setItem(WAITLIST_STORE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    const initial = createInitialWaitlistData();
    window.localStorage.setItem(WAITLIST_STORE_KEY, JSON.stringify(initial));
    return initial;
  }
}

function saveMockWaitlistData(data: WaitlistData) {
  window.localStorage.setItem(WAITLIST_STORE_KEY, JSON.stringify(data));
}

function withWaitlistData<T>(handler: (data: WaitlistData) => T) {
  const data = loadMockWaitlistData();
  const result = handler(data);
  saveMockWaitlistData(data);
  return Promise.resolve(clone(result));
}

// Adding, seating, removing, and reordering are frequent floor actions that
// no longer require a staff password (matching the real backend, where the
// Worker also skips its PIN pre-flight for these routes) — the identity is
// whatever staffName the already-logged-in session sends, no verification.
function passwordlessStaff(staffName: string) {
  return { staffName, role: "staff" as const };
}

// Managing the game list is rarer/more structural, so it keeps requiring a
// staff password — verified as a read-only cross-store call against the
// Joker Jackpot store, mirroring how the real Worker verifies it against the
// Joker Jackpot Apps Script before forwarding to the Waitlist one.
function verifyStaff(staffName: string, pin: string) {
  return verifyPin(loadMockData(), staffName, pin);
}

export function resetMockWaitlistData() {
  const initial = createInitialWaitlistData();
  saveMockWaitlistData(initial);
  return initial;
}

export const mockWaitlistApi = {
  async waitlistBootstrap() {
    return withWaitlistData((data) => getWaitlistBootstrap(data));
  },
  async waitlistBoard() {
    return withWaitlistData((data) => getWaitlistBoard(data));
  },
  async createWaitlistEntries(payload: CreateWaitlistEntriesPayload) {
    const staff = passwordlessStaff(payload.staffName);
    return withWaitlistData((data) => createWaitlistEntries(data, payload, staff));
  },
  async markEntrySeated(payload: MarkEntrySeatedPayload) {
    const staff = passwordlessStaff(payload.staffName);
    return withWaitlistData((data) => markEntrySeated(data, payload, staff));
  },
  async removeWaitlistEntry(payload: RemoveWaitlistEntryPayload) {
    const staff = passwordlessStaff(payload.staffName);
    return withWaitlistData((data) => removeWaitlistEntry(data, payload, staff));
  },
  async reorderWaitlistEntries(payload: ReorderWaitlistEntriesPayload) {
    const staff = passwordlessStaff(payload.staffName);
    return withWaitlistData((data) => reorderWaitlistEntries(data, payload, staff));
  },
  async saveWaitlistGame(payload: SaveWaitlistGamePayload) {
    const staff = verifyStaff(payload.staffName, payload.pin);
    return withWaitlistData((data) => saveWaitlistGame(data, payload, staff));
  },
  async setGameRunning(payload: SetGameRunningPayload) {
    const staff = passwordlessStaff(payload.staffName);
    return withWaitlistData((data) => setGameRunning(data, payload, staff));
  }
};
