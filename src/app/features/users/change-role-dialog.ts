import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { TranslocoPipe } from '@jsverse/transloco';
import { User } from '../../core/api/workspace.api';
import { Role } from '../../core/auth/auth.models';

export interface ChangeRoleDialogData {
  readonly user: User;
  readonly roles: readonly Role[];
}

@Component({
  selector: 'app-change-role-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, MatButtonModule, MatDialogModule, MatRadioModule, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>
      {{ 'users.changeRole.title' | transloco: { name: data.user.fullName } }}
    </h2>
    <mat-dialog-content>
      <mat-radio-group
        class="roles"
        [attr.aria-label]="'users.role' | transloco"
        [ngModel]="role()"
        (ngModelChange)="role.set($event)"
      >
        @for (option of data.roles; track option) {
          <mat-radio-button [value]="option">
            <span class="role-name">{{ 'roles.' + option | transloco }}</span>
            <span class="role-hint">{{ 'users.roleHints.' + option | transloco }}</span>
          </mat-radio-button>
        }
      </mat-radio-group>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
      <button
        mat-flat-button
        type="button"
        [disabled]="role() === data.user.role"
        [mat-dialog-close]="role()"
      >
        {{ 'common.save' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .roles {
      display: grid;
      gap: 8px;
    }

    .role-name {
      display: block;
      font: var(--mat-sys-title-small);
    }

    .role-hint {
      display: block;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ChangeRoleDialog {
  protected readonly data = inject<ChangeRoleDialogData>(MAT_DIALOG_DATA);
  protected readonly role = signal<Role>(this.data.user.role);
}
