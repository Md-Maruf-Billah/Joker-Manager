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
  const [runs, setRuns] = useState<TournamentRun[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
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

  async function load() {
    const [items, dashboardData] = await Promise.all([api.history(), api.dashboard()]);
    setRuns(items as TournamentRun[]);
    setDashboard(dashboardData as DashboardData);
  }

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err, "JM-HIST-001", "Could not load history.")));
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
      await load();
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
      await load();
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
      <Panel>
        <PanelHeader title="Filters">
          This first pass filters locally. The Worker route will forward date and staff filters to Apps Script later.
        </PanelHeader>
        <div className="grid gap-4 p-5 md:grid-cols-2">
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
      </Panel>
      <Panel className="mt-6 overflow-hidden">
        <PanelHeader title="Tournament runs">{dashboard ? `${filtered.length} rows shown.` : "Loading..."}</PanelHeader>
        <div className="overflow-x-auto">
          <table className="min-w-[1260px] w-full text-left text-sm">
            <thead className="bg-paper/5 text-xs uppercase tracking-[0.12em] text-muted">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Tournament</th>
                <th className="px-4 py-3">Entries</th>
                <th className="px-4 py-3">Contribution</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Winner</th>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Joker</th>
                <th className="px-4 py-3">Closing</th>
                <th className="px-4 py-3">Cards after</th>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper/10">
              {!dashboard ? (
                <>
                  <SkeletonRow columns={13} />
                  <SkeletonRow columns={13} />
                  <SkeletonRow columns={13} />
                </>
              ) : null}
              {filtered.map((run) => {
                const expanded = rowMode?.runId === run.runId ? rowMode.kind : null;
                const blocked = voidBlockedReason(run);
                const isVoided = run.status === "Voided";

                return (
                  <Fragment key={run.runId}>
                    <tr className={isVoided ? "opacity-50 hover:bg-paper/[0.035]" : "hover:bg-paper/[0.035]"}>
                      <td className="px-4 py-3 text-muted">{formatDateTime(run.updatedAt)}</td>
                      <td className="px-4 py-3 font-semibold text-paper">{run.tournamentName}</td>
                      <td className="px-4 py-3">{run.entries}</td>
                      <td className="px-4 py-3">{formatCurrency(run.contribution)}</td>
                      <td className="px-4 py-3 text-gold-300">{formatCurrency(run.availableJackpot)}</td>
                      <td className="px-4 py-3">{run.winnerName ?? "Pending"}</td>
                      <td className="px-4 py-3">{run.cardPulled ? cardLabel(run.cardPulled) : "Pending"}</td>
                      <td className="px-4 py-3">{run.jokerHit ? "Yes" : "No"}</td>
                      <td className="px-4 py-3">{formatCurrency(run.closingJackpot)}</td>
                      <td className="px-4 py-3">{run.cardsAfter}</td>
                      <td className="px-4 py-3">{run.staffName}</td>
                      <td className="px-4 py-3">{run.status}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="min-h-9 px-2.5 text-xs"
                            disabled={isVoided}
                            onClick={() => (expanded === "edit" ? closeRow() : openEdit(run))}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="danger"
                            className="min-h-9 px-2.5 text-xs"
                            disabled={Boolean(blocked)}
                            title={blocked ?? undefined}
                            onClick={() => (expanded === "void" ? closeRow() : openVoid(run))}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            Void
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {expanded ? (
                      <tr className="bg-paper/[0.03]">
                        <td colSpan={13} className="px-4 py-5">
                          {expanded === "edit" ? (
                            <form
                              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                              onSubmit={(event) => void submitEdit(event, run)}
                            >
                              {run.status === "Complete" ? (
                                <FormField label="Winner name">
                                  <TextInput value={winnerName} onChange={(event) => setWinnerName(event.target.value)} />
                                </FormField>
                              ) : (
                                <FormField label="Entries" hint="Only editable before the draw is submitted.">
                                  <TextInput
                                    value={entries}
                                    onChange={(event) => setEntries(event.target.value)}
                                    inputMode="numeric"
                                  />
                                </FormField>
                              )}
                              <FormField label="Reason">
                                <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Correction reason" />
                              </FormField>
                              <FormField label="Staff password">
                                <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
                              </FormField>
                              <div className="flex items-end gap-2">
                                <Button type="submit" disabled={!reason.trim() || !pin || loading}>
                                  {loading ? "Saving..." : "Save edit"}
                                </Button>
                                <Button type="button" variant="ghost" onClick={closeRow}>
                                  <X className="h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                              {rowError ? (
                                <div className="sm:col-span-2 lg:col-span-4">
                                  <StatusMessage tone="error">{rowError}</StatusMessage>
                                </div>
                              ) : null}
                              {rowMessage ? (
                                <div className="sm:col-span-2 lg:col-span-4">
                                  <StatusMessage tone="success">{rowMessage}</StatusMessage>
                                </div>
                              ) : null}
                            </form>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                              <FormField label="Reason">
                                <TextInput value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Void reason" />
                              </FormField>
                              <FormField label="Staff password">
                                <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
                              </FormField>
                              <div className="flex items-end gap-2 lg:col-span-2">
                                <HoldButton
                                  label="Hold 2 seconds to void this run"
                                  disabled={!reason.trim() || !pin || loading}
                                  onComplete={() => void submitVoid(run)}
                                />
                                <Button type="button" variant="ghost" onClick={closeRow}>
                                  <X className="h-4 w-4" />
                                  Cancel
                                </Button>
                              </div>
                              {rowError ? (
                                <div className="sm:col-span-2 lg:col-span-4">
                                  <StatusMessage tone="error">{rowError}</StatusMessage>
                                </div>
                              ) : null}
                              {rowMessage ? (
                                <div className="sm:col-span-2 lg:col-span-4">
                                  <StatusMessage tone="success">{rowMessage}</StatusMessage>
                                </div>
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
