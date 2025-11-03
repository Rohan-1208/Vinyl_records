import React, { useRef } from 'react';

type ProgressBarProps = {
  progressRatio: number; // 0..1
  elapsedMs?: number;
  durationMs?: number;
  onSeekRatio?: (ratio: number) => void;
};

function formatTime(ms?: number) {
  if (!ms || ms <= 0 || !isFinite(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ progressRatio, elapsedMs, durationMs, onSeekRatio }) => {
  const pct = Math.max(0, Math.min(100, (isFinite(progressRatio) ? progressRatio : 0) * 100));
  const elapsed = formatTime(elapsedMs);
  const total = formatTime(durationMs);
  const barRef = useRef<HTMLDivElement | null>(null);

  const getRatio = (clientX: number) => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || !durationMs || durationMs <= 0) return null;
    const x = Math.min(rect.right, Math.max(rect.left, clientX));
    const r = (x - rect.left) / rect.width;
    return Math.max(0, Math.min(1, r));
  };

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const r = getRatio(e.clientX);
    if (r != null && onSeekRatio) {
      onSeekRatio(r);
    }
  };

  return (
    <div className="w-full select-none">
      <div className="flex items-center justify-between text-xs text-white/80 mb-1">
        <span>{elapsed}</span>
        <span>{total}</span>
      </div>
      <div
        ref={barRef}
        className="w-full h-2 bg-white/20 rounded-full overflow-hidden cursor-pointer"
        aria-label="Song progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        onClick={handleClick}
      >
        <div className="h-full bg-white rounded-full transition-[width] duration-200 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

export default ProgressBar;