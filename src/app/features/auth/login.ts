import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthLayout,
    FieldErrorPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <app-auth-layout
      [heading]="'auth.login.title' | transloco"
      [subheading]="'auth.login.subtitle' | transloco"
    >
      <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">
            {{ message }}
            @if (needsVerification()) {
              <a routerLink="/auth/verify-email">{{ 'auth.login.resendLink' | transloco }}</a>
            }
          </p>
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
            formControlName="password"
            autocomplete="current-password"
            [type]="showPassword() ? 'text' : 'password'"
          />
          <button
            mat-icon-button
            matSuffix
            type="button"
            [attr.aria-label]="
              (showPassword() ? 'auth.fields.hidePassword' : 'auth.fields.showPassword') | transloco
            "
            [attr.aria-pressed]="showPassword()"
            (click)="showPassword.set(!showPassword())"
          >
            <mat-icon aria-hidden="true">
              {{ showPassword() ? 'visibility_off' : 'visibility' }}
            </mat-icon>
          </button>
          <mat-error>{{ form.controls.password | fieldError }}</mat-error>
        </mat-form-field>

        <a class="form-link end" routerLink="/auth/forgot-password">
          {{ 'auth.login.forgot' | transloco }}
        </a>

        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'auth.login.submit' | transloco }}
        </button>
      </form>

      <p class="form-footer">
        {{ 'auth.login.noAccount' | transloco }}
        <a routerLink="/auth/register">{{ 'auth.login.createWorkspace' | transloco }}</a>
      </p>
    </app-auth-layout>
  `,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  readonly returnUrl = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly needsVerification = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.needsVerification.set(false);

    this.auth.login(email, password).subscribe({
      next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())),
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        if (problem.code === 'email-not-verified') {
          this.needsVerification.set(true);
          this.auth.pendingVerificationEmail.set(email);
        }

        this.error.set(this.notifier.problemMessage(problem));
        this.submitting.set(false);
      },
    });
  }
}
