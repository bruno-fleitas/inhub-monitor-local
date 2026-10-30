/**
 * @fileoverview DOM utility helper. Infrastructure layer of the hexagonal architecture.
 *
 * Provides a shorthand for `document.getElementById` used across all modules.
 * No dependencies on other modules.
 */

/**
 * Shorthand for getElementById.
 * @param {string} id - The element ID to look up.
 * @returns {HTMLElement|null} The matching element or null.
 */
export const $ = id => document.getElementById(id);
