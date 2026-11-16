import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { Invitation, InvitationsApi } from '../../core/api/workspace.api';
import { Role } from '../../core/auth/auth.models';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';

export interface InviteDialogData {
  readonly roles: readonly Role[];
}

@Component({
  selector: 'app-invite-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'users.invite.title' | transloco }}</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="form-stack">
        <p class="dialog-lead">{{ 'users.invite.body' | transloco }}</p>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="off" cdkFocusInitial />
          <mat-error>{{ form.controls.email | fieldError }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'users.role' | transloco }}</mat-label>
          <mat-select formControlName="role">
            @for (role of data.roles; track role) {
              <mat-option [value]="role">{{ 'roles.' + role | transloco }}</mat-option>
            }
          </mat-select>
          <mat-hint>{{ 'users.roleHints.' + form.controls.role.value | transloco }}</mat-hint>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'users.invite.submit' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class InviteDialog {
  protected readonly data = inject<InviteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<InviteDialog, Invitation>>(MatDialogRef);
  private readonly api = inject(InvitationsApi);
  private readonly notifier = inject(Notifier);

  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    role: ['Agent' as Role, [Validators.required]],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, role } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.api.create(email, role).subscribe({
      next: (invitation) => this.dialogRef.close(invitation),
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
