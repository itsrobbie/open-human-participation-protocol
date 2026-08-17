import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  startedAt: string;
  durationMs: number;
}

export function CountdownTimer({ startedAt, durationMs }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => calcRemaining(startedAt, durationMs));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(calcRemaining(startedAt, durationMs));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt, durationMs]);

  if (remaining <= 0) {
    return <span className="text-xs text-red-500 font-medium" data-testid="countdown-expired">Expired</span>;
  }

  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);

  return (
    <span className="text-xs text-stone-500 dark:text-stone-400 font-mono" data-testid="countdown-timer">
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}

function calcRemaining(startedAt: string, durationMs: number): number {
  const start = new Date(startedAt).getTime();
  const end = start + durationMs;
  return Math.max(0, end - Date.now());
}
