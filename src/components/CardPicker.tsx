import * as Tooltip from "@radix-ui/react-tooltip";
import { Info } from "lucide-react";
import { clsx } from "clsx";
import type { CardView } from "../types";
import { SUITS } from "../lib/cards";
import { formatDateTime } from "../lib/format";

export function CardPicker({
  cards,
  selected,
  onSelect
}: {
  cards: CardView[];
  selected: string;
  onSelect: (cardCode: string) => void;
}) {
  const available = cards.filter((card) => !card.removed);
  const removed = cards.filter((card) => card.removed);
  const joker = available.find((card) => card.code === "JOKER");

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="grid gap-6">
        <section>
          <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-muted">Available cards</div>
          {joker ? (
            <button
              type="button"
              onClick={() => onSelect(joker.code)}
              className={clsx(
                "mb-4 flex min-h-16 w-full items-center justify-center rounded-lg border text-lg font-black transition",
                selected === joker.code
                  ? "border-gold-300 bg-gold-400 text-ink shadow-glow"
                  : "border-joker-purple/45 bg-joker-purple/14 text-paper hover:bg-joker-purple/22"
              )}
            >
              Joker
            </button>
          ) : null}
          <div className="grid gap-3">
            {SUITS.map((suit) => {
              const suitCards = available.filter((card) => card.suitName === suit.name);
              return (
                <div key={suit.code} className="grid grid-cols-[2.5rem_1fr] items-center gap-3">
                  <div
                    className={clsx(
                      "grid h-10 w-10 place-items-center rounded-md border border-paper/10 bg-paper/5 text-xl font-black",
                      suit.color === "red" ? "text-joker-red" : "text-paper"
                    )}
                  >
                    {suit.symbol}
                  </div>
                  <div className="grid grid-cols-7 gap-2 sm:grid-cols-[repeat(13,minmax(0,1fr))]">
                    {suitCards.map((card) => (
                      <button
                        key={card.code}
                        type="button"
                        onClick={() => onSelect(card.code)}
                        className={clsx(
                          "grid aspect-[5/6] min-h-12 place-items-center rounded-md border text-sm font-black transition",
                          card.color === "red" ? "text-joker-red" : "text-paper",
                          selected === card.code
                            ? "border-gold-300 bg-gold-400 text-ink shadow-glow"
                            : "border-paper/10 bg-paper/6 hover:border-gold-400/70 hover:bg-paper/10"
                        )}
                      >
                        {card.rank}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <div className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-muted">Removed cards</div>
          {removed.length === 0 ? (
            <div className="rounded-md border border-paper/10 bg-paper/5 p-4 text-sm text-muted">
              No cards have been removed in this cycle.
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {removed.map((card) => (
                <Tooltip.Root key={card.code}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-paper/8 bg-paper/[0.035] px-3 text-sm font-black text-muted opacity-70"
                    >
                      {card.label}
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={8}
                      className="max-w-xs rounded-md border border-paper/10 bg-felt-950 p-3 text-xs leading-5 text-paper shadow-panel"
                    >
                      <div className="font-bold">{card.label}</div>
                      <div>Pulled by {card.removal?.playerName ?? "Unknown"}</div>
                      <div>{card.removal ? formatDateTime(card.removal.removedDate) : ""}</div>
                      <div>Run: {card.removal?.runId ?? "Unknown"}</div>
                      <Tooltip.Arrow className="fill-felt-950" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              ))}
            </div>
          )}
        </section>
      </div>
    </Tooltip.Provider>
  );
}
