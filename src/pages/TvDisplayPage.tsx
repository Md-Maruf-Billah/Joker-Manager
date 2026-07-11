import { FormEvent, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Maximize2, Undo2 } from "lucide-react";
import { SkeletonBlock } from "../components/Skeleton";
import { api } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { formatCurrency } from "../lib/format";
import type { TvDisplayData, TvTier } from "../types";

type Theme = { accent: string; accentDeep: string; glow: string };

const TIER_THEME: Record<TvTier | "message", Theme> = {
  fresh: { accent: "#D9B15B", accentDeep: "#5c4415", glow: "rgba(217,177,91,0.35)" },
  building: { accent: "#49B57C", accentDeep: "#0d3324", glow: "rgba(73,181,124,0.3)" },
  hot: { accent: "#EC1E24", accentDeep: "#5b0a10", glow: "rgba(236,30,36,0.35)" },
  probability: { accent: "#E8C245", accentDeep: "#5c4415", glow: "rgba(232,194,69,0.4)" },
  danger: { accent: "#FF4141", accentDeep: "#3d0a0e", glow: "rgba(255,65,65,0.45)" },
  message: { accent: "#C69D42", accentDeep: "#7C0917", glow: "rgba(198,157,66,0.35)" }
};

const BULBS = Array.from({ length: 16 }, (_, index) => index);

function MarqueeRow({ theme, delayOffset = 0 }: { theme: Theme; delayOffset?: number }) {
  return (
    <div className="flex justify-between px-1">
      {BULBS.map((index) => (
        <div
          key={index}
          className="h-[clamp(8px,0.9vw,16px)] w-[clamp(8px,0.9vw,16px)] animate-glowPulse rounded-full"
          style={{
            background: `radial-gradient(circle, #fff8dd, ${theme.accent})`,
            boxShadow: `0 0 10px ${theme.glow}`,
            animationDelay: `${((index % 6) * 0.3 + delayOffset).toFixed(2)}s`
          }}
        />
      ))}
    </div>
  );
}

function StatCard({ label, value, theme, wide }: { label: string; value: string; theme: Theme; wide?: boolean }) {
  return (
    <div
      className={`rounded-[clamp(10px,1.4vw,16px)] border-2 bg-white/[0.04] px-[clamp(14px,2vw,26px)] py-[clamp(10px,1.6vh,18px)] ${
        wide ? "min-w-[clamp(200px,24vw,320px)]" : "min-w-[clamp(160px,20vw,280px)]"
      }`}
      style={{ borderColor: theme.accent }}
    >
      <div className="font-bold uppercase tracking-[0.14em] text-[#c9c9cf]" style={{ fontSize: "clamp(11px,1.1vw,20px)" }}>
        {label}
      </div>
      <div className="mt-0.5 font-black leading-none" style={{ color: theme.accent, fontSize: "clamp(30px,4vw,76px)" }}>
        {value}
      </div>
    </div>
  );
}

export function TvDisplayPage() {
  const [data, setData] = useState<TvDisplayData | null>(() => api.cachedTv());
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const isCleanDisplay = new URLSearchParams(window.location.search).get("display") === "clean";

  const [showClearPrompt, setShowClearPrompt] = useState(false);
  const [clearStaffName, setClearStaffName] = useState("");
  const [clearPin, setClearPin] = useState("");
  const [clearError, setClearError] = useState("");
  const [clearLoading, setClearLoading] = useState(false);

  async function load(options: { bypassCache?: boolean } = {}) {
    const next = (await api.tv(options)) as TvDisplayData;
    setData(next);
  }

  useEffect(() => {
    let alive = true;

    async function loadIfAlive(options: { bypassCache?: boolean } = {}) {
      const next = (await api.tv(options)) as TvDisplayData;
      if (alive) {
        setData(next);
      }
    }

    void loadIfAlive({ bypassCache: Boolean(data) }).catch(() => undefined);
    const interval = window.setInterval(() => void loadIfAlive().catch(() => undefined), 30_000);

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

  function closeClearPrompt() {
    setShowClearPrompt(false);
    setClearStaffName("");
    setClearPin("");
    setClearError("");
  }

  async function submitClear(event: FormEvent) {
    event.preventDefault();
    setClearError("");
    setClearLoading(true);

    try {
      await api.clearTvAnnouncement({ staffName: clearStaffName, pin: clearPin });
      closeClearPrompt();
      await load({ bypassCache: true });
    } catch (err) {
      setClearError(errorMessage(err, "JM-TV-902", "Could not clear announcement."));
    } finally {
      setClearLoading(false);
    }
  }

  if (!data) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-tv-bg px-6 py-8">
        <SkeletonBlock className="h-10 w-52" />
        <SkeletonBlock className="h-24 w-96 max-w-full" />
        <SkeletonBlock className="h-16 w-64" />
      </main>
    );
  }

  const showMessage = data.tvMessage.active;
  const theme = showMessage ? TIER_THEME.message : TIER_THEME[data.tier];
  const topHeading = showMessage ? "ANNOUNCEMENT" : "JOKER JACKPOT";
  const outerHeadline = showMessage ? "Staff announcement" : data.copy.headline;
  const outerCta = showMessage ? "See a staff member for details." : data.copy.cta;

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden font-sans"
      style={{ background: "linear-gradient(160deg, #0a0a0b 0%, #161318 55%, #0a0a0b 100%)" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-90 transition-[background] duration-700"
        style={{ background: `radial-gradient(ellipse 60% 55% at 50% 42%, ${theme.glow}, transparent 70%)` }}
      />
      {!isCleanDisplay ? (
        <div className="absolute right-5 top-5 z-20 flex gap-2">
          {data.tvMessage.active ? (
            <button
              type="button"
              onClick={() => setShowClearPrompt(true)}
              className="flex h-11 items-center gap-2 rounded-lg border border-white/15 bg-black/50 px-3.5 text-sm font-bold text-white transition hover:bg-white/10"
              aria-label="Back to jackpot screen"
              title="Back to jackpot screen"
            >
              <Undo2 className="h-4 w-4" />
              Back to jackpot
            </button>
          ) : null}
          {!isFullscreen ? (
            <button
              type="button"
              onClick={() => void enterFullscreen()}
              className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-lg border border-white/15 bg-black/50 text-white transition hover:bg-white/10"
              aria-label="Fullscreen"
              title="Fullscreen"
            >
              <Maximize2 className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      ) : null}

      {showClearPrompt ? (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 px-5">
          <form
            onSubmit={(event) => void submitClear(event)}
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#141416] p-6"
          >
            <div className="text-lg font-extrabold text-white">Back to jackpot screen</div>
            <div className="mt-1 text-sm text-white/60">Enter your staff password to clear the announcement.</div>
            <div className="mt-4 grid gap-3">
              <input
                value={clearStaffName}
                onChange={(event) => setClearStaffName(event.target.value)}
                placeholder="Staff name"
                autoFocus
                className="min-h-11 rounded-lg border border-white/15 bg-black/40 px-3.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/40"
              />
              <input
                value={clearPin}
                onChange={(event) => setClearPin(event.target.value)}
                type="password"
                placeholder="Password"
                className="min-h-11 rounded-lg border border-white/15 bg-black/40 px-3.5 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/40"
              />
            </div>
            {clearError ? <div className="mt-3 text-sm font-semibold text-[#FF6B6B]">{clearError}</div> : null}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={!clearStaffName.trim() || !clearPin || clearLoading}
                className="flex-1 min-h-11 rounded-lg bg-white font-bold text-black transition disabled:opacity-40"
              >
                {clearLoading ? "Clearing..." : "Clear"}
              </button>
              <button
                type="button"
                onClick={closeClearPrompt}
                className="min-h-11 rounded-lg border border-white/15 px-4 font-semibold text-white/70 transition hover:bg-white/10"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="relative z-10 flex flex-shrink-0 flex-col items-center gap-2.5 px-5 pt-[clamp(16px,3vh,40px)]">
        <img src="/brand/playlive-logo.png" alt="PlayLive Melbourne" className="h-[clamp(22px,3vw,42px)] opacity-95" />
        <div
          className="text-center font-black uppercase leading-none tracking-wide text-white"
          style={{ fontSize: "clamp(28px,3.6vw,64px)", textShadow: `0 0 40px ${theme.glow}` }}
        >
          {topHeading}
        </div>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center px-5">
        <motion.div
          key={showMessage ? "message" : data.tier}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-[clamp(14px,2.6vh,36px)] w-[min(1180px,88vw)] rounded-[clamp(16px,2vw,28px)] px-[clamp(24px,4vw,56px)] pb-[clamp(18px,2.6vh,40px)] pt-[clamp(20px,3vh,44px)]"
          style={{
            border: "clamp(3px,0.3vw,5px) solid " + theme.accent,
            boxShadow: `0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 60px ${theme.glow}`,
            background: "rgba(10,8,10,0.72)"
          }}
        >
          <MarqueeRow theme={theme} />

          {showMessage ? (
            <div className="mt-[clamp(8px,1.6vh,16px)] px-[clamp(4px,2vw,20px)] text-center">
              <div className="font-black leading-tight text-white" style={{ fontSize: "clamp(28px,4.2vw,74px)" }}>
                {data.tvMessage.title}
              </div>
              {data.tvMessage.sub ? (
                <div
                  className="mt-[clamp(8px,1.6vh,20px)] font-semibold leading-snug text-[#e6cf9f]"
                  style={{ fontSize: "clamp(14px,1.7vw,30px)" }}
                >
                  {data.tvMessage.sub}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-[clamp(8px,1.6vh,18px)] text-center">
              <div
                className="font-extrabold uppercase tracking-[0.18em]"
                style={{ color: theme.accent, fontSize: "clamp(13px,1.4vw,26px)" }}
              >
                Current Jackpot
              </div>
              <motion.div
                key={data.jackpot}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="mt-1 font-black leading-none text-white"
                style={{ fontSize: "clamp(56px,10vw,190px)", textShadow: `0 0 50px ${theme.glow}` }}
              >
                {formatCurrency(data.jackpot)}
              </motion.div>
              <div className="mt-[clamp(14px,2.4vh,26px)] flex flex-wrap justify-center gap-[clamp(10px,2vw,28px)]">
                <StatCard label="Cards remaining" value={String(data.cardsRemaining)} theme={theme} />
                {data.showProbability ? (
                  <StatCard label="Chance tonight" value={`1 in ${data.cardsRemaining}`} theme={theme} />
                ) : null}
                {data.showLatestWinner && data.latestWinner ? (
                  <div
                    className="min-w-[clamp(200px,24vw,320px)] rounded-[clamp(10px,1.4vw,16px)] border-2 bg-white/[0.04] px-[clamp(14px,2vw,26px)] py-[clamp(10px,1.6vh,18px)]"
                    style={{ borderColor: theme.accent }}
                  >
                    <div
                      className="font-bold uppercase tracking-[0.14em] text-[#c9c9cf]"
                      style={{ fontSize: "clamp(11px,1.1vw,20px)" }}
                    >
                      Latest Joker winner
                    </div>
                    <div className="mt-1.5 font-extrabold text-white" style={{ fontSize: "clamp(16px,2vw,34px)" }}>
                      {data.latestWinner.name} won {formatCurrency(data.latestWinner.amount)}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="mt-[clamp(12px,2.4vh,26px)]">
            <MarqueeRow theme={theme} delayOffset={0.15} />
          </div>
        </motion.div>

        <div className="flex min-h-0 w-full flex-1 items-center justify-center px-6 py-4 text-center">
          <div className="font-extrabold text-white" style={{ fontSize: "clamp(18px,2.4vw,46px)" }}>
            {outerHeadline}
          </div>
        </div>
      </div>

      <div
        className="relative z-10 flex flex-shrink-0 items-center justify-center gap-[clamp(8px,1vw,16px)] border-t-2 border-white/10 px-5 transition-[background] duration-700"
        style={{ height: "clamp(52px,7vh,104px)", background: theme.accentDeep }}
      >
        <div className="h-[clamp(8px,0.6vw,12px)] w-[clamp(8px,0.6vw,12px)] flex-shrink-0 animate-livePulse rounded-full bg-white" />
        <div className="text-center font-extrabold tracking-[0.03em] text-white" style={{ fontSize: "clamp(14px,1.7vw,32px)" }}>
          {outerCta}
        </div>
      </div>
    </main>
  );
}
