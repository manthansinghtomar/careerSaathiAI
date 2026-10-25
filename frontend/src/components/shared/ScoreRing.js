import React from 'react';
import { cn } from '@/lib/utils';

export function ScoreRing({
  score = 0,
  maxScore = 100,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  showPercentage = true,
  className,
}) {
  const normalizedScore = Math.max(0, Math.min(score, maxScore));
  const percentage = maxScore > 0 ? Math.round((normalizedScore / maxScore) * 100) : 0;

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  // Semantic color based on score threshold
  const getColorClass = (pct) => {
    if (pct >= 80) return { stroke: 'stroke-emerald-400', text: 'text-emerald-400', bg: 'stroke-emerald-950/40' };
    if (pct >= 60) return { stroke: 'stroke-indigo-400', text: 'text-indigo-400', bg: 'stroke-indigo-950/40' };
    if (pct >= 40) return { stroke: 'stroke-amber-400', text: 'text-amber-400', bg: 'stroke-amber-950/40' };
    return { stroke: 'stroke-rose-400', text: 'text-rose-400', bg: 'stroke-rose-950/40' };
  };

  const colors = getColorClass(percentage);

  return (
    <div className={cn('inline-flex flex-col items-center justify-center text-center', className)}>
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            className="stroke-zinc-800 fill-none"
          />
          {/* Progress Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={cn('fill-none transition-all duration-700 ease-out', colors.stroke)}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {showPercentage ? (
            <span className={cn('text-xl sm:text-2xl font-bold font-mono tracking-tight', colors.text)}>
              {percentage}%
            </span>
          ) : (
            <span className={cn('text-xl sm:text-2xl font-bold font-mono tracking-tight', colors.text)}>
              {normalizedScore}/{maxScore}
            </span>
          )}
          {sublabel && (
            <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">
              {sublabel}
            </span>
          )}
        </div>
      </div>

      {label && (
        <span className="mt-2 text-xs font-medium text-zinc-300">
          {label}
        </span>
      )}
    </div>
  );
}

export default ScoreRing;
