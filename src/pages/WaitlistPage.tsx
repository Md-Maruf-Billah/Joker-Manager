import { Fragment, FormEvent, DragEvent, useEffect, useState } from "react";
import { clsx } from "clsx";
import { Armchair, ChevronDown, ChevronUp, GripVertical, Monitor, PlusCircle, RefreshCcw, Save, UserPlus, X } from "lucide-react";
import { PageTitle } from "../components/AppShell";
import { Button, ButtonLink } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { Panel, PanelHeader } from "../components/Panel";
import { SelectField } from "../components/SelectField";
import { SkeletonPanel } from "../components/Skeleton";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useSession } from "../lib/session";
import { WAITLIST_COLOR_TAGS, WAITLIST_COLOR_THEME } from "../lib/waitlist";
import type { WaitlistBoardColumn, WaitlistBoardData, WaitlistColorTag, WaitlistGame } from "../types";

const COLOR_TAG_LABELS: Record<WaitlistColorTag, string> = {
  red: "Red",
  teal: "Teal",
  green: "Green",
  gold: "Gold",
  burgundy: "Burgundy"
};

function moveWithinColumn(column: WaitlistBoardColumn, fromId: string, toId: string): WaitlistBoardColumn {
  const items = [...column.waiting];
  const fromIndex = items.findIndex((entry) => entry.entryId === fromId);
  const toIndex = items.findIndex((entry) => entry.entryId === toId);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return column;
  }
  const [moved] = items.splice(fromIndex, 1);
  items.splice(toIndex, 0, moved);
  return { ...column, waiting: items };
}

export function WaitlistPage() {
  const session = useSession();
  const [initialBootstrap] = useState(() => api.cachedWaitlistBootstrap());
  const [games, setGames] = useState<WaitlistGame[]>(() => initialBootstrap?.games ?? []);
  const [board, setBoard] = useState<WaitlistBoardData | null>(() => initialBootstrap?.board ?? null);
  const [loadError, setLoadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const [playerName, setPlayerName] = useState("");
  const [selectedGameIds, setSelectedGameIds] = useState<string[]>([]);
  const [addError, setAddError] = useState("");
  const [addNotice, setAddNotice] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [rowActionError, setRowActionError] = useState("");
  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);

  const [showManageGames, setShowManageGames] = useState(false);
  const [selectedGameEditId, setSelectedGameEditId] = useState("__new");
  const [gameName, setGameName] = useState("");
  const [gameColorTag, setGameColorTag] = useState<WaitlistColorTag>("red");
  const [gameRunning, setGameRunning] = useState(false);
  const [gameTableNumbers, setGameTableNumbers] = useState("");
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

  async function refresh() {
    setLoadError("");
    setRefreshing(true);
    try {
      await load({ bypassCache: true });
    } catch (err) {
      setLoadError(errorMessage(err, "JM-WL-001", "Could not load waitlist."));
    } finally {
      setRefreshing(false);
    }
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
      const created = await api.createWaitlistEntries({
        playerName,
        gameIds: selectedGameIds,
        staffName: session.staffName
      });
      setBoard((current) => {
        if (!current) return current;
        return {
          ...current,
          totalWaiting: current.totalWaiting + created.length,
          columns: current.columns.map((column) => {
            const additions = created.filter((entry) => entry.gameId === column.game.gameId);
            if (!additions.length) return column;
            return {
              ...column,
              waiting: [
                ...column.waiting,
                ...additions.map((entry) => ({ entryId: entry.entryId, playerName: entry.playerName, addedAt: entry.addedAt }))
              ],
              waitingCount: column.waitingCount + additions.length
            };
          })
        };
      });
      setAddNotice(`${playerName} added to the waitlist.`);
      setPlayerName("");
      setSelectedGameIds([]);
      void load({ bypassCache: true }).catch(() => undefined);
    } catch (err) {
      setAddError(errorMessage(err, "JM-WL-900", "Could not add to waitlist."));
    } finally {
      setAddLoading(false);
    }
  }

  async function handleSeat(entryId: string) {
    setRowActionError("");
    try {
      const updated = await api.markEntrySeated({ entryId, staffName: session.staffName });
      setBoard((current) => {
        if (!current) return current;
        let removedFromWaiting = false;
        const columns = current.columns.map((column) => {
          if (column.game.gameId !== updated.gameId) return column;
          const stillWaiting = column.waiting.filter((entry) => entry.entryId !== entryId);
          if (stillWaiting.length === column.waiting.length) return column;
          removedFromWaiting = true;
          return {
            ...column,
            waiting: stillWaiting,
            waitingCount: column.waitingCount - 1,
            seated: [{ entryId: updated.entryId, playerName: updated.playerName, addedAt: updated.addedAt }, ...column.seated],
            seatedCount: column.seatedCount + 1
          };
        });
        return { ...current, columns, totalWaiting: removedFromWaiting ? current.totalWaiting - 1 : current.totalWaiting };
      });
      void load({ bypassCache: true }).catch(() => undefined);
    } catch (err) {
      setRowActionError(errorMessage(err, "JM-WL-901", "Could not mark as seated."));
    }
  }

  async function handleRemove(entryId: string) {
    setRowActionError("");
    try {
      await api.removeWaitlistEntry({ entryId, staffName: session.staffName });
      setBoard((current) => {
        if (!current) return current;
        let removedFromWaiting = false;
        const columns = current.columns.map((column) => {
          const wasWaiting = column.waiting.some((entry) => entry.entryId === entryId);
          const wasSeated = column.seated.some((entry) => entry.entryId === entryId);
          if (!wasWaiting && !wasSeated) return column;
          if (wasWaiting) removedFromWaiting = true;
          return {
            ...column,
            waiting: column.waiting.filter((entry) => entry.entryId !== entryId),
            waitingCount: wasWaiting ? column.waitingCount - 1 : column.waitingCount,
            seated: column.seated.filter((entry) => entry.entryId !== entryId),
            seatedCount: wasSeated ? column.seatedCount - 1 : column.seatedCount
          };
        });
        return { ...current, columns, totalWaiting: removedFromWaiting ? current.totalWaiting - 1 : current.totalWaiting };
      });
      void load({ bypassCache: true }).catch(() => undefined);
    } catch (err) {
      setRowActionError(errorMessage(err, "JM-WL-902", "Could not remove entry."));
    }
  }

  function handleDragOver(event: DragEvent, gameId: string, overEntryId: string) {
    event.preventDefault();
    if (!draggedEntryId || draggedEntryId === overEntryId) {
      return;
    }
    setBoard((current) => {
      if (!current) return current;
      return {
        ...current,
        columns: current.columns.map((column) =>
          column.game.gameId === gameId ? moveWithinColumn(column, draggedEntryId, overEntryId) : column
        )
      };
    });
  }

  async function handleDrop(gameId: string) {
    const column = board?.columns.find((c) => c.game.gameId === gameId);
    setDraggedEntryId(null);
    if (!column) return;

    try {
      await api.reorderWaitlistEntries({
        gameId,
        entryIds: column.waiting.map((entry) => entry.entryId),
        staffName: session.staffName
      });
    } catch (err) {
      setRowActionError(errorMessage(err, "JM-WL-903", "Could not reorder the waitlist."));
      await load({ bypassCache: true });
    }
  }

  function resetGameForm() {
    setSelectedGameEditId("__new");
    setGameName("");
    setGameColorTag("red");
    setGameRunning(false);
    setGameTableNumbers("");
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
    setGameRunning(game.running);
    setGameTableNumbers(game.tableNumbers);
    setGameActive(String(game.active));
  }

  async function submitGame(event: FormEvent) {
    event.preventDefault();
    setGameError("");
    setGameNotice("");
    setGameLoading(true);

    try {
      const saved = await api.saveWaitlistGame({
        gameId: selectedGameEditId === "__new" ? undefined : selectedGameEditId,
        gameName,
        colorTag: gameColorTag,
        running: gameRunning,
        tableNumbers: gameTableNumbers,
        active: gameActive === "true",
        staffName: session.staffName,
        pin: gamePin
      });
      setGames((current) => {
        const exists = current.some((game) => game.gameId === saved.gameId);
        return exists ? current.map((game) => (game.gameId === saved.gameId ? saved : game)) : [...current, saved];
      });
      setBoard((current) => {
        if (!current) return current;
        const hasColumn = current.columns.some((column) => column.game.gameId === saved.gameId);
        return {
          ...current,
          columns: hasColumn
            ? current.columns.map((column) => (column.game.gameId === saved.gameId ? { ...column, game: saved } : column))
            : [...current.columns, { game: saved, waiting: [], waitingCount: 0, seated: [], seatedCount: 0 }]
        };
      });
      setGameNotice("Game saved.");
      resetGameForm();
      void load({ bypassCache: true }).catch(() => undefined);
    } catch (err) {
      setGameError(errorMessage(err, "JM-WL-904", "Could not save game."));
    } finally {
      setGameLoading(false);
    }
  }

  const activeGames = games.filter((game) => game.active);

  return (
    <>
      <PageTitle
        title="TLT Waitlist"
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/waitlist-tv" variant="secondary" target="_blank">
              <Monitor className="h-[15px] w-[15px]" />
              Open TV
            </ButtonLink>
            <Button variant="secondary" onClick={() => void refresh()}>
              <RefreshCcw className={refreshing ? "h-[15px] w-[15px] animate-spin" : "h-[15px] w-[15px]"} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
      >
        Record player interest for Time Limit Tournaments. Shows live on the TLT Waitlist TV.
      </PageTitle>
      {loadError ? <div className="mb-5"><StatusMessage tone="error">{loadError}</StatusMessage></div> : null}
      {!board ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <SkeletonPanel rows={3} />
          <SkeletonPanel rows={3} />
        </div>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Add to waitlist">Select every game this player is interested in.</PanelHeader>
            <form className="grid gap-4 p-[26px]" onSubmit={submitAdd}>
              <FormField label="Player name">
                <TextInput value={playerName} onChange={(event) => setPlayerName(event.target.value)} />
              </FormField>
              <FormField label="Games">
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {activeGames.map((game) => {
                    const theme = WAITLIST_COLOR_THEME[game.colorTag];
                    const checked = selectedGameIds.includes(game.gameId);
                    return (
                      <label
                        key={game.gameId}
                        className="flex min-h-[46px] items-center gap-2.5 rounded-[10px] border px-3.5 text-sm font-semibold text-ink transition-colors"
                        style={{
                          borderColor: checked ? theme.accent : "rgba(0,0,0,0.14)",
                          background: checked ? theme.tint : "var(--tw-color-field, #F5F5F6)"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGameId(game.gameId)}
                          className="h-4 w-4 flex-shrink-0"
                          style={{ accentColor: theme.accent }}
                        />
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: theme.accent }} />
                        {game.gameName}
                      </label>
                    );
                  })}
                  {activeGames.length === 0 ? (
                    <div className="text-sm text-muted sm:col-span-2">No active games yet. Add one below.</div>
                  ) : null}
                </div>
              </FormField>
              {addError ? <StatusMessage tone="error">{addError}</StatusMessage> : null}
              {addNotice ? <StatusMessage tone="success">{addNotice}</StatusMessage> : null}
              <Button type="submit" disabled={!playerName.trim() || !selectedGameIds.length || addLoading}>
                <UserPlus className="h-4 w-4" />
                {addLoading ? "Adding..." : "Add to waitlist"}
              </Button>
            </form>
          </Panel>

          {rowActionError ? <div className="mt-5"><StatusMessage tone="error">{rowActionError}</StatusMessage></div> : null}

          <div className="mt-5 grid gap-5 xl:grid-cols-2">
            {board.columns.map((column) => {
              const theme = WAITLIST_COLOR_THEME[column.game.colorTag];
              return (
                <Panel key={column.game.gameId} className="overflow-hidden" style={{ borderTopColor: theme.accent, borderTopWidth: "3px" }}>
                  <PanelHeader
                    title={column.game.gameName}
                    action={<span className="text-xs font-semibold text-muted">{column.waitingCount} waiting</span>}
                  >
                    {column.game.running ? (
                      <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: theme.accent }}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: theme.accent }} />
                        RUNNING{column.game.tableNumbers ? ` · Tables ${column.game.tableNumbers}` : ""}
                      </span>
                    ) : (
                      "Interest — no tables running yet"
                    )}
                  </PanelHeader>
                  <div className="border-b border-black/[0.06] px-[26px] pb-2.5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                    Waitlist
                  </div>
                  {column.waiting.length === 0 ? (
                    <div className="px-[26px] py-5 text-sm text-muted">No one waiting for this game.</div>
                  ) : (
                    <div className="divide-y divide-black/[0.06]">
                      {column.waiting.map((entry) => (
                        <div
                          key={entry.entryId}
                          draggable
                          onDragStart={() => setDraggedEntryId(entry.entryId)}
                          onDragOver={(event) => handleDragOver(event, column.game.gameId, entry.entryId)}
                          onDrop={() => void handleDrop(column.game.gameId)}
                          onDragEnd={() => setDraggedEntryId(null)}
                          className={clsx(
                            "flex items-center gap-2.5 px-[26px] py-3 transition-all duration-150",
                            draggedEntryId === entry.entryId ? "opacity-40" : "opacity-100"
                          )}
                        >
                          <GripVertical className="h-4 w-4 flex-shrink-0 cursor-grab text-faint active:cursor-grabbing" />
                          <span className="flex-1 truncate font-semibold text-ink">{entry.playerName}</span>
                          <button
                            type="button"
                            onClick={() => void handleSeat(entry.entryId)}
                            title="Mark seated"
                            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-success transition-all duration-150 hover:bg-success/[0.12] active:scale-90"
                          >
                            <Armchair className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleRemove(entry.entryId)}
                            title="Remove"
                            className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg text-brand-danger transition-all duration-150 hover:bg-brand-danger/[0.12] active:scale-90"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {column.seatedCount > 0 ? (
                    <div className="border-t border-black/[0.06] bg-black/[0.015] px-[26px] py-3.5">
                      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">
                        Seated ({column.seatedCount})
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {column.seated.map((entry) => (
                          <div key={entry.entryId} className="flex items-center gap-2.5">
                            <span className="flex-1 truncate text-sm text-muted">{entry.playerName}</span>
                            <button
                              type="button"
                              onClick={() => void handleRemove(entry.entryId)}
                              title="Remove"
                              className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg text-faint transition-all duration-150 hover:bg-black/[0.06] hover:text-brand-danger active:scale-90"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Panel>
              );
            })}
          </div>

          <Panel className="mt-5">
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
              <div className="p-[26px]">
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
                  <FormField label="Game name">
                    <TextInput value={gameName} onChange={(event) => setGameName(event.target.value)} placeholder="$1/3 NLHE" />
                  </FormField>
                  <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                    <SelectField
                      label="Color tag"
                      value={gameColorTag}
                      onValueChange={(value) => setGameColorTag(value as WaitlistColorTag)}
                      options={WAITLIST_COLOR_TAGS.map((tag) => ({ value: tag, label: COLOR_TAG_LABELS[tag] }))}
                    />
                    <div className="flex items-end pb-[3px]">
                      <div
                        className="h-[42px] w-[42px] flex-shrink-0 rounded-[10px] border border-black/10"
                        style={{ background: WAITLIST_COLOR_THEME[gameColorTag].accent }}
                        title={`${COLOR_TAG_LABELS[gameColorTag]} preview`}
                      />
                    </div>
                  </div>
                  <FormField label="Status">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGameRunning(false)}
                        className={clsx(
                          "min-h-[42px] rounded-[10px] border text-sm font-bold transition-all duration-150",
                          !gameRunning ? "border-ink bg-ink text-white" : "border-black/[0.14] bg-field text-muted hover:bg-black/[0.03]"
                        )}
                      >
                        Interest
                      </button>
                      <button
                        type="button"
                        onClick={() => setGameRunning(true)}
                        className={clsx(
                          "min-h-[42px] rounded-[10px] border text-sm font-bold transition-all duration-150",
                          gameRunning ? "border-success bg-success text-white" : "border-black/[0.14] bg-field text-muted hover:bg-black/[0.03]"
                        )}
                      >
                        Running
                      </button>
                    </div>
                  </FormField>
                  {gameRunning ? (
                    <FormField label="Table numbers" hint="Shown on the TV board, e.g. 45, 48">
                      <TextInput value={gameTableNumbers} onChange={(event) => setGameTableNumbers(event.target.value)} />
                    </FormField>
                  ) : null}
                  <SelectField
                    label="Active"
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
                  <div className="flex gap-2.5">
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
                <div className="mt-6 divide-y divide-black/[0.06] border-t border-black/[0.06]">
                  {games.map((game) => {
                    const theme = WAITLIST_COLOR_THEME[game.colorTag];
                    return (
                      <div key={game.gameId} className="flex items-center gap-2.5 py-3">
                        <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: theme.accent }} />
                        <span className="flex-1 text-sm font-semibold text-ink">{game.gameName}</span>
                        <span className="text-xs text-muted">{game.active ? "Active" : "Inactive"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </Panel>
        </>
      )}
    </>
  );
}
