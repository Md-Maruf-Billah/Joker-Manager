import type {
  CreateWaitlistEntriesPayload,
  RemoveWaitlistEntryPayload,
  Role,
  SaveWaitlistGamePayload,
  WaitlistBoardData,
  WaitlistBootstrapData,
  WaitlistColorTag,
  WaitlistData,
  WaitlistEntry,
  WaitlistGame
} from "../types";
import { audit, id } from "./joker";
import { appError } from "./errors";

export const WAITLIST_COLOR_TAGS: WaitlistColorTag[] = ["red", "teal", "green", "gold", "burgundy"];

type StaffIdentity = { staffName: string; role: Role };

function nowIso() {
  return new Date().toISOString();
}

export function createInitialWaitlistData(): WaitlistData {
  return {
    games: [
      { gameId: "WG_1", gameName: "$1/3 NLHE", colorTag: "red", activeTables: "", sortOrder: 1, active: true },
      { gameId: "WG_2", gameName: "$2/5 NLHE", colorTag: "teal", activeTables: "", sortOrder: 2, active: true },
      { gameId: "WG_3", gameName: "$1/3 PLO", colorTag: "green", activeTables: "", sortOrder: 3, active: true },
      { gameId: "WG_4", gameName: "$5/10 NLHE", colorTag: "gold", activeTables: "", sortOrder: 4, active: true }
    ],
    entries: [],
    auditLog: []
  };
}

export function normalizeWaitlistData(data: WaitlistData): WaitlistData {
  if (!Array.isArray(data.games) || data.games.length === 0) {
    data.games = createInitialWaitlistData().games;
  }

  if (!Array.isArray(data.entries)) {
    data.entries = [];
  }

  if (!Array.isArray(data.auditLog)) {
    data.auditLog = [];
  }

  return data;
}

export function getWaitlistGames(data: WaitlistData, includeInactive = false): WaitlistGame[] {
  return data.games
    .filter((game) => includeInactive || game.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getWaitlistBoard(data: WaitlistData): WaitlistBoardData {
  const games = getWaitlistGames(data, false);
  const waitingByGame = new Map<string, WaitlistEntry[]>();

  data.entries
    .filter((entry) => entry.status === "Waiting")
    .sort((a, b) => a.addedAt.localeCompare(b.addedAt))
    .forEach((entry) => {
      const list = waitingByGame.get(entry.gameId) ?? [];
      list.push(entry);
      waitingByGame.set(entry.gameId, list);
    });

  const columns = games.map((game) => {
    const waiting = waitingByGame.get(game.gameId) ?? [];
    return {
      game,
      waiting: waiting.map((entry) => ({ entryId: entry.entryId, playerName: entry.playerName, addedAt: entry.addedAt })),
      waitingCount: waiting.length
    };
  });

  return {
    columns,
    totalWaiting: columns.reduce((sum, column) => sum + column.waitingCount, 0),
    refreshedAt: nowIso()
  };
}

export function getWaitlistBootstrap(data: WaitlistData): WaitlistBootstrapData {
  return {
    games: getWaitlistGames(data, true),
    board: getWaitlistBoard(data)
  };
}

export function createWaitlistEntries(
  data: WaitlistData,
  payload: CreateWaitlistEntriesPayload,
  staff: StaffIdentity
): WaitlistEntry[] {
  const playerName = payload.playerName.trim();
  if (!playerName) {
    throw appError("JM-WL-001", "Player name is required.");
  }

  if (!payload.gameIds.length) {
    throw appError("JM-WL-002", "Select at least one game.");
  }

  const now = nowIso();
  const created: WaitlistEntry[] = [];

  for (const gameId of payload.gameIds) {
    const game = data.games.find((item) => item.gameId === gameId && item.active);
    if (!game) {
      throw appError("JM-WL-003", "Selected game is not active.");
    }

    const duplicate = data.entries.find(
      (entry) =>
        entry.gameId === gameId &&
        entry.status === "Waiting" &&
        entry.playerName.toLowerCase() === playerName.toLowerCase()
    );
    if (duplicate) {
      throw appError("JM-WL-004", `${playerName} is already waiting for ${game.gameName}.`);
    }

    const entry: WaitlistEntry = {
      entryId: id("WLE"),
      playerName,
      gameId,
      status: "Waiting",
      reason: "",
      addedAt: now,
      updatedAt: now,
      staffName: staff.staffName
    };

    data.entries.push(entry);
    data.auditLog.push(
      audit(staff.staffName, staff.role, "CREATE_WAITLIST_ENTRY", entry.entryId, "status", "", "Waiting", `Added to ${game.gameName} waitlist`, "waitlist")
    );
    created.push(entry);
  }

  return created;
}

export function removeWaitlistEntry(
  data: WaitlistData,
  payload: RemoveWaitlistEntryPayload,
  staff: StaffIdentity
): WaitlistEntry {
  const entry = data.entries.find((item) => item.entryId === payload.entryId);
  if (!entry) {
    throw appError("JM-WL-005", "Waitlist entry was not found.");
  }

  if (entry.status === "Removed") {
    throw appError("JM-WL-006", "Entry has already been removed.");
  }

  const reason = payload.reason?.trim() || "Removed from waitlist";
  entry.status = "Removed";
  entry.reason = reason;
  entry.updatedAt = nowIso();

  data.auditLog.push(
    audit(staff.staffName, staff.role, "REMOVE_WAITLIST_ENTRY", entry.entryId, "status", "Waiting", "Removed", reason, "waitlist")
  );

  return entry;
}

export function saveWaitlistGame(
  data: WaitlistData,
  payload: SaveWaitlistGamePayload,
  staff: StaffIdentity
): WaitlistGame {
  const gameName = payload.gameName.trim();
  if (!gameName) {
    throw appError("JM-WL-007", "Game name is required.");
  }

  if (!WAITLIST_COLOR_TAGS.includes(payload.colorTag)) {
    throw appError("JM-WL-008", "Choose a valid color tag.");
  }

  const existing = payload.gameId ? data.games.find((game) => game.gameId === payload.gameId) : null;

  if (existing) {
    const oldName = existing.gameName;
    existing.gameName = gameName;
    existing.colorTag = payload.colorTag;
    existing.activeTables = payload.activeTables.trim();
    existing.sortOrder = payload.sortOrder;
    existing.active = payload.active;

    data.auditLog.push(
      audit(staff.staffName, staff.role, "SAVE_WAITLIST_GAME", existing.gameId, "gameName", oldName, gameName, "Waitlist game updated", "waitlist")
    );

    return existing;
  }

  const created: WaitlistGame = {
    gameId: id("WLG"),
    gameName,
    colorTag: payload.colorTag,
    activeTables: payload.activeTables.trim(),
    sortOrder: payload.sortOrder,
    active: payload.active
  };

  data.games.push(created);
  data.auditLog.push(
    audit(staff.staffName, staff.role, "SAVE_WAITLIST_GAME", created.gameId, "gameName", "", gameName, "Waitlist game created", "waitlist")
  );

  return created;
}
