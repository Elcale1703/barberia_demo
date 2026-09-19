export const DEFAULT_TIMEZONE = process.env.TIMEZONE || 'America/Bogota';

const WEEKDAYS_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function getTimezoneDetails(
  date: Date,
  timezone: string = DEFAULT_TIMEZONE,
): { dayOfWeek: number; minuteOfDay: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';

  const weekdayStr = getPart('weekday');
  const hour = parseInt(getPart('hour'), 10);
  const minute = parseInt(getPart('minute'), 10);

  const dayOfWeek = WEEKDAYS_MAP[weekdayStr] ?? date.getDay();
  const minuteOfDay = hour * 60 + minute;

  return { dayOfWeek, minuteOfDay };
}

export function dateFromMinutes(dateStr: string, minutes: number): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const isoString = `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(mins)}:00-05:00`;
  return new Date(isoString);
}

export function formatMinutesToTime(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const min = minutes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(hour)}:${pad(min)}`;
}
