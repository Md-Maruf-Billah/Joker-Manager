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
  const joker = cards.find((card) => card.code === "JOKER");

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="grid min-w-[620px] gap-[18px]">
        <button
          type="button"
          disabled={joker?.removed}
          onClick={() => joker && onSelect(joker.code)}
          className={clsx(
            "min-h-[50px] rounded-[11px] text-[15px] font-extrabold transition-all duration-150 ease-out active:scale-[0.97]",
            joker?.removed
              ? "cursor-not-allowed border border-black/[0.06] bg-black/[0.02] text-[#b0b0b5] opacity-60"
              : selected === "JOKER"
                ? "border border-brand-red bg-brand-red text-white"
                : "border border-brand-red/40 bg-brand-red/[0.06] text-brand-redDark hover:bg-brand-red/[0.1]"
          )}
        >
          Joker
        </button>
        <div className="grid gap-2.5">
          {SUITS.map((suit) => {
            const suitCards = available.filter((card) => card.suitName === suit.name);
            return (
              <div key={suit.code} className="grid grid-cols-[38px_1fr] items-center gap-2.5">
                <div
                  className={clsx(
                    "grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-black/[0.08] bg-field text-lg font-black",
                    suit.color === "red" ? "text-brand-red" : "text-ink"
                  )}
                >
                  {suit.symbol}
                </div>
                <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5">
                  {suitCards.map((card) => (
                    <button
                      key={card.code}
                      type="button"
                      onClick={() => onSelect(card.code)}
                      className={clsx(
                        "grid aspect-[5/6] min-h-[34px] place-items-center rounded-[7px] text-[12.5px] font-extrabold transition-all duration-150 ease-out active:scale-[0.94]",
                        selected === card.code
                          ? "border border-brand-red bg-brand-red text-white shadow-[0_0_0_3px_rgba(236,30,36,0.18)]"
                          : clsx(
                              "border border-black/10 bg-white hover:border-brand-red/50",
                              card.color === "red" ? "text-brand-red" : "text-ink"
                            )
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
        <div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-faint">Removed this cycle</div>
          {removed.length === 0 ? (
            <div className="rounded-[10px] border border-black/[0.07] bg-field p-3 text-[13px] text-muted">
              No cards have been removed in this cycle.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {removed.map((card) => (
                <Tooltip.Root key={card.code}>
                  <Tooltip.Trigger asChild>
                    <button
                      type="button"
                      disabled
                      className="inline-flex min-h-[30px] items-center gap-1.5 rounded-lg border border-black/[0.07] bg-black/[0.03] px-2.5 text-[12.5px] font-bold text-faint"
                    >
                      {card.label}
                      <Info className="h-3 w-3" />
                    </button>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Content
                      sideOffset={8}
                      className="max-w-xs rounded-lg border border-black/10 bg-ink p-3 text-xs leading-5 text-white shadow-panel"
                    >
                      <div className="font-bold">{card.label}</div>
                      <div>Pulled by {card.removal?.playerName ?? "Unknown"}</div>
                      <div>{card.removal ? formatDateTime(card.removal.removedDate) : ""}</div>
                      <div>Run: {card.removal?.runId ?? "Unknown"}</div>
                      <Tooltip.Arrow className="fill-ink" />
                    </Tooltip.Content>
                  </Tooltip.Portal>
                </Tooltip.Root>
              ))}
            </div>
          )}
        </div>
      </div>
    </Tooltip.Provider>
  );
}
