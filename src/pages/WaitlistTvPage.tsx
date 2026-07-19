import { useEffect, useState } from "react";
import { Maximize2 } from "lucide-react";
import { SkeletonBlock } from "../components/Skeleton";
import { api } from "../lib/api";
import { WAITLIST_COLOR_THEME } from "../lib/waitlist";
import type { WaitlistBoardData } from "../types";

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
    // Unlike the Joker Jackpot TV, this board needs to catch up almost
    // immediately when someone's added, seated, or removed on the floor —
    // the board read is edge-cached and writes already warm it, so a short
    // interval here is cheap and doesn't add real load on the backend.
    const interval = window.setInterval(() => void load().catch(() => undefined), 4_000);

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

      <div className="relative z-10 flex flex-shrink-0 flex-col items-center px-5 pt-[clamp(20px,3.5vh,44px)]">
        <div
          className="text-center font-black uppercase leading-tight tracking-wide text-white"
          style={{ fontSize: "clamp(24px,3.4vw,58px)", textShadow: "0 0 40px rgba(198,157,66,0.35)" }}
        >
          TLT Waitlist
        </div>
      </div>

      {showBoard ? (
        <div
          className="relative z-10 grid flex-1 content-start gap-[clamp(20px,2.6vw,34px)] px-[clamp(24px,3.6vw,56px)] py-[clamp(26px,4vh,48px)]"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}
        >
          {data.columns.map((column) => {
            const theme = WAITLIST_COLOR_THEME[column.game.colorTag];
            return (
              <div
                key={column.game.gameId}
                className="flex flex-col overflow-hidden rounded-[clamp(14px,1.6vw,22px)]"
                style={{ border: "clamp(2px,0.25vw,4px) solid " + theme.accent, boxShadow: `0 0 40px ${theme.glow}` }}
              >
                <div
                  className="px-[clamp(18px,2.2vw,28px)] py-[clamp(16px,2.2vh,22px)]"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div className="font-black uppercase leading-tight text-white" style={{ fontSize: "clamp(18px,2.1vw,30px)" }}>
                    {column.game.gameName}
                  </div>
                  <div className="mt-1.5 font-semibold" style={{ color: theme.accent, fontSize: "clamp(11px,1.1vw,16px)" }}>
                    {column.game.running
                      ? `Running${column.game.tableNumbers ? ` · Table ${column.game.tableNumbers}` : ""}`
                      : "Interest list"}
                  </div>
                </div>
                <div className="flex-1 px-[clamp(18px,2.2vw,28px)] py-[clamp(16px,2.2vh,22px)]">
                  {column.waiting.length === 0 ? (
                    <div className="text-white/40" style={{ fontSize: "clamp(13px,1.3vw,18px)" }}>
                      No one waiting yet
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[clamp(9px,1.3vh,14px)]">
                      {column.waiting.map((entry) => (
                        <div key={entry.entryId} className="font-bold text-white" style={{ fontSize: "clamp(15px,1.8vw,25px)" }}>
                          {entry.playerName}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div
                  className="px-[clamp(18px,2.2vw,28px)] py-[clamp(11px,1.7vh,16px)] text-center font-extrabold text-white"
                  style={{ background: theme.accentDeep, fontSize: "clamp(12px,1.3vw,18px)" }}
                >
                  {column.waitingCount} Waiting
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
          <div
            className="w-[min(960px,90vw)] rounded-[clamp(18px,2vw,28px)] px-[clamp(28px,4.5vw,64px)] py-[clamp(32px,5vh,60px)]"
            style={{
              border: "clamp(3px,0.3vw,5px) solid #C69D42",
              boxShadow: "0 0 0 1px rgba(255,255,255,0.06) inset, 0 0 60px rgba(198,157,66,0.35)",
              background: "rgba(10,8,10,0.72)"
            }}
          >
            <div
              className="font-black uppercase leading-tight text-white"
              style={{ fontSize: "clamp(32px,5.2vw,76px)", textShadow: "0 0 40px rgba(198,157,66,0.35)" }}
            >
              Fast-Paced Action
            </div>
            <div
              className="mt-[clamp(14px,2.4vh,24px)] font-semibold leading-snug text-[#e6cf9f]"
              style={{ fontSize: "clamp(15px,1.8vw,26px)" }}
            >
              Ask a concierge to join the waitlist.
            </div>
            {data.columns.length ? (
              <div className="mt-[clamp(22px,3.6vh,38px)] flex flex-wrap justify-center gap-[clamp(10px,1.6vw,18px)]">
                {data.columns.map((column) => {
                  const theme = WAITLIST_COLOR_THEME[column.game.colorTag];
                  return (
                    <div
                      key={column.game.gameId}
                      className="rounded-full px-[clamp(16px,2.2vw,24px)] py-[clamp(8px,1.3vh,13px)] font-bold text-white"
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

      <div
        className="relative z-10 flex flex-shrink-0 items-center justify-center border-t border-white/10 px-5"
        style={{ height: "clamp(52px,7vh,92px)" }}
      >
        <img src="/brand/playlive-logo.png" alt="PlayLive Melbourne" className="h-[clamp(18px,2.4vw,32px)] opacity-70" />
      </div>
    </main>
  );
}
