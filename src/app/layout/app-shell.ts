import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../core/auth/auth.service';
import { PreferencesControls } from './preferences-controls';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatMenuModule,
    MatToolbarModule,
    PreferencesControls,
    RouterLink,
    RouterOutlet,
    TranslocoPipe,
  ],
  template: `
    <mat-toolbar class="header">
      <a class="brand" routerLink="/app" [attr.aria-label]="'nav.dashboard' | transloco">
        <mat-icon aria-hidden="true">support_agent</mat-icon>
        <span>NexDesk</span>
      </a>
      @if (auth.session()?.tenant; as tenant) {
        <span class="workspace">{{ tenant.name }}</span>
      }
      <span class="spacer"></span>
      <app-preferences-controls />
      <button
        mat-icon-button
        type="button"
        class="avatar"
        [matMenuTriggerFor]="accountMenu"
        [attr.aria-label]="'nav.accountMenu' | transloco"
      >
        <span aria-hidden="true">{{ initials() }}</span>
      </button>
      <mat-menu #accountMenu="matMenu">
        @if (auth.session()?.user; as user) {
          <div class="account">
            <strong>{{ user.fullName }}</strong>
            <span>{{ user.email }}</span>
            @if (user.role) {
              <span>{{ 'roles.' + user.role | transloco }}</span>
            }
          </div>
          <mat-divider />
        }
        <button mat-menu-item type="button" (click)="signOut()">
          <mat-icon aria-hidden="true">logout</mat-icon>
          <span>{{ 'nav.signOut' | transloco }}</span>
        </button>
      </mat-menu>
    </mat-toolbar>
    <main class="content">
      <router-outlet />
    </main>
  `,
  styles: `
    .header {
      position: sticky;
      inset-block-start: 0;
      z-index: 10;
      gap: 8px;
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

    .workspace {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface-variant);
      border-inline-start: 1px solid var(--mat-sys-outline-variant);
      padding-inline-start: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .avatar {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-large);
    }

    .account {
      display: grid;
      gap: 2px;
      padding: 8px 16px 12px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }

    .account strong {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
    }

    .content {
      max-inline-size: 1200px;
      margin-inline: auto;
      padding: 24px;
    }

    @media (max-width: 600px) {
      .workspace {
        display: none;
      }

      .content {
        padding: 16px;
      }
    }
  `,
})
export class AppShell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly initials = computed(() =>
    (this.auth.session()?.user.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join(''),
  );

  protected signOut(): void {
    const leave = () => void this.router.navigate(['/auth/login']);
    this.auth.logout().subscribe({ next: leave, error: leave });
  }
}
