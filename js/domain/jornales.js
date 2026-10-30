/**
 * @fileoverview Jornales domain logic: tenure classification and date math.
 *
 * Domain layer of the hexagonal architecture. Pure functions for classifying
 * worker tenure based on days between first and current record dates.
 *
 * Dependencies: none.
 *
 * Exports: classifyTenure, daysBetween
 */

/**
 * Classify a tenure (days since first record) into a human-readable category.
 * @param {number} days - Business days since first record.
 * @param {number} [cut1=3] - First threshold (inclusive).
 * @param {number} [cut2=10] - Second threshold (inclusive).
 * @returns {string} Category label: "No contar", "Nuevo -X días", "Nuevo X-Y", or "Antiguo".
 */
export function classifyTenure(days, cut1 = 3, cut2 = 10) {
  if (days < 0) return 'No contar';
  if (days <= cut1) return `Nuevo -${cut1} días`;
  if (days <= cut2) return `Nuevo ${cut1 + 1}-${cut2}`;
  return 'Antiguo';
}

/**
 * Calculate the number of whole days between two timestamps.
 * @param {number} a - Start timestamp (ms).
 * @param {number} b - End timestamp (ms).
 * @returns {number} Whole days between a and b.
 */
export function daysBetween(a, b) {
  const day = 86400000;
  return Math.floor((b - a) / day);
}
