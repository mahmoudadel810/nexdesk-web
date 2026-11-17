import { VolumePoint } from '../../core/api/reports.api';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/** Says a number of minutes in the largest unit that keeps it readable: minutes, hours or days. */
export function formatDuration(
  minutes: number | null,
  translate: Translate,
  language: string,
): string {
  if (minutes === null) {
    return '–';
  }

  const number = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(value);
  if (minutes < 60) {
    return translate('reports.units.minutes', { count: number(Math.round(minutes)) });
  }

  return minutes < 1440
    ? translate('reports.units.hours', { count: number(minutes / 60) })
    : translate('reports.units.days', { count: number(minutes / 1440) });
}

/** How a figure moved against the period before, as a signed percentage. Null when there is no base. */
export function change(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
}

/** A short date for a chart axis, such as "Mar 9". */
export function axisDate(isoDate: string, language: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat(language, { month: 'short', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

export function totals(points: readonly VolumePoint[]): { created: number; solved: number } {
  return points.reduce(
    (sum, point) => ({ created: sum.created + point.created, solved: sum.solved + point.solved }),
    { created: 0, solved: 0 },
  );
}
