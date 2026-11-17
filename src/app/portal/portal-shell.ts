import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { CanActivateFn, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { PreferencesControls } from '../layout/preferences-controls';
import { brandTokens } from '../shared/brand';
import { PortalService } from './portal.service';

/** Loads the workspace behind the help centre and restores the customer's session before any page shows. */
export const portalWorkspaceGuard: CanActivateFn = async (route) => {
  const portal = inject(PortalService);
  const slug = route.paramMap.get('tenantSlug') ?? '';
  try {
    portal.info.set(await firstValueFrom(portal.loadInfo(slug)));
  } catch {
    portal.info.set(null);
    return true;
  }

  await portal.restore(slug);
  return true;
};

export const portalAuthGuard: CanActivateFn = (route) => {
  const portal = inject(PortalService);
  const slug =
    route.pathFromRoot.map((part) => part.paramMap.get('tenantSlug')).find(Boolean) ?? '';
  return portal.isAuthenticated() ? true : inject(Router).createUrlTree(['/portal', slug, 'login']);
};

@Component({
  selector: 'app-portal-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    PreferencesControls,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    TranslocoPipe,
  ],
  template: `
    @if (portal.info(); as info) {
      <a class="skip-link" href="#main" (click)="skipToMain($event)">{{
        'common.skipToContent' | transloco
      }}</a>
      <mat-toolbar class="header">
        <a
          class="brand"
          [routerLink]="base()"
          [attr.aria-label]="'portal.home' | transloco: { name: info.name }"
        >
          @if (info.logoUrl) {
            <img class="logo" [src]="info.logoUrl" alt="" />
          } @else {
            <mat-icon aria-hidden="true">support_agent</mat-icon>
          }
          <span>{{ info.name }}</span>
        </a>
        <span class="spacer"></span>
        @if (portal.isAuthenticated()) {
          <a
            mat-button
            class="wide-only"
            [routerLink]="[base(), 'tickets']"
            routerLinkActive="active"
          >
            {{ 'portal.nav.requests' | transloco }}
          </a>
        }
        <app-preferences-controls />
        @if (portal.isAuthenticated()) {
          <button mat-button type="button" (click)="signOut()">
            {{ 'nav.signOut' | transloco }}
          </button>
        } @else {
          <a mat-flat-button [routerLink]="[base(), 'login']">{{ 'nav.signIn' | transloco }}</a>
        }
      </mat-toolbar>
      <main id="main" class="content" tabindex="-1">
        <router-outlet />
      </main>
      <footer>{{ 'portal.poweredBy' | transloco }}</footer>
    } @else {
      <main class="content">
        <div class="empty-state">
          <mat-icon aria-hidden="true">search_off</mat-icon>
          <h1>{{ 'portal.notFoundTitle' | transloco }}</h1>
          <p>{{ 'portal.notFoundBody' | transloco }}</p>
        </div>
      </main>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-block-size: 100dvh;
    }

    .header {
      gap: 8px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .brand {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-inline-size: 0;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-title-large);
      font-weight: 600;
      text-decoration: none;
    }

    .logo {
      block-size: 36px;
      inline-size: auto;
      max-inline-size: 160px;
      object-fit: contain;
    }

    .brand span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .spacer {
      flex: 1 1 auto;
    }

    .content {
      flex: 1 1 auto;
      inline-size: 100%;
      max-inline-size: 880px;
      margin-inline: auto;
      padding: 32px 16px;
      box-sizing: border-box;
    }

    .empty-state h1 {
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-on-surface);
      margin: 0;
    }

    footer {
      padding: 16px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    @media (max-width: 600px) {
      .wide-only {
        display: none;
      }

      .brand {
        font: var(--mat-sys-title-medium);
      }
    }
  `,
})
export class PortalShell {
  protected readonly portal = inject(PortalService);
  private readonly router = inject(Router);

  readonly tenantSlug = input.required<string>();
  protected readonly base = computed(() => `/portal/${this.tenantSlug()}`);

  constructor() {
    // On the root, so menus and dialogs, which render outside this component, take the colour too.
    const root = inject(DOCUMENT).documentElement;
    let applied: string[] = [];
    const clear = () => applied.forEach((name) => root.style.removeProperty(name));
    effect(() => {
      clear();
      const tokens = brandTokens(this.portal.info()?.brandColor);
      applied = Object.keys(tokens);
      applied.forEach((name) => root.style.setProperty(name, tokens[name]));
    });
    inject(DestroyRef).onDestroy(clear);
  }

  protected skipToMain(event: Event): void {
    event.preventDefault();
    document.getElementById('main')?.focus();
  }

  protected signOut(): void {
    const leave = () => void this.router.navigate([this.base()]);
    this.portal.logout().subscribe({ next: leave, error: leave });
  }
}

/** A centred card used by the help centre's sign-in and form pages. */
@Component({
  selector: 'app-portal-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule],
  template: `
    <mat-card appearance="outlined" class="card">
      <h1>{{ heading() }}</h1>
      @if (subheading(); as text) {
        <p class="subheading">{{ text }}</p>
      }
      <ng-content />
    </mat-card>
  `,
  styles: `
    :host {
      display: grid;
      justify-items: center;
    }

    .card {
      inline-size: 100%;
      max-inline-size: 480px;
      padding: 32px;
      box-sizing: border-box;
    }

    h1 {
      font: var(--mat-sys-headline-small);
      margin: 0 0 8px;
    }

    .subheading {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 24px;
    }

    @media (max-width: 480px) {
      .card {
        padding: 24px 20px;
      }
    }
  `,
})
export class PortalCard {
  readonly heading = input.required<string>();
  readonly subheading = input<string>();
}
