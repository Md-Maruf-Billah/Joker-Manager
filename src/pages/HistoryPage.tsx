import { Fragment, FormEvent, useEffect, useMemo, useState } from "react";
import { Ban, Pencil, X } from "lucide-react";
import { PageTitle } from "../components/AppShell";
import { Button } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { HoldButton } from "../components/HoldButton";
import { Panel, PanelHeader } from "../components/Panel";
import { SelectField } from "../components/SelectField";
import { SkeletonRow } from "../components/Skeleton";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { cardLabel } from "../lib/cards";
import { errorMessage } from "../lib/errors";
import { formatCurrency, formatDateTime } from "../lib/format";
import { useSession } from "../lib/session";
import type { DashboardData, TournamentRun } from "../types";

type RowMode = { runId: string; kind: "edit" | "void" } | null;

export function HistoryPage() {
  const session = useSession();
  const [initialBootstrap] = useState(() => api.cachedHistoryBootstrap());
  const [runs, setRuns] = useState<TournamentRun[]>(() => initialBootstrap?.runs ?? []);
  const [dashboard, setDashboard] = useState<DashboardData | null>(() => initialBootstrap?.dashboard ?? null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [jokerFilter, setJokerFilter] = useState("all");
  const [error, setError] = useState("");
  const [rowMode, setRowMode] = useState<RowMode>(null);
  const [winnerName, setWinnerName] = useState("");
  const [entries, setEntries] = useState("");
  const [reason, setReason] = useState("");
  const [pin, setPin] = useState("");
  const [rowError, setRowError] = useState("");
  const [rowMessage, setRowMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function load(options: { bypassCache?: boolean } = {}) {
    const bootstrap = await api.historyBootstrap(options);
    setRuns(bootstrap.runs);
    setDashboard(bootstrap.dashboard);
  }

  useEffect(() => {
    void load({ bypassCache: Boolean(initialBootstrap) }).catch((err) =>
      setError(errorMessage(err, "JM-HIST-001", "Could not load history."))
    );
  }, []);

  const filtered = useMemo(() => {
    return runs.filter((run) => {
      const typeMatch = typeFilter === "all" || run.tournamentTypeId === typeFilter;
      const jokerMatch =
        jokerFilter === "all" ||
        (jokerFilter === "joker" && run.jokerHit) ||
        (jokerFilter === "nonjoker" && !run.jokerHit);

      return typeMatch && jokerMatch;
    });
  }, [jokerFilter, runs, typeFilter]);

  function closeRow() {
    setRowMode(null);
    setWinnerName("");
    setEntries("");
    setReason("");
    setPin("");
    setRowError("");
    setRowMessage("");
  }

  function openEdit(run: TournamentRun) {
    setRowMode({ runId: run.runId, kind: "edit" });
    setWinnerName(run.winnerName ?? "");
    setEntries(String(run.entries));
    setReason("");
    setPin("");
    setRowError("");
    setRowMessage("");
  }

  function openVoid(run: TournamentRun) {
    setRowMode({ runId: run.runId, kind: "void" });
    setReason("");
    setPin("");
    setRowError("");
    setRowMessage("");
  }

  async function submitEdit(event: FormEvent, run: TournamentRun) {
    event.preventDefault();
    setRowError("");
    setRowMessage("");
    setLoading(true);

    try {
      await api.editRun({
        runId: run.runId,
        staffName: session.staffName,
        pin,
        reason,
        winnerName: run.status === "Complete" ? winnerName : undefined,
        entries: run.status === "Awaiting Draw" ? Number(entries) : undefined
      });
      setRowMessage("Run updated and logged.");
      await load({ bypassCache: true });
      closeRow();
    } catch (err) {
      setRowError(errorMessage(err, "JM-EDIT-900", "Could not save edit."));
    } finally {
      setLoading(false);
    }
  }

  async function submitVoid(run: TournamentRun) {
    setRowError("");
    setRowMessage("");
    setLoading(true);

    try {
      await api.voidRun({
        runId: run.runId,
        staffName: session.staffName,
        pin,
        reason
      });
      setRowMessage("Run voided and logged.");
      await load({ bypassCache: true });
      closeRow();
    } catch (err) {
      setRowError(errorMessage(err, "JM-VOID-900", "Could not void run."));
    } finally {
      setLoading(false);
    }
  }

  function voidBlockedReason(run: TournamentRun) {
    if (run.status === "Voided") {
      return "This run has already been voided.";
    }
    if (run.jokerHit) {
      return "Joker-hit runs cannot be voided. Use Admin manual adjustment instead.";
    }
    if (run.runId !== dashboard?.jackpotState.lastRunId) {
      return "Only the most recent tournament run can be voided.";
    }
    return null;
  }

  return (
    <>
      <PageTitle title="History">
        Review tournament runs, jackpot contribution, card result, closing jackpot, and staff submission.
      </PageTitle>
      {error ? <div className="mb-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
      <Panel className="p-[20px] px-[26px]">
        <div className="flex flex-wrap gap-3.5">
          <div className="min-w-[220px] flex-1">
            <SelectField
              label="Tournament type"
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={[
                { value: "all", label: "All tournament types" },
                { value: "HTJ", label: "Hyper Turbo Joker" },
                { value: "SSJ", label: "Sunday Slam Joker Jackpot" }
              ]}
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <SelectField
              label="Joker hit"
              value={jokerFilter}
              onValueChange={setJokerFilter}
              options={[
                { value: "all", label: "All results" },
                { value: "joker", label: "Joker hit only" },
                { value: "nonjoker", label: "Non-Joker only" }
              ]}
            />
          </div>
        </div>
      </Panel>
      <Panel className="mt-4 overflow-hidden">
        <PanelHeader title={dashboard ? `${filtered.length} runs shown` : "Loading..."} />
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left text-[13.5px]">
            <thead>
              <tr>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Date</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Tournament</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Entries</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Available</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Winner</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Card</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Status</th>
                <th className="border-b border-black/[0.07] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!dashboard ? (
                <>
                  <SkeletonRow columns={8} />
                  <SkeletonRow columns={8} />
                  <SkeletonRow columns={8} />
                </>
              ) : null}
              {filtered.map((run) => {
                const expanded = rowMode?.runId === run.runId ? rowMode.kind : null;
                const blocked = voidBlockedReason(run);
                const isVoided = run.status === "Voided";

                return (
                  <Fragment key={run.runId}>
                    <tr className={isVoided ? "opacity-45" : "hover:bg-black/[0.015]"}>
                      <td className="border-b border-black/[0.06] px-4 py-[13px] text-muted">{formatDateTime(run.updatedAt)}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px] font-bold text-ink">{run.tournamentName}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px]">{run.entries}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px] text-jackpot">{formatCurrency(run.availableJackpot)}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px]">{run.winnerName ?? "Pending"}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px]">{run.cardPulled ? cardLabel(run.cardPulled) : "Pending"}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px]">{run.status}</td>
                      <td className="border-b border-black/[0.06] px-4 py-[13px]">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-8 px-2.5 text-[11.5px]"
                            disabled={isVoided}
                            onClick={() => (expanded === "edit" ? closeRow() : openEdit(run))}
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="min-h-8 px-2.5 text-[11.5px]"
                            disabled={Boolean(blocked)}
                            title={blocked ?? undefined}
                            onClick={() => (expanded === "void" ? closeRow() : openVoid(run))}
                          >
                            <Ban className="h-3 w-3" />
                            Void
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-black/[0.02]">
                        <td colSpan={8} className="border-b border-black/[0.06] px-[22px] py-[18px]">
                          {expanded === "edit" ? (
                            <form
                              className="flex flex-wrap items-end gap-3.5"
                              onSubmit={(event) => void submitEdit(event, run)}
                            >
                              {run.status === "Complete" ? (
                                <div className="min-w-[220px]">
                                  <FormField label="Winner name">
                                    <TextInput value={winnerName} onChange={(event) => setWinnerName(event.target.value)} />
                                  </FormField>
                                </div>
                              ) : (
                                <div className="min-w-[180px]">
                                  <FormField label="Entries" hint="Only before the draw is submitted">
                                    <TextInput
                                      value={entries}
                                      onChange={(event) => setEntries(event.target.value)}
                                      inputMode="numeric"
                                    />
                                  </FormField>
                                </div>
                              )}
                              <div className="min-w-[220px]">
                                <FormField label="Reason">
                                  <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason" />
                                </FormField>
                              </div>
                              <div className="min-w-[180px]">
                                <FormField label="Staff password">
                                  <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
                                </FormField>
                              </div>
                              <Button type="submit" disabled={!reason.trim() || !pin || loading}>
                                {loading ? "Saving..." : "Save edit"}
                              </Button>
                              <Button type="button" variant="ghost" onClick={closeRow}>
                                <X className="h-4 w-4" />
                                Cancel
                              </Button>
                              {rowError ? (
                                <div className="w-full"><StatusMessage tone="error">{rowError}</StatusMessage></div>
                              ) : null}
                              {rowMessage ? (
                                <div className="w-full"><StatusMessage tone="success">{rowMessage}</StatusMessage></div>
                              ) : null}
                            </form>
                          ) : (
                            <div className="flex flex-wrap items-end gap-3.5">
                              <div className="min-w-[220px]">
                                <FormField label="Void reason">
                                  <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason" />
                                </FormField>
                              </div>
                              <div className="min-w-[180px]">
                                <FormField label="Staff password">
                                  <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
                                </FormField>
                              </div>
                              <div className="min-h-[46px] min-w-[260px]">
                                <HoldButton
                                  label="Hold to void"
                                  disabled={!reason.trim() || !pin || loading}
                                  onComplete={() => void submitVoid(run)}
                                />
                              </div>
                              <Button type="button" variant="ghost" onClick={closeRow}>
                                <X className="h-4 w-4" />
                                Cancel
                              </Button>
                              {rowError ? (
                                <div className="w-full"><StatusMessage tone="error">{rowError}</StatusMessage></div>
                              ) : null}
                              {rowMessage ? (
                                <div className="w-full"><StatusMessage tone="success">{rowMessage}</StatusMessage></div>
                              ) : null}
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
