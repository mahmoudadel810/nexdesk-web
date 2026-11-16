import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { readStored, writeStored } from '../browser-storage';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'nexdesk.theme';
const PREFERENCES: readonly ThemePreference[] = ['light', 'dark', 'system'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly systemDark = signal(this.querySystemDark());
  private readonly current = signal<ThemePreference>(initialPreference());

  readonly preference = this.current.asReadonly();
  readonly isDark = computed(() =>
    this.current() === 'system' ? this.systemDark() : this.current() === 'dark',
  );

  constructor() {
    this.document.defaultView
      ?.matchMedia?.('(prefers-color-scheme: dark)')
      .addEventListener('change', (event) => this.systemDark.set(event.matches));

    effect(() => {
      this.document.documentElement.style.colorScheme = this.isDark() ? 'dark' : 'light';
    });
  }

  set(preference: ThemePreference): void {
    this.current.set(preference);
    writeStored(STORAGE_KEY, preference);
  }

  toggle(): void {
    this.set(this.isDark() ? 'light' : 'dark');
  }

  private querySystemDark(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}

function initialPreference(): ThemePreference {
  const stored = readStored(STORAGE_KEY) as ThemePreference | null;
  return stored && PREFERENCES.includes(stored) ? stored : 'system';
}
