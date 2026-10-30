/**
 * @fileoverview TMS domain logic: classification, HU tracking, DOT monitoring.
 *
 * Domain layer of the hexagonal architecture. Contains pure business logic for
 * TMS package classification, HU (Hub Unit) progress tracking, and Dispatch On
 * Time (DOT) compliance evaluation. These functions operate on processed worker
 * results and do not touch the DOM.
 *
 * Dependencies: core/formatters.js, core/config.js, core/state.js, core/time.js
 *
 * Exports: num, classify, isVolumetric, tmsHourlyVelocity, huCptRows, huActiveUsers,
 *          huSeparateAir, huPct, huTone, huDetailRows, huCptTracking,
 *          dotTarget, dotDay, dotTime, dotCptTime, dotData, dotExport, dotVisibleRows
 */

import { nf, pf, pct } from '../core/formatters.js';
import { masters, huConfig } from '../core/config.js';
import { state, dotExclusions, names } from '../core/state.js';

/**
 * Parse a numeric value from a TMS cell, handling Argentine/European number formats.
 * @param {*} v - The raw cell value.
 * @returns {number} The parsed number or 0.
 */
export function num(v) {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/\s/g, '');
  if (!s || /^null$/i.test(s)) return 0;
  const comma = s.lastIndexOf(','), dot = s.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) { s = comma > dot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, ''); }
  else if (comma >= 0) { s = s.replace(',', '.'); }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Classify a TMS package by dimensions/weight into a size category.
 * Dimensions are in centimeters, weight in grams (both TMS formats).
 * @param {number} w - Weight in grams.
 * @param {number} h - Height in cm.
 * @param {number} l - Length in cm.
 * @param {number} wi - Width in cm.
 * @returns {'SuperBigger'|'Bigger'|'Voluminoso'|'Paqueteria'} The classification.
 */
export function classify(w, h, l, wi) {
  w = num(w); h = num(h); l = num(l); wi = num(wi);
  const kg = w / 1000;
  if (h > 200 || l > 200 || wi > 200 || kg > 50) return 'SuperBigger';
  if (h > 150 || l > 150 || wi > 150 || kg > 30) return 'Bigger';
  if (h >= 50 || l >= 50 || wi >= 50 || kg >= 20) return 'Voluminoso';
  return 'Paqueteria';
}

/**
 * Check if a classification is volumetric (not standard paqueteria).
 * @param {string} classification - The classify() result.
 * @returns {boolean}
 */
export function isVolumetric(classification) {
  return classification !== 'Paqueteria';
}

/**
 * Calculate the real-time hourly velocity of TMS scanning.
 * Uses the same rule as BUSCARV(HORA(W4);BF:BH;3;0): pieces of the current hour
 * divided by minutes since HH:00.
 * @param {object} t - TMS result from the worker.
 * @returns {number|null} Pieces per hour, or null if no data.
 */
export function tmsHourlyVelocity(t) {
  if (!t?.by?.length || !Number.isFinite(t.maxInTs)) return null;
  const dt = new Date(t.maxInTs), h = dt.getHours();
  const start = new Date(dt); start.setMinutes(0, 0, 0);
  const minutes = (dt - start) / 60000;
  const qty = Number(t.by[h]?.tot || 0);
  return minutes > 0 ? qty * 60 / minutes : null;
}

/**
 * Build CPT-level HU tracking rows from TMS subca data and master config.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {object} t - TMS result (already separated from MELI Air).
 * @returns {Array<object>} CPT rows with etiquetado/abierto/cerrado/pendiente/users.
 */
export function huCptRows(site, t) {
  const mp = new Map(masters[site].map(x => [String(x.subca).trim().toUpperCase(), x]));
  const m = new Map();
  for (const g of t.hu?.subca || []) {
    const cfg = mp.get(String(g.subca).trim().toUpperCase()), cpt = cfg?.cpt ?? 'SIN CONFIG';
    if (!m.has(String(cpt))) m.set(String(cpt), { cpt, etiquetado: 0, abierto: 0, cerrado: 0, pendiente: 0, subcas: 0, users: new Set() });
    const x = m.get(String(cpt));
    x.etiquetado += g.etiquetado; x.abierto += g.abierto; x.cerrado += g.cerrado; x.pendiente += g.pendiente; x.subcas++;
  }
  for (const a of huActiveUsers(site, t)) {
    const cfg = mp.get(String(a.subca).trim().toUpperCase()), cpt = cfg?.cpt ?? 'SIN CONFIG';
    const x = m.get(String(cpt)); if (x) x.users.add(a.user);
  }
  return [...m.values()].sort((a, b) => String(a.cpt).localeCompare(String(b.cpt), 'es', { numeric: true }));
}

/**
 * Get users with HU activity within the configured time window.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {object} t - TMS result.
 * @returns {Array<object>} Active user activity entries.
 */
export function huActiveUsers(site, t) {
  const cfg = huConfig(site), mins = Math.max(1, Number(cfg.activeMinutes) || 10), max = t.hu?.maxOutTs;
  if (max == null) return [];
  const src = t.hu?.userActivity || t.hu?.activeUsers || [];
  return src.filter(x => max - x.last < mins * 60000);
}

/**
 * Separate TMS data into normal and MELI Air subsets based on SubCA naming.
 * MELI Air SubCAs end with `_A` (case-insensitive).
 * @param {object} t - Full TMS result.
 * @returns {{normal:object, meli:object}} Separated TMS objects.
 */
export function huSeparateAir(t) {
  const air = g => /_A$/i.test(String(g.subca || '').trim());
  const split = flag => (t.hu?.subca || []).filter(g => air(g) === flag);
  const total = rows => rows.reduce((a, g) => {
    for (const k of ['etiquetado', 'abierto', 'cerrado', 'pendiente']) a[k] += Number(g[k] || 0);
    return a;
  }, { etiquetado: 0, abierto: 0, cerrado: 0, pendiente: 0 });
  const normal = split(false), meli = split(true);
  return {
    normal: { ...t, hu: { ...t.hu, subca: normal, totals: total(normal), userActivity: (t.hu.userActivity || []).filter(x => !air(x)) } },
    meli: { ...t, hu: { ...t.hu, subca: meli, totals: total(meli), userActivity: (t.hu.userActivity || []).filter(air) } }
  };
}

/** HU advance percentage for a CPT row. */
export const huPct = x => x.etiquetado ? pct(x.abierto + x.cerrado, x.etiquetado) : 0;

/** CSS class for HU tone based on value vs objective. */
export const huTone = (v, obj) => v >= obj ? 'hu-good' : 'hu-bad';

/**
 * Build per-SubCA detail rows with master config enrichment and active users.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {object} t - TMS result (normal, without MELI Air).
 * @returns {Array<object>} Detail rows sorted by CPT then etiquetado.
 */
export function huDetailRows(site, t) {
  const mp = new Map(masters[site].map(x => [String(x.subca).trim().toUpperCase(), x]));
  const activeBySub = new Map();
  for (const a of huActiveUsers(site, t)) {
    const k = String(a.subca || 'SIN SUBCA');
    if (!activeBySub.has(k)) activeBySub.set(k, new Map());
    const m = activeBySub.get(k), prev = m.get(a.user);
    if (!prev || a.last > prev.last) m.set(a.user, { user: a.user, last: a.last });
  }
  return (t.hu?.subca || []).map(g => {
    const cfg = mp.get(String(g.subca).trim().toUpperCase()) || {};
    return {
      ...g,
      finalizado: g.finalizado || 0, enDespacho: g.enDespacho || 0, despachado: g.despachado || 0,
      ola: cfg.ola || '', cpt: cfg.cpt ?? 'SIN CONFIG', indicador: cfg.indicador || '',
      userList: [...(activeBySub.get(String(g.subca))?.values() || [])].sort((a, b) => String(a.user).localeCompare(String(b.user), 'es')),
      users: activeBySub.get(String(g.subca))?.size || 0,
      avance: g.etiquetado ? pct(g.abierto + g.cerrado, g.etiquetado) : 0
    };
  }).sort((a, b) => String(a.cpt).localeCompare(String(b.cpt), 'es', { numeric: true }) || b.etiquetado - a.etiquetado);
}

/**
 * Build CPT-level tracking groups from per-SubCA detail rows.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {object} t - TMS result.
 * @returns {Array<object>} CPT groups with aggregated metrics and user lists.
 */
export function huCptTracking(site, t) {
  const rows = huDetailRows(site, t), groups = new Map();
  for (const r of rows) {
    const k = String(r.cpt);
    if (!groups.has(k)) groups.set(k, { cpt: r.cpt, etiquetado: 0, abierto: 0, cerrado: 0, pendiente: 0, finalizado: 0, enDespacho: 0, despachado: 0, userMap: new Map(), users: 0, subcas: [] });
    const g = groups.get(k);
    g.etiquetado += r.etiquetado; g.abierto += r.abierto; g.cerrado += r.cerrado; g.pendiente += r.pendiente;
    g.finalizado += r.finalizado; g.enDespacho += r.enDespacho; g.despachado += r.despachado;
    for (const u of r.userList || []) { const p = g.userMap.get(u.user); if (!p || u.last > p.last) g.userMap.set(u.user, u); }
    g.users = g.userMap.size; g.subcas.push(r);
  }
  return [...groups.values()].map(g => ({
    ...g, userList: [...g.userMap.values()].sort((a, b) => String(a.user).localeCompare(String(b.user), 'es')),
    avance: g.etiquetado ? pct(g.abierto + g.cerrado, g.etiquetado) : 0
  })).sort((a, b) => String(a.cpt).localeCompare(String(b.cpt), 'es', { numeric: true }));
}

// ── DOT (Dispatch On Time) domain logic ──

/**
 * Get or lazily initialise the DOT configuration for a site.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @returns {object} DOT config with date, objective, filters, etc.
 */
export function dotTarget(site) {
  state.config.dot ??= {};
  const c = state.config.dot[site] ??= {};
  if (c.objective == null) c.objective = 99.55;
  if (c.date == null) {
    const base = state.config.analysisDate;
    if (base) { const [y, m, d] = base.split('-').map(Number); const next = new Date(y, m - 1, d + 1); c.date = dotDay(next.getTime()); }
    else c.date = dotDay(Date.now());
  }
  if (c.status == null) c.status = 'all';
  if (c.subca == null) c.subca = 'all';
  if (c.detail == null) c.detail = 'all';
  return c;
}

/**
 * Format a timestamp as a "YYYY-MM-DD" date string.
 * @param {number} ts - Epoch milliseconds.
 * @returns {string} Date string.
 */
export function dotDay(ts) {
  const d = new Date(ts);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

/**
 * Build a timestamp from a day string and HH:MM time, with optional day offset.
 * @param {string} day - "YYYY-MM-DD".
 * @param {string} time - "HH:MM".
 * @param {number} [plus=0] - Days to add.
 * @returns {number|null} Epoch ms or null.
 */
export function dotTime(day, time, plus = 0) {
  if (!day || !time) return null;
  const [y, m, d] = day.split('-').map(Number), [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d + plus, h, min || 0, 0).getTime();
}

/**
 * Parse a CPT value (e.g. "10", "10:30") and return a deadline timestamp for the given day.
 * @param {string} day - "YYYY-MM-DD".
 * @param {string|number} cpt - CPT hour or "HH:MM".
 * @returns {number|null} Epoch ms or null if invalid.
 */
export function dotCptTime(day, cpt) {
  if (!day || cpt == null) return null;
  const m = String(cpt).trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
  if (!m || +m[1] > 13 || +(m[2] || 0) > 59) return null;
  return dotTime(day, m[1].padStart(2, '0') + ':' + (m[2] || '00'));
}

/**
 * Evaluate DOT compliance for all TMS dotRows of a site.
 * Classifies each shipment as onTime, delay, pending, or sinCpt.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {object} t - TMS result.
 * @returns {object} DOT evaluation with rows, totals, groups, percentages.
 */
export function dotData(site, t) {
  const cfg = dotTarget(site), src = t.dotRows || [], master = new Map(masters[site].map(x => [String(x.subca).trim().toUpperCase(), x]));
  const start = dotTime(cfg.date, '00:00', -1), end = dotTime(cfg.date, '00:00'), now = Date.now(), exclusions = dotExclusions[site];
  const rows = [], missing = [], tot = { total: 0, onTime: 0, delay: 0, pending: 0, excluded: 0 }, groups = new Map();
  for (const x of src) {
    if (x.inTs == null || x.inTs < start || x.inTs >= end) continue;
    const zone = String(x.subca || '').trim(), status = String(x.status || '').trim();
    const m = master.get(zone.toUpperCase()), deadline = m ? dotCptTime(cfg.date, m.cpt) : null;
    const cpt = deadline == null ? '' : String(m.cpt), key = String(x.shipment), dispatch = x.dispatchTs;
    const kind = deadline == null ? 'sinCpt' : dispatch != null ? (dispatch <= deadline ? 'onTime' : 'delay') : (now >= deadline ? 'delay' : 'pending');
    const exclusion = kind === 'delay' ? (exclusions.get(key) || '') : '';
    const item = { ...x, subca: zone, status, cpt, deadline, kind, exclusion, minutes: deadline != null && dispatch != null ? Math.max(0, Math.ceil((dispatch - deadline) / 60000)) : null };
    rows.push(item);
    if (kind === 'sinCpt') { missing.push(item); continue; }
    tot.total++; tot[kind]++; if (exclusion) tot.excluded++;
    const groupKey = cpt + '|' + zone;
    if (!groups.has(groupKey)) groups.set(groupKey, { cpt, subca: zone, total: 0, onTime: 0, delay: 0, pending: 0, excluded: 0 });
    const g = groups.get(groupKey); g.total++; g[kind]++; if (exclusion) g.excluded++;
  }
  const evaluated = tot.onTime + tot.delay, adjusted = evaluated - tot.excluded;
  return {
    rows, missing, total: tot,
    groups: [...groups.values()].sort((a, b) => Number(a.cpt) - Number(b.cpt) || a.subca.localeCompare(b.subca)),
    date: cfg.date, sourceDate: dotDay(start),
    bruto: evaluated ? 100 * tot.onTime / evaluated : null,
    ajustado: adjusted > 0 ? 100 * tot.onTime / adjusted : null,
    hasDispatchField: t.dotHasDispatchField !== false
  };
}

/**
 * Export DOT detail rows as a CSV file download.
 * @param {string} site - 'soldati' or 'echeverria'.
 */
export function dotExport(site) {
  const t = state.sites[site].tms; if (!t) return;
  const d = dotData(site, t), rows = dotVisibleRows(site, d);
  const headers = ['Shipment ID', 'Site', 'Ingreso', 'SubCA', 'CPT', 'Limite CPT', 'Despacho', 'HU', 'Hub Status', 'Estado DOT', 'Minutos de atraso', 'Desestimado', 'Motivo'];
  const fmt = ts => ts == null ? '' : new Date(ts).toLocaleString('es-AR');
  const data = rows.map(x => [x.shipment, names[site], fmt(x.inTs), x.subca, x.cpt, fmt(x.deadline), fmt(x.dispatchTs), x.hu, x.status, x.kind === 'sinCpt' ? 'SIN CPT' : x.kind === 'onTime' ? 'ON TIME' : x.kind === 'pending' ? 'PENDIENTE' : 'DELAY', x.minutes ?? '', x.exclusion ? 'SI' : 'NO', x.exclusion]);
  const csv = '\uFEFF' + [headers, ...data].map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = 'Auditoria_DOT_' + site + '_' + d.date + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Filter DOT rows based on the site's current DOT filter configuration.
 * @param {string} site - 'soldati' or 'echeverria'.
 * @param {object} d - DOT evaluation result from dotData().
 * @returns {Array<object>} Filtered rows.
 */
export function dotVisibleRows(site, d) {
  const cfg = dotTarget(site), q = (cfg.search || '').toLowerCase().trim();
  return d.rows.filter(x =>
    (!cfg.kind || cfg.kind === 'all' || x.kind === cfg.kind) &&
    (!cfg.subcaFilter || cfg.subcaFilter === 'all' || x.subca === cfg.subcaFilter) &&
    (!cfg.cptFilter || cfg.cptFilter === 'all' || x.cpt === cfg.cptFilter) &&
    (!q || String(x.shipment).toLowerCase().includes(q) || x.subca.toLowerCase().includes(q) || String(x.hu).toLowerCase().includes(q))
  );
}
