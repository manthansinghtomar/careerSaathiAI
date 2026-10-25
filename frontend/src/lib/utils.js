/**
 * General utilities, string manipulation, date formatters,
 * and visual styling helpers for CareerSaathi AI.
 */

/**
 * Conditionally join class names into a clean string.
 * @param  {...any} classes
 * @returns {string}
 */
export function cn(...classes) {
  return classes
    .flatMap((c) => {
      if (!c) return [];
      if (typeof c === 'string') return c.split(' ');
      if (typeof c === 'object') {
        return Object.entries(c)
          .filter(([, val]) => Boolean(val))
          .map(([key]) => key);
      }
      return [];
    })
    .filter(Boolean)
    .join(' ');
}

/**
 * Format date to standard localized string (e.g. "23 Oct 2026").
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatDate(dateInput) {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/**
 * Format relative time (e.g. "Just now", "5m ago", "2h ago", "3d ago").
 * @param {string|Date} dateInput
 * @returns {string}
 */
export function formatRelativeTime(dateInput) {
  if (!dateInput) return '—';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return '—';

  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 45) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return formatDate(date);
}

/**
 * Format number into percentage string.
 * @param {number} value
 * @returns {string}
 */
export function formatPercentage(value) {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${Math.round(Number(value))}%`;
}

/**
 * Format seconds into minutes and seconds string (e.g. 900 -> "15m 00s").
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatDuration(totalSeconds) {
  if (!totalSeconds || isNaN(totalSeconds) || totalSeconds <= 0) return '0m 00s';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

/**
 * Map topic name to semantic color palette.
 * Supported topics: JavaScript, React, Node.js, MongoDB
 */
export function getTopicColor(topic) {
  const normalized = String(topic || '').toLowerCase().trim();
  switch (normalized) {
    case 'javascript':
    case 'js':
      return {
        badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        dot: 'bg-amber-400',
        text: 'text-amber-400',
      };
    case 'react':
      return {
        badge: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        dot: 'bg-cyan-400',
        text: 'text-cyan-400',
      };
    case 'node.js':
    case 'nodejs':
    case 'node':
      return {
        badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-400',
        text: 'text-emerald-400',
      };
    case 'mongodb':
    case 'mongo':
      return {
        badge: 'bg-green-600/10 text-green-400 border-green-600/30',
        dot: 'bg-green-400',
        text: 'text-green-400',
      };
    default:
      return {
        badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        dot: 'bg-indigo-400',
        text: 'text-indigo-400',
      };
  }
}

/**
 * Map mastery status to badge variant ('strong', 'developing', 'weak').
 */
export function getMasteryBadge(status) {
  switch (String(status || '').toLowerCase()) {
    case 'strong':
      return {
        label: 'Strong Mastery',
        variant: 'success',
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
      };
    case 'weak':
      return {
        label: 'Needs Focus',
        variant: 'danger',
        color: 'text-rose-400',
        bg: 'bg-rose-500/10',
      };
    case 'developing':
    default:
      return {
        label: 'Developing',
        variant: 'info',
        color: 'text-sky-400',
        bg: 'bg-sky-500/10',
      };
  }
}

/**
 * Truncate long strings safely.
 * @param {string} text
 * @param {number} length
 * @returns {string}
 */
export function truncate(text, length = 60) {
  if (!text) return '';
  return text.length > length ? `${text.slice(0, length)}…` : text;
}
