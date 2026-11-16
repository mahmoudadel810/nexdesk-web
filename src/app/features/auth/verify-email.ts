import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { AuthLayout } from './auth-layout';

type Stage = 'verifying' | 'failed' | 'inbox';

@Component({
  selector: 'app-verify-email',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AuthLayout,
    FieldErrorPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    @switch (stage()) {
      @case ('verifying') {
        <app-auth-layout [heading]="'auth.verify.verifyingTitle' | transloco">
          <div class="center" role="status">
            <mat-spinner
              diameter="40"
              [attr.aria-label]="'auth.verify.verifyingTitle' | transloco"
            />
          </div>
        </app-auth-layout>
      }
      @default {
        <app-auth-layout
          [heading]="
            (stage() === 'failed' ? 'auth.verify.failedTitle' : 'auth.verify.inboxTitle')
              | transloco
          "
          [subheading]="
            stage() === 'failed'
              ? ('auth.verify.failedBody' | transloco)
              : auth.pendingVerificationEmail()
                ? ('auth.verify.inboxBody' | transloco: { email: auth.pendingVerificationEmail() })
                : ('auth.verify.inboxBodyNoEmail' | transloco)
          "
        >
          <form class="form-stack" [formGroup]="form" (ngSubmit)="resend()" novalidate>
            @if (notice(); as message) {
              <p class="form-notice" role="status">{{ message }}</p>
            }

            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
              <input matInput type="email" formControlName="email" autocomplete="username" />
              <mat-error>{{ form.controls.email | fieldError }}</mat-error>
            </mat-form-field>

            <button mat-flat-button type="submit" [disabled]="submitting()">
              {{ 'auth.verify.resend' | transloco }}
            </button>
          </form>

          <p class="form-footer">
            <a routerLink="/auth/login">{{ 'auth.backToSignIn' | transloco }}</a>
          </p>
        </app-auth-layout>
      }
    }
  `,
  styles: `
    .center {
      display: grid;
      place-items: center;
      padding-block: 24px;
    }
  `,
})
export class VerifyEmail implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  readonly token = input<string>();

  protected readonly stage = signal<Stage>('inbox');
  protected readonly submitting = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: [this.auth.pendingVerificationEmail() ?? '', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      return;
    }

    this.stage.set('verifying');
    this.auth.verifyEmail(token).subscribe({
      next: () => {
        this.notifier.success('auth.verify.success');
        void this.router.navigate(['/app']);
      },
      error: () => this.stage.set('failed'),
    });
  }

  protected resend(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.notice.set(null);
    this.auth.resendVerification(this.form.getRawValue().email).subscribe({
      next: () => {
        this.notice.set(this.notifier.translate('auth.verify.resent'));
        this.submitting.set(false);
      },
      error: (failure: unknown) => {
        this.notice.set(this.notifier.problemMessage(toProblem(failure)));
        this.submitting.set(false);
      },
    });
  }
}
