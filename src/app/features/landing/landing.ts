import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PublicHeader } from '../../layout/public-header';

interface Highlight {
  readonly icon: string;
  readonly key: string;
}

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, PublicHeader, RouterLink, TranslocoPipe],
  template: `
    <app-public-header />
    <main class="page">
      <section class="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">{{ 'landing.title' | transloco }}</h1>
        <p class="lead">{{ 'landing.subtitle' | transloco }}</p>
        <p class="hero-actions">
          <a mat-flat-button routerLink="/auth/register">{{ 'nav.getStarted' | transloco }}</a>
          <a mat-button href="#pricing">{{ 'nav.pricing' | transloco }}</a>
        </p>
      </section>

      <section class="highlights" [attr.aria-label]="'landing.highlightsLabel' | transloco">
        @for (highlight of highlights; track highlight.key) {
          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-icon mat-card-avatar aria-hidden="true">{{ highlight.icon }}</mat-icon>
              <mat-card-title>
                {{ 'landing.highlights.' + highlight.key + '.title' | transloco }}
              </mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p>{{ 'landing.highlights.' + highlight.key + '.body' | transloco }}</p>
            </mat-card-content>
          </mat-card>
        }
      </section>

      <section id="pricing" class="pricing" aria-labelledby="pricing-title">
        <h2 id="pricing-title">{{ 'landing.pricing.title' | transloco }}</h2>
        <p class="lead">{{ 'landing.pricing.subtitle' | transloco }}</p>
        <div class="plans">
          @for (plan of plans; track plan.key) {
            <mat-card appearance="outlined" class="plan" [class.featured]="plan.featured">
              @if (plan.featured) {
                <span class="ribbon">{{ 'landing.pricing.popular' | transloco }}</span>
              }
              <h3>{{ 'landing.pricing.plans.' + plan.key + '.name' | transloco }}</h3>
              <p class="tagline">
                {{ 'landing.pricing.plans.' + plan.key + '.tagline' | transloco }}
              </p>
              <p class="price">
                <strong dir="ltr">{{
                  'landing.pricing.plans.' + plan.key + '.price' | transloco
                }}</strong>
                <span>{{ 'landing.pricing.perMonth' | transloco }}</span>
              </p>
              <ul>
                @for (
                  feature of 'landing.pricing.plans.' + plan.key + '.features' | transloco;
                  track feature
                ) {
                  <li>
                    <mat-icon aria-hidden="true">check</mat-icon>
                    <span>{{ feature }}</span>
                  </li>
                }
              </ul>
              <a routerLink="/auth/register" class="plan-cta" [class.primary]="plan.featured">
                {{
                  'landing.pricing.cta'
                    | transloco
                      : { plan: ('landing.pricing.plans.' + plan.key + '.name' | transloco) }
                }}
              </a>
            </mat-card>
          }
        </div>
      </section>
    </main>
  `,
  styles: `
    .page {
      max-inline-size: 1080px;
      margin-inline: auto;
      padding: 48px 24px 72px;
    }

    .hero {
      text-align: center;
      margin-block-end: 48px;
    }

    h1 {
      font: var(--mat-sys-display-small);
      margin: 0 0 16px;
    }

    .lead {
      font: var(--mat-sys-title-medium);
      color: var(--mat-sys-on-surface-variant);
      max-inline-size: 640px;
      margin: 0 auto;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin: 24px 0 0;
    }

    .pricing {
      margin-block-start: 72px;
      text-align: center;
      scroll-margin-block-start: 80px;
    }

    .pricing h2 {
      font: var(--mat-sys-headline-medium);
      margin: 0 0 8px;
    }

    .plans {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-block-start: 32px;
      text-align: start;
      align-items: stretch;
    }

    .plan {
      position: relative;
      display: flex;
      flex-direction: column;
      padding: 24px;
    }

    .plan.featured {
      border-color: var(--mat-sys-primary);
      border-width: 2px;
    }

    .ribbon {
      position: absolute;
      inset-block-start: 12px;
      inset-inline-end: 12px;
      padding: 2px 10px;
      border-radius: 12px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font: var(--mat-sys-label-medium);
    }

    .plan h3 {
      font: var(--mat-sys-title-large);
      margin: 0;
    }

    .tagline {
      color: var(--mat-sys-on-surface-variant);
      margin: 4px 0 16px;
    }

    .price {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin: 0 0 16px;
    }

    .price strong {
      font: var(--mat-sys-display-small);
    }

    .price span {
      color: var(--mat-sys-on-surface-variant);
    }

    .plan ul {
      list-style: none;
      margin: 0 0 24px;
      padding: 0;
      display: grid;
      gap: 8px;
      flex: 1 1 auto;
      align-content: start;
    }

    .plan li {
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }

    .plan li mat-icon {
      color: var(--mat-sys-primary);
      flex: 0 0 auto;
    }

    .plan-cta {
      display: block;
      text-align: center;
      text-decoration: none;
      padding: 10px 16px;
      border-radius: 20px;
      border: 1px solid var(--mat-sys-outline);
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
    }

    .plan-cta.primary {
      background: var(--mat-sys-primary);
      border-color: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
    }

    .plan-cta:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .highlights {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
    }

    mat-icon[mat-card-avatar] {
      display: grid;
      place-items: center;
      color: var(--mat-sys-primary);
    }

    @media (max-width: 600px) {
      .page {
        padding: 32px 16px 48px;
      }

      h1 {
        font: var(--mat-sys-headline-medium);
      }
    }
  `,
})
export class Landing {
  protected readonly plans: readonly { key: string; featured: boolean }[] = [
    { key: 'free', featured: false },
    { key: 'pro', featured: true },
    { key: 'business', featured: false },
  ];

  protected readonly highlights: readonly Highlight[] = [
    { icon: 'confirmation_number', key: 'tickets' },
    { icon: 'timer', key: 'sla' },
    { icon: 'bolt', key: 'automation' },
    { icon: 'menu_book', key: 'knowledge' },
  ];
}
