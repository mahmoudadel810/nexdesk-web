import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { LanguageService } from '../../core/i18n/language.service';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors, passwordStrength } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'app-register',
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
      [heading]="'auth.register.title' | transloco"
      [subheading]="'auth.register.subtitle' | transloco"
    >
      <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.workspaceName' | transloco }}</mat-label>
          <input matInput formControlName="workspaceName" autocomplete="organization" />
          <mat-hint>{{ 'auth.register.workspaceHint' | transloco }}</mat-hint>
          <mat-error>{{ form.controls.workspaceName | fieldError }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.fullName' | transloco }}</mat-label>
          <input matInput formControlName="fullName" autocomplete="name" />
          <mat-error>{{ form.controls.fullName | fieldError }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.workEmail' | transloco }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="username" />
          <mat-error>{{ form.controls.email | fieldError }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.password' | transloco }}</mat-label>
          <input
            matInput
            formControlName="password"
            autocomplete="new-password"
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
          <mat-hint>{{ 'auth.fields.passwordHint' | transloco }}</mat-hint>
          <mat-error>{{ form.controls.password | fieldError }}</mat-error>
        </mat-form-field>

        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'auth.register.submit' | transloco }}
        </button>
      </form>

      <p class="form-footer">
        {{ 'auth.register.haveAccount' | transloco }}
        <a routerLink="/auth/login">{{ 'nav.signIn' | transloco }}</a>
      </p>
    </app-auth-layout>
  `,
})
export class Register {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  private readonly language = inject(LanguageService);

  protected readonly form = inject(NonNullableFormBuilder).group({
    workspaceName: ['', [Validators.required, Validators.maxLength(100)]],
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128), passwordStrength],
    ],
  });
  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth
      .register({
        ...this.form.getRawValue(),
        language: this.language.language(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      })
      .subscribe({
        next: () => void this.router.navigate(['/auth/verify-email']),
        error: (failure: unknown) => {
          const problem = toProblem(failure);
          if (!applyServerErrors(this.form, problem)) {
            this.error.set(this.notifier.problemMessage(problem));
          }

          this.submitting.set(false);
        },
      });
  }
}
