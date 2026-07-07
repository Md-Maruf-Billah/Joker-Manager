import { useRef, useState } from "react";
import { Button } from "./Button";

export function HoldButton({
  onComplete,
  disabled
}: {
  onComplete: () => void;
  disabled?: boolean;
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
    <Button
      type="button"
      variant="danger"
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      className="relative w-full overflow-hidden"
    >
      <span
        className="absolute inset-y-0 left-0 bg-joker-red/35"
        style={{ width: `${Math.round(progress * 100)}%` }}
      />
      <span className="relative">Hold 2 seconds to confirm Joker hit</span>
    </Button>
  );
}

