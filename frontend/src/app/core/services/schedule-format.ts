export interface RecurringPattern {
  time: string;
  frequency: 'DAILY' | 'WEEKDAYS' | 'MON_WED_FRI';
  days: number[];
}
export function parseRecurring(cron: string): RecurringPattern | null {
  const parts = cron.trim().split(/\s+/);
  if (
    parts.length !== 6 ||
    parts[0] !== '0' ||
    parts[4] !== '*' ||
    !/^\d+$/.test(parts[1]) ||
    !/^\d+$/.test(parts[2])
  )
    return null;
  const minute = Number(parts[1]),
    hour = Number(parts[2]);
  if (minute > 59 || hour > 23) return null;
  const time = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
  if (parts[3] === '*' && parts[5] === '?')
    return { time, frequency: 'DAILY', days: [0, 1, 2, 3, 4, 5, 6] };
  if (parts[3] === '?' && parts[5] === 'MON-FRI')
    return { time, frequency: 'WEEKDAYS', days: [0, 1, 2, 3, 4] };
  if (parts[3] === '?' && parts[5] === 'MON,WED,FRI')
    return { time, frequency: 'MON_WED_FRI', days: [0, 2, 4] };
  return null;
}
