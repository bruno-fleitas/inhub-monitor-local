import { pct } from '../core/formatters.js';

export function universe(a, start) {
  let packages = 0, vehicles = 0;
  if (a?.ok) for (let h = start; h <= 23; h++) { packages += a.h[h].ship; vehicles += a.h[h].veh; }
  return { packages, vehicles };
}

export function cut(a, start, c, type) {
  const u = universe(a, start)[type];
  let x = 0;
  if (a?.ok) for (let h = start; h < c && h <= 23; h++) x += a.h[h][type === 'packages' ? 'ship' : 'veh'];
  return pct(x, u);
}

export function cuts(a, start, type) {
  return '<table><tr><th>Corte</th><th>%</th></tr>' +
    [16, 18, 20].map(c => `<tr><td>Pre ${c}</td><td>${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(cut(a, start, c, type))}%</td></tr>`).join('') +
    `<tr><td>Post 20</td><td>${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(100 - cut(a, start, 20, type))}%</td></tr></table>`;
}

export function buildArrivalCurve(rows, startHour = 9) {
  const byHour = Array.from({ length: 24 }, () => ({ packages: 0, vehicles: 0 }));
  for (const row of rows) {
    const h = Number(row.hour);
    if (!Number.isInteger(h) || h < startHour || h > 23) continue;
    byHour[h].packages += Number(row.shipments || 0);
    byHour[h].vehicles += 1;
  }
  const hours = [];
  let cumPackages = 0, cumVehicles = 0;
  for (let h = startHour; h < 24; h++) {
    cumPackages += byHour[h].packages;
    cumVehicles += byHour[h].vehicles;
    hours.push({ hour: h, ...byHour[h], cumPackages, cumVehicles });
  }
  return { startHour, hours, totalPackages: cumPackages, totalVehicles: cumVehicles };
}

export function cutoffShare(curve, cutoff, type = 'packages') {
  const total = type === 'vehicles' ? curve.totalVehicles : curve.totalPackages;
  if (!total) return 0;
  const key = type === 'vehicles' ? 'vehicles' : 'packages';
  let value = 0;
  for (const r of curve.hours) { if (r.hour < cutoff) value += r[key]; }
  return value / total * 100;
}
