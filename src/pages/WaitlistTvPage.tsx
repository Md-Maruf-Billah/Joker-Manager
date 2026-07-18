import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { SkeletonBlock } from "../components/Skeleton";
import { api } from "../lib/api";
import { WAITLIST_COLOR_THEME } from "../lib/waitlist";
import type { WaitlistBoardData } from "../types";

// Visual direction: bold, flat, confident color blocking and oversized type
// (Pentagram / Paula Scher influence) rather than the Joker Jackpot TV's
// neon-glow treatment — solid color bars carry each game's identity instead
// of thin glowing borders, and type does the work instead of gradients.

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
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-tv-bg font-sans">
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

      <div className="relative z-10 flex flex-shrink-0 flex-col items-center gap-3 px-5 pt-[clamp(20px,3.5vh,44px)]">
        <img src="/brand/playlive-logo.png" alt="PlayLive Melbourne" className="h-[clamp(20px,2.6vw,36px)] opacity-95" />
        <div
          className="text-center font-black uppercase leading-none tracking-[0.02em] text-white"
          style={{ fontSize: "clamp(30px,4.4vw,68px)" }}
        >
          TLT Waitlist
        </div>
      </div>

      {showBoard ? (
        <div
          className="relative z-10 grid flex-1 content-start gap-[clamp(16px,2.2vw,28px)] px-[clamp(20px,3vw,48px)] py-[clamp(24px,3.6vh,44px)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))" }}
        >
          {data.columns.map((column) => {
            const theme = WAITLIST_COLOR_THEME[column.game.colorTag];
            return (
              <div key={column.game.gameId} className="flex flex-col overflow-hidden rounded-[clamp(10px,1vw,16px)] bg-[#141416]">
                <div className="px-[clamp(16px,2vw,26px)] py-[clamp(14px,2vh,22px)]" style={{ background: theme.accent }}>
                  <div
                    className="font-black uppercase leading-tight text-white"
                    style={{ fontSize: "clamp(19px,2.3vw,32px)" }}
                  >
                    {column.game.gameName}
                  </div>
                  <div
                    className="mt-1 font-extrabold uppercase tracking-[0.1em] text-white/85"
                    style={{ fontSize: "clamp(10px,1vw,14px)" }}
                  >
                    {column.game.running
                      ? `Running${column.game.tableNumbers ? ` · Tables ${column.game.tableNumbers}` : ""}`
                      : "Interest"}
                  </div>
                </div>
                <div className="flex-1 px-[clamp(16px,2vw,26px)] py-[clamp(14px,2vh,20px)]">
                  {column.waiting.length === 0 ? (
                    <div className="text-white/35" style={{ fontSize: "clamp(13px,1.3vw,18px)" }}>
                      No one waiting yet
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[clamp(8px,1.2vh,14px)]">
                      {column.waiting.map((entry) => (
                        <div key={entry.entryId} className="font-bold text-white" style={{ fontSize: "clamp(16px,1.9vw,26px)" }}>
                          {entry.playerName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className="px-[clamp(16px,2vw,26px)] py-[clamp(10px,1.6vh,16px)] text-center font-black uppercase tracking-[0.06em] text-white"
                  style={{ background: theme.accentDeep, fontSize: "clamp(12px,1.3vw,18px)" }}
                >
                  Waitlist · {column.waitingCount}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-[clamp(24px,4vh,48px)] px-6 text-center">
          <div
            className="font-black uppercase leading-[0.95] text-white"
            style={{ fontSize: "clamp(40px,7vw,120px)" }}
          >
            Fast-Paced Action
          </div>
          <div className="font-semibold leading-snug text-white/70" style={{ fontSize: "clamp(16px,1.9vw,28px)" }}>
            Ask a floor staff member to join the waitlist.
          </div>
          {data.columns.length ? (
            <div className="flex flex-wrap items-center justify-center gap-[clamp(10px,1.6vw,18px)]">
              {data.columns.map((column) => {
                const theme = WAITLIST_COLOR_THEME[column.game.colorTag];
                return (
                  <div
                    key={column.game.gameId}
                    className="rounded-full px-[clamp(18px,2.4vw,26px)] py-[clamp(9px,1.4vh,14px)] font-black uppercase text-white"
                    style={{ background: theme.accent, fontSize: "clamp(13px,1.4vw,19px)" }}
                  >
                    {column.game.gameName}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      )}
    </main>
  );
}
