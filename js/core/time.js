export function hoursUntil(lastTs, target) {
  if (!lastTs) return 0;
  const d = new Date(lastTs), [hh, mm] = String(target || '22:00').split(':').map(Number), t = new Date(d);
  t.setHours(hh || 0, mm || 0, 0, 0);
  if (t <= d) t.setDate(t.getDate() + 1);
  return Math.max(0, (t - d) / 3600000);
}

export function hoursToTarget(lastTs, targetTime) {
  if (!lastTs) return 0;
  const d = new Date(lastTs), [hh, mm] = String(targetTime || '05:00').split(':').map(Number);
  const target = new Date(d);
  target.setHours(hh || 0, mm || 0, 0, 0);
  if (target <= d) target.setDate(target.getDate() + 1);
  return Math.max(0, (target - d) / 3600000);
}

export function fmtDuration(hours) {
  if (!isFinite(hours) || hours < 0) return '-';
  const total = Math.round(hours * 60), h = Math.floor(total / 60), m = total % 60;
  return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
}
