import { BreakpointObserver } from '@angular/cdk/layout';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AVAILABILITIES, Availability, UsersApi } from '../core/api/workspace.api';
import { AuthService } from '../core/auth/auth.service';
import { TranslatedPaginatorIntl } from '../core/i18n/paginator-intl';
import { RealtimeService } from '../core/realtime/realtime.service';
import { NotificationBell } from './notification-bell';
import { PreferencesControls } from './preferences-controls';

interface NavItem {
  readonly path: string;
  readonly icon: string;
  readonly label: string;
  readonly permission?: string;
  readonly exact?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { path: '/app', icon: 'space_dashboard', label: 'nav.dashboard', exact: true },
  {
    path: '/app/tickets',
    icon: 'confirmation_number',
    label: 'nav.tickets',
    permission: 'tickets.view',
  },
  { path: '/app/kb', icon: 'menu_book', label: 'nav.knowledgeBase', permission: 'kb.view' },
  { path: '/app/reports', icon: 'bar_chart', label: 'nav.reports', permission: 'reports.view' },
  { path: '/app/users', icon: 'group', label: 'nav.users', permission: 'users.view' },
  { path: '/app/teams', icon: 'diversity_3', label: 'nav.teams', permission: 'users.view' },
  { path: '/app/settings/sla', icon: 'timer', label: 'nav.sla', permission: 'sla.manage' },
  {
    path: '/app/settings/automation',
    icon: 'bolt',
    label: 'nav.automation',
    permission: 'automation.manage',
  },
  {
    path: '/app/settings/custom-fields',
    icon: 'tune',
    label: 'nav.customFields',
    permission: 'custom-fields.manage',
  },
  {
    path: '/app/settings/developers',
    icon: 'code',
    label: 'nav.developers',
    permission: 'developer.manage',
  },
  {
    path: '/app/settings/audit',
    icon: 'history',
    label: 'nav.auditLog',
    permission: 'audit.view',
  },
  {
    path: '/app/settings/billing',
    icon: 'credit_card',
    label: 'nav.billing',
    permission: 'settings.manage',
  },
];

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  imports: [
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatMenuModule,
    MatSidenavModule,
    MatToolbarModule,
    NotificationBell,
    PreferencesControls,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoPipe,
  ],
  template: `
    <mat-toolbar class="header">
      @if (compact()) {
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'nav.toggleMenu' | transloco"
          [attr.aria-expanded]="menuOpen()"
          (click)="menuOpen.set(!menuOpen())"
        >
          <mat-icon aria-hidden="true">menu</mat-icon>
        </button>
      }
      <a class="brand" routerLink="/app" [attr.aria-label]="'nav.dashboard' | transloco">
        <mat-icon aria-hidden="true">support_agent</mat-icon>
        <span>NexDesk</span>
      </a>
      @if (auth.session()?.tenant; as tenant) {
        <span class="workspace">{{ tenant.name }}</span>
      }
      <span class="spacer"></span>
      <app-notification-bell />
      <app-preferences-controls />
      <button
        mat-icon-button
        type="button"
        class="avatar"
        [matMenuTriggerFor]="accountMenu"
        [attr.aria-label]="'nav.accountMenu' | transloco"
      >
        <span aria-hidden="true">{{ initials() }}</span>
        <span class="presence" [attr.data-availability]="availability()"></span>
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
        <button mat-menu-item type="button" [matMenuTriggerFor]="availabilityMenu">
          <mat-icon aria-hidden="true">circle</mat-icon>
          <span>{{ 'availability.' + availability() | transloco }}</span>
        </button>
        <a mat-menu-item routerLink="/app/profile">
          <mat-icon aria-hidden="true">person</mat-icon>
          <span>{{ 'nav.profile' | transloco }}</span>
        </a>
        <button mat-menu-item type="button" (click)="signOut()">
          <mat-icon aria-hidden="true">logout</mat-icon>
          <span>{{ 'nav.signOut' | transloco }}</span>
        </button>
      </mat-menu>
      <mat-menu #availabilityMenu="matMenu">
        @for (option of availabilities; track option) {
          <button
            mat-menu-item
            type="button"
            [attr.aria-current]="option === availability() ? 'true' : null"
            (click)="setAvailability(option)"
          >
            <mat-icon aria-hidden="true">{{ option === availability() ? 'check' : '' }}</mat-icon>
            <span>{{ 'availability.' + option | transloco }}</span>
          </button>
        }
      </mat-menu>
    </mat-toolbar>

    <mat-sidenav-container class="body">
      <mat-sidenav
        class="nav"
        [mode]="compact() ? 'over' : 'side'"
        [opened]="!compact() || menuOpen()"
        (closedStart)="menuOpen.set(false)"
      >
        <mat-nav-list [attr.aria-label]="'nav.mainMenu' | transloco">
          @for (item of navItems(); track item.path) {
            <a
              mat-list-item
              routerLinkActive
              #link="routerLinkActive"
              [routerLink]="item.path"
              [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
              [activated]="link.isActive"
              [attr.aria-current]="link.isActive ? 'page' : null"
              (click)="menuOpen.set(false)"
            >
              <mat-icon matListItemIcon aria-hidden="true">{{ item.icon }}</mat-icon>
              <span matListItemTitle>{{ item.label | transloco }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <main class="content">
          <router-outlet />
        </main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      block-size: 100dvh;
    }

    .header {
      flex: 0 0 auto;
      gap: 8px;
      min-inline-size: 0;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .body {
      flex: 1 1 auto;
      background: var(--mat-sys-surface);
    }

    .nav {
      inline-size: 240px;
      border-inline-end: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0;
      padding: 8px;
      box-sizing: border-box;
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
      position: relative;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
      font: var(--mat-sys-label-large);
    }

    .presence {
      position: absolute;
      inset-block-end: 4px;
      inset-inline-end: 4px;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      border: 2px solid var(--mat-sys-surface);
      background: var(--mat-sys-outline);
    }

    .presence[data-availability='Online'] {
      background: #1e8e3e;
    }

    .presence[data-availability='Away'] {
      background: #f29900;
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

      .brand span {
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
  private readonly usersApi = inject(UsersApi);
  private readonly realtime = inject(RealtimeService);

  protected readonly availabilities = AVAILABILITIES;
  protected readonly availability = signal<Availability>('Offline');
  protected readonly menuOpen = signal(false);
  protected readonly compact = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 960px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  protected readonly navItems = computed(() =>
    NAV_ITEMS.filter((item) => !item.permission || this.auth.can(item.permission)),
  );

  protected readonly initials = computed(() =>
    (this.auth.session()?.user.fullName ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join(''),
  );

  constructor() {
    void this.realtime.start();
    inject(DestroyRef).onDestroy(() => void this.realtime.stop());

    const userId = this.auth.session()?.user.id;
    if (userId) {
      this.usersApi.get(userId).subscribe((user) => {
        // Arriving while Offline means a new working session; a chosen Away survives page reloads.
        if (user.availability === 'Offline') {
          this.setAvailability('Online');
        } else {
          this.availability.set(user.availability);
        }
      });
    }
  }

  protected setAvailability(availability: Availability): void {
    this.usersApi
      .setAvailability(availability)
      .subscribe((user) => this.availability.set(user.availability));
  }

  protected signOut(): void {
    const leave = () => void this.router.navigate(['/auth/login']);
    this.usersApi.setAvailability('Offline').subscribe({
      complete: () => this.auth.logout().subscribe({ next: leave, error: leave }),
      error: () => this.auth.logout().subscribe({ next: leave, error: leave }),
    });
  }
}
