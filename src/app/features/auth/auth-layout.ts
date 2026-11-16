import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { PublicHeader } from '../../layout/public-header';

/** Centred card shared by every sign-in and sign-up screen. */
@Component({
  selector: 'app-auth-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, PublicHeader],
  template: `
    <app-public-header />
    <main class="page">
      <mat-card appearance="outlined" class="card">
        <h1>{{ heading() }}</h1>
        @if (subheading(); as text) {
          <p class="subheading">{{ text }}</p>
        }
        <ng-content />
      </mat-card>
    </main>
  `,
  styles: `
    .page {
      display: grid;
      justify-items: center;
      padding: 48px 16px;
    }

    .card {
      inline-size: 100%;
      max-inline-size: 440px;
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
      .page {
        padding: 24px 12px;
      }

      .card {
        padding: 24px 20px;
      }
    }
  `,
})
export class AuthLayout {
  readonly heading = input.required<string>();
  readonly subheading = input<string>();
}
