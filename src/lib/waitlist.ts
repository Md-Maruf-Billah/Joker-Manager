import type {
  CreateWaitlistEntriesPayload,
  MarkEntrySeatedPayload,
  ReorderWaitlistEntriesPayload,
  RemoveWaitlistEntryPayload,
  Role,
  SaveWaitlistGamePayload,
  SetGameRunningPayload,
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

// Single source of truth for what each color tag actually renders as, shared
// by the staff Waitlist page and the public Waitlist TV board so the same
// game can never show up in two different colors in two different places.
export const WAITLIST_COLOR_THEME: Record<WaitlistColorTag, { accent: string; accentDeep: string; glow: string; tint: string }> = {
  red: { accent: "#EC1E24", accentDeep: "#5b0a10", glow: "rgba(236,30,36,0.35)", tint: "rgba(236,30,36,0.08)" },
  gold: { accent: "#C69D42", accentDeep: "#7C0917", glow: "rgba(198,157,66,0.35)", tint: "rgba(198,157,66,0.1)" },
  green: { accent: "#49B57C", accentDeep: "#0d3324", glow: "rgba(73,181,124,0.3)", tint: "rgba(73,181,124,0.08)" },
  teal: { accent: "#2E93BE", accentDeep: "#0c2733", glow: "rgba(46,147,190,0.32)", tint: "rgba(46,147,190,0.08)" },
  burgundy: { accent: "#B0223A", accentDeep: "#3d0a12", glow: "rgba(176,34,58,0.32)", tint: "rgba(176,34,58,0.08)" }
};

type StaffIdentity = { staffName: string; role: Role };

function nowIso() {
  return new Date().toISOString();
}

export function createInitialWaitlistData(): WaitlistData {
  return {
    games: [
      { gameId: "WG_1", gameName: "$1/3 NLHE", colorTag: "red", running: false, tableNumbers: "", sortOrder: 1, active: true },
      { gameId: "WG_2", gameName: "$2/5 NLHE", colorTag: "teal", running: false, tableNumbers: "", sortOrder: 2, active: true },
      { gameId: "WG_3", gameName: "$1/3 PLO", colorTag: "green", running: false, tableNumbers: "", sortOrder: 3, active: true },
      { gameId: "WG_4", gameName: "$5/10 NLHE", colorTag: "gold", running: false, tableNumbers: "", sortOrder: 4, active: true }
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
  const seatedByGame = new Map<string, WaitlistEntry[]>();

  data.entries
    .filter((entry) => entry.status === "Waiting")
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .forEach((entry) => {
      const list = waitingByGame.get(entry.gameId) ?? [];
      list.push(entry);
      waitingByGame.set(entry.gameId, list);
    });

  data.entries
    .filter((entry) => entry.status === "Seated")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .forEach((entry) => {
      const list = seatedByGame.get(entry.gameId) ?? [];
      list.push(entry);
      seatedByGame.set(entry.gameId, list);
    });

  const columns = games.map((game) => {
    const waiting = waitingByGame.get(game.gameId) ?? [];
    const seated = seatedByGame.get(game.gameId) ?? [];
    return {
      game,
      waiting: waiting.map((e) => ({ entryId: e.entryId, playerName: e.playerName, addedAt: e.addedAt })),
      waitingCount: waiting.length,
      seated: seated.map((e) => ({ entryId: e.entryId, playerName: e.playerName, addedAt: e.addedAt })),
      seatedCount: seated.length
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

function nextSortIndex(data: WaitlistData, gameId: string) {
  const existing = data.entries.filter((entry) => entry.gameId === gameId && entry.status === "Waiting");
  return existing.length ? Math.max(...existing.map((entry) => entry.sortIndex)) + 1 : 0;
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
    const game = data.games.find((g) => g.gameId === gameId && g.active);
    if (!game) {
      throw appError("JM-WL-003", "Selected game is not active.");
    }

    const duplicate = data.entries.find(
      (e) => e.gameId === gameId && e.status === "Waiting" && e.playerName.toLowerCase() === playerName.toLowerCase()
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
      sortIndex: nextSortIndex(data, gameId),
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

export function markEntrySeated(
  data: WaitlistData,
  payload: MarkEntrySeatedPayload,
  staff: StaffIdentity
): WaitlistEntry {
  const entry = data.entries.find((e) => e.entryId === payload.entryId);
  if (!entry) {
    throw appError("JM-WL-005", "Waitlist entry was not found.");
  }
  if (entry.status !== "Waiting") {
    throw appError("JM-WL-010", "Entry is not currently waiting.");
  }

  entry.status = "Seated";
  entry.updatedAt = nowIso();
  data.auditLog.push(
    audit(staff.staffName, staff.role, "MARK_ENTRY_SEATED", entry.entryId, "status", "Waiting", "Seated", "Marked seated", "waitlist")
  );

  return entry;
}

export function removeWaitlistEntry(
  data: WaitlistData,
  payload: RemoveWaitlistEntryPayload,
  staff: StaffIdentity
): WaitlistEntry {
  const entry = data.entries.find((e) => e.entryId === payload.entryId);
  if (!entry) {
    throw appError("JM-WL-005", "Waitlist entry was not found.");
  }

  if (entry.status === "Removed") {
    throw appError("JM-WL-006", "Entry has already been removed.");
  }

  const reason = payload.reason?.trim() || "Removed from waitlist";
  const oldStatus = entry.status;
  entry.status = "Removed";
  entry.reason = reason;
  entry.updatedAt = nowIso();

  data.auditLog.push(
    audit(staff.staffName, staff.role, "REMOVE_WAITLIST_ENTRY", entry.entryId, "status", oldStatus, "Removed", reason, "waitlist")
  );

  return entry;
}

export function reorderWaitlistEntries(
  data: WaitlistData,
  payload: ReorderWaitlistEntriesPayload,
  staff: StaffIdentity
): WaitlistEntry[] {
  const waiting = data.entries.filter((entry) => entry.gameId === payload.gameId && entry.status === "Waiting");
  const waitingIds = new Set(waiting.map((entry) => entry.entryId));

  if (payload.entryIds.length !== waiting.length || !payload.entryIds.every((entryId) => waitingIds.has(entryId))) {
    throw appError("JM-WL-011", "The waiting list changed — refresh and try again.");
  }

  payload.entryIds.forEach((entryId, index) => {
    const entry = data.entries.find((e) => e.entryId === entryId);
    if (entry) {
      entry.sortIndex = index;
      entry.updatedAt = nowIso();
    }
  });

  data.auditLog.push(
    audit(staff.staffName, staff.role, "REORDER_WAITLIST_ENTRIES", payload.gameId, "sortIndex", "", "", "Waitlist reordered", "waitlist")
  );

  return data.entries.filter((entry) => entry.gameId === payload.gameId && entry.status === "Waiting");
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
    existing.running = payload.running;
    existing.tableNumbers = payload.tableNumbers.trim();
    existing.active = payload.active;

    data.auditLog.push(
      audit(staff.staffName, staff.role, "SAVE_WAITLIST_GAME", existing.gameId, "gameName", oldName, gameName, "Waitlist game updated", "waitlist")
    );

    return existing;
  }

  const nextSortOrder = data.games.length ? Math.max(...data.games.map((game) => game.sortOrder)) + 1 : 1;
  const created: WaitlistGame = {
    gameId: id("WLG"),
    gameName,
    colorTag: payload.colorTag,
    running: payload.running,
    tableNumbers: payload.tableNumbers.trim(),
    sortOrder: nextSortOrder,
    active: payload.active
  };

  data.games.push(created);
  data.auditLog.push(
    audit(staff.staffName, staff.role, "SAVE_WAITLIST_GAME", created.gameId, "gameName", "", gameName, "Waitlist game created", "waitlist")
  );

  return created;
}

export function setGameRunning(data: WaitlistData, payload: SetGameRunningPayload, staff: StaffIdentity): WaitlistGame {
  const game = data.games.find((g) => g.gameId === payload.gameId);
  if (!game) {
    throw appError("JM-WL-009", "Game was not found.");
  }

  const oldRunning = game.running;
  game.running = payload.running;
  game.tableNumbers = payload.tableNumbers.trim();

  data.auditLog.push(
    audit(
      staff.staffName,
      staff.role,
      "SET_GAME_RUNNING",
      game.gameId,
      "running",
      String(oldRunning),
      String(payload.running),
      payload.running ? `Started running · Table ${game.tableNumbers}` : "Stopped running",
      "waitlist"
    )
  );

  return game;
}
