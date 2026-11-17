import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import {
  DeveloperApi,
  WEBHOOK_EVENTS,
  WebhookEndpoint,
  WebhookEvent,
  WebhookSecret,
} from '../../core/api/developer.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { SecretReveal } from './secret-reveal';

/** A full http or https address without credentials, as the API accepts it. */
export const WEBHOOK_URL_PATTERN = /^https?:\/\/[^\s/@]+(?:[/?#]\S*)?$/i;

/**
 * Adds or edits a webhook endpoint. A new endpoint's signing secret is shown before the dialog closes;
 * the dialog then closes with the saved endpoint.
 */
@Component({
  selector: 'app-webhook-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
    SecretReveal,
    TranslocoPipe,
  ],
  template: `
    @if (created(); as result) {
      <h2 mat-dialog-title>{{ 'developers.webhooks.createdTitle' | transloco }}</h2>
      <mat-dialog-content class="form-stack">
        <p class="dialog-lead">{{ 'developers.webhooks.createdLead' | transloco }}</p>
        <app-secret-reveal [value]="result.secret" [label]="result.endpoint.url" />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-flat-button type="button" (click)="dialogRef.close(result.endpoint)">
          {{ 'developers.secret.done' | transloco }}
        </button>
      </mat-dialog-actions>
    } @else {
      <h2 mat-dialog-title>
        {{
          (existing ? 'developers.webhooks.editTitle' : 'developers.webhooks.newTitle') | transloco
        }}
      </h2>
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <mat-dialog-content class="form-stack">
          @if (error(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <mat-form-field appearance="outline">
            <mat-label>{{ 'developers.webhooks.url' | transloco }}</mat-label>
            <input
              matInput
              type="url"
              formControlName="url"
              dir="ltr"
              autocomplete="off"
              placeholder="https://hooks.example.com/nexdesk"
            />
            <mat-error>
              @if (form.controls.url.hasError('pattern')) {
                {{ 'developers.webhooks.urlInvalid' | transloco }}
              } @else {
                {{ form.controls.url | fieldError }}
              }
            </mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'developers.webhooks.description' | transloco }}</mat-label>
            <input matInput formControlName="description" maxlength="200" autocomplete="off" />
          </mat-form-field>

          <fieldset>
            <legend>{{ 'developers.webhooks.events' | transloco }}</legend>
            @for (event of events; track event) {
              <mat-checkbox
                [checked]="chosen().includes(event)"
                (change)="toggle(event, $event.checked)"
              >
                <span class="event" dir="ltr">{{ event }}</span>
                <span class="event-help">{{ 'developers.events.' + event | transloco }}</span>
              </mat-checkbox>
            }
            @if (eventMissing()) {
              <p class="field-error" role="alert">
                {{ 'developers.webhooks.eventRequired' | transloco }}
              </p>
            }
          </fieldset>

          @if (existing) {
            <mat-slide-toggle formControlName="isEnabled">
              {{ 'developers.webhooks.enabled' | transloco }}
            </mat-slide-toggle>
          }
        </mat-dialog-content>
        <mat-dialog-actions align="end">
          <button mat-button type="button" mat-dialog-close>
            {{ 'common.cancel' | transloco }}
          </button>
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ (existing ? 'common.save' : 'developers.webhooks.add') | transloco }}
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

    .event {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      margin-inline-end: 8px;
    }

    .event-help {
      color: var(--mat-sys-on-surface-variant);
    }

    .field-error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class WebhookDialog {
  protected readonly existing = inject<WebhookEndpoint | null>(MAT_DIALOG_DATA, { optional: true });
  protected readonly dialogRef = inject<MatDialogRef<WebhookDialog, WebhookEndpoint>>(MatDialogRef);
  private readonly api = inject(DeveloperApi);
  private readonly notifier = inject(Notifier);

  protected readonly events = WEBHOOK_EVENTS;
  protected readonly chosen = signal<readonly WebhookEvent[]>(
    this.existing?.events ?? ['ticket.created'],
  );
  protected readonly eventMissing = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly created = signal<WebhookSecret | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    url: [
      this.existing?.url ?? '',
      [Validators.required, Validators.maxLength(2000), Validators.pattern(WEBHOOK_URL_PATTERN)],
    ],
    description: [this.existing?.description ?? '', Validators.maxLength(200)],
    isEnabled: [this.existing?.isEnabled ?? true],
  });

  constructor() {
    // A new endpoint's secret is only ever shown here, so closing by accident would lose it.
    this.dialogRef.disableClose = true;
    this.dialogRef.backdropClick().subscribe(() => {
      if (!this.created()) {
        this.dialogRef.close();
      }
    });
  }

  protected toggle(event: WebhookEvent, checked: boolean): void {
    this.chosen.update((events) =>
      checked ? [...events, event] : events.filter((existing) => existing !== event),
    );
    this.eventMissing.set(this.chosen().length === 0);
  }

  protected submit(): void {
    this.eventMissing.set(this.chosen().length === 0);
    if (this.form.invalid || this.eventMissing()) {
      this.form.markAllAsTouched();
      return;
    }

    const { url, description, isEnabled } = this.form.getRawValue();
    const input = {
      url: url.trim(),
      description: description.trim() || null,
      events: this.chosen(),
    };
    this.submitting.set(true);
    this.error.set(null);

    const request: Observable<WebhookEndpoint | WebhookSecret> = this.existing
      ? this.api.updateWebhook(this.existing.id, { ...input, isEnabled })
      : this.api.createWebhook(input);
    request.subscribe({
      next: (saved) => {
        if ('secret' in saved) {
          this.created.set(saved);
          this.submitting.set(false);
        } else {
          this.dialogRef.close(saved);
        }
      },
      error: (failure: unknown) => {
        this.error.set(this.notifier.problemMessage(toProblem(failure)));
        this.submitting.set(false);
      },
    });
  }
}
