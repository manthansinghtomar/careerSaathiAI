/**
 * India Standard Time (IST) Date and Timezone Helper.
 * Timezone: Asia/Kolkata (UTC+5:30, +19,800,000 ms)
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19,800,000 ms

/**
 * Returns integer day index since epoch in Asia/Kolkata timezone.
 * @param {Date|number|string} date
 * @returns {number}
 */
function getIstDayIndex(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date(date);
  return Math.floor((d.getTime() + IST_OFFSET_MS) / 86400000);
}

/**
 * Returns calendar day key 'YYYY-MM-DD' in Asia/Kolkata timezone.
 * @param {Date|number|string} date
 * @returns {string}
 */
function getIstDayKey(date = new Date()) {
  const d = date instanceof Date && !isNaN(date.getTime()) ? date : new Date(date);
  const istDate = new Date(d.getTime() + IST_OFFSET_MS);
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Converts a 'YYYY-MM-DD' day key into an integer day index.
 * @param {string} key
 * @returns {number|null}
 */
function getIstDayIndexFromKey(key) {
  if (!key || typeof key !== 'string') return null;
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  const [y, m, d] = parts;
  return Math.floor((Date.UTC(y, m - 1, d) + IST_OFFSET_MS) / 86400000);
}

module.exports = {
  IST_OFFSET_MS,
  getIstDayIndex,
  getIstDayKey,
  getIstDayIndexFromKey,
};
