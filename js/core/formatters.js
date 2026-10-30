/**
 * @fileoverview Number, percentage and text formatters.
 *
 * Infrastructure layer of the hexagonal architecture.
 * All formatting constants and helper functions used across views and domain
 * modules are defined here to avoid duplication and ensure consistency.
 *
 * Exports: nf, pf, pct, esc, huPercent2
 */

/** Argentine locale integer formatter. */
export const nf = new Intl.NumberFormat('es-AR');

/** Argentine locale formatter with 1 decimal place. */
export const pf = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/**
 * Calculate percentage of a over b. Returns 0 when b is falsy.
 * @param {number} a - The part.
 * @param {number} b - The whole.
 * @returns {number} The percentage value (0–100).
 */
export const pct = (a, b) => b ? a / b * 100 : 0;

/**
 * HTML-escape a string value to prevent XSS in template literals.
 * @param {*} s - The value to escape (coerced to string).
 * @returns {string} The escaped string.
 */
export const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));

/**
 * Format a number as a percentage with 2 decimal places (Argentine locale).
 * @param {number} v - The percentage value.
 * @returns {string} Formatted percentage like "65,00".
 */
export const huPercent2 = v => Number(v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
