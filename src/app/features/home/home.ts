import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatCardModule, TranslocoPipe],
  template: `
    @if (auth.session(); as session) {
      <h1>{{ 'home.welcome' | transloco: { name: session.user.fullName } }}</h1>
      @if (session.tenant; as tenant) {
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ tenant.name }}</mat-card-title>
            <mat-card-subtitle>{{ 'home.workspaceCard' | transloco }}</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <dl>
              <dt>{{ 'home.address' | transloco }}</dt>
              <dd dir="ltr">{{ tenant.slug }}</dd>
              <dt>{{ 'home.role' | transloco }}</dt>
              <dd>{{ 'roles.' + session.user.role | transloco }}</dd>
              <dt>{{ 'home.timezone' | transloco }}</dt>
              <dd dir="ltr">{{ tenant.timezone }}</dd>
            </dl>
          </mat-card-content>
        </mat-card>
      }
    }
  `,
  styles: `
    h1 {
      font: var(--mat-sys-headline-medium);
      margin: 0 0 24px;
    }

    mat-card {
      max-inline-size: 520px;
    }

    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 24px;
      margin: 16px 0 0;
    }

    dt {
      color: var(--mat-sys-on-surface-variant);
    }

    dd {
      margin: 0;
      text-align: start;
    }
  `,
})
export class Home {
  protected readonly auth = inject(AuthService);
}
