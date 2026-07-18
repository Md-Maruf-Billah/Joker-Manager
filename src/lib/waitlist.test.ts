import { describe, expect, it } from "vitest";
import type { WaitlistData } from "../types";
import {
  createInitialWaitlistData,
  createWaitlistEntries,
  getWaitlistBoard,
  getWaitlistBootstrap,
  getWaitlistGames,
  markEntrySeated,
  normalizeWaitlistData,
  removeWaitlistEntry,
  reorderWaitlistEntries,
  saveWaitlistGame
} from "./waitlist";

const staff = { staffName: "staff", role: "staff" as const };

function freshWaitlistData(): WaitlistData {
  return {
    games: [
      { gameId: "G1", gameName: "$1/3 NLHE", colorTag: "red", running: false, tableNumbers: "", sortOrder: 2, active: true },
      { gameId: "G2", gameName: "$2/5 NLHE", colorTag: "teal", running: true, tableNumbers: "45, 48", sortOrder: 1, active: true },
      { gameId: "G3", gameName: "$1/3 PLO", colorTag: "green", running: false, tableNumbers: "", sortOrder: 3, active: false }
    ],
    entries: [],
    auditLog: []
  };
}

describe("createInitialWaitlistData / normalizeWaitlistData", () => {
  it("seeds demo games with no entries", () => {
    const data = createInitialWaitlistData();
    expect(data.games.length).toBeGreaterThan(0);
    expect(data.entries).toEqual([]);
  });

  it("backfills a missing games array", () => {
    const data = normalizeWaitlistData({ games: [], entries: [], auditLog: [] });
    expect(data.games.length).toBeGreaterThan(0);
  });
});

describe("getWaitlistGames", () => {
  it("returns only active games by default, sorted by sortOrder", () => {
    const games = getWaitlistGames(freshWaitlistData());
    expect(games.map((g) => g.gameId)).toEqual(["G2", "G1"]);
  });

  it("includes inactive games when requested", () => {
    const games = getWaitlistGames(freshWaitlistData(), true);
    expect(games.map((g) => g.gameId)).toEqual(["G2", "G1", "G3"]);
  });
});

describe("getWaitlistBoard", () => {
  it("only includes active games as columns, in sortOrder", () => {
    const board = getWaitlistBoard(freshWaitlistData());
    expect(board.columns.map((c) => c.game.gameId)).toEqual(["G2", "G1"]);
  });

  it("shows zero waiting/seated for an empty column", () => {
    const board = getWaitlistBoard(freshWaitlistData());
    expect(board.columns.every((c) => c.waitingCount === 0 && c.seatedCount === 0)).toBe(true);
    expect(board.totalWaiting).toBe(0);
  });

  it("separates Waiting and Seated entries, ignores Removed, orders waiting by sortIndex", () => {
    const data = freshWaitlistData();
    data.entries = [
      { entryId: "E1", playerName: "Thomas", gameId: "G1", status: "Waiting", reason: "", sortIndex: 1, addedAt: "t2", updatedAt: "t2", staffName: "staff" },
      { entryId: "E2", playerName: "Jake", gameId: "G1", status: "Waiting", reason: "", sortIndex: 0, addedAt: "t1", updatedAt: "t1", staffName: "staff" },
      { entryId: "E3", playerName: "Wook", gameId: "G1", status: "Seated", reason: "", sortIndex: 2, addedAt: "t0", updatedAt: "t3", staffName: "staff" },
      { entryId: "E4", playerName: "Ali", gameId: "G1", status: "Removed", reason: "Left", sortIndex: 3, addedAt: "t0", updatedAt: "t4", staffName: "staff" }
    ];

    const board = getWaitlistBoard(data);
    const column = board.columns.find((c) => c.game.gameId === "G1")!;
    expect(column.waiting.map((e) => e.playerName)).toEqual(["Jake", "Thomas"]);
    expect(column.seated.map((e) => e.playerName)).toEqual(["Wook"]);
    expect(column.waitingCount).toBe(2);
    expect(column.seatedCount).toBe(1);
    expect(board.totalWaiting).toBe(2);
  });
});

describe("getWaitlistBootstrap", () => {
  it("returns inactive games too, and a board matching getWaitlistBoard", () => {
    const data = freshWaitlistData();
    const bootstrap = getWaitlistBootstrap(data);
    expect(bootstrap.games.map((g) => g.gameId)).toContain("G3");
    expect(bootstrap.board.columns).toEqual(getWaitlistBoard(data).columns);
    expect(bootstrap.board.totalWaiting).toBe(getWaitlistBoard(data).totalWaiting);
  });
});

describe("createWaitlistEntries", () => {
  it("creates one row per selected game from a single call, with no pin required", () => {
    const data = freshWaitlistData();
    const created = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1", "G2"], staffName: "staff" }, staff);
    expect(created).toHaveLength(2);
    expect(data.entries).toHaveLength(2);
    expect(data.entries.every((e) => e.playerName === "Amit" && e.status === "Waiting")).toBe(true);
  });

  it("assigns increasing sortIndex per game", () => {
    const data = freshWaitlistData();
    createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    createWaitlistEntries(data, { playerName: "Ben", gameIds: ["G1"], staffName: "staff" }, staff);
    const [first, second] = data.entries;
    expect(second.sortIndex).toBeGreaterThan(first.sortIndex);
  });

  it("rejects an empty player name", () => {
    const data = freshWaitlistData();
    expect(() => createWaitlistEntries(data, { playerName: "  ", gameIds: ["G1"], staffName: "staff" }, staff)).toThrow("[JM-WL-001]");
  });

  it("rejects an empty game selection", () => {
    const data = freshWaitlistData();
    expect(() => createWaitlistEntries(data, { playerName: "Amit", gameIds: [], staffName: "staff" }, staff)).toThrow("[JM-WL-002]");
  });

  it("rejects an inactive or unknown game", () => {
    const data = freshWaitlistData();
    expect(() => createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G3"], staffName: "staff" }, staff)).toThrow("[JM-WL-003]");
    expect(() => createWaitlistEntries(data, { playerName: "Amit", gameIds: ["unknown"], staffName: "staff" }, staff)).toThrow("[JM-WL-003]");
  });

  it("rejects a duplicate (same player, same game, already waiting, case-insensitive)", () => {
    const data = freshWaitlistData();
    createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    expect(() => createWaitlistEntries(data, { playerName: "amit", gameIds: ["G1"], staffName: "staff" }, staff)).toThrow("[JM-WL-004]");
  });

  it("writes one audit entry per created row, tagged with source waitlist", () => {
    const data = freshWaitlistData();
    createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1", "G2"], staffName: "staff" }, staff);
    expect(data.auditLog).toHaveLength(2);
    expect(data.auditLog.every((entry) => entry.action === "CREATE_WAITLIST_ENTRY" && entry.source === "waitlist")).toBe(true);
  });
});

describe("markEntrySeated", () => {
  it("moves an entry from Waiting to Seated", () => {
    const data = freshWaitlistData();
    const [entry] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    const seated = markEntrySeated(data, { entryId: entry.entryId, staffName: "staff" }, staff);
    expect(seated.status).toBe("Seated");
  });

  it("rejects an unknown entryId", () => {
    const data = freshWaitlistData();
    expect(() => markEntrySeated(data, { entryId: "nope", staffName: "staff" }, staff)).toThrow("[JM-WL-005]");
  });

  it("rejects seating an entry that isn't currently waiting", () => {
    const data = freshWaitlistData();
    const [entry] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    markEntrySeated(data, { entryId: entry.entryId, staffName: "staff" }, staff);
    expect(() => markEntrySeated(data, { entryId: entry.entryId, staffName: "staff" }, staff)).toThrow("[JM-WL-010]");
  });
});

describe("removeWaitlistEntry", () => {
  it("marks an entry Removed and logs the reason, with no pin required", () => {
    const data = freshWaitlistData();
    const [entry] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    const removed = removeWaitlistEntry(data, { entryId: entry.entryId, reason: "Left", staffName: "staff" }, staff);
    expect(removed.status).toBe("Removed");
    expect(removed.reason).toBe("Left");
  });

  it("defaults the reason when none is given", () => {
    const data = freshWaitlistData();
    const [entry] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    const removed = removeWaitlistEntry(data, { entryId: entry.entryId, staffName: "staff" }, staff);
    expect(removed.reason).toBe("Removed from waitlist");
  });

  it("can remove a Seated entry too", () => {
    const data = freshWaitlistData();
    const [entry] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    markEntrySeated(data, { entryId: entry.entryId, staffName: "staff" }, staff);
    const removed = removeWaitlistEntry(data, { entryId: entry.entryId, staffName: "staff" }, staff);
    expect(removed.status).toBe("Removed");
  });

  it("rejects an unknown entryId", () => {
    const data = freshWaitlistData();
    expect(() => removeWaitlistEntry(data, { entryId: "nope", staffName: "staff" }, staff)).toThrow("[JM-WL-005]");
  });

  it("rejects removing an already-removed entry", () => {
    const data = freshWaitlistData();
    const [entry] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    removeWaitlistEntry(data, { entryId: entry.entryId, staffName: "staff" }, staff);
    expect(() => removeWaitlistEntry(data, { entryId: entry.entryId, staffName: "staff" }, staff)).toThrow("[JM-WL-006]");
  });
});

describe("reorderWaitlistEntries", () => {
  it("reassigns sortIndex to match the given order", () => {
    const data = freshWaitlistData();
    const [a] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    const [b] = createWaitlistEntries(data, { playerName: "Ben", gameIds: ["G1"], staffName: "staff" }, staff);
    reorderWaitlistEntries(data, { gameId: "G1", entryIds: [b.entryId, a.entryId], staffName: "staff" }, staff);

    const board = getWaitlistBoard(data);
    const column = board.columns.find((c) => c.game.gameId === "G1")!;
    expect(column.waiting.map((e) => e.playerName)).toEqual(["Ben", "Amit"]);
  });

  it("rejects a stale/mismatched order", () => {
    const data = freshWaitlistData();
    const [a] = createWaitlistEntries(data, { playerName: "Amit", gameIds: ["G1"], staffName: "staff" }, staff);
    expect(() => reorderWaitlistEntries(data, { gameId: "G1", entryIds: [a.entryId, "unknown"], staffName: "staff" }, staff)).toThrow("[JM-WL-011]");
  });
});

describe("saveWaitlistGame", () => {
  it("creates a new game with a generated gameId and auto-assigned sortOrder", () => {
    const data = freshWaitlistData();
    const created = saveWaitlistGame(data, { gameName: "$5/10 NLHE", colorTag: "gold", running: false, tableNumbers: "", active: true, staffName: "staff", pin: "7777" }, staff);
    expect(created.gameId).toBeTruthy();
    expect(created.sortOrder).toBe(4);
    expect(data.games).toHaveLength(4);
  });

  it("edits an existing game in place, keeping its gameId and sortOrder stable", () => {
    const data = freshWaitlistData();
    const updated = saveWaitlistGame(data, { gameId: "G1", gameName: "$1/3 NLHE Turbo", colorTag: "burgundy", running: true, tableNumbers: "12", active: false, staffName: "staff", pin: "7777" }, staff);
    expect(updated.gameId).toBe("G1");
    expect(updated.gameName).toBe("$1/3 NLHE Turbo");
    expect(updated.colorTag).toBe("burgundy");
    expect(updated.running).toBe(true);
    expect(updated.tableNumbers).toBe("12");
    expect(updated.active).toBe(false);
    expect(updated.sortOrder).toBe(2);
    expect(data.games).toHaveLength(3);
  });

  it("rejects an empty game name", () => {
    const data = freshWaitlistData();
    expect(() => saveWaitlistGame(data, { gameName: "  ", colorTag: "red", running: false, tableNumbers: "", active: true, staffName: "staff", pin: "7777" }, staff)).toThrow("[JM-WL-007]");
  });

  it("rejects an invalid color tag", () => {
    const data = freshWaitlistData();
    expect(() =>
      saveWaitlistGame(data, { gameName: "New game", colorTag: "purple" as never, running: false, tableNumbers: "", active: true, staffName: "staff", pin: "7777" }, staff)
    ).toThrow("[JM-WL-008]");
  });
});
