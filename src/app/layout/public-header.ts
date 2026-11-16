import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppLanguage, LanguageService, SUPPORTED_LANGUAGES } from '../core/i18n/language.service';
import { ThemeService } from '../core/theme/theme.service';

@Component({
  selector: 'app-public-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <mat-toolbar class="header">
      <a class="brand" routerLink="/" [attr.aria-label]="'common.brandHome' | transloco">
        <mat-icon aria-hidden="true">support_agent</mat-icon>
        <span>NexDesk</span>
      </a>
      <span class="spacer"></span>

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
    </mat-toolbar>
  `,
  styles: `
    .header {
      position: sticky;
      inset-block-start: 0;
      z-index: 10;
      gap: 4px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-title-large);
      font-weight: 600;
      text-decoration: none;
      border-radius: 8px;
      padding-inline: 4px;
    }

    .brand:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .spacer {
      flex: 1 1 auto;
    }
  `,
})
export class PublicHeader {
  protected readonly languageService = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly languages: readonly AppLanguage[] = SUPPORTED_LANGUAGES;
}
