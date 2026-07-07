import type { CardView, RemovedCard } from "../types";

export const JOKER_CODE = "JOKER";

export const RANKS = ["A", "K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2"];

export const SUITS = [
  { code: "S", name: "Spades", symbol: "\u2660", color: "black" as const },
  { code: "H", name: "Hearts", symbol: "\u2665", color: "red" as const },
  { code: "D", name: "Diamonds", symbol: "\u2666", color: "red" as const },
  { code: "C", name: "Clubs", symbol: "\u2663", color: "black" as const }
];

export const FULL_DECK = [
  JOKER_CODE,
  ...SUITS.flatMap((suit) => RANKS.map((rank) => `${rank}${suit.code}`))
];

export function isJoker(cardCode: string) {
  return cardCode === JOKER_CODE;
}

export function cardLabel(cardCode: string) {
  if (isJoker(cardCode)) {
    return "Joker";
  }

  const suit = SUITS.find((item) => cardCode.endsWith(item.code));
  const rank = suit ? cardCode.slice(0, -suit.code.length) : cardCode;
  return suit ? `${rank}${suit.symbol}` : cardCode;
}

export function buildCardViews(removedCards: RemovedCard[], cycleId: string): CardView[] {
  const removals = new Map(
    removedCards
      .filter((item) => item.cycleId === cycleId)
      .map((item) => [item.card, item])
  );

  return FULL_DECK.map((code) => {
    if (isJoker(code)) {
      return {
        code,
        label: "Joker",
        rank: "Joker",
        suit: null,
        suitName: null,
        color: "joker" as const,
        removed: removals.has(code),
        removal: removals.get(code)
      };
    }

    const suit = SUITS.find((item) => code.endsWith(item.code));
    const rank = suit ? code.slice(0, -suit.code.length) : code;

    return {
      code,
      label: cardLabel(code),
      rank,
      suit: suit?.symbol ?? null,
      suitName: suit?.name ?? null,
      color: suit?.color ?? "black",
      removed: removals.has(code),
      removal: removals.get(code)
    };
  });
}

