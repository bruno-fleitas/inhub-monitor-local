/**
 * @fileoverview Time and duration utility functions.
 *
 * Infrastructure layer of the hexagonal architecture.
 * Provides hour/duration calculations used by the operation, HU control
 * and report views.
 *
 * Dependencies: none.
 */

/**
 * Calculate hours remaining from a timestamp until a target HH:MM time.
 * If the target time has already passed on the same day, it rolls to the next day.
 * @param {number|null} lastTs - The reference timestamp in ms (epoch).
 * @param {string} target - Target time in "HH:MM" format.
 * @returns {number} Hours remaining (0 if lastTs is falsy).
 */
export function hoursUntil(lastTs, target) {
  if (!lastTs) return 0;
  const d = new Date(lastTs), [hh, mm] = String(target || '22:00').split(':').map(Number), t = new Date(d);
  t.setHours(hh || 0, mm || 0, 0, 0);
  if (t <= d) t.setDate(t.getDate() + 1);
  return Math.max(0, (t - d) / 3600000);
}

/**
 * Calculate hours from a timestamp until a target HH:MM time (rolls to next day if past).
 * @param {number|null} lastTs - The reference timestamp in ms (epoch).
 * @param {string} targetTime - Target time in "HH:MM" format (default "05:00").
 * @returns {number} Hours remaining.
 */
export function hoursToTarget(lastTs, targetTime) {
  if (!lastTs) return 0;
  const d = new Date(lastTs), [hh, mm] = String(targetTime || '05:00').split(':').map(Number);
  const target = new Date(d);
  target.setHours(hh || 0, mm || 0, 0, 0);
  if (target <= d) target.setDate(target.getDate() + 1);
  return Math.max(0, (target - d) / 3600000);
}

/**
 * Format a fractional hours value as "X h YY min" or "X h".
 * @param {number} hours - The duration in hours.
 * @returns {string} Human-readable duration or "-" if invalid.
 */
export function fmtDuration(hours) {
  if (!isFinite(hours) || hours < 0) return '-';
  const total = Math.round(hours * 60), h = Math.floor(total / 60), m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}
