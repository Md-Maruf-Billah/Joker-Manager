import type {
  AdminAdjustmentPayload,
  AuditLogEntry,
  ClearTvAnnouncementPayload,
  CreateStaffPayload,
  CreateTournamentPayload,
  DashboardData,
  EditRunPayload,
  JokerData,
  JackpotCycle,
  PushTvAnnouncementPayload,
  RemovedCard,
  Role,
  SetStaffActivePayload,
  SetStaffPinPayload,
  StaffMember,
  SubmitDrawPayload,
  TournamentRun,
  TournamentType,
  TvDisplayData,
  TvMessage,
  TvTier,
  UpsertTournamentTypePayload,
  VoidRunPayload
} from "../types";
import { FULL_DECK, JOKER_CODE, buildCardViews, cardLabel, isJoker } from "./cards";
import { appError } from "./errors";

export const STARTING_DECK_SIZE = 53;

export const TOURNAMENT_TYPES: TournamentType[] = [
  {
    id: "HTJ",
    name: "Hyper Turbo Joker",
    shortName: "Hyper Joker",
    jackpotPerEntry: 40,
    active: true
  },
  {
    id: "SSJ",
    name: "Sunday Slam Joker Jackpot",
    shortName: "Sunday Slam",
    jackpotPerEntry: 50,
    active: true
  }
];

const seedRemovedCodes = [
  "QD",
  "8C",
  "3S",
  "AH",
  "10D",
  "5C",
  "KS",
  "2H",
  "JD",
  "7S",
  "4D",
  "9H",
  "AC",
  "6S",
  "KC",
  "2D",
  "QS",
  "5H"
];

// Mock mode has no real backend to hash against, so passwordHash here just
// holds the plaintext PIN directly. The real Apps Script backend always
// stores a salted SHA-256 hash instead; see hashPassword_ in Code.gs.
const seedStaff: StaffMember[] = [
  {
    staffId: "STAFF_001",
    staffName: "staff",
    passwordHash: "7777",
    role: "staff",
    active: true
  }
];

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}_${stamp}_${suffix}`;
}

function audit(
  staffName: string,
  role: Role,
  action: AuditLogEntry["action"],
  recordId: string,
  fieldChanged: string,
  oldValue: string,
  newValue: string,
  reason: string,
  source: AuditLogEntry["source"]
): AuditLogEntry {
  return {
    logId: id("LOG"),
    timestamp: nowIso(),
    staffName,
    role,
    action,
    recordId,
    fieldChanged,
    oldValue,
    newValue,
    reason,
    source
  };
}

export function createInitialData(): JokerData {
  const seedTime = nowIso();
  const removedCards: RemovedCard[] = seedRemovedCodes.map((card, index) => ({
    cycleId: "CYCLE_002",
    card,
    runId: `RUN_SEED_${String(index + 1).padStart(3, "0")}`,
    removedDate: seedTime,
    playerName: ["Andrew Peng", "Mia Tran", "Dean Blatt", "Kara Lee"][index % 4]
  }));

  const runs: TournamentRun[] = removedCards.slice(0, 8).map((removed, index) => {
    const runDate = new Date(Date.now() - (8 - index) * 4 * 24 * 60 * 60 * 1000).toISOString();
    const isHyper = index % 2 === 0;
    const contribution = isHyper ? 920 + index * 40 : 900 + index * 50;
    const openingJackpot = 4200 + index * 760;
    const availableJackpot = openingJackpot + contribution;

    return {
      runId: removed.runId,
      date: runDate.slice(0, 10),
      timeCreated: runDate,
      tournamentTypeId: isHyper ? "HTJ" : "SSJ",
      tournamentName: isHyper ? "Hyper Turbo Joker" : "Sunday Slam Joker Jackpot",
      entries: isHyper ? 23 + index : 18 + index,
      jackpotPerEntry: isHyper ? 40 : 50,
      contribution,
      openingJackpot,
      availableJackpot,
      winnerName: removed.playerName,
      cardPulled: removed.card,
      jokerHit: false,
      jackpotPaid: 0,
      closingJackpot: availableJackpot,
      cardsBefore: STARTING_DECK_SIZE - index,
      cardsAfter: STARTING_DECK_SIZE - index - 1,
      staffName: "staff",
      status: "Complete",
      createdAt: runDate,
      updatedAt: runDate
    };
  });

  return {
    settings: {
      starting_deck_size: String(STARTING_DECK_SIZE),
      current_cycle_id: "CYCLE_002",
      show_latest_winner_until_cards_remaining: "48",
      show_probability_from_cards_remaining: "20",
      currency: "AUD",
      tv_refresh_seconds: "30",
      app_status: "active",
      tv_announcement_active: "false",
      tv_announcement_title: "",
      tv_announcement_sub: ""
    },
    tournamentTypes: TOURNAMENT_TYPES,
    jackpotState: {
      jackpotId: "JOKER_MAIN",
      currentCycleId: "CYCLE_002",
      currentJackpot: 9760,
      cardsRemaining: STARTING_DECK_SIZE - removedCards.length,
      lastCardPulled: seedRemovedCodes[7],
      lastRunId: "RUN_SEED_008",
      lastUpdated: seedTime
    },
    runs,
    removedCards,
    cycles: [
      {
        cycleId: "CYCLE_001",
        startDate: "2026-05-01T10:00:00.000Z",
        endDate: "2026-06-30T22:45:00.000Z",
        startingDeckSize: STARTING_DECK_SIZE,
        totalContributions: 8840,
        jackpotPaid: 8840,
        winnerName: "Dean Blatt",
        winningRunId: "RUN_PREV_JOKER",
        cardsRemainingWhenHit: 47,
        status: "Closed"
      },
      {
        cycleId: "CYCLE_002",
        startDate: "2026-07-01T10:00:00.000Z",
        endDate: null,
        startingDeckSize: STARTING_DECK_SIZE,
        totalContributions: 9760,
        jackpotPaid: 0,
        winnerName: null,
        winningRunId: null,
        cardsRemainingWhenHit: null,
        status: "Active"
      }
    ],
    auditLog: [
      audit("staff", "staff", "SUBMIT_DRAW", "RUN_SEED_001", "cardPulled", "", "Q\u2666", "Seed demo history", "api")
    ],
    staff: seedStaff
  };
}

export function normalizeData(data: JokerData): JokerData {
  if (!Array.isArray(data.staff) || data.staff.length === 0) {
    data.staff = seedStaff;
  }

  if (!Array.isArray(data.tournamentTypes) || data.tournamentTypes.length === 0) {
    data.tournamentTypes = TOURNAMENT_TYPES;
  }

  return data;
}

export function getActiveCycle(data: JokerData) {
  const cycle = data.cycles.find((item) => item.cycleId === data.jackpotState.currentCycleId);
  if (!cycle) {
    throw appError("JM-DATA-001", "Active jackpot cycle is missing.");
  }

  return cycle;
}

export function getPendingRun(data: JokerData) {
  return data.runs.find((run) => run.status === "Awaiting Draw") ?? null;
}

export function getLatestRun(data: JokerData) {
  return [...data.runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

export function getTvTier(cardsRemaining: number): TvTier {
  if (cardsRemaining >= 48) {
    return "fresh";
  }

  if (cardsRemaining >= 31) {
    return "building";
  }

  if (cardsRemaining >= 21) {
    return "hot";
  }

  if (cardsRemaining >= 11) {
    return "probability";
  }

  return "danger";
}

export function getLatestJokerWinner(data: JokerData) {
  const closed = [...data.cycles]
    .filter((cycle) => cycle.status === "Closed" && cycle.winnerName)
    .sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""));

  const latest = closed[0];
  return latest
    ? {
        name: latest.winnerName ?? "",
        amount: latest.jackpotPaid
      }
    : null;
}

function copyForTier(tier: TvTier, cardsRemaining: number) {
  switch (tier) {
    case "fresh":
      return {
        headline: "Fresh deck. New chase begins.",
        subline: `${cardsRemaining} cards remaining`,
        cta: "Get in early."
      };
    case "building":
      return {
        headline: "The deck is getting thinner.",
        subline: `${cardsRemaining} cards remaining`,
        cta: "Every tournament adds more to the pool."
      };
    case "hot":
      return {
        headline: "The chase is heating up.",
        subline: `Only ${cardsRemaining} cards remain.`,
        cta: "Fewer cards. Bigger jackpot."
      };
    case "probability":
      return {
        headline: `1 in ${cardsRemaining} to hit the Joker`,
        subline: `${cardsRemaining} cards remaining`,
        cta: "The odds are getting serious."
      };
    case "danger":
      return {
        headline: `Only ${cardsRemaining} cards left`,
        subline: `1 in ${cardsRemaining}`,
        cta: "Every pull could be the one."
      };
  }
}

export function getTvMessage(data: JokerData): TvMessage {
  return {
    active: data.settings.tv_announcement_active === "true",
    title: data.settings.tv_announcement_title ?? "",
    sub: data.settings.tv_announcement_sub ?? ""
  };
}

export function pushTvAnnouncement(data: JokerData, payload: PushTvAnnouncementPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const title = payload.title.trim();
  const sub = payload.sub.trim();

  if (!title) {
    throw appError("JM-TV-001", "Headline is required.");
  }

  data.settings.tv_announcement_active = "true";
  data.settings.tv_announcement_title = title;
  data.settings.tv_announcement_sub = sub;

  data.auditLog.push(
    audit(staff.staffName, staff.role, "PUSH_TV_ANNOUNCEMENT", "TV_MESSAGE", "tvAnnouncement", "", title, "Announcement pushed to TV", "admin")
  );

  return getTvMessage(data);
}

export function clearTvAnnouncement(data: JokerData, payload: ClearTvAnnouncementPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const previous = getTvMessage(data);

  data.settings.tv_announcement_active = "false";

  data.auditLog.push(
    audit(staff.staffName, staff.role, "CLEAR_TV_ANNOUNCEMENT", "TV_MESSAGE", "tvAnnouncement", previous.title, "", "Announcement cleared", "admin")
  );

  return getTvMessage(data);
}

export function getTvDisplayData(data: JokerData): TvDisplayData {
  const cardsRemaining = data.jackpotState.cardsRemaining;
  const tier = getTvTier(cardsRemaining);

  return {
    jackpot: data.jackpotState.currentJackpot,
    cardsRemaining,
    tier,
    showLatestWinner: cardsRemaining >= 48,
    showProbability: cardsRemaining <= 20,
    latestWinner: cardsRemaining >= 48 ? getLatestJokerWinner(data) : null,
    copy: copyForTier(tier, cardsRemaining),
    tvMessage: getTvMessage(data),
    refreshedAt: nowIso()
  };
}

export function getDashboardData(data: JokerData): DashboardData {
  return {
    jackpotState: data.jackpotState,
    pendingRun: getPendingRun(data),
    latestRun: getLatestRun(data),
    activeCycle: getActiveCycle(data),
    recentAudit: [...data.auditLog].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5),
    jackpotTrend: getJackpotTrend(data)
  };
}

export function getJackpotTrend(data: JokerData) {
  const daily = new Map<string, number>();

  [...data.runs]
    .filter((run) => run.status === "Complete")
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
    .forEach((run) => {
      daily.set(run.updatedAt.slice(0, 10), run.closingJackpot);
    });

  daily.set(new Date().toISOString().slice(0, 10), data.jackpotState.currentJackpot);

  return [...daily.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, jackpot]) => ({ date, jackpot }));
}

export function getCards(data: JokerData) {
  return buildCardViews(data.removedCards, data.jackpotState.currentCycleId);
}

export function verifyPin(data: JokerData, staffName: string, pin: string, _requiredRole: Role = "staff") {
  const staff = data.staff.find(
    (item) => item.active && item.staffName.toLowerCase() === staffName.trim().toLowerCase()
  );

  if (!staff) {
    throw appError("JM-AUTH-001", "Staff member is not active or does not exist.");
  }

  if (staff.passwordHash !== pin) {
    throw appError("JM-AUTH-002", "Password is incorrect.");
  }

  return staff;
}

export function getStaffList(data: JokerData) {
  return data.staff.map((item) => ({
    staffId: item.staffId,
    staffName: item.staffName,
    role: item.role,
    active: item.active
  }));
}

export function createStaff(data: JokerData, payload: CreateStaffPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const newStaffName = payload.newStaffName.trim();

  if (!newStaffName) {
    throw appError("JM-STAFF-001", "Staff name is required.");
  }

  if (!payload.newPin || payload.newPin.length < 4) {
    throw appError("JM-STAFF-002", "PIN must be at least 4 characters.");
  }

  if (data.staff.some((item) => item.staffName.toLowerCase() === newStaffName.toLowerCase())) {
    throw appError("JM-STAFF-003", "A staff member with that name already exists.");
  }

  const created: StaffMember = {
    staffId: id("STAFF"),
    staffName: newStaffName,
    passwordHash: payload.newPin,
    role: "staff",
    active: true
  };

  data.staff.push(created);
  data.auditLog.push(
    audit(staff.staffName, staff.role, "CREATE_STAFF", created.staffId, "staffName", "", newStaffName, "Staff member added", "admin")
  );

  return getStaffList(data).find((item) => item.staffId === created.staffId);
}

export function setStaffPin(data: JokerData, payload: SetStaffPinPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);

  if (!payload.newPin || payload.newPin.length < 4) {
    throw appError("JM-STAFF-004", "PIN must be at least 4 characters.");
  }

  const target = data.staff.find(
    (item) => item.staffName.toLowerCase() === payload.targetStaffName.trim().toLowerCase()
  );

  if (!target) {
    throw appError("JM-STAFF-005", "Staff member was not found.");
  }

  target.passwordHash = payload.newPin;
  data.auditLog.push(
    audit(staff.staffName, staff.role, "SET_STAFF_PIN", target.staffId, "passwordHash", "", "", "PIN reset", "admin")
  );

  return getStaffList(data).find((item) => item.staffId === target.staffId);
}

export function setStaffActive(data: JokerData, payload: SetStaffActivePayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const target = data.staff.find(
    (item) => item.staffName.toLowerCase() === payload.targetStaffName.trim().toLowerCase()
  );

  if (!target) {
    throw appError("JM-STAFF-005", "Staff member was not found.");
  }

  if (!payload.active) {
    const otherActiveCount = data.staff.filter((item) => item.active && item.staffId !== target.staffId).length;
    if (otherActiveCount === 0) {
      throw appError("JM-STAFF-006", "At least one active staff member must remain.");
    }
  }

  const oldValue = String(target.active);
  target.active = payload.active;
  data.auditLog.push(
    audit(
      staff.staffName,
      staff.role,
      "SET_STAFF_ACTIVE",
      target.staffId,
      "active",
      oldValue,
      String(target.active),
      target.active ? "Staff reactivated" : "Staff deactivated",
      "admin"
    )
  );

  return getStaffList(data).find((item) => item.staffId === target.staffId);
}

export function createTournamentRun(data: JokerData, payload: CreateTournamentPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const entries = Number(payload.entries);
  const tournamentType = data.tournamentTypes.find(
    (item) => item.id === payload.tournamentTypeId && item.active
  );

  if (!tournamentType) {
    throw appError("JM-RUN-001", "Tournament type must be active.");
  }

  if (!Number.isInteger(entries) || entries <= 0) {
    throw appError("JM-RUN-002", "Entries must be a positive whole number.");
  }

  if (getPendingRun(data)) {
    throw appError("JM-RUN-003", "Resolve the pending draw before creating another tournament.");
  }

  const openingJackpot = data.jackpotState.currentJackpot;
  const contribution = entries * tournamentType.jackpotPerEntry;
  const availableJackpot = openingJackpot + contribution;
  const timestamp = nowIso();
  const runId = id("RUN");

  const run: TournamentRun = {
    runId,
    date: timestamp.slice(0, 10),
    timeCreated: timestamp,
    tournamentTypeId: tournamentType.id,
    tournamentName: tournamentType.name,
    entries,
    jackpotPerEntry: tournamentType.jackpotPerEntry,
    contribution,
    openingJackpot,
    availableJackpot,
    winnerName: null,
    cardPulled: null,
    jokerHit: false,
    jackpotPaid: 0,
    closingJackpot: availableJackpot,
    cardsBefore: data.jackpotState.cardsRemaining,
    cardsAfter: data.jackpotState.cardsRemaining,
    staffName: staff.staffName,
    status: "Awaiting Draw",
    createdAt: timestamp,
    updatedAt: timestamp
  };

  data.runs.unshift(run);
  data.jackpotState.currentJackpot = availableJackpot;
  data.jackpotState.lastRunId = runId;
  data.jackpotState.lastUpdated = timestamp;
  getActiveCycle(data).totalContributions += contribution;
  data.auditLog.push(
    audit(staff.staffName, staff.role, "CREATE_RUN", runId, "status", "", "Awaiting Draw", "Tournament created", "dashboard")
  );

  return run;
}

export function submitDrawResult(data: JokerData, payload: SubmitDrawPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const run = data.runs.find((item) => item.runId === payload.runId && item.status === "Awaiting Draw");

  if (!run) {
    throw appError("JM-DRAW-001", "No awaiting draw exists for that run.");
  }

  if (!payload.winnerName.trim()) {
    throw appError("JM-DRAW-002", "Winner name is required.");
  }

  if (!FULL_DECK.includes(payload.cardPulled)) {
    throw appError("JM-DRAW-003", "Selected card is not valid.");
  }

  const activeCards = getCards(data).filter((card) => !card.removed);
  const selected = activeCards.find((card) => card.code === payload.cardPulled);

  if (!selected) {
    throw appError("JM-DRAW-004", "Selected card has already been removed.");
  }

  const timestamp = nowIso();
  const jokerHit = isJoker(payload.cardPulled);

  if (jokerHit && !payload.jokerConfirmed) {
    throw appError("JM-DRAW-005", "Joker hit requires confirmation.");
  }

  if (!jokerHit && data.jackpotState.cardsRemaining <= 1) {
    throw appError("JM-DRAW-006", "Critical deck warning: only one card remains and it is not the Joker.");
  }

  run.winnerName = payload.winnerName.trim();
  run.cardPulled = payload.cardPulled;
  run.jokerHit = jokerHit;
  run.status = "Complete";
  run.updatedAt = timestamp;

  if (jokerHit) {
    run.jackpotPaid = run.availableJackpot;
    run.closingJackpot = 0;
    run.cardsAfter = STARTING_DECK_SIZE;

    const cycle = getActiveCycle(data);
    cycle.endDate = timestamp;
    cycle.jackpotPaid = run.availableJackpot;
    cycle.winnerName = run.winnerName;
    cycle.winningRunId = run.runId;
    cycle.cardsRemainingWhenHit = data.jackpotState.cardsRemaining;
    cycle.status = "Closed";

    const cycleNumber = data.cycles.length + 1;
    const newCycle: JackpotCycle = {
      cycleId: `CYCLE_${String(cycleNumber).padStart(3, "0")}`,
      startDate: timestamp,
      endDate: null,
      startingDeckSize: STARTING_DECK_SIZE,
      totalContributions: 0,
      jackpotPaid: 0,
      winnerName: null,
      winningRunId: null,
      cardsRemainingWhenHit: null,
      status: "Active"
    };

    data.cycles.push(newCycle);
    data.jackpotState.currentCycleId = newCycle.cycleId;
    data.jackpotState.currentJackpot = 0;
    data.jackpotState.cardsRemaining = STARTING_DECK_SIZE;
  } else {
    run.jackpotPaid = 0;
    run.closingJackpot = run.availableJackpot;
    run.cardsAfter = run.cardsBefore - 1;

    data.removedCards.push({
      cycleId: data.jackpotState.currentCycleId,
      card: payload.cardPulled,
      runId: run.runId,
      removedDate: timestamp,
      playerName: run.winnerName
    });

    data.jackpotState.currentJackpot = run.availableJackpot;
    data.jackpotState.cardsRemaining = run.cardsAfter;
  }

  data.jackpotState.lastCardPulled = payload.cardPulled;
  data.jackpotState.lastRunId = run.runId;
  data.jackpotState.lastUpdated = timestamp;
  data.auditLog.push(
    audit(
      staff.staffName,
      staff.role,
      "SUBMIT_DRAW",
      run.runId,
      "cardPulled",
      "",
      cardLabel(payload.cardPulled),
      jokerHit ? "Joker hit confirmed" : "Draw submitted",
      "dashboard"
    )
  );

  return run;
}

function findMostRecentReference(data: JokerData, excludeRunId: string) {
  const candidate = [...data.runs]
    .filter((run) => run.status === "Complete" && run.runId !== excludeRunId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];

  return {
    lastRunId: candidate ? candidate.runId : null,
    lastCardPulled: candidate ? candidate.cardPulled : null
  };
}

export function editRun(data: JokerData, payload: EditRunPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const run = data.runs.find((item) => item.runId === payload.runId);

  if (!run) {
    throw appError("JM-EDIT-001", "Tournament run was not found.");
  }

  if (run.status === "Voided") {
    throw appError("JM-EDIT-002", "Voided runs cannot be edited.");
  }

  if (!payload.reason.trim()) {
    throw appError("JM-EDIT-003", "A reason is required for edits.");
  }

  const winnerName = payload.winnerName?.trim();
  if (winnerName !== undefined) {
    if (!winnerName) {
      throw appError("JM-EDIT-004", "Winner name cannot be blank.");
    }
    if (run.status !== "Complete") {
      throw appError("JM-EDIT-005", "Winner name can only be corrected after the draw is submitted.");
    }
  }

  let newEntries: number | undefined;
  if (payload.entries !== undefined) {
    if (run.status !== "Awaiting Draw") {
      throw appError("JM-EDIT-006", "Entries can only be corrected before the draw is submitted.");
    }
    newEntries = Number(payload.entries);
    if (!Number.isInteger(newEntries) || newEntries <= 0) {
      throw appError("JM-EDIT-007", "Entries must be a positive whole number.");
    }
  }

  const timestamp = nowIso();
  const changes: Array<{ field: string; oldValue: string; newValue: string }> = [];

  if (winnerName !== undefined && winnerName !== run.winnerName) {
    changes.push({ field: "winnerName", oldValue: run.winnerName ?? "", newValue: winnerName });
    run.winnerName = winnerName;

    const removed = data.removedCards.find((item) => item.runId === run.runId);
    if (removed) {
      removed.playerName = winnerName;
    }
  }

  if (newEntries !== undefined && newEntries !== run.entries) {
    const newContribution = newEntries * run.jackpotPerEntry;
    const contributionDelta = newContribution - run.contribution;

    changes.push({ field: "entries", oldValue: String(run.entries), newValue: String(newEntries) });
    run.entries = newEntries;
    run.contribution = newContribution;
    run.availableJackpot += contributionDelta;
    run.closingJackpot = run.availableJackpot;

    data.jackpotState.currentJackpot += contributionDelta;
    getActiveCycle(data).totalContributions += contributionDelta;
  }

  if (changes.length === 0) {
    throw appError("JM-EDIT-008", "No changes were made.");
  }

  run.updatedAt = timestamp;
  data.jackpotState.lastUpdated = timestamp;

  changes.forEach((change) => {
    data.auditLog.push(
      audit(
        staff.staffName,
        staff.role,
        "EDIT_RUN",
        run.runId,
        change.field,
        change.oldValue,
        change.newValue,
        payload.reason,
        "dashboard"
      )
    );
  });

  return run;
}

export function voidRun(data: JokerData, payload: VoidRunPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const run = data.runs.find((item) => item.runId === payload.runId);

  if (!run) {
    throw appError("JM-VOID-001", "Tournament run was not found.");
  }

  if (run.status === "Voided") {
    throw appError("JM-VOID-002", "This run has already been voided.");
  }

  if (!payload.reason.trim()) {
    throw appError("JM-VOID-003", "A reason is required to void a run.");
  }

  if (run.jokerHit) {
    throw appError("JM-VOID-004", "Joker-hit runs cannot be voided. Use a manual admin adjustment instead.");
  }

  if (run.runId !== data.jackpotState.lastRunId) {
    throw appError("JM-VOID-005", "Only the most recent tournament run can be voided.");
  }

  const timestamp = nowIso();
  const oldStatus = run.status;

  data.jackpotState.currentJackpot = run.openingJackpot;
  getActiveCycle(data).totalContributions -= run.contribution;

  if (oldStatus === "Complete") {
    data.jackpotState.cardsRemaining = run.cardsBefore;
    data.removedCards = data.removedCards.filter((item) => item.runId !== run.runId);
  }

  run.status = "Voided";
  run.updatedAt = timestamp;

  const reference = findMostRecentReference(data, run.runId);
  data.jackpotState.lastRunId = reference.lastRunId;
  data.jackpotState.lastCardPulled = reference.lastCardPulled;
  data.jackpotState.lastUpdated = timestamp;

  data.auditLog.push(
    audit(staff.staffName, staff.role, "VOID_RUN", run.runId, "status", oldStatus, "Voided", payload.reason, "dashboard")
  );

  return run;
}

export function applyAdminAdjustment(data: JokerData, payload: AdminAdjustmentPayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const previousJackpot = data.jackpotState.currentJackpot;
  const previousCards = data.jackpotState.cardsRemaining;

  if (!payload.reason.trim()) {
    throw appError("JM-ADJ-001", "A reason is required for admin adjustments.");
  }

  if (payload.adjustmentType !== "reset_deck") {
    const amount = Number(payload.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      throw appError("JM-ADJ-002", "Amount must be zero or greater.");
    }
  }

  switch (payload.adjustmentType) {
    case "add":
      data.jackpotState.currentJackpot += Number(payload.amount);
      break;
    case "subtract":
      data.jackpotState.currentJackpot = Math.max(0, data.jackpotState.currentJackpot - Number(payload.amount));
      break;
    case "set":
      data.jackpotState.currentJackpot = Number(payload.amount);
      break;
    case "reset_deck":
      data.jackpotState.cardsRemaining = STARTING_DECK_SIZE;
      data.removedCards = data.removedCards.filter((item) => item.cycleId !== data.jackpotState.currentCycleId);
      break;
  }

  data.jackpotState.lastUpdated = nowIso();
  data.auditLog.push(
    audit(
      staff.staffName,
      staff.role,
      "MANUAL_ADJUSTMENT",
      data.jackpotState.currentCycleId,
      payload.adjustmentType === "reset_deck" ? "cardsRemaining" : "currentJackpot",
      payload.adjustmentType === "reset_deck" ? String(previousCards) : String(previousJackpot),
      payload.adjustmentType === "reset_deck"
        ? String(data.jackpotState.cardsRemaining)
        : String(data.jackpotState.currentJackpot),
      payload.reason,
      "admin"
    )
  );

  return data.jackpotState;
}

function makeTournamentTypeId(name: string, existing: TournamentType[]) {
  const base = name
    .replace(/[^a-z0-9 ]/gi, "")
    .trim()
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 6)
    .toUpperCase() || "JOKER";

  let next = base;
  let count = 2;
  while (existing.some((type) => type.id === next)) {
    next = `${base}${count}`;
    count += 1;
  }

  return next;
}

export function upsertTournamentType(data: JokerData, payload: UpsertTournamentTypePayload) {
  const staff = verifyPin(data, payload.staffName, payload.pin);
  const name = payload.name.trim();
  const shortName = payload.shortName.trim() || name;
  const jackpotPerEntry = Number(payload.jackpotPerEntry);

  if (!name) {
    throw appError("JM-TYPE-001", "Tournament name is required.");
  }

  if (!Number.isFinite(jackpotPerEntry) || jackpotPerEntry <= 0) {
    throw appError("JM-TYPE-002", "Jackpot per entry must be greater than zero.");
  }

  const existing = payload.tournamentTypeId
    ? data.tournamentTypes.find((type) => type.id === payload.tournamentTypeId)
    : null;

  if (existing) {
    const oldValue = `${existing.name}, ${existing.jackpotPerEntry}`;
    existing.name = name;
    existing.shortName = shortName;
    existing.jackpotPerEntry = jackpotPerEntry;
    existing.active = payload.active;
    data.auditLog.push(
      audit(
        staff.staffName,
        staff.role,
        "SAVE_TOURNAMENT_TYPE",
        existing.id,
        "tournamentType",
        oldValue,
        `${name}, ${jackpotPerEntry}`,
        "Tournament type updated",
        "admin"
      )
    );
    return existing;
  }

  const created: TournamentType = {
    id: makeTournamentTypeId(name, data.tournamentTypes),
    name,
    shortName,
    jackpotPerEntry,
    active: payload.active
  };

  data.tournamentTypes.push(created);
  data.auditLog.push(
    audit(
      staff.staffName,
      staff.role,
      "SAVE_TOURNAMENT_TYPE",
      created.id,
      "tournamentType",
      "",
      `${name}, ${jackpotPerEntry}`,
      "Tournament type created",
      "admin"
    )
  );

  return created;
}
