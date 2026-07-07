const STARTING_DECK_SIZE = 53;
const JOKER_CODE = "JOKER";

const SHEET_HEADERS = {
  Settings: ["SettingKey", "SettingValue", "Notes"],
  Tournament_Types: ["TournamentTypeID", "TournamentName", "ShortName", "JackpotPerEntry", "Active"],
  Jackpot_State: ["JackpotID", "CurrentCycleID", "CurrentJackpot", "CardsRemaining", "LastCardPulled", "LastRunID", "LastUpdated"],
  Tournament_Runs: [
    "RunID",
    "Date",
    "TimeCreated",
    "TournamentTypeID",
    "TournamentName",
    "Entries",
    "JackpotPerEntry",
    "Contribution",
    "OpeningJackpot",
    "AvailableJackpot",
    "WinnerName",
    "CardPulled",
    "JokerHit",
    "JackpotPaid",
    "ClosingJackpot",
    "CardsBefore",
    "CardsAfter",
    "StaffName",
    "Status",
    "CreatedAt",
    "UpdatedAt"
  ],
  Removed_Cards: ["CycleID", "Card", "RunID", "RemovedDate", "PlayerName"],
  Jackpot_Cycles: [
    "CycleID",
    "StartDate",
    "EndDate",
    "StartingDeckSize",
    "TotalContributions",
    "JackpotPaid",
    "WinnerName",
    "WinningRunID",
    "CardsRemainingWhenHit",
    "Status"
  ],
  Audit_Log: [
    "LogID",
    "Timestamp",
    "StaffName",
    "Role",
    "Action",
    "RecordID",
    "FieldChanged",
    "OldValue",
    "NewValue",
    "Reason",
    "Source"
  ],
  Staff: ["StaffID", "StaffName", "PasswordHash", "Role", "Active"]
};

const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];
const SUITS = [
  { code: "S", name: "Spades", symbol: "\u2660", color: "black" },
  { code: "H", name: "Hearts", symbol: "\u2665", color: "red" },
  { code: "D", name: "Diamonds", symbol: "\u2666", color: "red" },
  { code: "C", name: "Clubs", symbol: "\u2663", color: "black" }
];
const FULL_DECK = [JOKER_CODE].concat(
  SUITS.flatMap(function (suit) {
    return RANKS.map(function (rank) {
      return rank + suit.code;
    });
  })
);

function setupJokerJackpotDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensurePinSalt_();

  Object.keys(SHEET_HEADERS).forEach(function (name) {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.clear();
    sheet.getRange(1, 1, 1, SHEET_HEADERS[name].length).setValues([SHEET_HEADERS[name]]);
    sheet.setFrozenRows(1);
  });

  appendRows_("Settings", [
    ["starting_deck_size", "53", "52 cards + 1 Joker"],
    ["current_cycle_id", "CYCLE_001", "Active jackpot cycle"],
    ["show_latest_winner_until_cards_remaining", "48", "Hide winner below 48 cards"],
    ["show_probability_from_cards_remaining", "20", "Show chance from 20 cards or lower"],
    ["currency", "AUD", "Display currency"],
    ["tv_refresh_seconds", "30", "TV display auto-refresh"],
    ["app_status", "active", "Can be paused if needed"]
  ]);

  appendRows_("Tournament_Types", [
    ["HTJ", "Hyper Turbo Joker", "Hyper Joker", 40, true],
    ["SSJ", "Sunday Slam Joker Jackpot", "Sunday Slam", 50, true]
  ]);

  const now = new Date();
  appendRows_("Jackpot_State", [["JOKER_MAIN", "CYCLE_001", 0, STARTING_DECK_SIZE, "", "", now]]);
  appendRows_("Jackpot_Cycles", [["CYCLE_001", now, "", STARTING_DECK_SIZE, 0, 0, "", "", "", "Active"]]);
  appendRows_("Staff", [["STAFF_001", "staff", hashPassword_("7777"), "staff", true]]);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("SERVER_TOKEN");

    if (!expected) {
      throw new Error("[JM-SCRIPT-001] SERVER_TOKEN script property is not configured.");
    }

    if (payload.token !== expected) {
      throw new Error("[JM-SCRIPT-002] Invalid server token.");
    }

    return json_({ ok: true, data: handleRequest_(payload) });
  } catch (error) {
    return json_({ ok: false, error: error.message || "Apps Script request failed." });
  }
}

function doGet() {
  return json_({ ok: true, data: { status: "Joker Manager Apps Script is running." } });
}

function handleRequest_(payload) {
  const body = payload.body || {};

  switch (payload.path) {
    case "/api/auth/verify-pin":
      return verifyPinRoute_(body);
    case "/api/dashboard":
      return getDashboardData_();
    case "/api/tv":
      return getTvDisplayData_();
    case "/api/tournament-types":
      return getTournamentTypes_(String((payload.query || {}).includeInactive) === "true");
    case "/api/tournament-types/save":
      return withLock_(function () {
        return saveTournamentType_(body);
      });
    case "/api/tournament/create":
      return withLock_(function () {
        return createTournamentRun_(body);
      });
    case "/api/draw/pending":
      return getPendingDraw_();
    case "/api/cards":
      return getCardViews_();
    case "/api/draw/submit":
      return withLock_(function () {
        return submitDrawResult_(body);
      });
    case "/api/history":
      return getHistory_();
    case "/api/admin/audit-log":
      return getAuditLog_();
    case "/api/admin/export-backup":
      return exportBackup_();
    case "/api/admin/adjustment":
      return withLock_(function () {
        return adminAdjustment_(body);
      });
    default:
      throw new Error("[JM-SCRIPT-003] Unknown route: " + payload.path);
  }
}

function verifyPinRoute_(body) {
  const staff = verifyPin_(body.staffName, body.pin, "staff");
  return {
    staffName: staff.StaffName,
    role: staff.Role,
    expiresAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString()
  };
}

function getDashboardData_() {
  const state = getCurrentState_();
  const activeCycle = getActiveCycle_();
  const runs = getObjects_("Tournament_Runs").map(runFromRow_);
  const audit = getAuditLog_();

  return {
    jackpotState: state,
    pendingRun: runs.find(function (run) { return run.status === "Awaiting Draw"; }) || null,
    latestRun: runs.sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); })[0] || null,
    activeCycle: activeCycle,
    recentAudit: audit.slice(0, 5),
    jackpotTrend: getJackpotTrend_()
  };
}

function getTournamentTypes_(includeInactive) {
  return getObjects_("Tournament_Types")
    .filter(function (row) { return includeInactive || String(row.Active).toLowerCase() === "true"; })
    .map(function (row) {
      return {
        id: String(row.TournamentTypeID),
        name: String(row.TournamentName),
        shortName: String(row.ShortName),
        jackpotPerEntry: Number(row.JackpotPerEntry),
        active: String(row.Active).toLowerCase() === "true"
      };
    });
}

function createTournamentRun_(body) {
  const staff = verifyPin_(body.staffName, body.pin, "staff");
  const entries = Number(body.entries);
  const type = getTournamentTypes_(false).find(function (item) { return item.id === body.tournamentTypeId; });

  if (!type) {
    throw new Error("[JM-RUN-001] Tournament type must be active.");
  }

  if (!Number.isInteger(entries) || entries <= 0) {
    throw new Error("[JM-RUN-002] Entries must be a positive whole number.");
  }

  if (getPendingDraw_()) {
    throw new Error("[JM-RUN-003] Resolve the pending draw before creating another tournament.");
  }

  const state = getCurrentState_();
  const now = new Date();
  const runId = newId_("RUN");
  const contribution = entries * type.jackpotPerEntry;
  const availableJackpot = Number(state.currentJackpot) + contribution;
  const runRow = {
    RunID: runId,
    Date: Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd"),
    TimeCreated: now,
    TournamentTypeID: type.id,
    TournamentName: type.name,
    Entries: entries,
    JackpotPerEntry: type.jackpotPerEntry,
    Contribution: contribution,
    OpeningJackpot: Number(state.currentJackpot),
    AvailableJackpot: availableJackpot,
    WinnerName: "",
    CardPulled: "",
    JokerHit: false,
    JackpotPaid: 0,
    ClosingJackpot: availableJackpot,
    CardsBefore: Number(state.cardsRemaining),
    CardsAfter: Number(state.cardsRemaining),
    StaffName: staff.StaffName,
    Status: "Awaiting Draw",
    CreatedAt: now,
    UpdatedAt: now
  };

  appendObject_("Tournament_Runs", runRow);
  updateObjectByKey_("Jackpot_State", "JackpotID", "JOKER_MAIN", {
    CurrentJackpot: availableJackpot,
    LastRunID: runId,
    LastUpdated: now
  });

  const activeCycle = getActiveCycleRow_();
  updateObjectByKey_("Jackpot_Cycles", "CycleID", activeCycle.CycleID, {
    TotalContributions: Number(activeCycle.TotalContributions || 0) + contribution
  });

  writeAudit_(staff, "CREATE_RUN", runId, "status", "", "Awaiting Draw", "Tournament created", "dashboard");
  return runFromRow_(runRow);
}

function getPendingDraw_() {
  const pending = getObjects_("Tournament_Runs")
    .map(runFromRow_)
    .filter(function (run) { return run.status === "Awaiting Draw"; })
    .sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); })[0];

  return pending || null;
}

function submitDrawResult_(body) {
  const staff = verifyPin_(body.staffName, body.pin, "staff");
  const runRow = getObjects_("Tournament_Runs").find(function (row) {
    return row.RunID === body.runId && row.Status === "Awaiting Draw";
  });

  if (!runRow) {
    throw new Error("[JM-DRAW-001] No awaiting draw exists for that run.");
  }

  if (!String(body.winnerName || "").trim()) {
    throw new Error("[JM-DRAW-002] Winner name is required.");
  }

  if (FULL_DECK.indexOf(body.cardPulled) === -1) {
    throw new Error("[JM-DRAW-003] Selected card is not valid.");
  }

  const available = getCardViews_().filter(function (card) { return !card.removed; });
  const selected = available.find(function (card) { return card.code === body.cardPulled; });
  if (!selected) {
    throw new Error("[JM-DRAW-004] Selected card has already been removed.");
  }

  const state = getCurrentState_();
  const now = new Date();
  const jokerHit = body.cardPulled === JOKER_CODE;

  if (jokerHit && !body.jokerConfirmed) {
    throw new Error("[JM-DRAW-005] Joker hit requires confirmation.");
  }

  if (!jokerHit && Number(state.cardsRemaining) <= 1) {
    throw new Error("[JM-DRAW-006] Critical deck warning: only one card remains and it is not the Joker.");
  }

  const runUpdates = {
    WinnerName: String(body.winnerName).trim(),
    CardPulled: body.cardPulled,
    JokerHit: jokerHit,
    Status: "Complete",
    UpdatedAt: now
  };

  if (jokerHit) {
    runUpdates.JackpotPaid = Number(runRow.AvailableJackpot);
    runUpdates.ClosingJackpot = 0;
    runUpdates.CardsAfter = STARTING_DECK_SIZE;

    const cycle = getActiveCycleRow_();
    updateObjectByKey_("Jackpot_Cycles", "CycleID", cycle.CycleID, {
      EndDate: now,
      JackpotPaid: Number(runRow.AvailableJackpot),
      WinnerName: String(body.winnerName).trim(),
      WinningRunID: runRow.RunID,
      CardsRemainingWhenHit: Number(state.cardsRemaining),
      Status: "Closed"
    });

    const newCycleId = "CYCLE_" + String(getObjects_("Jackpot_Cycles").length + 1).padStart(3, "0");
    appendObject_("Jackpot_Cycles", {
      CycleID: newCycleId,
      StartDate: now,
      EndDate: "",
      StartingDeckSize: STARTING_DECK_SIZE,
      TotalContributions: 0,
      JackpotPaid: 0,
      WinnerName: "",
      WinningRunID: "",
      CardsRemainingWhenHit: "",
      Status: "Active"
    });
    updateObjectByKey_("Settings", "SettingKey", "current_cycle_id", { SettingValue: newCycleId });
    updateObjectByKey_("Jackpot_State", "JackpotID", "JOKER_MAIN", {
      CurrentCycleID: newCycleId,
      CurrentJackpot: 0,
      CardsRemaining: STARTING_DECK_SIZE,
      LastCardPulled: body.cardPulled,
      LastRunID: runRow.RunID,
      LastUpdated: now
    });
  } else {
    runUpdates.JackpotPaid = 0;
    runUpdates.ClosingJackpot = Number(runRow.AvailableJackpot);
    runUpdates.CardsAfter = Number(runRow.CardsBefore) - 1;

    appendObject_("Removed_Cards", {
      CycleID: state.currentCycleId,
      Card: body.cardPulled,
      RunID: runRow.RunID,
      RemovedDate: now,
      PlayerName: String(body.winnerName).trim()
    });
    updateObjectByKey_("Jackpot_State", "JackpotID", "JOKER_MAIN", {
      CurrentJackpot: Number(runRow.AvailableJackpot),
      CardsRemaining: runUpdates.CardsAfter,
      LastCardPulled: body.cardPulled,
      LastRunID: runRow.RunID,
      LastUpdated: now
    });
  }

  updateObjectByKey_("Tournament_Runs", "RunID", runRow.RunID, runUpdates);
  writeAudit_(staff, "SUBMIT_DRAW", runRow.RunID, "cardPulled", "", cardLabel_(body.cardPulled), jokerHit ? "Joker hit confirmed" : "Draw submitted", "dashboard");
  return runFromRow_(Object.assign({}, runRow, runUpdates));
}

function getHistory_() {
  return getObjects_("Tournament_Runs")
    .map(runFromRow_)
    .sort(function (a, b) { return b.updatedAt.localeCompare(a.updatedAt); });
}

function exportBackup_() {
  const backup = {
    exportedAt: new Date().toISOString(),
    app: "Joker Manager",
    sheets: {}
  };

  Object.keys(SHEET_HEADERS).forEach(function (sheetName) {
    backup.sheets[sheetName] = getObjects_(sheetName);
  });

  return backup;
}

function getJackpotTrend_() {
  const daily = {};
  getObjects_("Tournament_Runs")
    .map(runFromRow_)
    .filter(function (run) { return run.status === "Complete"; })
    .sort(function (a, b) { return a.updatedAt.localeCompare(b.updatedAt); })
    .forEach(function (run) {
      daily[run.updatedAt.slice(0, 10)] = run.closingJackpot;
    });

  const state = getCurrentState_();
  daily[new Date().toISOString().slice(0, 10)] = state.currentJackpot;

  return Object.keys(daily)
    .sort()
    .map(function (date) {
      return { date: date, jackpot: Number(daily[date]) };
    });
}

function saveTournamentType_(body) {
  const staff = verifyPin_(body.staffName, body.pin, "staff");
  const name = String(body.name || "").trim();
  const shortName = String(body.shortName || "").trim() || name;
  const jackpotPerEntry = Number(body.jackpotPerEntry);
  const active = String(body.active).toLowerCase() === "true" || body.active === true;

  if (!name) {
    throw new Error("[JM-TYPE-001] Tournament name is required.");
  }

  if (!Number.isFinite(jackpotPerEntry) || jackpotPerEntry <= 0) {
    throw new Error("[JM-TYPE-002] Jackpot per entry must be greater than zero.");
  }

  if (body.tournamentTypeId) {
    const oldRow = getObjects_("Tournament_Types").find(function (row) {
      return row.TournamentTypeID === body.tournamentTypeId;
    });
    if (!oldRow) {
      throw new Error("[JM-TYPE-003] Tournament type was not found.");
    }

    updateObjectByKey_("Tournament_Types", "TournamentTypeID", body.tournamentTypeId, {
      TournamentName: name,
      ShortName: shortName,
      JackpotPerEntry: jackpotPerEntry,
      Active: active
    });
    writeAudit_(staff, "SAVE_TOURNAMENT_TYPE", body.tournamentTypeId, "tournamentType", oldRow.TournamentName + ", " + oldRow.JackpotPerEntry, name + ", " + jackpotPerEntry, "Tournament type updated", "admin");
    return getTournamentTypes_(true).find(function (type) { return type.id === body.tournamentTypeId; });
  }

  const id = makeTournamentTypeId_(name);
  appendObject_("Tournament_Types", {
    TournamentTypeID: id,
    TournamentName: name,
    ShortName: shortName,
    JackpotPerEntry: jackpotPerEntry,
    Active: active
  });
  writeAudit_(staff, "SAVE_TOURNAMENT_TYPE", id, "tournamentType", "", name + ", " + jackpotPerEntry, "Tournament type created", "admin");
  return getTournamentTypes_(true).find(function (type) { return type.id === id; });
}

function makeTournamentTypeId_(name) {
  const existing = getObjects_("Tournament_Types").map(function (row) { return String(row.TournamentTypeID); });
  const parts = String(name).replace(/[^a-z0-9 ]/gi, "").trim().split(/\s+/);
  const base = (parts.map(function (part) { return part[0] || ""; }).join("").slice(0, 6).toUpperCase() || "JOKER");
  let next = base;
  let count = 2;

  while (existing.indexOf(next) !== -1) {
    next = base + count;
    count += 1;
  }

  return next;
}

function adminAdjustment_(body) {
  const staff = verifyPin_(body.staffName, body.pin, "staff");
  const reason = String(body.reason || "").trim();
  const type = String(body.adjustmentType || "");
  const state = getCurrentState_();
  const now = new Date();

  if (!reason) {
    throw new Error("[JM-ADJ-001] A reason is required for admin adjustments.");
  }

  if (type !== "reset_deck" && (!Number.isFinite(Number(body.amount)) || Number(body.amount) < 0)) {
    throw new Error("[JM-ADJ-002] Amount must be zero or greater.");
  }

  let newJackpot = Number(state.currentJackpot);
  let newCards = Number(state.cardsRemaining);
  let field = "currentJackpot";
  let oldValue = String(state.currentJackpot);

  if (type === "add") {
    newJackpot += Number(body.amount || 0);
  } else if (type === "subtract") {
    newJackpot = Math.max(0, newJackpot - Number(body.amount || 0));
  } else if (type === "set") {
    newJackpot = Number(body.amount || 0);
  } else if (type === "reset_deck") {
    field = "cardsRemaining";
    oldValue = String(state.cardsRemaining);
    newCards = STARTING_DECK_SIZE;
    deleteRemovedCardsForCycle_(state.currentCycleId);
  } else {
    throw new Error("[JM-ADJ-004] Unknown adjustment type.");
  }

  updateObjectByKey_("Jackpot_State", "JackpotID", "JOKER_MAIN", {
    CurrentJackpot: newJackpot,
    CardsRemaining: newCards,
    LastUpdated: now
  });

  writeAudit_(staff, "MANUAL_ADJUSTMENT", state.currentCycleId, field, oldValue, type === "reset_deck" ? String(newCards) : String(newJackpot), reason, "admin");
  return getCurrentState_();
}

function getTvDisplayData_() {
  const state = getCurrentState_();
  const cardsRemaining = Number(state.cardsRemaining);
  const tier = getTvTier_(cardsRemaining);
  const latestWinner = cardsRemaining >= 48 ? getLatestJokerWinner_() : null;

  return {
    jackpot: Number(state.currentJackpot),
    cardsRemaining: cardsRemaining,
    tier: tier,
    showLatestWinner: cardsRemaining >= 48,
    showProbability: cardsRemaining <= 20,
    latestWinner: latestWinner,
    copy: copyForTier_(tier, cardsRemaining),
    refreshedAt: new Date().toISOString()
  };
}

function getLatestJokerWinner_() {
  const closed = getObjects_("Jackpot_Cycles")
    .filter(function (row) { return row.Status === "Closed" && row.WinnerName; })
    .sort(function (a, b) { return iso_(b.EndDate).localeCompare(iso_(a.EndDate)); });

  if (!closed.length) {
    return null;
  }

  return {
    name: String(closed[0].WinnerName),
    amount: Number(closed[0].JackpotPaid)
  };
}

function getTvTier_(cardsRemaining) {
  if (cardsRemaining >= 48) return "fresh";
  if (cardsRemaining >= 31) return "building";
  if (cardsRemaining >= 21) return "hot";
  if (cardsRemaining >= 11) return "probability";
  return "danger";
}

function copyForTier_(tier, cardsRemaining) {
  if (tier === "fresh") return { headline: "Fresh deck. New chase begins.", subline: cardsRemaining + " cards remaining", cta: "Get in early." };
  if (tier === "building") return { headline: "The deck is getting thinner.", subline: cardsRemaining + " cards remaining", cta: "Every tournament adds more to the pool." };
  if (tier === "hot") return { headline: "The chase is heating up.", subline: "Only " + cardsRemaining + " cards remain.", cta: "Fewer cards. Bigger jackpot." };
  if (tier === "probability") return { headline: "1 in " + cardsRemaining + " to hit the Joker", subline: cardsRemaining + " cards remaining", cta: "The odds are getting serious." };
  return { headline: "Only " + cardsRemaining + " cards left", subline: "1 in " + cardsRemaining, cta: "Every pull could be the one." };
}

function getCardViews_() {
  const state = getCurrentState_();
  const removedRows = getObjects_("Removed_Cards")
    .filter(function (row) { return row.CycleID === state.currentCycleId; })
    .map(removedFromRow_);
  const removedMap = {};
  removedRows.forEach(function (row) {
    removedMap[row.card] = row;
  });

  return FULL_DECK.map(function (code) {
    if (code === JOKER_CODE) {
      return {
        code: code,
        label: "Joker",
        rank: "Joker",
        suit: null,
        suitName: null,
        color: "joker",
        removed: Boolean(removedMap[code]),
        removal: removedMap[code] || null
      };
    }

    const suit = SUITS.find(function (item) { return code.endsWith(item.code); });
    const rank = suit ? code.slice(0, -suit.code.length) : code;
    return {
      code: code,
      label: cardLabel_(code),
      rank: rank,
      suit: suit ? suit.symbol : null,
      suitName: suit ? suit.name : null,
      color: suit ? suit.color : "black",
      removed: Boolean(removedMap[code]),
      removal: removedMap[code] || null
    };
  });
}

function getCurrentState_() {
  const row = getObjects_("Jackpot_State").find(function (item) { return item.JackpotID === "JOKER_MAIN"; });
  if (!row) throw new Error("[JM-DATA-002] Jackpot_State row is missing.");

  return {
    jackpotId: "JOKER_MAIN",
    currentCycleId: String(row.CurrentCycleID),
    currentJackpot: Number(row.CurrentJackpot || 0),
    cardsRemaining: Number(row.CardsRemaining || STARTING_DECK_SIZE),
    lastCardPulled: row.LastCardPulled ? String(row.LastCardPulled) : null,
    lastRunId: row.LastRunID ? String(row.LastRunID) : null,
    lastUpdated: iso_(row.LastUpdated)
  };
}

function getActiveCycleRow_() {
  const state = getCurrentState_();
  const row = getObjects_("Jackpot_Cycles").find(function (item) { return item.CycleID === state.currentCycleId; });
  if (!row) throw new Error("[JM-DATA-001] Active jackpot cycle is missing.");
  return row;
}

function getActiveCycle_() {
  return cycleFromRow_(getActiveCycleRow_());
}

function getAuditLog_() {
  return getObjects_("Audit_Log")
    .map(auditFromRow_)
    .sort(function (a, b) { return b.timestamp.localeCompare(a.timestamp); });
}

function verifyPin_(staffName, pin, requiredRole) {
  const staff = getObjects_("Staff").find(function (row) {
    return String(row.StaffName).toLowerCase() === String(staffName || "").trim().toLowerCase() &&
      String(row.Active).toLowerCase() === "true";
  });

  if (!staff) {
    throw new Error("[JM-AUTH-001] Staff member is not active or does not exist.");
  }

  if (staff.PasswordHash !== hashPassword_(String(pin || ""))) {
    throw new Error("[JM-AUTH-002] Password is incorrect.");
  }

  return staff;
}

function writeAudit_(staff, action, recordId, fieldChanged, oldValue, newValue, reason, source) {
  appendObject_("Audit_Log", {
    LogID: newId_("LOG"),
    Timestamp: new Date(),
    StaffName: staff.StaffName,
    Role: staff.Role,
    Action: action,
    RecordID: recordId,
    FieldChanged: fieldChanged,
    OldValue: oldValue,
    NewValue: newValue,
    Reason: reason,
    Source: source
  });
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function hashPassword_(password) {
  const salt = ensurePasswordSalt_();
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ":" + password);
  return digest.map(function (byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ("0" + normalized.toString(16)).slice(-2);
  }).join("");
}

function ensurePasswordSalt_() {
  const props = PropertiesService.getScriptProperties();
  let salt = props.getProperty("PASSWORD_SALT");
  if (!salt) {
    salt = Utilities.getUuid();
    props.setProperty("PASSWORD_SALT", salt);
  }
  return salt;
}

function appendRows_(sheetName, rows) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function appendObject_(sheetName, object) {
  const headers = SHEET_HEADERS[sheetName];
  appendRows_(sheetName, [headers.map(function (header) { return object[header] === undefined ? "" : object[header]; })]);
}

function getObjects_(sheetName) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values
    .filter(function (row) { return row.some(function (value) { return value !== ""; }); })
    .map(function (row) {
      const object = {};
      headers.forEach(function (header, index) {
        object[header] = row[index];
      });
      return object;
    });
}

function updateObjectByKey_(sheetName, keyHeader, keyValue, updates) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const keyIndex = headers.indexOf(keyHeader);
  if (keyIndex === -1) throw new Error("[JM-SHEET-001] Missing key header: " + keyHeader);

  const values = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), headers.length).getValues();
  for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
    if (String(values[rowIndex][keyIndex]) === String(keyValue)) {
      const next = values[rowIndex].slice();
      Object.keys(updates).forEach(function (header) {
        const column = headers.indexOf(header);
        if (column !== -1) {
          next[column] = updates[header];
        }
      });
      sheet.getRange(rowIndex + 2, 1, 1, headers.length).setValues([next]);
      return;
    }
  }

  throw new Error("[JM-SHEET-002] Could not find row in " + sheetName + " for " + keyValue);
}

function deleteRemovedCardsForCycle_(cycleId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Removed_Cards");
  if (!sheet || sheet.getLastRow() < 2) return;

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const cycleColumn = headers.indexOf("CycleID") + 1;
  for (let row = sheet.getLastRow(); row >= 2; row--) {
    if (String(sheet.getRange(row, cycleColumn).getValue()) === String(cycleId)) {
      sheet.deleteRow(row);
    }
  }
}

function runFromRow_(row) {
  return {
    runId: String(row.RunID),
    date: String(row.Date),
    timeCreated: iso_(row.TimeCreated),
    tournamentTypeId: String(row.TournamentTypeID),
    tournamentName: String(row.TournamentName),
    entries: Number(row.Entries || 0),
    jackpotPerEntry: Number(row.JackpotPerEntry || 0),
    contribution: Number(row.Contribution || 0),
    openingJackpot: Number(row.OpeningJackpot || 0),
    availableJackpot: Number(row.AvailableJackpot || 0),
    winnerName: row.WinnerName ? String(row.WinnerName) : null,
    cardPulled: row.CardPulled ? String(row.CardPulled) : null,
    jokerHit: String(row.JokerHit).toLowerCase() === "true",
    jackpotPaid: Number(row.JackpotPaid || 0),
    closingJackpot: Number(row.ClosingJackpot || 0),
    cardsBefore: Number(row.CardsBefore || 0),
    cardsAfter: Number(row.CardsAfter || 0),
    staffName: String(row.StaffName),
    status: String(row.Status),
    createdAt: iso_(row.CreatedAt),
    updatedAt: iso_(row.UpdatedAt)
  };
}

function cycleFromRow_(row) {
  return {
    cycleId: String(row.CycleID),
    startDate: iso_(row.StartDate),
    endDate: row.EndDate ? iso_(row.EndDate) : null,
    startingDeckSize: Number(row.StartingDeckSize || STARTING_DECK_SIZE),
    totalContributions: Number(row.TotalContributions || 0),
    jackpotPaid: Number(row.JackpotPaid || 0),
    winnerName: row.WinnerName ? String(row.WinnerName) : null,
    winningRunId: row.WinningRunID ? String(row.WinningRunID) : null,
    cardsRemainingWhenHit: row.CardsRemainingWhenHit ? Number(row.CardsRemainingWhenHit) : null,
    status: String(row.Status)
  };
}

function removedFromRow_(row) {
  return {
    cycleId: String(row.CycleID),
    card: String(row.Card),
    runId: String(row.RunID),
    removedDate: iso_(row.RemovedDate),
    playerName: String(row.PlayerName)
  };
}

function auditFromRow_(row) {
  return {
    logId: String(row.LogID),
    timestamp: iso_(row.Timestamp),
    staffName: String(row.StaffName),
    role: String(row.Role),
    action: String(row.Action),
    recordId: String(row.RecordID),
    fieldChanged: String(row.FieldChanged),
    oldValue: String(row.OldValue),
    newValue: String(row.NewValue),
    reason: String(row.Reason),
    source: String(row.Source)
  };
}

function cardLabel_(code) {
  if (code === JOKER_CODE) return "Joker";
  const suit = SUITS.find(function (item) { return code.endsWith(item.code); });
  const rank = suit ? code.slice(0, -suit.code.length) : code;
  return suit ? rank + suit.symbol : code;
}

function iso_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return value.toISOString();
  return new Date(value).toISOString();
}

function newId_(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
