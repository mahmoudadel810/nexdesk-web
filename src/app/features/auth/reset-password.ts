import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors, matches, passwordStrength } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'app-reset-password',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthLayout,
    FieldErrorPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <app-auth-layout
      [heading]="'auth.reset.title' | transloco"
      [subheading]="'auth.reset.subtitle' | transloco"
    >
      <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">
            {{ message }}
            @if (linkExpired()) {
              <a routerLink="/auth/forgot-password">{{ 'auth.reset.requestNew' | transloco }}</a>
            }
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

      <p class="form-footer">
        <a routerLink="/auth/login">{{ 'auth.backToSignIn' | transloco }}</a>
      </p>
    </app-auth-layout>
  `,
})
export class ResetPassword {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  readonly token = input<string>();

  protected readonly form = inject(NonNullableFormBuilder).group({
    newPassword: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128), passwordStrength],
    ],
    confirmPassword: ['', [Validators.required, matches('newPassword')]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly linkExpired = signal(false);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.linkExpired.set(false);
    this.auth.resetPassword(this.token() ?? '', this.form.getRawValue().newPassword).subscribe({
      next: () => {
        this.notifier.success('auth.reset.success');
        void this.router.navigate(['/auth/login']);
      },
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        const tokenProblem = problem.code === 'invalid-token' || problem.errors?.['token'];
        this.linkExpired.set(Boolean(tokenProblem));
        if (tokenProblem || !applyServerErrors(this.form, problem)) {
          this.error.set(
            this.notifier.problemMessage(
              tokenProblem ? { ...problem, code: 'invalid-token' } : problem,
            ),
          );
        }

        this.submitting.set(false);
      },
    });
  }
}
