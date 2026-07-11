import { useRef, useState } from "react";

export function HoldButton({
  onComplete,
  disabled,
  label = "Hold 2 seconds to confirm Joker hit"
}: {
  onComplete: () => void;
  disabled?: boolean;
  label?: string;
}) {
  const [progress, setProgress] = useState(0);
  const frame = useRef<number | null>(null);
  const startedAt = useRef<number | null>(null);

  function cancel() {
    if (frame.current) {
      window.cancelAnimationFrame(frame.current);
    }
    frame.current = null;
    startedAt.current = null;
    setProgress(0);
  }

  function tick() {
    if (!startedAt.current) {
      return;
    }

    const next = Math.min(1, (performance.now() - startedAt.current) / 2000);
    setProgress(next);

    if (next >= 1) {
      cancel();
      onComplete();
      return;
    }

    frame.current = window.requestAnimationFrame(tick);
  }

  function start() {
    if (disabled) {
      return;
    }

    startedAt.current = performance.now();
    frame.current = window.requestAnimationFrame(tick);
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      className="relative min-h-[48px] w-full overflow-hidden rounded-[11px] border border-brand-danger/45 bg-brand-danger/[0.09] px-5 font-bold text-sm text-[#8f1613] transition disabled:pointer-events-none disabled:opacity-45"
    >
      <span
        className="absolute inset-y-0 left-0 bg-brand-danger/[0.22]"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
      <span className="relative">{label}</span>
    </button>
  );
}

