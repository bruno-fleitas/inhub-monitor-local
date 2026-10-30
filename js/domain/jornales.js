export function classifyTenure(days, cut1 = 3, cut2 = 10) {
  if (days < 0) return 'No contar';
  if (days <= cut1) return `Nuevo -${cut1} días`;
  if (days <= cut2) return `Nuevo ${cut1 + 1}-${cut2}`;
  return 'Antiguo';
}

export function daysBetween(a, b) {
  const day = 86400000;
  return Math.floor((b - a) / day);
}
