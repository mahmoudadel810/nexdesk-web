import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { API_SCOPES, ApiScope, DeveloperApi, IssuedApiKey } from '../../core/api/developer.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { SecretReveal } from './secret-reveal';

/** Days a key works for; 0 stands for "never expires", since a select shows null as empty. */
const NEVER = 0;
const LIFETIMES = [NEVER, 30, 90, 365] as const;

/** Issues an API key, then shows it once. Closes with the issued key so the list can refresh. */
@Component({
  selector: 'app-api-key-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    SecretReveal,
    TranslocoPipe,
  ],
  template: `
    @if (issued(); as result) {
      <h2 mat-dialog-title>{{ 'developers.keys.issuedTitle' | transloco }}</h2>
      <mat-dialog-content class="form-stack">
        <p class="dialog-lead">
          {{ 'developers.keys.issuedLead' | transloco: { name: result.apiKey.name } }}
        </p>
        <app-secret-reveal [value]="result.key" [label]="result.apiKey.name" />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button type="button" (click)="dialogRef.close(result)">
          {{ 'developers.secret.done' | transloco }}
        </button>
      </mat-dialog-actions>
    } @else {
      <h2 mat-dialog-title>{{ 'developers.keys.newTitle' | transloco }}</h2>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-dialog-content class="form-stack">
          <p class="dialog-lead">{{ 'developers.keys.newLead' | transloco }}</p>
          @if (error(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'developers.keys.name' | transloco }}</mat-label>
            <input matInput formControlName="name" maxlength="100" autocomplete="off" />
            <mat-hint>{{ 'developers.keys.nameHint' | transloco }}</mat-hint>
            <mat-error>{{ form.controls.name | fieldError }}</mat-error>
          </mat-form-field>

          <fieldset>
            <legend>{{ 'developers.keys.scopes' | transloco }}</legend>
            @for (scope of scopes; track scope) {
              <mat-checkbox
                [checked]="chosen().includes(scope)"
                (change)="toggle(scope, $event.checked)"
              >
                <span class="scope" dir="ltr">{{ scope }}</span>
                <span class="scope-help">{{ 'developers.scopes.' + scope | transloco }}</span>
              </mat-checkbox>
            }
            @if (scopeMissing()) {
              <p class="field-error" role="alert">
                {{ 'developers.keys.scopeRequired' | transloco }}
              </p>
            }
          </fieldset>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'developers.keys.expiry' | transloco }}</mat-label>
            <mat-select formControlName="expiresInDays">
              @for (days of lifetimes; track days) {
                <mat-option [value]="days">
                  {{
                    days === 0
                      ? ('developers.keys.never' | transloco)
                      : ('developers.keys.days' | transloco: { count: days })
                  }}
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button mat-button type="button" mat-dialog-close>
            {{ 'common.cancel' | transloco }}
          </button>
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ 'developers.keys.issue' | transloco }}
          </button>
        </mat-dialog-actions>
      </form>
    }
  `,
  styles: `
    fieldset {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      border: 0;
    }

    legend {
      margin-block-end: 4px;
      font: var(--mat-sys-title-small);
    }

    .scope {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      margin-inline-end: 8px;
    }

    .scope-help {
      color: var(--mat-sys-on-surface-variant);
    }

    .field-error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class ApiKeyDialog {
  protected readonly dialogRef = inject<MatDialogRef<ApiKeyDialog, IssuedApiKey>>(MatDialogRef);
  private readonly api = inject(DeveloperApi);
  private readonly notifier = inject(Notifier);

  protected readonly scopes = API_SCOPES;
  protected readonly lifetimes = LIFETIMES;
  protected readonly chosen = signal<readonly ApiScope[]>(['tickets:read']);
  protected readonly scopeMissing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly issued = signal<IssuedApiKey | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    expiresInDays: [NEVER as number],
  });

  constructor() {
    // The key is only ever shown here, so closing by accident would lose it.
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => {
      if (!this.issued()) {
        this.dialogRef.close();
      }
    });
  }

  protected toggle(scope: ApiScope, checked: boolean): void {
    this.chosen.update((scopes) =>
      checked ? [...scopes, scope] : scopes.filter((existing) => existing !== scope),
    );
    this.scopeMissing.set(this.chosen().length === 0);
  }

  protected submit(): void {
    this.scopeMissing.set(this.chosen().length === 0);
    if (this.form.invalid || this.scopeMissing()) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, expiresInDays } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .issueKey({
        name: name.trim(),
        scopes: this.chosen(),
        expiresInDays: expiresInDays === NEVER ? null : expiresInDays,
      })
      .subscribe({
        next: (issued) => {
          this.issued.set(issued);
          this.submitting.set(false);
        },
        error: (failure: unknown) => {
          this.error.set(this.notifier.problemMessage(toProblem(failure)));
          this.submitting.set(false);
        },
      });
  }
}
