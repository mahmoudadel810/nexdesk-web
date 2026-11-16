import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'app-forgot-password',
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
    @if (sentTo(); as email) {
      <app-auth-layout
        [heading]="'auth.forgot.sentTitle' | transloco"
        [subheading]="'auth.forgot.sentBody' | transloco: { email }"
      >
        <p class="form-footer">
          <a routerLink="/auth/login">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      </app-auth-layout>
    } @else {
      <app-auth-layout
        [heading]="'auth.forgot.title' | transloco"
        [subheading]="'auth.forgot.subtitle' | transloco"
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
          <a routerLink="/auth/login">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      </app-auth-layout>
    }
  `,
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);
  private readonly notifier = inject(Notifier);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly sentTo = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.forgotPassword(email).subscribe({
      next: () => this.sentTo.set(email),
      error: (failure: unknown) => {
        this.error.set(this.notifier.problemMessage(toProblem(failure)));
        this.submitting.set(false);
      },
    });
  }
}
