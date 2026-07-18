import type {
  CreateWaitlistEntriesPayload,
  RemoveWaitlistEntryPayload,
  SaveWaitlistGamePayload,
  WaitlistData
} from "../types";
import { loadMockData } from "./mockApi";
import { verifyPin } from "./joker";
import {
  createInitialWaitlistData,
  createWaitlistEntries,
  getWaitlistBoard,
  getWaitlistBootstrap,
  normalizeWaitlistData,
  removeWaitlistEntry,
  saveWaitlistGame
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

// Staff PIN verification happens against the jackpot store, not the waitlist
// store, since staff accounts are shared across both features (mirroring how
// the real backend's verifyPin_ reads the one Staff sheet regardless of which
// route is calling it). This is a read-only cross-store call, never a write.
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
    const staff = verifyStaff(payload.staffName, payload.pin);
    return withWaitlistData((data) => createWaitlistEntries(data, payload, staff));
  },
  async removeWaitlistEntry(payload: RemoveWaitlistEntryPayload) {
    const staff = verifyStaff(payload.staffName, payload.pin);
    return withWaitlistData((data) => removeWaitlistEntry(data, payload, staff));
  },
  async saveWaitlistGame(payload: SaveWaitlistGamePayload) {
    const staff = verifyStaff(payload.staffName, payload.pin);
    return withWaitlistData((data) => saveWaitlistGame(data, payload, staff));
  }
};
