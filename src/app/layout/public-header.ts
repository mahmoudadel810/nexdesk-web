import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { PreferencesControls } from './preferences-controls';

@Component({
  selector: 'app-public-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    PreferencesControls,
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
      <app-preferences-controls />
      @if (auth.isAuthenticated()) {
        <a mat-flat-button routerLink="/app">{{ 'nav.openApp' | transloco }}</a>
      } @else {
        <a mat-button class="sign-in" routerLink="/auth/login">{{ 'nav.signIn' | transloco }}</a>
        <a mat-flat-button routerLink="/auth/register">{{ 'nav.getStarted' | transloco }}</a>
      }
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

    @media (max-width: 480px) {
      .sign-in {
        display: none;
      }
    }
  `,
})
export class PublicHeader {
  protected readonly auth = inject(AuthService);
}
