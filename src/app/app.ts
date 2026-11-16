import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { LoadingService } from './core/http/loading.service';
import { LanguageService } from './core/i18n/language.service';
import { ThemeService } from './core/theme/theme.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatProgressBarModule, RouterOutlet, TranslocoPipe],
  template: `
    @if (loading.isLoading()) {
      <mat-progress-bar
        class="request-progress"
        mode="indeterminate"
        [attr.aria-label]="'common.loading' | transloco"
      />
    }
    <router-outlet />
  `,
  styles: `
    .request-progress {
      position: fixed;
      inset-block-start: 0;
      inset-inline: 0;
      z-index: 1000;
    }
  `,
})
export class App {
  // Injected eagerly so language, direction and colour scheme are applied before the first route renders.
  protected readonly language = inject(LanguageService);
  protected readonly theme = inject(ThemeService);
  protected readonly loading = inject(LoadingService);
}
