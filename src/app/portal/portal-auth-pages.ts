import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { toProblem } from '../core/http/problem';
import { FieldErrorPipe } from '../core/ui/field-error.pipe';
import { applyServerErrors, matches, passwordStrength } from '../core/ui/form-errors';
import { Notifier } from '../core/ui/notifier';
import { PortalCard } from './portal-shell';
import { PortalService } from './portal.service';

const FORM_IMPORTS = [
  FieldErrorPipe,
  MatButtonModule,
  MatFormFieldModule,
  MatInputModule,
  PortalCard,
  ReactiveFormsModule,
  RouterLink,
  TranslocoPipe,
] as const;

/** What every help-centre form page needs: the workspace, navigation and translated error text. */
abstract class PortalPage {
  protected readonly portal = inject(PortalService);
  protected readonly router = inject(Router);
  protected readonly notifier = inject(Notifier);
  protected readonly formBuilder = inject(NonNullableFormBuilder);

  protected readonly slug = computed(() => this.portal.info()?.slug ?? '');
  protected readonly base = computed(() => `/portal/${this.slug()}`);
  protected readonly workspace = computed(() => this.portal.info()?.name ?? '');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected fail(failure: unknown): void {
    this.error.set(this.notifier.problemMessage(toProblem(failure)));
    this.submitting.set(false);
  }
}

@Component({
  selector: 'app-portal-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_IMPORTS],
  template: `
    <app-portal-card
      [heading]="'auth.login.title' | transloco"
      [subheading]="'portal.login.subtitle' | transloco: { name: workspace() }"
    >
      <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="username" />
          <mat-error>{{ form.controls.email | fieldError }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.password' | transloco }}</mat-label>
          <input
            matInput
            type="password"
            formControlName="password"
            autocomplete="current-password"
          />
          <mat-error>{{ form.controls.password | fieldError }}</mat-error>
        </mat-form-field>
        <a class="form-link end" [routerLink]="[base(), 'forgot-password']">
          {{ 'auth.login.forgot' | transloco }}
        </a>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'auth.login.submit' | transloco }}
        </button>
      </form>
      <p class="form-footer">
        {{ 'portal.login.noAccount' | transloco }}
        <a [routerLink]="[base(), 'register']">{{ 'portal.register.submit' | transloco }}</a>
      </p>
    </app-portal-card>
  `,
})
export class PortalLogin extends PortalPage {
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.portal.login(this.slug(), email, password).subscribe({
      next: () => void this.router.navigate([this.base(), 'tickets']),
      error: (failure: unknown) => this.fail(failure),
    });
  }
}

@Component({
  selector: 'app-portal-register',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_IMPORTS],
  template: `
    @if (sentTo(); as email) {
      <app-portal-card
        [heading]="'auth.verify.inboxTitle' | transloco"
        [subheading]="'portal.register.sent' | transloco: { email }"
      >
        <p class="form-footer">
          <a [routerLink]="[base(), 'login']">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      </app-portal-card>
    } @else {
      <app-portal-card
        [heading]="'portal.register.title' | transloco"
        [subheading]="'portal.register.subtitle' | transloco: { name: workspace() }"
      >
        <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (error(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.fields.fullName' | transloco }}</mat-label>
            <input matInput formControlName="fullName" autocomplete="name" />
            <mat-error>{{ form.controls.fullName | fieldError }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" />
            <mat-error>{{ form.controls.email | fieldError }}</mat-error>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ 'portal.register.submit' | transloco }}
          </button>
        </form>
        <p class="form-footer">
          {{ 'auth.register.haveAccount' | transloco }}
          <a [routerLink]="[base(), 'login']">{{ 'nav.signIn' | transloco }}</a>
        </p>
      </app-portal-card>
    }
  `,
})
export class PortalRegister extends PortalPage {
  protected readonly sentTo = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, email } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.portal.register(this.slug(), fullName, email).subscribe({
      next: () => this.sentTo.set(email),
      error: (failure: unknown) => {
        if (applyServerErrors(this.form, toProblem(failure))) {
          this.submitting.set(false);
        } else {
          this.fail(failure);
        }
      },
    });
  }
}

@Component({
  selector: 'app-portal-forgot-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_IMPORTS],
  template: `
    @if (sentTo(); as email) {
      <app-portal-card
        [heading]="'auth.forgot.sentTitle' | transloco"
        [subheading]="'auth.forgot.sentBody' | transloco: { email }"
      >
        <p class="form-footer">
          <a [routerLink]="[base(), 'login']">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      </app-portal-card>
    } @else {
      <app-portal-card
        [heading]="'auth.forgot.title' | transloco"
        [subheading]="'portal.forgot.subtitle' | transloco"
      >
        <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (error(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" />
            <mat-error>{{ form.controls.email | fieldError }}</mat-error>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ 'auth.forgot.submit' | transloco }}
          </button>
        </form>
        <p class="form-footer">
          <a [routerLink]="[base(), 'login']">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      </app-portal-card>
    }
  `,
})
export class PortalForgotPassword extends PortalPage {
  protected readonly sentTo = signal<string | null>(null);
  protected readonly form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.portal.forgotPassword(this.slug(), email).subscribe({
      next: () => this.sentTo.set(email),
      error: (failure: unknown) => this.fail(failure),
    });
  }
}

@Component({
  selector: 'app-portal-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...FORM_IMPORTS],
  template: `
    <app-portal-card
      [heading]="'portal.setPassword.title' | transloco"
      [subheading]="'portal.setPassword.subtitle' | transloco: { name: workspace() }"
    >
      <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">
            {{ message }}
            <a [routerLink]="[base(), 'forgot-password']">{{
              'auth.reset.requestNew' | transloco
            }}</a>
          </p>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.newPassword' | transloco }}</mat-label>
          <input
            matInput
            type="password"
            formControlName="newPassword"
            autocomplete="new-password"
            (input)="form.controls.confirmPassword.updateValueAndValidity()"
          />
          <mat-hint>{{ 'auth.fields.passwordHint' | transloco }}</mat-hint>
          <mat-error>{{ form.controls.newPassword | fieldError }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.confirmPassword' | transloco }}</mat-label>
          <input
            matInput
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
          />
          <mat-error>{{ form.controls.confirmPassword | fieldError }}</mat-error>
        </mat-form-field>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'auth.reset.submit' | transloco }}
        </button>
      </form>
    </app-portal-card>
  `,
})
export class PortalResetPassword extends PortalPage {
  readonly token = input<string>();
  protected readonly form = this.formBuilder.group({
    newPassword: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128), passwordStrength],
    ],
    confirmPassword: ['', [Validators.required, matches('newPassword')]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.portal
      .resetPassword(this.slug(), this.token() ?? '', this.form.getRawValue().newPassword)
      .subscribe({
        next: () => {
          this.notifier.success('portal.setPassword.success');
          void this.router.navigate([this.base(), 'login']);
        },
        error: (failure: unknown) => this.fail(failure),
      });
  }
}
