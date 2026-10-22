/**
 * Calculates calendar-day login streak based on normalized UTC day index.
 * @param {Date|string|null} lastActiveDate - Previous active date.
 * @param {number} currentStreak - Existing streak count.
 * @param {Date} [referenceDate=new Date()] - Injectable reference date for deterministic testing.
 * @returns {{ streakCount: number, updatedActiveDate: Date, isIncremented: boolean }}
 */
function calculateLoginStreak(lastActiveDate, currentStreak = 1, referenceDate = new Date()) {
  const now = referenceDate instanceof Date && !isNaN(referenceDate.getTime())
    ? referenceDate
    : new Date();

  const getUtcDayIndex = (d) => {
    if (!d || isNaN(new Date(d).getTime())) return null;
    const dateObj = new Date(d);
    return Math.floor(
      Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate()) / 86400000
    );
  };

  const todayIndex = getUtcDayIndex(now);
  const lastIndex = getUtcDayIndex(lastActiveDate);

  // If no valid previous active date, start at streak 1
  if (lastIndex === null) {
    return { streakCount: 1, updatedActiveDate: now, isIncremented: false };
  }

  const dayDiff = todayIndex - lastIndex;

  if (dayDiff === 0) {
    // Same calendar day: do not increment
    return {
      streakCount: Math.max(1, Number(currentStreak) || 1),
      updatedActiveDate: now,
      isIncremented: false,
    };
  } else if (dayDiff === 1) {
    // Consecutive calendar day: increment streak
    return {
      streakCount: (Number(currentStreak) || 1) + 1,
      updatedActiveDate: now,
      isIncremented: true,
    };
  } else {
    // Missed one or more calendar days or negative diff (clock skew): reset to 1
    return {
      streakCount: 1,
      updatedActiveDate: now,
      isIncremented: false,
    };
  }
}

module.exports = { calculateLoginStreak };
