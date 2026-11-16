import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, switchMap } from 'rxjs';
import { Team, TeamsApi, User } from '../../core/api/workspace.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';

export interface TeamDialogData {
  readonly team: Team | null;
  readonly users: readonly User[];
}

@Component({
  selector: 'app-team-dialog',
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
    <h2 mat-dialog-title>
      {{ (data.team ? 'teams.dialog.editTitle' : 'teams.dialog.createTitle') | transloco }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="form-stack">
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }

        <mat-form-field appearance="outline">
          <mat-label>{{ 'teams.name' | transloco }}</mat-label>
          <input matInput formControlName="name" cdkFocusInitial />
          <mat-error>{{ form.controls.name | fieldError }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'teams.description' | transloco }}</mat-label>
          <textarea matInput rows="2" formControlName="description"></textarea>
          <mat-error>{{ form.controls.description | fieldError }}</mat-error>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'teams.members' | transloco }}</mat-label>
          <mat-select formControlName="memberIds" multiple>
            @for (user of data.users; track user.id) {
              <mat-option [value]="user.id">{{ user.fullName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'common.save' | transloco }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class TeamDialog {
  protected readonly data = inject<TeamDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<TeamDialog, Team>>(MatDialogRef);
  private readonly api = inject(TeamsApi);
  private readonly notifier = inject(Notifier);

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: [this.data.team?.name ?? '', [Validators.required, Validators.maxLength(80)]],
    description: [this.data.team?.description ?? '', [Validators.maxLength(300)]],
    memberIds: [this.data.team?.members.map((member) => member.userId) ?? []],
  });
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.save().subscribe({
      next: (team) => this.dialogRef.close(team),
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        if (!applyServerErrors(this.form, problem)) {
          this.error.set(this.notifier.problemMessage(problem));
        }

        this.submitting.set(false);
      },
    });
  }

  private save(): Observable<Team> {
    const { name, description, memberIds } = this.form.getRawValue();
    const team = this.data.team;
    return team
      ? this.api
          .update(team.id, name, description || null)
          .pipe(switchMap(() => this.api.setMembers(team.id, memberIds)))
      : this.api.create(name, description || null, memberIds);
  }
}
