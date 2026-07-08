import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Spade } from "lucide-react";
import { PageTitle } from "../components/AppShell";
import { Button, ButtonLink } from "../components/Button";
import { CardPicker } from "../components/CardPicker";
import { FormField, TextInput } from "../components/FormField";
import { HoldButton } from "../components/HoldButton";
import { Metric, Panel, PanelHeader } from "../components/Panel";
import { SkeletonPanel } from "../components/Skeleton";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { cardLabel, isJoker } from "../lib/cards";
import { errorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import { useSession } from "../lib/session";
import type { CardView, TournamentRun } from "../types";

export function DrawResultPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [pendingRun, setPendingRun] = useState<TournamentRun | null>(null);
  const [cards, setCards] = useState<CardView[]>([]);
  const [winnerName, setWinnerName] = useState("");
  const [selectedCard, setSelectedCard] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const [run, loadedCards] = await Promise.all([api.pendingDraw(), api.cards()]);
    setPendingRun(run as TournamentRun | null);
    setCards(loadedCards as CardView[]);
    setLoaded(true);
  }

  useEffect(() => {
    void load().catch((err) => setError(errorMessage(err, "JM-DRAW-900", "Could not load draw.")));
  }, []);

  async function submit(jokerConfirmed: boolean) {
    if (!pendingRun) {
      return;
    }

    setError("");
    setLoading(true);

    try {
      await api.submitDraw({
        runId: pendingRun.runId,
        winnerName,
        cardPulled: selectedCard,
        staffName: session.staffName,
        pin,
        jokerConfirmed
      });
      navigate("/dashboard");
    } catch (err) {
      setError(errorMessage(err, "JM-DRAW-901", "Could not submit draw."));
    } finally {
      setLoading(false);
    }
  }

  function submitForm(event: FormEvent) {
    event.preventDefault();
    void submit(false);
  }

  const selectedIsJoker = isJoker(selectedCard);

  return (
    <>
      <PageTitle title="Submit draw result">
        Record the physical card pull. The selected card is locked out for the active cycle unless it is the Joker.
      </PageTitle>
      {error ? <div className="mb-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
      {!loaded ? (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <SkeletonPanel rows={4} />
          <SkeletonPanel rows={6} />
        </div>
      ) : !pendingRun ? (
        <Panel className="p-5">
          <StatusMessage>No tournament is currently awaiting a draw result.</StatusMessage>
          <div className="mt-4">
            <ButtonLink to="/add-tournament">Add tournament</ButtonLink>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <Panel>
            <PanelHeader title="Pending draw">{pendingRun.tournamentName} is waiting for its winner and card.</PanelHeader>
            <form className="grid gap-4 p-5" onSubmit={submitForm}>
              <div className="grid gap-4 sm:grid-cols-3">
                <Metric label="Entries" value={String(pendingRun.entries)} />
                <Metric label="Available jackpot" value={formatCurrency(pendingRun.availableJackpot)} tone="gold" />
                <Metric label="Cards before draw" value={String(pendingRun.cardsBefore)} tone="green" />
              </div>
              <FormField label="Winner name">
                <TextInput value={winnerName} onChange={(event) => setWinnerName(event.target.value)} placeholder="Andrew Peng" />
              </FormField>
              <FormField label="Selected card">
                <TextInput value={selectedCard ? cardLabel(selectedCard) : ""} readOnly placeholder="Choose from card picker" />
              </FormField>
              <FormField label="Staff password">
                <TextInput value={pin} onChange={(event) => setPin(event.target.value)} type="password" />
              </FormField>
              {selectedIsJoker ? (
                <div className="rounded-lg border border-joker-red/40 bg-joker-red/10 p-4">
                  <div className="flex items-center gap-2 text-lg font-black text-paper">
                    <AlertTriangle className="h-5 w-5 text-joker-red" />
                    Joker hit confirmation
                  </div>
                  <div className="mt-2 text-sm leading-6 text-muted">
                    Winner: {winnerName || "Not entered"}.
                    Jackpot paid: {formatCurrency(pendingRun.availableJackpot)}.
                    This closes the current cycle, resets the jackpot to $0, and starts a fresh 53-card deck.
                  </div>
                  <div className="mt-4">
                    <HoldButton disabled={!winnerName.trim() || !pin || loading} onComplete={() => void submit(true)} />
                  </div>
                </div>
              ) : (
                <Button type="submit" disabled={!winnerName.trim() || !selectedCard || !pin || loading}>
                  <CheckCircle2 className="h-4 w-4" />
                  {loading ? "Submitting..." : "Submit draw result"}
                </Button>
              )}
            </form>
          </Panel>
          <Panel>
            <PanelHeader title="Card picker">
              Available cards stay at the top. Removed cards are disabled and shown below with removal detail.
            </PanelHeader>
            <div className="p-5">
              <CardPicker cards={cards} selected={selectedCard} onSelect={setSelectedCard} />
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
