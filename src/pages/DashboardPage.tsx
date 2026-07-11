import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Monitor, Plus, RefreshCcw, Spade } from "lucide-react";
import { Button, ButtonLink } from "../components/Button";
import { Metric, Panel, PanelHeader } from "../components/Panel";
import { PageTitle } from "../components/AppShell";
import { SkeletonMetric, SkeletonPanel } from "../components/Skeleton";
import { StatusMessage } from "../components/StatusMessage";
import { api } from "../lib/api";
import { cardLabel } from "../lib/cards";
import { errorMessage } from "../lib/errors";
import { formatCurrency, formatDateTime } from "../lib/format";
import type { DashboardData, JackpotTrendPoint } from "../types";

const timelineOptions = [
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "1M", days: 30 },
  { label: "2M", days: 60 },
  { label: "3M", days: 90 },
  { label: "6M", days: 180 },
  { label: "1Y", days: 365 }
];

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  return points.reduce((path, point, index, all) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previous = all[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function JackpotTrendChart({ points }: { points: JackpotTrendPoint[] }) {
  const width = 520;
  const height = 150;
  const paddingX = 16;
  const paddingY = 18;
  const values = points.map((point) => point.jackpot);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const span = Math.max(max - min, 1);

  const coordinates = points.map((point, index) => {
    const x = paddingX + (index / Math.max(points.length - 1, 1)) * (width - paddingX * 2);
    const y = height - paddingY - ((point.jackpot - min) / span) * (height - paddingY * 2);
    return { ...point, x, y };
  });

  const path = smoothPath(coordinates);
  const area = `${path} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z`;
  const latest = coordinates[coordinates.length - 1];

  if (points.length === 0) {
    return (
      <div className="grid min-h-[150px] place-items-center rounded-xl border border-black/[0.07] bg-field text-sm text-muted">
        No jackpot history yet.
      </div>
    );
  }

  return (
    <svg className="h-[150px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Jackpot movement">
      <defs>
        <linearGradient id="jackpotTrendArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="rgba(198,157,66,0.30)" />
          <stop offset="100%" stopColor="rgba(198,157,66,0.02)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#jackpotTrendArea)" />
      <path d={path} fill="none" stroke="#96721D" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      {latest ? <circle cx={latest.x} cy={latest.y} r="5.5" fill="#FFFFFF" stroke="#96721D" strokeWidth="3" /> : null}
    </svg>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(() => api.cachedDashboard());
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [timelineDays, setTimelineDays] = useState(30);

  async function load(options: { bypassCache?: boolean } = {}) {
    setError("");
    setRefreshing(Boolean(data));
    try {
      setData((await api.dashboard(options)) as DashboardData);
    } catch (err) {
      setError(errorMessage(err, "JM-DASH-001", "Could not load dashboard."));
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load({ bypassCache: Boolean(data) });
  }, []);

  const trendPoints = useMemo(() => {
    if (!data) {
      return [];
    }

    const cutoff = Date.now() - timelineDays * 24 * 60 * 60 * 1000;
    return data.jackpotTrend.filter((point) => Date.parse(`${point.date}T00:00:00`) >= cutoff);
  }, [data, timelineDays]);

  if (!data) {
    return (
      <>
        <PageTitle title="Dashboard">Current operational state for Joker Manager at PlayLive Melbourne.</PageTitle>
        {error ? <div className="mb-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
        <div className="grid gap-[18px] xl:grid-cols-[1fr_1fr_1fr_1.45fr]">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonPanel rows={1} />
        </div>
        <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.15fr_0.85fr]">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={3} />
        </div>
      </>
    );
  }

  const state = data.jackpotState;
  const shownPoints = trendPoints.length ? trendPoints : data.jackpotTrend;
  const latestJackpot = shownPoints[shownPoints.length - 1]?.jackpot ?? state.currentJackpot;

  return (
    <>
      <PageTitle
        title="Dashboard"
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/tv?mode=fullscreen" variant="secondary" target="_blank">
              <Monitor className="h-[15px] w-[15px]" />
              Open TV
            </ButtonLink>
            <Button variant="secondary" onClick={() => void load({ bypassCache: true })}>
              <RefreshCcw className={refreshing ? "h-[15px] w-[15px] animate-spin" : "h-[15px] w-[15px]"} />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
      >
        Current operational state for Joker Manager at PlayLive Melbourne.
      </PageTitle>
      {error ? <div className="mb-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
      <div className="grid gap-[18px] xl:grid-cols-[1fr_1fr_1fr_1.45fr]">
        <Metric label="Current jackpot" value={formatCurrency(state.currentJackpot)} detail="Includes pending contribution" tone="gold" />
        <Metric label="Cards remaining" value={`${state.cardsRemaining} / 53`} detail="Active cycle deck" tone="green" />
        <Metric label="Last card" value={state.lastCardPulled ? cardLabel(state.lastCardPulled) : "None"} detail={formatDateTime(state.lastUpdated)} />
        <Panel>
          <div className="flex items-start justify-between gap-3 p-5 pb-0">
            <div>
              <div className="text-[15.5px] font-bold text-ink">Jackpot movement</div>
              <div className="mt-0.5 text-[12.5px] text-muted">Last {shownPoints.length} tournament runs.</div>
            </div>
            <div className="text-[19px] font-extrabold text-jackpot">{formatCurrency(latestJackpot)}</div>
          </div>
          <div className="flex flex-wrap gap-1.5 px-5 pt-3">
            {timelineOptions.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setTimelineDays(option.days)}
                className={[
                  "min-h-7 rounded-md px-2.5 text-[11px] font-bold transition",
                  timelineDays === option.days
                    ? "bg-brand-red text-white"
                    : "border border-black/10 bg-black/[0.02] text-muted hover:bg-black/[0.05]"
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="p-5 pt-3">
            <JackpotTrendChart points={shownPoints} />
          </div>
        </Panel>
      </div>
      <div className="mt-[18px] grid gap-[18px] xl:grid-cols-[1.15fr_0.85fr]">
        <Panel>
          <PanelHeader
            title="Next action"
            action={
              data.pendingRun ? (
                <ButtonLink to="/draw-result">
                  <Spade className="h-[15px] w-[15px]" />
                  Submit draw
                </ButtonLink>
              ) : (
                <ButtonLink to="/add-tournament">
                  <Plus className="h-[15px] w-[15px]" />
                  Add tournament
                </ButtonLink>
              )
            }
          >
            {data.pendingRun
              ? "A tournament has been created and is waiting for the physical card draw result."
              : "No unresolved draw is waiting. Add the next Joker tournament after late registration closes."}
          </PanelHeader>
          <div className="p-[22px] px-[26px]">
            {data.pendingRun ? (
              <div className="grid gap-3 md:grid-cols-3">
                <Metric label="Tournament" value={data.pendingRun.tournamentName} />
                <Metric label="Available jackpot" value={formatCurrency(data.pendingRun.availableJackpot)} tone="gold" />
                <Metric label="Cards before draw" value={String(data.pendingRun.cardsBefore)} tone="green" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <ButtonLink to="/add-tournament">
                  <Plus className="h-[15px] w-[15px]" />
                  Add tournament
                </ButtonLink>
                <ButtonLink to="/tv" variant="secondary" target="_blank">
                  <ExternalLink className="h-[15px] w-[15px]" />
                  Open TV display
                </ButtonLink>
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Recent updates">Latest changes recorded by the system.</PanelHeader>
          <div>
            {data.recentAudit.map((log) => (
              <div key={log.logId} className="border-t border-black/[0.06] p-4 first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-[13.5px] font-semibold text-ink">{log.action}</span>
                  <span className="text-xs text-faint">{formatDateTime(log.timestamp)}</span>
                </div>
                <div className="mt-1 text-[13px] text-muted">
                  {log.staffName} changed {log.fieldChanged} to {log.newValue}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
