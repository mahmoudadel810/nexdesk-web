import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { InvitationPreview, InvitationsApi } from '../../core/api/workspace.api';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors, passwordStrength } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';
import { AuthLayout } from './auth-layout';

@Component({
  selector: 'app-accept-invite',
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
    @if (preview(); as invitation) {
      <app-auth-layout
        [heading]="'auth.invite.title' | transloco: { workspace: invitation.workspaceName }"
        [subheading]="
          'auth.invite.subtitle'
            | transloco: { email: invitation.email, role: ('roles.' + invitation.role | transloco) }
        "
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
            <mat-label>{{ 'auth.fields.password' | transloco }}</mat-label>
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
            <mat-hint>{{ 'auth.fields.passwordHint' | transloco }}</mat-hint>
            <mat-error>{{ form.controls.password | fieldError }}</mat-error>
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ 'auth.invite.submit' | transloco }}
          </button>
        </form>
      </app-auth-layout>
    } @else if (invalid()) {
      <app-auth-layout
        [heading]="'auth.invite.invalidTitle' | transloco"
        [subheading]="'auth.invite.invalidBody' | transloco"
      >
        <p class="form-footer">
          <a routerLink="/auth/login">{{ 'auth.backToSignIn' | transloco }}</a>
        </p>
      </app-auth-layout>
    } @else {
      <app-auth-layout [heading]="'auth.invite.loading' | transloco">
        <div class="center" role="status">
          <mat-spinner diameter="40" [attr.aria-label]="'auth.invite.loading' | transloco" />
        </div>
      </app-auth-layout>
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
export class AcceptInvite implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly invitationsApi = inject(InvitationsApi);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);

  readonly token = input<string>();

  protected readonly preview = signal<InvitationPreview | null>(null);
  protected readonly invalid = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, Validators.maxLength(100)]],
    password: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128), passwordStrength],
    ],
  });

  ngOnInit(): void {
    const token = this.token();
    if (!token) {
      this.invalid.set(true);
      return;
    }

    this.invitationsApi.lookup(token).subscribe({
      next: (preview) => this.preview.set(preview),
      error: () => this.invalid.set(true),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { fullName, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.acceptInvitation(this.token() ?? '', fullName, password).subscribe({
      next: () => {
        this.notifier.success('auth.invite.done');
        void this.router.navigate(['/app']);
      },
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
