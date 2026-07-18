import { Fragment, FormEvent, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, PlusCircle, Save, UserPlus, UserMinus, X } from "lucide-react";
import { PageTitle } from "../components/AppShell";
import { Button } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { Panel, PanelHeader } from "../components/Panel";
import { SelectField } from "../components/SelectField";
import { SkeletonPanel } from "../components/Skeleton";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useSession } from "../lib/session";
import { WAITLIST_COLOR_TAGS } from "../lib/waitlist";
import type { WaitlistBoardData, WaitlistColorTag, WaitlistGame } from "../types";

const COLOR_TAG_LABELS: Record<WaitlistColorTag, string> = {
  red: "Red",
  teal: "Teal",
  green: "Green",
  gold: "Gold",
  burgundy: "Burgundy"
};

export function WaitlistPage() {
  const session = useSession();
  const [initialBootstrap] = useState(() => api.cachedWaitlistBootstrap());
  const [games, setGames] = useState<WaitlistGame[]>(() => initialBootstrap?.games ?? []);
  const [board, setBoard] = useState<WaitlistBoardData | null>(() => initialBootstrap?.board ?? null);
  const [loadError, setLoadError] = useState("");

  const [playerName, setPlayerName] = useState("");
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [addPin, setAddPin] = useState("");
  const [addError, setAddError] = useState("");
  const [addNotice, setAddNotice] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  const [removeEntryId, setRemoveEntryId] = useState<string | null>(null);
  const [removeReason, setRemoveReason] = useState("");
  const [removePin, setRemovePin] = useState("");
  const [removeError, setRemoveError] = useState("");
  const [removeLoading, setRemoveLoading] = useState(false);

  const [showManageGames, setShowManageGames] = useState(false);
  const [selectedGameEditId, setSelectedGameEditId] = useState("__new");
  const [gameName, setGameName] = useState("");
  const [gameColorTag, setGameColorTag] = useState<WaitlistColorTag>("red");
  const [gameActiveTables, setGameActiveTables] = useState("");
  const [gameSortOrder, setGameSortOrder] = useState("1");
  const [gameActive, setGameActive] = useState("true");
  const [gamePin, setGamePin] = useState("");
  const [gameError, setGameError] = useState("");
  const [gameNotice, setGameNotice] = useState("");
  const [gameLoading, setGameLoading] = useState(false);

  async function load(options: { bypassCache?: boolean } = {}) {
    const bootstrap = await api.waitlistBootstrap(options);
    setGames(bootstrap.games);
    setBoard(bootstrap.board);
  }

  useEffect(() => {
    void load({ bypassCache: Boolean(initialBootstrap) }).catch((err) =>
      setLoadError(errorMessage(err, "JM-WL-001", "Could not load waitlist."))
    );
    const interval = window.setInterval(() => void load().catch(() => undefined), 20_000);
    return () => window.clearInterval(interval);
  }, []);

  function toggleGameId(gameId: string) {
    setSelectedGameIds((current) => (current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId]));
  }

  async function submitAdd(event: FormEvent) {
    event.preventDefault();
    setAddError("");
    setAddNotice("");
    setAddLoading(true);

    try {
      await api.createWaitlistEntries({
        playerName,
        gameIds: selectedGameIds,
        staffName: session.staffName,
        pin: addPin
      });
      setAddNotice(`${playerName} added to the waitlist.`);
      setPlayerName("");
      setSelectedGameIds([]);
      setAddPin("");
      await load({ bypassCache: true });
    } catch (err) {
      setAddError(errorMessage(err, "JM-WL-900", "Could not add to waitlist."));
    } finally {
      setAddLoading(false);
    }
  }

  function openRemoveRow(entryId: string) {
    setRemoveEntryId(entryId);
    setRemoveReason("");
    setRemovePin("");
    setRemoveError("");
  }

  function closeRemoveRow() {
    setRemoveEntryId(null);
    setRemoveReason("");
    setRemovePin("");
    setRemoveError("");
  }

  async function submitRemove(event: FormEvent, entryId: string) {
    event.preventDefault();
    setRemoveError("");
    setRemoveLoading(true);

    try {
      await api.removeWaitlistEntry({
        entryId,
        reason: removeReason,
        staffName: session.staffName,
        pin: removePin
      });
      closeRemoveRow();
      await load({ bypassCache: true });
    } catch (err) {
      setRemoveError(errorMessage(err, "JM-WL-901", "Could not remove entry."));
    } finally {
      setRemoveLoading(false);
    }
  }

  function resetGameForm() {
    setSelectedGameEditId("__new");
    setGameName("");
    setGameColorTag("red");
    setGameActiveTables("");
    setGameSortOrder(String(games.length + 1));
    setGameActive("true");
    setGamePin("");
  }

  function selectGameForEdit(value: string) {
    setSelectedGameEditId(value);
    if (value === "__new") {
      resetGameForm();
      return;
    }

    const game = games.find((item) => item.gameId === value);
    if (!game) {
      return;
    }

    setGameName(game.gameName);
    setGameColorTag(game.colorTag);
    setGameActiveTables(game.activeTables);
    setGameSortOrder(String(game.sortOrder));
    setGameActive(String(game.active));
  }

  async function submitGame(event: FormEvent) {
    event.preventDefault();
    setGameError("");
    setGameNotice("");
    setGameLoading(true);

    try {
      await api.saveWaitlistGame({
        gameId: selectedGameEditId === "__new" ? undefined : selectedGameEditId,
        gameName,
        colorTag: gameColorTag,
        activeTables: gameActiveTables,
        sortOrder: Number(gameSortOrder),
        active: gameActive === "true",
        staffName: session.staffName,
        pin: gamePin
      });
      setGameNotice("Game saved.");
      resetGameForm();
      await load({ bypassCache: true });
    } catch (err) {
      setGameError(errorMessage(err, "JM-WL-902", "Could not save game."));
    } finally {
      setGameLoading(false);
    }
  }

  const activeGames = games.filter((game) => game.active);

  return (
    <>
      <PageTitle title="Waitlist">
        Record player interest for Time Limit Tournaments cash games. Shows live on the Waitlist TV.
      </PageTitle>
      {loadError ? <div className="mb-4"><StatusMessage tone="error">{loadError}</StatusMessage></div> : null}
      {!board ? (
        <div className="grid gap-[18px] xl:grid-cols-2">
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={3} />
        </div>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Add to waitlist">Select every game this player is interested in.</PanelHeader>
            <form className="grid gap-4 p-[24px] px-[26px]" onSubmit={submitAdd}>
              <FormField label="Player name">
                <TextInput value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
              </FormField>
              <FormField label="Games">
                <div className="grid gap-2 sm:grid-cols-2">
                  {activeGames.map((game) => (
                    <label
                      key={game.gameId}
                      className="flex min-h-[42px] items-center gap-2.5 rounded-[10px] border border-black/[0.14] bg-field px-3.5 text-sm font-semibold text-ink"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGameIds.includes(game.gameId)}
                        onChange={() => toggleGameId(game.gameId)}
                        className="h-4 w-4 accent-brand-red"
                      />
                      {game.gameName}
                    </label>
                  ))}
                  {activeGames.length === 0 ? (
                    <div className="text-sm text-muted sm:col-span-2">No active games yet. Add one below.</div>
                  ) : null}
                </div>
              </FormField>
              <FormField label="Staff password">
                <TextInput value={addPin} onChange={(event) => setAddPin(event.target.value)} type="password" />
              </FormField>
              {addError ? <StatusMessage tone="error">{addError}</StatusMessage> : null}
              {addNotice ? <StatusMessage tone="success">{addNotice}</StatusMessage> : null}
              <Button type="submit" disabled={!playerName.trim() || !selectedGameIds.length || !addPin || addLoading}>
                <UserPlus className="h-4 w-4" />
                {addLoading ? "Adding..." : "Add to waitlist"}
              </Button>
            </form>
          </Panel>

          <div className="mt-[18px] grid gap-[18px] xl:grid-cols-2">
            {board.columns.map((column) => (
              <Panel key={column.game.gameId} className="overflow-hidden">
                <PanelHeader
                  title={column.game.gameName}
                  action={<span className="text-xs font-semibold text-muted">{column.waitingCount} waiting</span>}
                >
                  {column.game.activeTables ? column.game.activeTables : "Interest only — no tables running yet"}
                </PanelHeader>
                {column.waiting.length === 0 ? (
                  <div className="px-[26px] py-5 text-sm text-muted">No one waiting for this game.</div>
                ) : (
                  <div className="divide-y divide-black/[0.06]">
                    {column.waiting.map((entry) => {
                      const expanded = removeEntryId === entry.entryId;
                      return (
                        <Fragment key={entry.entryId}>
                          <div className="flex items-center justify-between gap-3 px-[26px] py-3.5">
                            <span className="font-semibold text-ink">{entry.playerName}</span>
                            <Button
                              type="button"
                              variant="secondary"
                              className="min-h-8 px-2.5 text-xs"
                              onClick={() => (expanded ? closeRemoveRow() : openRemoveRow(entry.entryId))}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              Remove
                            </Button>
                          </div>
                          {expanded ? (
                            <div className="bg-black/[0.02] px-[26px] py-4">
                              <form className="grid gap-3 sm:grid-cols-3" onSubmit={(event) => void submitRemove(event, entry.entryId)}>
                                <FormField label="Reason (optional)">
                                  <TextInput value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} placeholder="Seated" />
                                </FormField>
                                <FormField label="Staff password">
                                  <TextInput value={removePin} onChange={(event) => setRemovePin(event.target.value)} type="password" />
                                </FormField>
                                <div className="flex items-end gap-2">
                                  <Button type="submit" variant="danger" disabled={!removePin || removeLoading}>
                                    {removeLoading ? "Removing..." : "Confirm remove"}
                                  </Button>
                                  <Button type="button" variant="ghost" onClick={closeRemoveRow}>
                                    <X className="h-4 w-4" />
                                    Cancel
                                  </Button>
                                </div>
                                {removeError ? <div className="sm:col-span-3"><StatusMessage tone="error">{removeError}</StatusMessage></div> : null}
                              </form>
                            </div>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </div>
                )}
              </Panel>
            ))}
          </div>

          <Panel className="mt-[18px]">
            <PanelHeader
              title="Manage games"
              action={
                <Button type="button" variant="ghost" onClick={() => setShowManageGames((current) => !current)}>
                  {showManageGames ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  {showManageGames ? "Hide" : "Show"}
                </Button>
              }
            >
              Add or edit the game types offered on the waitlist and TV board.
            </PanelHeader>
            {showManageGames ? (
              <div className="p-[24px] px-[26px]">
                <form className="grid gap-4" onSubmit={submitGame}>
                  <SelectField
                    label="Edit existing"
                    value={selectedGameEditId}
                    onValueChange={selectGameForEdit}
                    options={[
                      { value: "__new", label: "Create new game" },
                      ...games.map((game) => ({
                        value: game.gameId,
                        label: game.gameName,
                        detail: game.active ? "Active" : "Inactive"
                      }))
                    ]}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Game name">
                      <TextInput value={gameName} onChange={(event) => setGameName(event.target.value)} placeholder="$1/3 NLHE" />
                    </FormField>
                    <SelectField
                      label="Color tag"
                      value={gameColorTag}
                      onValueChange={(value) => setGameColorTag(value as WaitlistColorTag)}
                      options={WAITLIST_COLOR_TAGS.map((tag) => ({ value: tag, label: COLOR_TAG_LABELS[tag] }))}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <FormField label="Active tables note" hint="Shown on the TV board, e.g. 2 tables running">
                        <TextInput value={gameActiveTables} onChange={(event) => setGameActiveTables(event.target.value)} />
                      </FormField>
                    </div>
                    <FormField label="Sort order">
                      <TextInput value={gameSortOrder} onChange={(event) => setGameSortOrder(event.target.value)} inputMode="numeric" />
                    </FormField>
                  </div>
                  <SelectField
                    label="Status"
                    value={gameActive}
                    onValueChange={setGameActive}
                    options={[
                      { value: "true", label: "Active" },
                      { value: "false", label: "Inactive" }
                    ]}
                  />
                  <FormField label="Staff password">
                    <TextInput value={gamePin} onChange={(event) => setGamePin(event.target.value)} type="password" />
                  </FormField>
                  {gameError ? <StatusMessage tone="error">{gameError}</StatusMessage> : null}
                  {gameNotice ? <StatusMessage tone="success">{gameNotice}</StatusMessage> : null}
                  <div className="flex gap-2">
                    <Button type="submit" disabled={!gameName.trim() || !gamePin || gameLoading}>
                      <Save className="h-4 w-4" />
                      {gameLoading ? "Saving..." : "Save game"}
                    </Button>
                    <Button type="button" variant="ghost" onClick={resetGameForm}>
                      <PlusCircle className="h-4 w-4" />
                      New game
                    </Button>
                  </div>
                </form>
                <div className="mt-5 divide-y divide-black/[0.06] border-t border-black/[0.06]">
                  {games.map((game) => (
                    <div key={game.gameId} className="flex items-center justify-between gap-3 py-3">
                      <span className="text-sm font-semibold text-ink">{game.gameName}</span>
                      <span className="text-xs text-muted">{game.active ? "Active" : "Inactive"}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Panel>
        </>
      )}
    </>
  );
}
