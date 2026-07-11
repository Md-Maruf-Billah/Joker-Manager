import { describe, expect, it } from "vitest";
import type { JokerData } from "../types";
import {
  STARTING_DECK_SIZE,
  applyAdminAdjustment,
  clearTvAnnouncement,
  createStaff,
  createTournamentRun,
  editRun,
  getPendingRun,
  getStaffList,
  getTvDisplayData,
  getTvMessage,
  getTvTier,
  pushTvAnnouncement,
  setStaffActive,
  setStaffPin,
  submitDrawResult,
  verifyPin,
  voidRun
} from "./joker";

function freshData(): JokerData {
  const now = new Date().toISOString();

  return {
    settings: {
      starting_deck_size: String(STARTING_DECK_SIZE),
      current_cycle_id: "CYCLE_001",
      show_latest_winner_until_cards_remaining: "48",
      show_probability_from_cards_remaining: "20",
      currency: "AUD",
      tv_refresh_seconds: "30",
      app_status: "active"
    },
    tournamentTypes: [
      { id: "HTJ", name: "Hyper Turbo Joker", shortName: "Hyper Joker", jackpotPerEntry: 40, active: true },
      { id: "SSJ", name: "Sunday Slam Joker Jackpot", shortName: "Sunday Slam", jackpotPerEntry: 50, active: true }
    ],
    jackpotState: {
      jackpotId: "JOKER_MAIN",
      currentCycleId: "CYCLE_001",
      currentJackpot: 0,
      cardsRemaining: STARTING_DECK_SIZE,
      lastCardPulled: null,
      lastRunId: null,
      lastUpdated: now
    },
    runs: [],
    removedCards: [],
    cycles: [
      {
        cycleId: "CYCLE_001",
        startDate: now,
        endDate: null,
        startingDeckSize: STARTING_DECK_SIZE,
        totalContributions: 0,
        jackpotPaid: 0,
        winnerName: null,
        winningRunId: null,
        cardsRemainingWhenHit: null,
        status: "Active"
      }
    ],
    auditLog: [],
    staff: [{ staffId: "STAFF_001", staffName: "staff", passwordHash: "7777", role: "staff", active: true }]
  };
}

function create(data: JokerData, tournamentTypeId: string, entries: number) {
  return createTournamentRun(data, { tournamentTypeId, entries, staffName: "staff", pin: "7777" });
}

function submit(data: JokerData, runId: string, cardPulled: string, winnerName = "Winner", jokerConfirmed = true) {
  return submitDrawResult(data, { runId, winnerName, cardPulled, staffName: "staff", pin: "7777", jokerConfirmed });
}

describe("fresh state", () => {
  it("starts at $0 jackpot and 53 cards", () => {
    const data = freshData();
    expect(data.jackpotState.currentJackpot).toBe(0);
    expect(data.jackpotState.cardsRemaining).toBe(53);
  });
});

describe("createTournamentRun", () => {
  it("adds $400 for 10 Hyper Turbo entries", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(run.contribution).toBe(400);
    expect(run.availableJackpot).toBe(400);
    expect(data.jackpotState.currentJackpot).toBe(400);
  });

  it("adds $500 for 10 Sunday Slam entries", () => {
    const data = freshData();
    const run = create(data, "SSJ", 10);
    expect(run.contribution).toBe(500);
    expect(data.jackpotState.currentJackpot).toBe(500);
  });

  it("saves the run as Awaiting Draw", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(run.status).toBe("Awaiting Draw");
    expect(getPendingRun(data)?.runId).toBe(run.runId);
  });

  it("rejects an inactive tournament type", () => {
    const data = freshData();
    data.tournamentTypes[0].active = false;
    expect(() => create(data, "HTJ", 10)).toThrow("[JM-RUN-001]");
  });

  it("rejects zero or non-integer entries", () => {
    const data = freshData();
    expect(() => create(data, "HTJ", 0)).toThrow("[JM-RUN-002]");
    expect(() => create(data, "HTJ", 1.5)).toThrow("[JM-RUN-002]");
  });

  it("blocks a second tournament while one is awaiting a draw", () => {
    const data = freshData();
    create(data, "HTJ", 10);
    expect(() => create(data, "SSJ", 5)).toThrow("[JM-RUN-003]");
  });
});

describe("submitDrawResult", () => {
  it("requires a winner name", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(() => submit(data, run.runId, "AS", "")).toThrow("[JM-DRAW-002]");
  });

  it("rejects a card that has already been removed", () => {
    const data = freshData();
    const first = create(data, "HTJ", 10);
    submit(data, first.runId, "AS");
    const second = create(data, "HTJ", 10);
    expect(() => submit(data, second.runId, "AS")).toThrow("[JM-DRAW-004]");
  });

  it("decrements cards remaining by one on a non-Joker draw", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    submit(data, run.runId, "AS");
    expect(data.jackpotState.cardsRemaining).toBe(52);
  });

  it("rolls the jackpot forward on a non-Joker draw", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    const completed = submit(data, run.runId, "AS");
    expect(completed.closingJackpot).toBe(400);
    expect(data.jackpotState.currentJackpot).toBe(400);
  });

  it("pays opening jackpot plus tonight's contribution on a Joker hit", () => {
    const data = freshData();
    const first = create(data, "HTJ", 10);
    submit(data, first.runId, "AS");
    const second = create(data, "SSJ", 10);
    const jokerRun = submit(data, second.runId, "JOKER");
    expect(jokerRun.jackpotPaid).toBe(900);
  });

  it("resets jackpot to $0, deck to 53, and opens a new cycle on a Joker hit", () => {
    const data = freshData();
    const first = create(data, "HTJ", 10);
    submit(data, first.runId, "AS");
    const second = create(data, "SSJ", 10);
    submit(data, second.runId, "JOKER");

    expect(data.jackpotState.currentJackpot).toBe(0);
    expect(data.jackpotState.cardsRemaining).toBe(STARTING_DECK_SIZE);
    expect(data.jackpotState.currentCycleId).not.toBe("CYCLE_001");

    const newCycle = data.cycles.find((cycle) => cycle.cycleId === data.jackpotState.currentCycleId);
    expect(newCycle?.status).toBe("Active");

    const oldCycle = data.cycles.find((cycle) => cycle.cycleId === "CYCLE_001");
    expect(oldCycle?.status).toBe("Closed");
    expect(oldCycle?.jackpotPaid).toBe(900);
  });

  it("requires confirmation to submit a Joker draw", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(() => submit(data, run.runId, "JOKER", "Winner", false)).toThrow("[JM-DRAW-005]");
  });

  it("blocks a non-Joker draw when only one card remains", () => {
    const data = freshData();
    data.jackpotState.cardsRemaining = 1;
    const run = create(data, "HTJ", 10);
    expect(() => submit(data, run.runId, "AS")).toThrow("[JM-DRAW-006]");
  });
});

describe("getTvTier boundaries", () => {
  it("is fresh from 53 to 48", () => {
    expect(getTvTier(53)).toBe("fresh");
    expect(getTvTier(48)).toBe("fresh");
  });

  it("is building from 47 to 31", () => {
    expect(getTvTier(47)).toBe("building");
    expect(getTvTier(31)).toBe("building");
  });

  it("is hot from 30 to 21", () => {
    expect(getTvTier(30)).toBe("hot");
    expect(getTvTier(21)).toBe("hot");
  });

  it("is probability from 20 to 11", () => {
    expect(getTvTier(20)).toBe("probability");
    expect(getTvTier(11)).toBe("probability");
  });

  it("is danger from 10 to 1", () => {
    expect(getTvTier(10)).toBe("danger");
    expect(getTvTier(1)).toBe("danger");
  });
});

describe("getTvDisplayData visibility", () => {
  it("shows the latest winner from 53 to 48 cards and hides it at 47 and below", () => {
    const data = freshData();
    data.jackpotState.cardsRemaining = 48;
    expect(getTvDisplayData(data).showLatestWinner).toBe(true);
    data.jackpotState.cardsRemaining = 47;
    expect(getTvDisplayData(data).showLatestWinner).toBe(false);
  });

  it("hides probability above 20 cards and shows it at 20 and below", () => {
    const data = freshData();
    data.jackpotState.cardsRemaining = 21;
    expect(getTvDisplayData(data).showProbability).toBe(false);
    data.jackpotState.cardsRemaining = 20;
    expect(getTvDisplayData(data).showProbability).toBe(true);
  });
});

describe("TV announcement", () => {
  it("defaults to inactive with no message", () => {
    const data = freshData();
    expect(getTvMessage(data)).toEqual({ active: false, title: "", sub: "" });
    expect(getTvDisplayData(data).tvMessage).toEqual({ active: false, title: "", sub: "" });
  });

  it("pushes a headline and subtext live", () => {
    const data = freshData();
    const result = pushTvAnnouncement(data, {
      title: "  Sunday Slam Tonight  ",
      sub: "  Late registration closes 6:45PM  ",
      staffName: "staff",
      pin: "7777"
    });

    expect(result).toEqual({ active: true, title: "Sunday Slam Tonight", sub: "Late registration closes 6:45PM" });
    expect(getTvDisplayData(data).tvMessage.active).toBe(true);
    expect(data.auditLog[data.auditLog.length - 1]?.action).toBe("PUSH_TV_ANNOUNCEMENT");
  });

  it("rejects a blank headline", () => {
    const data = freshData();
    expect(() => pushTvAnnouncement(data, { title: "  ", sub: "", staffName: "staff", pin: "7777" })).toThrow(
      "[JM-TV-001]"
    );
  });

  it("clears an announcement without deleting the last headline text", () => {
    const data = freshData();
    pushTvAnnouncement(data, { title: "Sunday Slam", sub: "Tonight", staffName: "staff", pin: "7777" });

    const cleared = clearTvAnnouncement(data, { staffName: "staff", pin: "7777" });

    expect(cleared.active).toBe(false);
    expect(getTvDisplayData(data).tvMessage.active).toBe(false);
    expect(data.auditLog[data.auditLog.length - 1]?.action).toBe("CLEAR_TV_ANNOUNCEMENT");
  });

  it("requires a valid staff password to push or clear", () => {
    const data = freshData();
    expect(() =>
      pushTvAnnouncement(data, { title: "Sunday Slam", sub: "", staffName: "staff", pin: "wrong" })
    ).toThrow("[JM-AUTH-002]");
    expect(() => clearTvAnnouncement(data, { staffName: "staff", pin: "wrong" })).toThrow("[JM-AUTH-002]");
  });
});

describe("verifyPin", () => {
  it("rejects an incorrect password", () => {
    const data = freshData();
    expect(() => verifyPin(data, "staff", "wrong")).toThrow("[JM-AUTH-002]");
  });

  it("rejects an unknown staff member", () => {
    const data = freshData();
    expect(() => verifyPin(data, "nobody", "7777")).toThrow("[JM-AUTH-001]");
  });

  it("accepts the correct password", () => {
    const data = freshData();
    expect(verifyPin(data, "staff", "7777").staffName).toBe("staff");
  });
});

describe("applyAdminAdjustment", () => {
  it("requires a reason", () => {
    const data = freshData();
    expect(() =>
      applyAdminAdjustment(data, { adjustmentType: "add", amount: 100, reason: "", staffName: "staff", pin: "7777" })
    ).toThrow("[JM-ADJ-001]");
  });

  it("adds, subtracts, and sets the jackpot amount", () => {
    const data = freshData();
    applyAdminAdjustment(data, { adjustmentType: "add", amount: 500, reason: "Test add", staffName: "staff", pin: "7777" });
    expect(data.jackpotState.currentJackpot).toBe(500);

    applyAdminAdjustment(data, { adjustmentType: "subtract", amount: 200, reason: "Test subtract", staffName: "staff", pin: "7777" });
    expect(data.jackpotState.currentJackpot).toBe(300);

    applyAdminAdjustment(data, { adjustmentType: "set", amount: 1000, reason: "Test set", staffName: "staff", pin: "7777" });
    expect(data.jackpotState.currentJackpot).toBe(1000);
  });

  it("resets the deck to 53 cards and clears removed cards for the active cycle", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    submit(data, run.runId, "AS");
    expect(data.jackpotState.cardsRemaining).toBe(52);

    applyAdminAdjustment(data, { adjustmentType: "reset_deck", reason: "Test reset", staffName: "staff", pin: "7777" });
    expect(data.jackpotState.cardsRemaining).toBe(STARTING_DECK_SIZE);
    expect(data.removedCards).toHaveLength(0);
  });

  it("writes an audit log entry for every adjustment", () => {
    const data = freshData();
    applyAdminAdjustment(data, { adjustmentType: "add", amount: 100, reason: "Test", staffName: "staff", pin: "7777" });
    expect(data.auditLog).toHaveLength(1);
    expect(data.auditLog[0].action).toBe("MANUAL_ADJUSTMENT");
  });
});

describe("editRun", () => {
  it("recomputes contribution and jackpot when entries change on an Awaiting Draw run", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Recount", entries: 15 });

    expect(run.entries).toBe(15);
    expect(run.contribution).toBe(600);
    expect(run.availableJackpot).toBe(600);
    expect(data.jackpotState.currentJackpot).toBe(600);
  });

  it("corrects the winner name on a Complete run", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    submit(data, run.runId, "AS", "Wrong Name");
    editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Spelling fix", winnerName: "Right Name" });
    expect(run.winnerName).toBe("Right Name");
  });

  it("rejects editing entries after the draw is submitted", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    submit(data, run.runId, "AS");
    expect(() =>
      editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Test", entries: 20 })
    ).toThrow("[JM-EDIT-006]");
  });

  it("rejects editing winner name before the draw is submitted", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(() =>
      editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Test", winnerName: "Someone" })
    ).toThrow("[JM-EDIT-005]");
  });

  it("rejects edits with no reason", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(() =>
      editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "", entries: 20 })
    ).toThrow("[JM-EDIT-003]");
  });

  it("rejects edits with no actual changes", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(() =>
      editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Test", entries: 10 })
    ).toThrow("[JM-EDIT-008]");
  });

  it("rejects editing a voided run", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Cancelled" });
    expect(() =>
      editRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Test", entries: 20 })
    ).toThrow("[JM-EDIT-002]");
  });
});

describe("voidRun", () => {
  it("cancels a pending Awaiting Draw run and reverses its contribution", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(data.jackpotState.currentJackpot).toBe(400);

    voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Cancelled before draw" });

    expect(run.status).toBe("Voided");
    expect(data.jackpotState.currentJackpot).toBe(0);
    expect(getPendingRun(data)).toBeNull();
  });

  it("reverses the latest Complete non-Joker run", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    submit(data, run.runId, "AS");
    expect(data.jackpotState.cardsRemaining).toBe(52);
    expect(data.removedCards).toHaveLength(1);

    voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Wrong card recorded" });

    expect(run.status).toBe("Voided");
    expect(data.jackpotState.currentJackpot).toBe(0);
    expect(data.jackpotState.cardsRemaining).toBe(STARTING_DECK_SIZE);
    expect(data.removedCards).toHaveLength(0);
    expect(data.jackpotState.lastRunId).toBeNull();
  });

  it("points lastRunId at the prior run after voiding the latest one", () => {
    const data = freshData();
    const first = create(data, "HTJ", 10);
    submit(data, first.runId, "AS");
    const second = create(data, "SSJ", 5);
    submit(data, second.runId, "KS");

    voidRun(data, { runId: second.runId, staffName: "staff", pin: "7777", reason: "Wrong card recorded" });

    expect(data.jackpotState.lastRunId).toBe(first.runId);
    expect(data.jackpotState.lastCardPulled).toBe("AS");
  });

  it("blocks voiding a Joker-hit run", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    submit(data, run.runId, "JOKER");
    expect(() =>
      voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Test" })
    ).toThrow("[JM-VOID-004]");
  });

  it("blocks voiding a run that is not the most recent", () => {
    const data = freshData();
    const first = create(data, "HTJ", 10);
    submit(data, first.runId, "AS");
    const second = create(data, "SSJ", 5);
    submit(data, second.runId, "KS");

    expect(() =>
      voidRun(data, { runId: first.runId, staffName: "staff", pin: "7777", reason: "Test" })
    ).toThrow("[JM-VOID-005]");
  });

  it("blocks voiding an already-voided run", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "First void" });
    expect(() =>
      voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "Second void" })
    ).toThrow("[JM-VOID-002]");
  });

  it("requires a reason", () => {
    const data = freshData();
    const run = create(data, "HTJ", 10);
    expect(() => voidRun(data, { runId: run.runId, staffName: "staff", pin: "7777", reason: "" })).toThrow(
      "[JM-VOID-003]"
    );
  });
});

describe("createStaff", () => {
  it("adds a new staff member who can then log in with their own PIN", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });

    expect(getStaffList(data)).toHaveLength(2);
    expect(verifyPin(data, "Sarah", "4321").staffName).toBe("Sarah");
  });

  it("rejects a duplicate staff name", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });
    expect(() =>
      createStaff(data, { newStaffName: "sarah", newPin: "9999", staffName: "staff", pin: "7777" })
    ).toThrow("[JM-STAFF-003]");
  });

  it("rejects a PIN shorter than 4 characters", () => {
    const data = freshData();
    expect(() =>
      createStaff(data, { newStaffName: "Sarah", newPin: "123", staffName: "staff", pin: "7777" })
    ).toThrow("[JM-STAFF-002]");
  });

  it("writes an audit log entry", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });
    expect(data.auditLog).toHaveLength(1);
    expect(data.auditLog[0].action).toBe("CREATE_STAFF");
  });
});

describe("setStaffPin", () => {
  it("changes the target staff member's PIN", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });
    setStaffPin(data, { targetStaffName: "Sarah", newPin: "5555", staffName: "staff", pin: "7777" });

    expect(() => verifyPin(data, "Sarah", "4321")).toThrow("[JM-AUTH-002]");
    expect(verifyPin(data, "Sarah", "5555").staffName).toBe("Sarah");
  });

  it("rejects a PIN shorter than 4 characters", () => {
    const data = freshData();
    expect(() =>
      setStaffPin(data, { targetStaffName: "staff", newPin: "12", staffName: "staff", pin: "7777" })
    ).toThrow("[JM-STAFF-004]");
  });
});

describe("setStaffActive", () => {
  it("deactivates a staff member so they can no longer log in", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });
    setStaffActive(data, { targetStaffName: "Sarah", active: false, staffName: "staff", pin: "7777" });

    expect(() => verifyPin(data, "Sarah", "4321")).toThrow("[JM-AUTH-001]");
  });

  it("blocks deactivating the last remaining active staff member", () => {
    const data = freshData();
    expect(() =>
      setStaffActive(data, { targetStaffName: "staff", active: false, staffName: "staff", pin: "7777" })
    ).toThrow("[JM-STAFF-006]");
  });

  it("allows deactivating one staff member when another stays active", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });
    setStaffActive(data, { targetStaffName: "staff", active: false, staffName: "Sarah", pin: "4321" });

    expect(() => verifyPin(data, "staff", "7777")).toThrow("[JM-AUTH-001]");
  });

  it("reactivates a deactivated staff member", () => {
    const data = freshData();
    createStaff(data, { newStaffName: "Sarah", newPin: "4321", staffName: "staff", pin: "7777" });
    setStaffActive(data, { targetStaffName: "Sarah", active: false, staffName: "staff", pin: "7777" });
    setStaffActive(data, { targetStaffName: "Sarah", active: true, staffName: "staff", pin: "7777" });

    expect(verifyPin(data, "Sarah", "4321").staffName).toBe("Sarah");
  });
});
