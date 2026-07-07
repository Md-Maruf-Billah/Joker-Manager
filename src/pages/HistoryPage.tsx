import { useEffect, useMemo, useState } from "react";
import { PageTitle } from "../components/AppShell";
import { Panel, PanelHeader } from "../components/Panel";
import { SelectField } from "../components/SelectField";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { cardLabel } from "../lib/cards";
import { errorMessage } from "../lib/errors";
import { formatCurrency, formatDateTime } from "../lib/format";
import type { TournamentRun } from "../types";

export function HistoryPage() {
  const [runs, setRuns] = useState<TournamentRun[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [jokerFilter, setJokerFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => {
    void api
      .history()
      .then((items) => setRuns(items as TournamentRun[]))
      .catch((err) => setError(errorMessage(err, "JM-HIST-001", "Could not load history.")));
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
        <PanelHeader title="Tournament runs">{filtered.length} rows shown.</PanelHeader>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
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
              </tr>
            </thead>
            <tbody className="divide-y divide-paper/10">
              {filtered.map((run) => (
                <tr key={run.runId} className="hover:bg-paper/[0.035]">
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
