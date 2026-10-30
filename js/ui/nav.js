/**
 * @fileoverview Navigation logic: view switching between sidebar tabs.
 *
 * UI infrastructure layer of the hexagonal architecture.
 * Binds click handlers on sidebar nav buttons to toggle active view visibility.
 *
 * Dependencies: core/dom.js
 *
 * Exports: initNav
 */

import { $ } from '../core/dom.js';

/**
 * Initialise sidebar navigation: clicking a nav button switches the active view.
 */
export function initNav() {
  document.querySelectorAll('.nav').forEach(b => b.onclick = () => {
    document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
    document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('view-' + b.dataset.view).classList.add('active');
  });
}
