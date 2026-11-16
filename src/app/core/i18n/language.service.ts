import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { readStored, writeStored } from '../browser-storage';

export type AppLanguage = 'en' | 'ar';

export const SUPPORTED_LANGUAGES: readonly AppLanguage[] = ['en', 'ar'];
export const DEFAULT_LANGUAGE: AppLanguage = 'en';
const STORAGE_KEY = 'nexdesk.language';

export function isSupportedLanguage(value: unknown): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly document = inject(DOCUMENT);
  private readonly directionality = inject(Directionality);

  private readonly current = signal<AppLanguage>(initialLanguage());

  readonly language = this.current.asReadonly();
  readonly direction = computed(() => (this.current() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    effect(() => {
      const language = this.current();
      const direction = this.direction();

      this.transloco.setActiveLang(language);
      this.document.documentElement.lang = language;
      this.document.documentElement.dir = direction;
      this.directionality.valueSignal.set(direction);
    });
  }

  use(language: AppLanguage): void {
    this.current.set(language);
    writeStored(STORAGE_KEY, language);
  }
}

function initialLanguage(): AppLanguage {
  const stored = readStored(STORAGE_KEY);
  return isSupportedLanguage(stored) ? stored : DEFAULT_LANGUAGE;
}
