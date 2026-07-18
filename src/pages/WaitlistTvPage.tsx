import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { SkeletonBlock } from "../components/Skeleton";
import { api } from "../lib/api";
import type { WaitlistBoardData, WaitlistColorTag } from "../types";

type Theme = { accent: string; accentDeep: string; glow: string };

const COLUMN_THEME: Record<WaitlistColorTag, Theme> = {
  red: { accent: "#EC1E24", accentDeep: "#5b0a10", glow: "rgba(236,30,36,0.35)" },
  gold: { accent: "#C69D42", accentDeep: "#7C0917", glow: "rgba(198,157,66,0.35)" },
  green: { accent: "#49B57C", accentDeep: "#0d3324", glow: "rgba(73,181,124,0.3)" },
  teal: { accent: "#2E93BE", accentDeep: "#0c2733", glow: "rgba(46,147,190,0.32)" },
  burgundy: { accent: "#B0223A", accentDeep: "#3d0a12", glow: "rgba(176,34,58,0.32)" }
};

export function WaitlistTvPage() {
  const [data, setData] = useState<WaitlistBoardData | null>(() => api.cachedWaitlistBoard());
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const isCleanDisplay = new URLSearchParams(window.location.search).get("display") === "clean";

  useEffect(() => {
    let alive = true;

    async function load(options: { bypassCache?: boolean } = {}) {
      const next = (await api.waitlistBoard(options)) as WaitlistBoardData;
      if (alive) {
        setData(next);
      }
    }

    void load({ bypassCache: Boolean(data) }).catch(() => undefined);
    const interval = window.setInterval(() => void load().catch(() => undefined), 30_000);

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
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-tv-bg px-6 py-8">
        <SkeletonBlock className="h-10 w-52" />
        <SkeletonBlock className="h-24 w-96 max-w-full" />
        <SkeletonBlock className="h-16 w-64" />
      </main>
    );
  }

  const showBoard = data.totalWaiting > 0;

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden font-sans"
      style={{ background: "linear-gradient(160deg, #0a0a0b 0%, #161318 55%, #0a0a0b 100%)" }}
    >
      {!isFullscreen && !isCleanDisplay ? (
        <button
          type="button"
          onClick={() => void enterFullscreen()}
          className="absolute right-5 top-5 z-20 grid h-11 w-11 place-items-center rounded-lg border border-white/15 bg-black/50 text-white transition hover:bg-white/10"
          aria-label="Fullscreen"
          title="Fullscreen"
        >
          <Maximize2 className="h-5 w-5" />
        </button>
      ) : null}

      <div className="relative z-10 flex flex-shrink-0 flex-col items-center gap-2.5 px-5 pt-[clamp(16px,3vh,40px)]">
        <img src="/brand/playlive-logo.png" alt="PlayLive Melbourne" className="h-[clamp(22px,3vw,42px)] opacity-95" />
        <div
          className="text-center font-black uppercase leading-tight tracking-wide text-white"
          style={{ fontSize: "clamp(22px,3vw,52px)", textShadow: "0 0 40px rgba(198,157,66,0.35)" }}
        >
          Time Limit Tournaments Waitlist
        </div>
      </div>

      {showBoard ? (
        <div
          className="relative z-10 grid flex-1 content-start gap-[clamp(14px,2vw,26px)] px-[clamp(20px,3vw,48px)] py-[clamp(20px,3vh,40px)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}
        >
          {data.columns.map((column) => {
            const theme = COLUMN_THEME[column.game.colorTag];
            return (
              <div
                key={column.game.gameId}
                className="flex flex-col overflow-hidden rounded-[clamp(14px,1.6vw,22px)]"
                style={{ border: "clamp(2px,0.25vw,4px) solid " + theme.accent, boxShadow: `0 0 40px ${theme.glow}` }}
              >
                <div className="px-[clamp(14px,1.8vw,24px)] py-[clamp(12px,1.8vh,18px)]" style={{ background: "rgba(255,255,255,0.04)" }}>
                  <div className="font-black uppercase leading-tight text-white" style={{ fontSize: "clamp(16px,1.9vw,28px)" }}>
                    {column.game.gameName}
                  </div>
                  <div className="mt-1 font-semibold" style={{ color: theme.accent, fontSize: "clamp(11px,1.1vw,16px)" }}>
                    {column.game.activeTables || "Interest list"}
                  </div>
                </div>
                <div className="flex-1 px-[clamp(14px,1.8vw,24px)] py-[clamp(10px,1.6vh,16px)]">
                  {column.waiting.length === 0 ? (
                    <div className="text-white/40" style={{ fontSize: "clamp(13px,1.3vw,18px)" }}>
                      No one waiting yet
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[clamp(6px,1vh,10px)]">
                      {column.waiting.map((entry) => (
                        <div key={entry.entryId} className="font-bold text-white" style={{ fontSize: "clamp(14px,1.6vw,22px)" }}>
                          {entry.playerName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className="px-[clamp(14px,1.8vw,24px)] py-[clamp(9px,1.4vh,14px)] text-center font-extrabold text-white"
                  style={{ background: theme.accentDeep, fontSize: "clamp(12px,1.3vw,18px)" }}
                >
                  {column.waitingCount} Waiting
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div
            className="w-[min(920px,90vw)] rounded-[clamp(18px,2vw,28px)] px-[clamp(24px,4vw,56px)] py-[clamp(28px,4vh,52px)]"
            style={{
              border: "clamp(3px,0.3vw,5px) solid #C69D42",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 60px rgba(198,157,66,0.35)",
              background: "rgba(10,8,10,0.72)"
            }}
          >
            <div
              className="font-black uppercase leading-tight text-white"
              style={{ fontSize: "clamp(30px,5vw,72px)", textShadow: "0 0 40px rgba(198,157,66,0.35)" }}
            >
              Fast-paced cash action
            </div>
            <div
              className="mt-[clamp(10px,2vh,20px)] font-semibold leading-snug text-[#e6cf9f]"
              style={{ fontSize: "clamp(15px,1.8vw,26px)" }}
            >
              Ask a floor staff member to add your name to the waitlist.
            </div>
            {data.columns.length ? (
              <div className="mt-[clamp(18px,3vh,32px)] flex flex-wrap justify-center gap-[clamp(8px,1.4vw,16px)]">
                {data.columns.map((column) => {
                  const theme = COLUMN_THEME[column.game.colorTag];
                  return (
                    <div
                      key={column.game.gameId}
                      className="rounded-full px-[clamp(14px,2vw,22px)] py-[clamp(7px,1.2vh,12px)] font-bold text-white"
                      style={{ border: `2px solid ${theme.accent}`, fontSize: "clamp(13px,1.4vw,19px)" }}
                    >
                      {column.game.gameName}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
