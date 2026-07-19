import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calculator, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { PageTitle } from "../components/AppShell";
import { Button, ButtonLink } from "../components/Button";
import { FormField, TextInput } from "../components/FormField";
import { Metric, Panel, PanelHeader } from "../components/Panel";
import { SelectField } from "../components/SelectField";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useSession } from "../lib/session";
import type { DashboardData, TournamentType } from "../types";

export function AddTournamentPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [initialBootstrap] = useState(() => api.cachedAddTournamentBootstrap());
  const [types, setTypes] = useState<TournamentType[]>(() => initialBootstrap?.tournamentTypes ?? []);
  const [dashboard, setDashboard] = useState<DashboardData | null>(() => initialBootstrap?.dashboard ?? null);
  const [tournamentTypeId, setTournamentTypeId] = useState(() => initialBootstrap?.tournamentTypes?.[0]?.id ?? "");
  const [entries, setEntries] = useState("");
  const [pin, setPin] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const bootstrap = await api.addTournamentBootstrap({ bypassCache: Boolean(initialBootstrap) });
      setTypes(bootstrap.tournamentTypes);
      setDashboard(bootstrap.dashboard);
      setTournamentTypeId((current) => current || (bootstrap.tournamentTypes[0]?.id ?? ""));
    }

    void load().catch((err) => setError(errorMessage(err, "JM-RUN-900", "Could not load form.")));
  }, []);

  const selectedType = types.find((type) => type.id === tournamentTypeId);
  const preview = useMemo(() => {
    const count = Number(entries);
    if (!selectedType || !dashboard || !Number.isInteger(count) || count <= 0) {
      return null;
    }

    const openingJackpot = dashboard.jackpotState.currentJackpot;
    const contribution = count * selectedType.jackpotPerEntry;
    return {
      contribution,
      openingJackpot,
      availableJackpot: openingJackpot + contribution,
      cardsBefore: dashboard.jackpotState.cardsRemaining
    };
  }, [dashboard, entries, selectedType]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await api.createTournament({
        tournamentTypeId,
        entries: Number(entries),
        staffName: session.staffName,
        pin
      });
      setMessage("Tournament created. Draw result is now awaiting submission.");
      navigate("/draw-result");
    } catch (err) {
      setError(errorMessage(err, "JM-RUN-901", "Could not create tournament."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <PageTitle
        title="Add tournament"
        action={
          <ButtonLink to="/admin" variant="secondary">
            <SlidersHorizontal className="h-4 w-4" />
            Edit types
          </ButtonLink>
        }
      >
        Enter final CasinoWare count. Tournament names and per-entry amounts can be edited in Admin.
      </PageTitle>
      <div className="grid gap-[18px] xl:grid-cols-[0.85fr_1.15fr]">
        <Panel>
          <PanelHeader title="Tournament details">Only active Joker tournament types are available.</PanelHeader>
          <form className="grid gap-4 p-[24px] px-[26px]" onSubmit={submit}>
            <SelectField
              key={types.length}
              label="Tournament type"
              value={tournamentTypeId}
              onValueChange={setTournamentTypeId}
              options={types.map((type) => ({
                value: type.id,
                label: type.name,
                detail: `${formatCurrency(type.jackpotPerEntry)} per entry`
              }))}
            />
            <FormField label="Final entries" hint="From CasinoWare after late registration closes">
              <TextInput value={entries} onChange={(event) => setEntries(event.target.value)} inputMode="numeric" />
            </FormField>
            <FormField label="Staff password">
              <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
            </FormField>
            {error ? <StatusMessage tone="error">{error}</StatusMessage> : null}
            {message ? <StatusMessage tone="success">{message}</StatusMessage> : null}
            <Button type="submit" disabled={!preview || loading}>
              <CheckCircle2 className="h-4 w-4" />
              {loading ? "Creating..." : "Confirm tournament"}
            </Button>
          </form>
        </Panel>
        <Panel>
          <PanelHeader title="Preview">
            These values are calculated by the system and will be written with the tournament run.
          </PanelHeader>
          <div className="grid gap-4 p-[24px] px-[26px] md:grid-cols-2">
            {preview ? (
              <>
                <Metric label="Opening jackpot" value={formatCurrency(preview.openingJackpot)} />
                <Metric label="Tonight contribution" value={formatCurrency(preview.contribution)} tone="green" />
                <Metric label="Available jackpot" value={formatCurrency(preview.availableJackpot)} tone="gold" />
                <Metric label="Cards before draw" value={String(preview.cardsBefore)} tone="purple" />
              </>
            ) : (
              <div className="md:col-span-2">
                <StatusMessage>
                  Choose a tournament type and enter a positive whole number of entries to preview the jackpot.
                </StatusMessage>
              </div>
            )}
          </div>
          <div className="border-t border-black/[0.07] p-[24px] px-[26px]">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Calculator className="h-4 w-4 text-jackpot" />
              Contribution is entries multiplied by the tournament jackpot-per-entry rule.
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
}
