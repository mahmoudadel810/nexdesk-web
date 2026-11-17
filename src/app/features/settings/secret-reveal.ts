import { Clipboard } from '@angular/cdk/clipboard';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

/** A secret the API returns only once, with a copy button and a warning that it will not show again. */
@Component({
  selector: 'app-secret-reveal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, TranslocoPipe],
  template: `
    <div class="form-notice" role="note">
      <mat-icon aria-hidden="true">key</mat-icon>
      <span>{{ 'developers.secret.onlyOnce' | transloco }}</span>
    </div>
    <div class="secret">
      <code dir="ltr" [attr.aria-label]="label()">{{ value() }}</code>
      <button mat-stroked-button type="button" (click)="copy()">
        <mat-icon aria-hidden="true">{{ copied() ? 'check' : 'content_copy' }}</mat-icon>
        {{ (copied() ? 'developers.secret.copied' : 'developers.secret.copy') | transloco }}
      </button>
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 12px;
    }

    .form-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .secret {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    code {
      flex: 1 1 260px;
      min-inline-size: 0;
      padding: 10px 12px;
      border-radius: 8px;
      background: var(--mat-sys-surface-container-high);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.9em;
      overflow-wrap: anywhere;
      user-select: all;
    }
  `,
})
export class SecretReveal {
  private readonly clipboard = inject(Clipboard);

  readonly value = input.required<string>();
  readonly label = input<string>('');
  protected readonly copied = signal(false);

  protected copy(): void {
    this.copied.set(this.clipboard.copy(this.value()));
  }
}

export interface SecretDialogData {
  readonly title: string;
  readonly lead: string;
  readonly secret: string;
}

/** Shows a freshly created or rotated secret once. */
@Component({
  selector: 'app-secret-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatDialogModule, SecretReveal, TranslocoPipe],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content class="form-stack">
      <p class="dialog-lead">{{ data.lead }}</p>
      <app-secret-reveal [value]="data.secret" [label]="data.title" />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" mat-dialog-close>
        {{ 'developers.secret.done' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
})
export class SecretDialog {
  protected readonly data = inject<SecretDialogData>(MAT_DIALOG_DATA);
}
