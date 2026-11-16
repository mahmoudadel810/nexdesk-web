import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PublicHeader } from '../../layout/public-header';

interface Highlight {
  readonly icon: string;
  readonly key: string;
}

@Component({
  selector: 'app-landing',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, MatIconModule, PublicHeader, TranslocoPipe],
  template: `
    <app-public-header />
    <main class="page">
      <section class="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">{{ 'landing.title' | transloco }}</h1>
        <p class="lead">{{ 'landing.subtitle' | transloco }}</p>
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
  protected readonly highlights: readonly Highlight[] = [
    { icon: 'confirmation_number', key: 'tickets' },
    { icon: 'timer', key: 'sla' },
    { icon: 'bolt', key: 'automation' },
    { icon: 'menu_book', key: 'knowledge' },
  ];
}
