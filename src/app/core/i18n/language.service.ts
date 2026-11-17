import { Directionality } from '@angular/cdk/bidi';
import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslocoService } from '@jsverse/transloco';
import { merge, scan } from 'rxjs';
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

  /**
   * Changes whenever translated text may read differently: after a language switch and again once
   * that language's texts have arrived. Code that translates outside a template reads it to stay current.
   */
  readonly translations = toSignal(
    merge(this.transloco.langChanges$, this.transloco.events$).pipe(
      scan((version) => version + 1, 0),
    ),
    { initialValue: 0 },
  );

  constructor() {
    effect(() => {
      const language = this.current();
      const direction = this.direction();

      this.transloco.setActiveLang(language);
      this.document.documentElement.lang = language;
      this.document.documentElement.dir = direction;
      if (this.directionality.value !== direction) {
        this.directionality.valueSignal.set(direction);
        // Components such as the side menu only re-lay themselves out when this emits.
        this.directionality.change.emit(direction);
        this.remeasureFormFields();
      }
    });
  }

  /**
   * Outlined form fields place a floating label beside a prefix icon by measuring the icon, and measure
   * again only when its size changes. Resizing the prefixes for one frame makes them measure again with
   * the new reading direction.
   */
  private remeasureFormFields(): void {
    const root = this.document.documentElement;
    root.classList.add('nd-remeasure-fields');
    this.document.defaultView?.requestAnimationFrame(() =>
      this.document.defaultView?.requestAnimationFrame(() =>
        root.classList.remove('nd-remeasure-fields'),
      ),
    );
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
