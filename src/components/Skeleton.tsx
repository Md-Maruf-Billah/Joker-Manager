import { clsx } from "clsx";

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-paper/10", className)} />;
}

export function SkeletonMetric() {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-paper/10 bg-felt-900/72 p-5">
      <SkeletonBlock className="h-3 w-20" />
      <SkeletonBlock className="mt-3 h-8 w-28" />
      <SkeletonBlock className="mt-2 h-3 w-24" />
    </div>
  );
}

export function SkeletonPanel({ rows = 3 }: { rows?: number }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-lg border border-paper/10 bg-paper/[0.055] shadow-panel">
      <div className="border-b border-paper/10 p-5">
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="mt-2 h-3 w-56" />
      </div>
      <div className="grid gap-3 p-5">
        {Array.from({ length: rows }).map((_, index) => (
          <SkeletonBlock key={index} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow({ columns = 6 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <SkeletonBlock className="h-4 w-full max-w-24" />
        </td>
      ))}
    </tr>
  );
}
