import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import {
  Attachment,
  Customer,
  TICKET_PRIORITIES,
  TICKET_TYPES,
  TicketPriority,
  TicketType,
  TicketsApi,
} from '../../core/api/tickets.api';
import { Team, TeamsApi, User, UsersApi } from '../../core/api/workspace.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';
import { AttachmentPicker } from './attachment-picker';
import { TagInput } from './tag-input';

@Component({
  selector: 'app-ticket-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AttachmentPicker,
    FieldErrorPipe,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    TagInput,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'tickets.new.title' | transloco }}</h1>
        <p>{{ 'tickets.new.subtitle' | transloco }}</p>
      </div>
    </header>

    <form class="form-stack ticket-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-alert" role="alert">{{ message }}</p>
      }

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.new.requesterEmail' | transloco }}</mat-label>
          <input
            matInput
            type="email"
            formControlName="requesterEmail"
            autocomplete="off"
            [matAutocomplete]="customersList"
          />
          <mat-autocomplete
            #customersList="matAutocomplete"
            (optionSelected)="pick($event.option.value)"
          >
            @for (customer of suggestions(); track customer.id) {
              <mat-option [value]="customer.email">
                {{ customer.fullName }} · <span dir="ltr">{{ customer.email }}</span>
              </mat-option>
            }
          </mat-autocomplete>
          <mat-hint>{{ 'tickets.new.requesterHint' | transloco }}</mat-hint>
          <mat-error>{{ form.controls.requesterEmail | fieldError }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.new.requesterName' | transloco }}</mat-label>
          <input matInput formControlName="requesterName" autocomplete="off" />
          <mat-error>{{ form.controls.requesterName | fieldError }}</mat-error>
        </mat-form-field>
      </div>

      <mat-form-field appearance="outline">
        <mat-label>{{ 'tickets.fields.subject' | transloco }}</mat-label>
        <input matInput formControlName="subject" />
        <mat-error>{{ form.controls.subject | fieldError }}</mat-error>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>{{ 'tickets.new.description' | transloco }}</mat-label>
        <textarea matInput rows="6" formControlName="description"></textarea>
        <mat-error>{{ form.controls.description | fieldError }}</mat-error>
      </mat-form-field>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.fields.priority' | transloco }}</mat-label>
          <mat-select formControlName="priority">
            @for (priority of priorities; track priority) {
              <mat-option [value]="priority">{{
                'ticketPriority.' + priority | transloco
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.fields.type' | transloco }}</mat-label>
          <mat-select formControlName="type">
            @for (type of types; track type) {
              <mat-option [value]="type">{{ 'ticketType.' + type | transloco }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <div class="row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.fields.assignee' | transloco }}</mat-label>
          <mat-select formControlName="assigneeId">
            <mat-option [value]="null">{{ 'tickets.unassigned' | transloco }}</mat-option>
            @for (agent of agents(); track agent.id) {
              <mat-option [value]="agent.id">{{ agent.fullName }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'tickets.fields.team' | transloco }}</mat-label>
          <mat-select formControlName="teamId">
            <mat-option [value]="null">{{ 'tickets.noTeam' | transloco }}</mat-option>
            @for (team of teams(); track team.id) {
              <mat-option [value]="team.id">{{ team.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      </div>

      <app-tag-input [(tags)]="tags" />
      <app-attachment-picker [(attachments)]="attachments" />

      <div class="form-actions">
        <a mat-button routerLink="/app/tickets">{{ 'common.cancel' | transloco }}</a>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'tickets.new.submit' | transloco }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .ticket-form {
      max-inline-size: 760px;
    }

    .row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 12px;
    }
  `,
})
export class TicketNew {
  private readonly ticketsApi = inject(TicketsApi);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);

  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly types = TICKET_TYPES;
  protected readonly agents = signal<readonly User[]>([]);
  protected readonly teams = signal<readonly Team[]>([]);
  protected readonly suggestions = signal<readonly Customer[]>([]);
  protected readonly tags = signal<readonly string[]>([]);
  protected readonly attachments = signal<readonly Attachment[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(NonNullableFormBuilder).group({
    requesterEmail: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    requesterName: ['', [Validators.maxLength(100)]],
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(20000)]],
    priority: ['Normal' as TicketPriority],
    type: ['Question' as TicketType],
    assigneeId: [null as string | null],
    teamId: [null as string | null],
  });

  constructor() {
    inject(UsersApi)
      .list({ isActive: true, page: 1, pageSize: 100 })
      .subscribe((users) => this.agents.set(users.items.filter((user) => user.role !== 'Viewer')));
    inject(TeamsApi)
      .list()
      .subscribe((teams) => this.teams.set(teams));

    this.form.controls.requesterEmail.valueChanges
      .pipe(
        debounceTime(200),
        distinctUntilChanged(),
        filter((value): value is string => typeof value === 'string' && value.trim().length >= 2),
        switchMap((value) => this.ticketsApi.customers(value.trim())),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.suggestions.set(page.items));
  }

  protected pick(email: string): void {
    const customer = this.suggestions().find((item) => item.email === email);
    if (customer) {
      this.form.patchValue({ requesterName: customer.fullName });
    }
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.ticketsApi
      .create({
        ...value,
        requesterName: value.requesterName.trim() || null,
        tags: this.tags(),
        attachmentIds: this.attachments().map((attachment) => attachment.id),
      })
      .subscribe({
        next: (ticket) => {
          this.notifier.success('tickets.new.created', { number: ticket.number });
          void this.router.navigate(['/app/tickets', ticket.id]);
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
