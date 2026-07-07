import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Club, Diamond, Heart, Maximize2, Spade } from "lucide-react";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/format";
import type { TvDisplayData, TvTier } from "../types";

const tierStyles: Record<TvTier, { accent: string; ring: string; panel: string; felt: string }> = {
  fresh: {
    accent: "text-gold-300",
    ring: "border-gold-400/35",
    panel: "bg-gold-400/10",
    felt: "from-felt-950 via-felt-850 to-ink"
  },
  building: {
    accent: "text-joker-green",
    ring: "border-joker-green/35",
    panel: "bg-joker-green/10",
    felt: "from-felt-950 via-felt-800 to-ink"
  },
  hot: {
    accent: "text-joker-purple",
    ring: "border-joker-purple/40",
    panel: "bg-joker-purple/13",
    felt: "from-ink via-felt-850 to-felt-950"
  },
  probability: {
    accent: "text-gold-300",
    ring: "border-gold-400/45",
    panel: "bg-gold-400/12",
    felt: "from-ink via-felt-900 to-felt-800"
  },
  danger: {
    accent: "text-joker-red",
    ring: "border-joker-red/55",
    panel: "bg-joker-red/13",
    felt: "from-ink via-felt-950 to-felt-900"
  }
};

function CardBacks({ tier }: { tier: TvTier }) {
  const opacity = tier === "danger" ? 0.34 : tier === "fresh" ? 0.16 : 0.24;
  const labels = ["J", "A", "K", "Q", "10", "JOKER"];

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 22 }).map((_, index) => (
        <motion.div
          key={index}
          className="absolute grid h-36 w-24 place-items-center rounded-lg border border-gold-400/18 bg-paper/[0.055] text-center font-black text-paper/45"
          style={{
            left: `${(index * 13) % 100}%`,
            top: `${(index * 19) % 100}%`,
            opacity
          }}
          animate={{ y: [0, -18, 0], rotate: [-9 + (index % 6) * 4, -6 + (index % 5) * 4, -9 + (index % 6) * 4] }}
          transition={{ duration: 12 + (index % 5), repeat: Infinity, ease: "easeInOut" }}
        >
          <span className={labels[index % labels.length] === "JOKER" ? "text-joker-purple" : ""}>
            {labels[index % labels.length]}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

function SuitRail() {
  const suits = [
    { icon: Spade, className: "text-paper/24" },
    { icon: Heart, className: "text-joker-red/35" },
    { icon: Diamond, className: "text-joker-red/35" },
    { icon: Club, className: "text-paper/24" }
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-10 flex justify-center gap-8 opacity-80" aria-hidden="true">
      {suits.map((suit, index) => {
        const Icon = suit.icon;
        return (
          <motion.div
            key={index}
            animate={{ y: [0, -10, 0], opacity: [0.45, 0.9, 0.45] }}
            transition={{ duration: 4 + index, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className={`h-14 w-14 ${suit.className}`} />
          </motion.div>
        );
      })}
    </div>
  );
}

export function TvDisplayPage() {
  const [data, setData] = useState<TvDisplayData | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const isCleanDisplay = new URLSearchParams(window.location.search).get("display") === "clean";

  useEffect(() => {
    let alive = true;

    async function load() {
      const next = (await api.tv()) as TvDisplayData;
      if (alive) {
        setData(next);
      }
    }

    void load();
    const interval = window.setInterval(() => void load(), 30_000);

    return () => {
      alive = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function syncFullscreen() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }

    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  async function enterFullscreen() {
    const target = document.documentElement;
    if (!document.fullscreenElement && target.requestFullscreen) {
      await target.requestFullscreen();
    }
  }

  if (!data) {
    return <main className="grid min-h-screen place-items-center bg-felt-950 text-paper">Loading Joker Manager...</main>;
  }

  const style = tierStyles[data.tier];

  return (
    <main className={`relative min-h-screen overflow-hidden bg-gradient-to-br ${style.felt} text-paper`}>
      <CardBacks tier={data.tier} />
      <SuitRail />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(115deg,oklch(93%_0.012_78_/_0.035)_0_1px,transparent_1px_18px),linear-gradient(90deg,oklch(12%_0.012_72_/_0.82),transparent_28%,transparent_72%,oklch(12%_0.012_72_/_0.82))]" />
      <motion.div
        className="absolute inset-x-0 top-0 h-2 bg-gold-400"
        animate={{ opacity: data.tier === "danger" ? [0.5, 1, 0.5] : [0.32, 0.62, 0.32] }}
        transition={{ duration: data.tier === "danger" ? 2.2 : 5.5, repeat: Infinity, ease: "easeInOut" }}
      />
      {!isFullscreen && !isCleanDisplay ? (
        <button
          type="button"
          onClick={() => void enterFullscreen()}
          className="absolute right-5 top-5 z-20 grid h-12 w-12 place-items-center rounded-md border border-paper/15 bg-ink/70 text-paper transition hover:bg-paper/10"
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      ) : null}
      <div className="relative z-10 flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-14">
        <header className="flex justify-center">
          <div className="grid justify-items-center gap-3 text-center">
            <motion.div
              className="grid h-20 w-20 place-items-center rounded-lg border border-gold-400/45 bg-ink text-gold-300 shadow-glow"
              animate={{ rotate: [-3, 3, -3], scale: [1, 1.04, 1] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            >
              <span className="text-4xl font-black">J</span>
            </motion.div>
            <div>
              <div className="text-4xl font-black uppercase text-paper sm:text-5xl">Joker Manager Live</div>
              <div className="mt-2 text-sm font-black uppercase tracking-[0.22em] text-gold-300">PlayLive Melbourne</div>
            </div>
          </div>
        </header>
        <section className="grid flex-1 place-items-center py-10 text-center">
          <div className="w-full max-w-6xl">
            <motion.div
              key={data.jackpot}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
              className={`break-words text-7xl font-black leading-none sm:text-8xl lg:text-9xl ${style.accent}`}
            >
              {formatCurrency(data.jackpot)}
            </motion.div>
            <div className={`mx-auto mt-8 max-w-2xl rounded-lg border ${style.ring} ${style.panel} px-6 py-5`}>
              <div className="text-sm font-black uppercase tracking-[0.16em] text-muted">Cards remaining</div>
              <div className={`mt-1 text-6xl font-black leading-none sm:text-7xl ${style.accent}`}>{data.cardsRemaining}</div>
            </div>
            <motion.div
              className="mx-auto mt-8 max-w-4xl break-words text-4xl font-black leading-tight text-paper sm:text-5xl"
              animate={{ opacity: [0.84, 1, 0.84] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {data.copy.headline}
            </motion.div>
            {data.showProbability ? (
              <div className={`mx-auto mt-9 max-w-xl rounded-lg border ${style.ring} ${style.panel} px-6 py-5`}>
                <div className="text-sm font-black uppercase tracking-[0.16em] text-muted">Chance tonight</div>
                <div className={`mt-2 text-6xl font-black ${style.accent}`}>1 in {data.cardsRemaining}</div>
              </div>
            ) : null}
            {data.showLatestWinner && data.latestWinner ? (
              <div className="mx-auto mt-9 max-w-xl rounded-lg border border-gold-400/35 bg-gold-400/10 px-6 py-5">
                <div className="text-sm font-black uppercase tracking-[0.16em] text-muted">Latest Joker winner</div>
                <div className="mt-2 text-3xl font-black text-paper">
                  {data.latestWinner.name} won {formatCurrency(data.latestWinner.amount)}
                </div>
              </div>
            ) : null}
          </div>
        </section>
        <footer className="pb-3 text-center text-3xl font-black text-paper">{data.copy.cta}</footer>
      </div>
    </main>
  );
}
