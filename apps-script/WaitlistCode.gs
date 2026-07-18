/**
 * Cash-Game Waitlist backend — a SEPARATE Google Sheet and Apps Script project
 * from the Joker Jackpot one, on purpose:
 *
 * - Zero shared code or data with the Joker Jackpot spreadsheet/script. This
 *   file never reads or writes anything outside its own Sheet.
 * - Its own Apps Script execution-time quota, independent of Joker Jackpot's
 *   (each Google account's Apps Script quota is allocated per script
 *   project). The TLT Waitlist TV board and staff page poll on their own
 *   schedule; keeping that on a separate project means it can never crowd
 *   out the Joker Jackpot TV/staff screens' own quota, or vice versa.
 * - Staff still log in with the SAME password as Joker Jackpot for the one
 *   action that still needs one (Manage games). Adding, seating, removing,
 *   and reordering entries are frequent floor actions and no longer require
 *   a password at all — the Worker just forwards whatever staffName the
 *   already-logged-in session sends. Manage games keeps a password check:
 *   the Worker calls Joker Jackpot's existing, unmodified /api/auth/verify-pin
 *   route first, and only forwards the request here once that succeeds. So
 *   saveWaitlistGame_ trusts body.staffName as already-verified — there is
 *   no PasswordHash/verifyPin_ anywhere in this file, for any route.
 *
 * Setup (one time, on a brand new Google Sheet):
 * 1. Create a new Google Sheet.
 * 2. Extensions -> Apps Script, paste this whole file in as Code.gs.
 * 3. Project Settings -> Script Properties -> add SERVER_TOKEN with any
 *    long random value (this is a shared secret with the Cloudflare Worker,
 *    separate from the Joker Jackpot script's own SERVER_TOKEN).
 * 4. Run setupWaitlistDatabase() once from the function picker to create
 *    and seed the sheets. Grant permissions if asked.
 * 5. Deploy -> New deployment -> Web app -> Execute as: Me, Who has access:
 *    Anyone. Copy the Web App URL.
 * 6. Give the Web App URL and the SERVER_TOKEN value to whoever configures
 *    the Cloudflare Worker's WAITLIST_APPS_SCRIPT_URL / WAITLIST_APPS_SCRIPT_TOKEN
 *    secrets.
 */

const WAITLIST_SHEET_HEADERS = {
  Waitlist_Games: ["GameID", "GameName", "ColorTag", "Running", "TableNumbers", "SortOrder", "Active"],
  Waitlist_Entries: ["EntryID", "PlayerName", "GameID", "Status", "Reason", "SortIndex", "AddedAt", "UpdatedAt", "StaffName"],
  Waitlist_Audit_Log: ["LogID", "Timestamp", "StaffName", "Action", "RecordID", "FieldChanged", "OldValue", "NewValue", "Reason"]
};

const WAITLIST_COLOR_TAGS = ["red", "teal", "green", "gold", "burgundy"];

function setupWaitlistDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const gamesSheet = ss.getSheetByName("Waitlist_Games");

  if (gamesSheet && gamesSheet.getLastRow() > 1) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.prompt(
      "Re-initialize Waitlist database",
      "This Sheet already has data. Running this again will ERASE every game, waitlist entry, and the change log, " +
        "resetting everything back to defaults. Type RESET to confirm.",
      ui.ButtonSet.OK_CANCEL
    );

    if (response.getSelectedButton() !== ui.Button.OK || response.getResponseText() !== "RESET") {
      ui.alert("Cancelled. No changes were made.");
      return;
    }
  }

  Object.keys(WAITLIST_SHEET_HEADERS).forEach(function (name) {
    const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
    sheet.clear();
    sheet.getRange(1, 1, 1, WAITLIST_SHEET_HEADERS[name].length).setValues([WAITLIST_SHEET_HEADERS[name]]);
    sheet.setFrozenRows(1);
  });

  appendWaitlistRows_("Waitlist_Games", [
    ["WG_1", "$1/3 NLHE", "red", false, "", 1, true],
    ["WG_2", "$2/5 NLHE", "teal", false, "", 2, true],
    ["WG_3", "$1/3 PLO", "green", false, "", 3, true],
    ["WG_4", "$5/10 NLHE", "gold", false, "", 4, true]
  ]);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || "{}");
    const expected = PropertiesService.getScriptProperties().getProperty("SERVER_TOKEN");

    if (!expected) {
      throw new Error("[JM-WLSCRIPT-001] SERVER_TOKEN script property is not configured.");
    }

    if (payload.token !== expected) {
      throw new Error("[JM-WLSCRIPT-002] Invalid server token.");
    }

    return waitlistJson_({ ok: true, data: handleWaitlistRequest_(payload) });
  } catch (error) {
    return waitlistJson_({ ok: false, error: error.message || "Waitlist Apps Script request failed." });
  }
}

function doGet() {
  return waitlistJson_({ ok: true, data: { status: "Joker Manager Waitlist Apps Script is running." } });
}

function handleWaitlistRequest_(payload) {
  clearWaitlistSheetCache_();
  const body = payload.body || {};

  switch (payload.path) {
    case "/api/waitlist/bootstrap":
      return getWaitlistBootstrap_();
    case "/api/waitlist/board":
      return getWaitlistBoard_();
    case "/api/waitlist/entries/create":
      return withWaitlistLock_(function () {
        return createWaitlistEntries_(body);
      });
    case "/api/waitlist/entries/seat":
      return withWaitlistLock_(function () {
        return markEntrySeated_(body);
      });
    case "/api/waitlist/entries/remove":
      return withWaitlistLock_(function () {
        return removeWaitlistEntry_(body);
      });
    case "/api/waitlist/entries/reorder":
      return withWaitlistLock_(function () {
        return reorderWaitlistEntries_(body);
      });
    case "/api/waitlist/games/save":
      return withWaitlistLock_(function () {
        return saveWaitlistGame_(body);
      });
    default:
      throw new Error("[JM-WLSCRIPT-003] Unknown route: " + payload.path);
  }
}

function waitlistGameFromRow_(row) {
  return {
    gameId: String(row.GameID),
    gameName: String(row.GameName),
    colorTag: String(row.ColorTag),
    running: String(row.Running).toLowerCase() === "true",
    tableNumbers: String(row.TableNumbers || ""),
    sortOrder: Number(row.SortOrder || 0),
    active: String(row.Active).toLowerCase() === "true"
  };
}

function waitlistEntryFromRow_(row) {
  return {
    entryId: String(row.EntryID),
    playerName: String(row.PlayerName),
    gameId: String(row.GameID),
    status: String(row.Status),
    reason: String(row.Reason || ""),
    sortIndex: Number(row.SortIndex || 0),
    addedAt: waitlistIso_(row.AddedAt),
    updatedAt: waitlistIso_(row.UpdatedAt),
    staffName: String(row.StaffName)
  };
}

function getWaitlistGames_(includeInactive) {
  return getWaitlistObjects_("Waitlist_Games")
    .filter(function (row) { return includeInactive || String(row.Active).toLowerCase() === "true"; })
    .map(waitlistGameFromRow_)
    .sort(function (a, b) { return a.sortOrder - b.sortOrder; });
}

function getWaitlistBoard_() {
  const games = getWaitlistGames_(false);
  const allEntries = getWaitlistObjects_("Waitlist_Entries").map(waitlistEntryFromRow_);
  const waiting = allEntries.filter(function (e) { return e.status === "Waiting"; }).sort(function (a, b) { return a.sortIndex - b.sortIndex; });
  const seated = allEntries.filter(function (e) { return e.status === "Seated"; }).sort(function (a, b) { return a.updatedAt.localeCompare(b.updatedAt); });

  const toBoardEntry = function (e) { return { entryId: e.entryId, playerName: e.playerName, addedAt: e.addedAt }; };

  const columns = games.map(function (game) {
    const gameWaiting = waiting.filter(function (e) { return e.gameId === game.gameId; });
    const gameSeated = seated.filter(function (e) { return e.gameId === game.gameId; });
    return {
      game: game,
      waiting: gameWaiting.map(toBoardEntry),
      waitingCount: gameWaiting.length,
      seated: gameSeated.map(toBoardEntry),
      seatedCount: gameSeated.length
    };
  });

  return {
    columns: columns,
    totalWaiting: columns.reduce(function (sum, column) { return sum + column.waitingCount; }, 0),
    refreshedAt: new Date().toISOString()
  };
}

function getWaitlistBootstrap_() {
  return {
    games: getWaitlistGames_(true),
    board: getWaitlistBoard_()
  };
}

function nextWaitlistSortIndex_(gameId) {
  const existing = getWaitlistObjects_("Waitlist_Entries").filter(function (row) {
    return row.GameID === gameId && row.Status === "Waiting";
  });
  if (!existing.length) return 0;
  return Math.max.apply(null, existing.map(function (row) { return Number(row.SortIndex || 0); })) + 1;
}

function createWaitlistEntries_(body) {
  const staffName = String(body.staffName || "").trim();
  if (!staffName) {
    throw new Error("[JM-WL-000] Staff name is required.");
  }

  const playerName = String(body.playerName || "").trim();
  if (!playerName) {
    throw new Error("[JM-WL-001] Player name is required.");
  }

  const gameIds = Array.isArray(body.gameIds) ? body.gameIds : [];
  if (!gameIds.length) {
    throw new Error("[JM-WL-002] Select at least one game.");
  }

  const activeGames = getWaitlistGames_(false);
  const existingEntries = getWaitlistObjects_("Waitlist_Entries");
  const now = new Date();
  const created = [];

  gameIds.forEach(function (gameId) {
    const game = activeGames.find(function (g) { return g.gameId === gameId; });
    if (!game) {
      throw new Error("[JM-WL-003] Selected game is not active.");
    }

    const duplicate = existingEntries.find(function (row) {
      return row.GameID === gameId && row.Status === "Waiting" &&
        String(row.PlayerName).toLowerCase() === playerName.toLowerCase();
    });
    if (duplicate) {
      throw new Error("[JM-WL-004] " + playerName + " is already waiting for " + game.gameName + ".");
    }

    const entryId = newWaitlistId_("WLE");
    const row = {
      EntryID: entryId,
      PlayerName: playerName,
      GameID: gameId,
      Status: "Waiting",
      Reason: "",
      SortIndex: nextWaitlistSortIndex_(gameId),
      AddedAt: now,
      UpdatedAt: now,
      StaffName: staffName
    };
    appendWaitlistObject_("Waitlist_Entries", row);
    writeWaitlistAudit_(staffName, "CREATE_WAITLIST_ENTRY", entryId, "status", "", "Waiting", "Added to " + game.gameName + " waitlist");
    created.push(waitlistEntryFromRow_(row));
  });

  return created;
}

function markEntrySeated_(body) {
  const staffName = String(body.staffName || "").trim();
  if (!staffName) {
    throw new Error("[JM-WL-000] Staff name is required.");
  }

  const row = getWaitlistObjects_("Waitlist_Entries").find(function (r) { return r.EntryID === body.entryId; });
  if (!row) {
    throw new Error("[JM-WL-005] Waitlist entry was not found.");
  }
  if (row.Status !== "Waiting") {
    throw new Error("[JM-WL-010] Entry is not currently waiting.");
  }

  const now = new Date();
  updateWaitlistObjectByKey_("Waitlist_Entries", "EntryID", body.entryId, { Status: "Seated", UpdatedAt: now });
  writeWaitlistAudit_(staffName, "MARK_ENTRY_SEATED", body.entryId, "status", "Waiting", "Seated", "Marked seated");

  return waitlistEntryFromRow_(Object.assign({}, row, { Status: "Seated", UpdatedAt: now }));
}

function removeWaitlistEntry_(body) {
  const staffName = String(body.staffName || "").trim();
  if (!staffName) {
    throw new Error("[JM-WL-000] Staff name is required.");
  }

  const row = getWaitlistObjects_("Waitlist_Entries").find(function (r) { return r.EntryID === body.entryId; });
  if (!row) {
    throw new Error("[JM-WL-005] Waitlist entry was not found.");
  }
  if (row.Status === "Removed") {
    throw new Error("[JM-WL-006] Entry has already been removed.");
  }

  const now = new Date();
  const reason = String(body.reason || "").trim() || "Removed from waitlist";
  updateWaitlistObjectByKey_("Waitlist_Entries", "EntryID", body.entryId, { Status: "Removed", Reason: reason, UpdatedAt: now });
  writeWaitlistAudit_(staffName, "REMOVE_WAITLIST_ENTRY", body.entryId, "status", row.Status, "Removed", reason);

  return waitlistEntryFromRow_(Object.assign({}, row, { Status: "Removed", Reason: reason, UpdatedAt: now }));
}

function reorderWaitlistEntries_(body) {
  const staffName = String(body.staffName || "").trim();
  if (!staffName) {
    throw new Error("[JM-WL-000] Staff name is required.");
  }

  const gameId = String(body.gameId || "");
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds : [];
  const waiting = getWaitlistObjects_("Waitlist_Entries").filter(function (row) {
    return row.GameID === gameId && row.Status === "Waiting";
  });
  const waitingIds = waiting.map(function (row) { return row.EntryID; });

  const sameSet = entryIds.length === waitingIds.length && entryIds.every(function (entryId) { return waitingIds.indexOf(entryId) !== -1; });
  if (!sameSet) {
    throw new Error("[JM-WL-011] The waiting list changed — refresh and try again.");
  }

  const now = new Date();
  entryIds.forEach(function (entryId, index) {
    updateWaitlistObjectByKey_("Waitlist_Entries", "EntryID", entryId, { SortIndex: index, UpdatedAt: now });
  });
  writeWaitlistAudit_(staffName, "REORDER_WAITLIST_ENTRIES", gameId, "sortIndex", "", "", "Waitlist reordered");

  return getWaitlistObjects_("Waitlist_Entries")
    .filter(function (row) { return row.GameID === gameId && row.Status === "Waiting"; })
    .map(waitlistEntryFromRow_);
}

function saveWaitlistGame_(body) {
  const staffName = String(body.staffName || "").trim();
  if (!staffName) {
    throw new Error("[JM-WL-000] Staff name is required.");
  }

  const gameName = String(body.gameName || "").trim();
  const colorTag = String(body.colorTag || "").trim();
  const running = String(body.running).toLowerCase() === "true" || body.running === true;
  const tableNumbers = String(body.tableNumbers || "").trim();
  const active = String(body.active).toLowerCase() === "true" || body.active === true;

  if (!gameName) {
    throw new Error("[JM-WL-007] Game name is required.");
  }
  if (WAITLIST_COLOR_TAGS.indexOf(colorTag) === -1) {
    throw new Error("[JM-WL-008] Choose a valid color tag.");
  }

  if (body.gameId) {
    const oldRow = getWaitlistObjects_("Waitlist_Games").find(function (row) { return row.GameID === body.gameId; });
    if (!oldRow) {
      throw new Error("[JM-WL-009] Game was not found.");
    }
    updateWaitlistObjectByKey_("Waitlist_Games", "GameID", body.gameId, {
      GameName: gameName,
      ColorTag: colorTag,
      Running: running,
      TableNumbers: tableNumbers,
      Active: active
    });
    writeWaitlistAudit_(staffName, "SAVE_WAITLIST_GAME", body.gameId, "gameName", oldRow.GameName, gameName, "Waitlist game updated");
    return getWaitlistGames_(true).find(function (g) { return g.gameId === body.gameId; });
  }

  const existingGames = getWaitlistObjects_("Waitlist_Games");
  const nextSortOrder = existingGames.length
    ? Math.max.apply(null, existingGames.map(function (row) { return Number(row.SortOrder || 0); })) + 1
    : 1;

  const gameId = newWaitlistId_("WLG");
  appendWaitlistObject_("Waitlist_Games", {
    GameID: gameId,
    GameName: gameName,
    ColorTag: colorTag,
    Running: running,
    TableNumbers: tableNumbers,
    SortOrder: nextSortOrder,
    Active: active
  });
  writeWaitlistAudit_(staffName, "SAVE_WAITLIST_GAME", gameId, "gameName", "", gameName, "Waitlist game created");
  return getWaitlistGames_(true).find(function (g) { return g.gameId === gameId; });
}

function writeWaitlistAudit_(staffName, action, recordId, fieldChanged, oldValue, newValue, reason) {
  appendWaitlistObject_("Waitlist_Audit_Log", {
    LogID: newWaitlistId_("WLLOG"),
    Timestamp: new Date(),
    StaffName: staffName,
    Action: action,
    RecordID: recordId,
    FieldChanged: fieldChanged,
    OldValue: oldValue,
    NewValue: newValue,
    Reason: reason
  });
}

function withWaitlistLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function newWaitlistId_(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").slice(0, 12).toUpperCase();
}

function waitlistIso_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") return value.toISOString();
  return new Date(value).toISOString();
}

function waitlistJson_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

let waitlistSheetObjectCache_ = {};
let waitlistSpreadsheetHandle_ = null;

function getWaitlistSpreadsheet_() {
  if (!waitlistSpreadsheetHandle_) {
    waitlistSpreadsheetHandle_ = SpreadsheetApp.getActiveSpreadsheet();
  }
  return waitlistSpreadsheetHandle_;
}

function clearWaitlistSheetCache_(sheetName) {
  if (sheetName) {
    delete waitlistSheetObjectCache_[sheetName];
  } else {
    waitlistSheetObjectCache_ = {};
  }
}

function appendWaitlistRows_(sheetName, rows) {
  const sheet = getWaitlistSpreadsheet_().getSheetByName(sheetName);
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
  clearWaitlistSheetCache_(sheetName);
}

function appendWaitlistObject_(sheetName, object) {
  const headers = WAITLIST_SHEET_HEADERS[sheetName];
  appendWaitlistRows_(sheetName, [headers.map(function (header) { return object[header] === undefined ? "" : object[header]; })]);
}

function getWaitlistObjects_(sheetName) {
  if (waitlistSheetObjectCache_[sheetName]) {
    return waitlistSheetObjectCache_[sheetName];
  }

  const sheet = getWaitlistSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) {
    waitlistSheetObjectCache_[sheetName] = [];
    return waitlistSheetObjectCache_[sheetName];
  }

  const allValues = sheet.getDataRange().getValues();
  const headers = allValues[0] || [];
  const values = allValues.slice(1);
  waitlistSheetObjectCache_[sheetName] = values
    .filter(function (row) { return row.some(function (value) { return value !== ""; }); })
    .map(function (row) {
      const object = {};
      headers.forEach(function (header, index) {
        object[header] = row[index];
      });
      return object;
    });

  return waitlistSheetObjectCache_[sheetName];
}

function updateWaitlistObjectByKey_(sheetName, keyHeader, keyValue, updates) {
  const sheet = getWaitlistSpreadsheet_().getSheetByName(sheetName);
  const allValues = sheet.getDataRange().getValues();
  const headers = allValues[0] || [];
  const keyIndex = headers.indexOf(keyHeader);
  if (keyIndex === -1) throw new Error("[JM-WLSHEET-001] Missing key header: " + keyHeader);

  for (let rowIndex = 1; rowIndex < allValues.length; rowIndex++) {
    if (String(allValues[rowIndex][keyIndex]) === String(keyValue)) {
      const next = allValues[rowIndex].slice();
      Object.keys(updates).forEach(function (header) {
        const column = headers.indexOf(header);
        if (column !== -1) {
          next[column] = updates[header];
        }
      });
      sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([next]);
      clearWaitlistSheetCache_(sheetName);
      return;
    }
  }

  throw new Error("[JM-WLSHEET-002] Could not find row in " + sheetName + " for " + keyValue);
}
