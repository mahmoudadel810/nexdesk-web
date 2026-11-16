import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from '../core/i18n/language.service';

export type DateStyle = 'date' | 'dateTime' | 'relative';

const DIVISIONS: readonly (readonly [number, Intl.RelativeTimeFormatUnit])[] = [
  [60, 'second'],
  [60, 'minute'],
  [24, 'hour'],
  [7, 'day'],
  [4.345, 'week'],
  [12, 'month'],
  [Number.POSITIVE_INFINITY, 'year'],
];

export function formatLocalDate(
  value: string | Date | null | undefined,
  language: string,
  style: DateStyle = 'dateTime',
  now: Date = new Date(),
): string {
  if (!value) {
    return '';
  }

  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  if (style === 'relative') {
    let amount = (date.getTime() - now.getTime()) / 1000;
    const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
    for (const [size, unit] of DIVISIONS) {
      if (Math.abs(amount) < size) {
        return formatter.format(Math.round(amount), unit);
      }

      amount /= size;
    }
  }

  return new Intl.DateTimeFormat(language, {
    dateStyle: 'medium',
    timeStyle: style === 'date' ? undefined : 'short',
  }).format(date);
}

/** Formats a timestamp in the active UI language. Impure so it follows language switches. */
@Pipe({ name: 'localDate', pure: false })
export class LocalDatePipe implements PipeTransform {
  private readonly language = inject(LanguageService);

  transform(value: string | Date | null | undefined, style: DateStyle = 'dateTime'): string {
    return formatLocalDate(value, this.language.language(), style);
  }
}
