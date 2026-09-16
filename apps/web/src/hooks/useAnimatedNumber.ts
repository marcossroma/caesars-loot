import { useEffect, useRef, useState } from 'react';

export function useAnimatedNumber(value: number, duration = 420): number {
  const [display, setDisplay] = useState(value);
  const latest = useRef(value);
  useEffect(() => {
    const from = latest.current;
    latest.current = value;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || duration <= 0) {
      setDisplay(value);
      return;
    }
    const started = performance.now();
    let frame = 0;
    const update = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(from + (value - from) * eased);
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [duration, value]);
  return display;
}
