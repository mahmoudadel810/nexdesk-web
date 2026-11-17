import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AdminApi } from '../core/api/admin.api';
import { AuthService } from '../core/auth/auth.service';
import { PreferencesControls } from '../layout/preferences-controls';

/** The platform console: separate from any workspace, for the people who run NexDesk. */
@Component({
  selector: 'app-admin-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatToolbarModule,
    PreferencesControls,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoPipe,
  ],
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">{{
      'common.skipToContent' | transloco
    }}</a>
    <mat-toolbar class="header">
      <a class="brand" routerLink="/admin">
        <mat-icon aria-hidden="true">admin_panel_settings</mat-icon>
        <span>{{ 'admin.title' | transloco }}</span>
      </a>
      <nav
        mat-tab-nav-bar
        [tabPanel]="panel"
        disablePagination
        class="tabs"
        [attr.aria-label]="'admin.nav.label' | transloco"
      >
        <a
          mat-tab-link
          routerLink="/admin"
          routerLinkActive
          #overview="routerLinkActive"
          [routerLinkActiveOptions]="{ exact: true }"
          [active]="overview.isActive"
          >{{ 'admin.nav.overview' | transloco }}</a
        >
        <a
          mat-tab-link
          routerLink="/admin/tenants"
          routerLinkActive
          #tenants="routerLinkActive"
          [active]="tenants.isActive"
          >{{ 'admin.nav.tenants' | transloco }}</a
        >
      </nav>
      <span class="spacer"></span>
      <button mat-button type="button" class="wide-only" (click)="openJobs()">
        <mat-icon aria-hidden="true">work_history</mat-icon>
        {{ 'admin.jobs' | transloco }}
      </button>
      <app-preferences-controls />
      <button mat-button type="button" (click)="signOut()">{{ 'nav.signOut' | transloco }}</button>
    </mat-toolbar>
    <mat-tab-nav-panel #panel>
      <main id="main" class="content" tabindex="-1">
        <router-outlet />
      </main>
    </mat-tab-nav-panel>
  `,
  styles: `
    .header {
      gap: 8px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-title-medium);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
    }

    .tabs {
      align-self: stretch;
      margin-inline-start: 16px;
      border-block-end: 0;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .content {
      inline-size: 100%;
      max-inline-size: 1200px;
      margin-inline: auto;
      padding: 24px 16px;
      box-sizing: border-box;
    }

    @media (max-width: 720px) {
      .wide-only,
      .brand span {
        display: none;
      }
    }
  `,
})
export class AdminShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(AdminApi);

  protected skipToMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }

  /** The dashboard opens in its own tab through a link that works once, within a minute. */
  protected openJobs(): void {
    // Opened before the request finishes, so pop-up blockers see it as the user's own click.
    const tab = window.open('about:blank', '_blank');
    this.api.jobsDashboardLink().subscribe({
      next: ({ url }) => {
        if (tab) {
          tab.opener = null;
          tab.location.href = url;
        } else {
          // Pop-ups are blocked; the dashboard links back to the console, so open it here instead.
          window.location.assign(url);
        }
      },
      error: () => tab?.close(),
    });
  }

  protected signOut(): void {
    const leave = () => void this.router.navigate(['/auth/login']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}
