import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppLanguage, LanguageService, SUPPORTED_LANGUAGES } from '../core/i18n/language.service';
import { ThemeService } from '../core/theme/theme.service';

@Component({
  selector: 'app-preferences-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule, TranslocoPipe],
  template: `
    <button
      mat-icon-button
      type="button"
      [matMenuTriggerFor]="languageMenu"
      [attr.aria-label]="'common.changeLanguage' | transloco"
      [matTooltip]="'common.changeLanguage' | transloco"
    >
      <mat-icon aria-hidden="true">translate</mat-icon>
    </button>
    <mat-menu #languageMenu="matMenu">
      @for (language of languages; track language) {
        <button
          mat-menu-item
          type="button"
          [attr.lang]="language"
          [attr.aria-current]="language === languageService.language() ? 'true' : null"
          (click)="languageService.use(language)"
        >
          <mat-icon aria-hidden="true">
            {{ language === languageService.language() ? 'check' : '' }}
          </mat-icon>
          <span>{{ 'languages.' + language | transloco }}</span>
        </button>
      }
    </mat-menu>

    <button
      mat-icon-button
      type="button"
      [attr.aria-label]="
        (theme.isDark() ? 'common.useLightTheme' : 'common.useDarkTheme') | transloco
      "
      [matTooltip]="(theme.isDark() ? 'common.useLightTheme' : 'common.useDarkTheme') | transloco"
      (click)="theme.toggle()"
    >
      <mat-icon aria-hidden="true">{{ theme.isDark() ? 'light_mode' : 'dark_mode' }}</mat-icon>
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  `,
})
export class PreferencesControls {
  protected readonly languageService = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly languages: readonly AppLanguage[] = SUPPORTED_LANGUAGES;
}
