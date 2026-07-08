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
  const paddingX = 18;
  const paddingY = 20;
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
  const previous = coordinates[coordinates.length - 2];
  const delta = latest && previous ? latest.jackpot - previous.jackpot : 0;

  if (points.length === 0) {
    return (
      <div className="grid min-h-[150px] place-items-center rounded-lg border border-paper/10 bg-felt-900/72 text-sm text-muted">
        No jackpot history yet.
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-muted">Jackpot movement</div>
          <div className="mt-1 text-2xl font-black text-gold-300">{formatCurrency(latest?.jackpot ?? 0)}</div>
        </div>
        <div className={delta >= 0 ? "text-sm font-black text-joker-green" : "text-sm font-black text-joker-red"}>
          {delta >= 0 ? "+" : ""}
          {formatCurrency(delta)}
        </div>
      </div>
      <svg className="h-[150px] w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Jackpot movement">
        <defs>
          <linearGradient id="jackpotTrendArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(77% 0.15 82 / 0.34)" />
            <stop offset="100%" stopColor="oklch(77% 0.15 82 / 0.02)" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((tick) => {
          const y = paddingY + tick * ((height - paddingY * 2) / 3);
          return <line key={tick} x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="oklch(93% 0.012 78 / 0.08)" />;
        })}
        <path d={area} fill="url(#jackpotTrendArea)" />
        <path d={path} fill="none" stroke="oklch(84% 0.13 86)" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
        {latest ? (
          <circle cx={latest.x} cy={latest.y} r="5" fill="oklch(16% 0.018 150)" stroke="oklch(84% 0.13 86)" strokeWidth="3" />
        ) : null}
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <span>{points[0]?.date}</span>
        <span>{points[points.length - 1]?.date}</span>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [timelineDays, setTimelineDays] = useState(30);

  async function load() {
    setError("");
    try {
      setData((await api.dashboard()) as DashboardData);
    } catch (err) {
      setError(errorMessage(err, "JM-DASH-001", "Could not load dashboard."));
    }
  }

  useEffect(() => {
    void load();
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
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.45fr]">
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonMetric />
          <SkeletonPanel rows={1} />
        </div>
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <SkeletonPanel rows={2} />
          <SkeletonPanel rows={3} />
        </div>
      </>
    );
  }

  const state = data.jackpotState;

  return (
    <>
      <PageTitle
        title="Dashboard"
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/tv?mode=fullscreen" variant="primary" target="_blank">
              <ExternalLink className="h-4 w-4" />
              Open TV
            </ButtonLink>
            <ButtonLink to="/tv?display=clean" variant="secondary" target="_blank">
              <Monitor className="h-4 w-4" />
              Clean TV
            </ButtonLink>
            <Button variant="secondary" onClick={load}>
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        }
      >
        Current operational state for Joker Manager at PlayLive Melbourne.
      </PageTitle>
      {error ? <div className="mb-4"><StatusMessage tone="error">{error}</StatusMessage></div> : null}
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1.45fr]">
        <Metric label="Current jackpot" value={formatCurrency(state.currentJackpot)} detail="Includes pending contribution" tone="gold" />
        <Metric label="Cards remaining" value={`${state.cardsRemaining} / 53`} detail="Active cycle deck" tone="green" />
        <Metric label="Last card" value={state.lastCardPulled ? cardLabel(state.lastCardPulled) : "None"} detail={formatDateTime(state.lastUpdated)} />
        <Panel className="p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {timelineOptions.map((option) => (
              <button
                key={option.days}
                type="button"
                onClick={() => setTimelineDays(option.days)}
                className={[
                  "min-h-8 rounded-md px-2.5 text-xs font-black transition",
                  timelineDays === option.days
                    ? "bg-gold-400 text-ink"
                    : "border border-paper/10 bg-paper/5 text-muted hover:bg-paper/10 hover:text-paper"
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
          <JackpotTrendChart points={trendPoints.length ? trendPoints : data.jackpotTrend} />
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader
            title="Next action"
            action={
              data.pendingRun ? (
                <ButtonLink to="/draw-result">
                  <Spade className="h-4 w-4" />
                  Submit draw
                </ButtonLink>
              ) : (
                <ButtonLink to="/add-tournament">
                  <Plus className="h-4 w-4" />
                  Add tournament
                </ButtonLink>
              )
            }
          >
            {data.pendingRun
              ? "A tournament has been created and is waiting for the physical card draw result."
              : "No unresolved draw is waiting. Add the next Joker tournament after late registration closes."}
          </PanelHeader>
          <div className="p-5">
            {data.pendingRun ? (
              <div className="grid gap-4 md:grid-cols-3">
                <Metric label="Tournament" value={data.pendingRun.tournamentName} />
                <Metric label="Available jackpot" value={formatCurrency(data.pendingRun.availableJackpot)} tone="gold" />
                <Metric label="Cards before draw" value={String(data.pendingRun.cardsBefore)} tone="green" />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <ButtonLink to="/add-tournament">
                  <Plus className="h-4 w-4" />
                  Add Tournament
                </ButtonLink>
                <ButtonLink to="/tv" variant="secondary" target="_blank">
                  <Monitor className="h-4 w-4" />
                  Open TV Display
                </ButtonLink>
                <ButtonLink to="/tv?display=clean" variant="secondary" target="_blank">
                  <ExternalLink className="h-4 w-4" />
                  Clean TV Display
                </ButtonLink>
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <PanelHeader title="Recent updates">Latest changes recorded by the system.</PanelHeader>
          <div className="divide-y divide-paper/10">
            {data.recentAudit.map((log) => (
              <div key={log.logId} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-paper">{log.action}</span>
                  <span className="text-xs text-muted">{formatDateTime(log.timestamp)}</span>
                </div>
                <div className="mt-1 text-sm text-muted">
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
