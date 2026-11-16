import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, filter, switchMap } from 'rxjs';
import {
  Attachment,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
  CustomField,
  TicketDetail as Ticket,
  TicketListItem,
  TicketStatus,
  TicketsApi,
  TimelineItem,
} from '../../core/api/tickets.api';
import { Team, TeamsApi, User, UsersApi } from '../../core/api/workspace.api';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { Prompt } from '../../shared/prompt-dialog';
import { SlaStatus } from '../../shared/sla-status';
import { AttachmentPicker } from './attachment-picker';
import { CustomFieldInputs } from './custom-field-inputs';
import { MergeDialog } from './merge-dialog';
import { TagInput } from './tag-input';
import { TicketTimeline } from './ticket-timeline';

type ReplyMode = 'reply' | 'note';

@Component({
  selector: 'app-ticket-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AttachmentPicker,
    CustomFieldInputs,
    FormsModule,
    LocalDatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
    SlaStatus,
    TagInput,
    TicketTimeline,
    TranslocoPipe,
  ],
  template: `
    <a class="back" routerLink="/app/tickets">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ 'tickets.detail.back' | transloco }}
    </a>

    @if (ticket(); as ticket) {
      <header class="page-header">
        <div>
          <h1>
            <span class="number" dir="ltr">#{{ ticket.number }}</span>
            {{ ticket.subject }}
          </h1>
          <p>
            <span class="status-badge" [attr.data-status]="ticket.status">
              {{ 'ticketStatus.' + ticket.status | transloco }}
            </span>
            {{
              'tickets.detail.openedBy'
                | transloco
                  : {
                      name: ticket.requester.name,
                      when: (ticket.createdAt | localDate: 'relative'),
                    }
            }}
            · {{ 'ticketChannel.' + ticket.channel | transloco }}
          </p>
        </div>
        <div class="header-actions">
          <button
            mat-stroked-button
            type="button"
            [attr.aria-pressed]="ticket.isWatching"
            (click)="toggleWatching(ticket)"
          >
            <mat-icon aria-hidden="true">{{
              ticket.isWatching ? 'visibility_off' : 'visibility'
            }}</mat-icon>
            {{
              (ticket.isWatching ? 'tickets.detail.unwatch' : 'tickets.detail.watch') | transloco
            }}
          </button>
          @if (canEdit() || canDelete()) {
            <button
              mat-icon-button
              type="button"
              [matMenuTriggerFor]="moreMenu"
              [attr.aria-label]="'common.actions' | transloco"
            >
              <mat-icon aria-hidden="true">more_vert</mat-icon>
            </button>
            <mat-menu #moreMenu="matMenu">
              @if (canEdit() && !closed()) {
                <button mat-menu-item type="button" (click)="rename(ticket)">
                  <mat-icon aria-hidden="true">edit</mat-icon>
                  <span>{{ 'tickets.detail.rename' | transloco }}</span>
                </button>
                <button mat-menu-item type="button" (click)="merge(ticket)">
                  <mat-icon aria-hidden="true">merge</mat-icon>
                  <span>{{ 'tickets.merge.open' | transloco }}</span>
                </button>
              }
              @if (canDelete()) {
                <button mat-menu-item type="button" (click)="remove(ticket)">
                  <mat-icon aria-hidden="true">delete</mat-icon>
                  <span>{{ 'tickets.detail.delete' | transloco }}</span>
                </button>
              }
            </mat-menu>
          }
        </div>
      </header>

      <div class="layout">
        <section class="conversation" [attr.aria-label]="'tickets.timeline.label' | transloco">
          <app-ticket-timeline [items]="timeline()" />

          @if (ticket.mergedInto; as target) {
            <p class="form-notice">
              {{ 'tickets.merge.mergedInto' | transloco }}
              <a [routerLink]="['/app/tickets', target.id]">
                <span dir="ltr">#{{ target.number }}</span> {{ target.subject }}
              </a>
            </p>
          } @else if (closed()) {
            <p class="form-notice">{{ 'tickets.detail.closedNotice' | transloco }}</p>
          } @else if (canReply()) {
            <form class="composer" (ngSubmit)="send(ticket)">
              <mat-button-toggle-group
                [value]="mode()"
                (valueChange)="mode.set($event)"
                [attr.aria-label]="'tickets.composer.mode' | transloco"
                hideSingleSelectionIndicator
              >
                <mat-button-toggle value="reply">{{
                  'tickets.composer.reply' | transloco
                }}</mat-button-toggle>
                <mat-button-toggle value="note">{{
                  'tickets.composer.note' | transloco
                }}</mat-button-toggle>
              </mat-button-toggle-group>
              <mat-form-field
                appearance="outline"
                subscriptSizing="dynamic"
                [class.note]="mode() === 'note'"
              >
                <mat-label>
                  {{
                    (mode() === 'note'
                      ? 'tickets.composer.notePlaceholder'
                      : 'tickets.composer.replyPlaceholder'
                    ) | transloco: { name: ticket.requester.name }
                  }}
                </mat-label>
                <textarea
                  matInput
                  rows="5"
                  name="body"
                  maxlength="20000"
                  [ngModel]="body()"
                  (ngModelChange)="body.set($event)"
                ></textarea>
              </mat-form-field>
              @if (composerError(); as message) {
                <p class="form-alert" role="alert">{{ message }}</p>
              }
              <app-attachment-picker [(attachments)]="attachments" />
              <div class="composer-actions">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="submit-as">
                  <mat-label>{{ 'tickets.composer.submitAs' | transloco }}</mat-label>
                  <mat-select [value]="submitAs()" (valueChange)="submitAs.set($event)">
                    <mat-option [value]="null">{{
                      'tickets.composer.keepStatus' | transloco
                    }}</mat-option>
                    @for (status of statuses; track status) {
                      <mat-option [value]="status">{{
                        'ticketStatus.' + status | transloco
                      }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button mat-flat-button type="submit" [disabled]="sending() || !body().trim()">
                  {{
                    (mode() === 'note' ? 'tickets.composer.addNote' : 'tickets.composer.send')
                      | transloco
                  }}
                </button>
              </div>
            </form>
          }
        </section>

        <aside class="properties" [attr.aria-label]="'tickets.detail.properties' | transloco">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tickets.fields.status' | transloco }}</mat-label>
            <mat-select
              [value]="ticket.status"
              [disabled]="!canEdit() || closed()"
              (valueChange)="update(ticket, { status: $event })"
            >
              @for (status of statuses; track status) {
                <mat-option [value]="status">{{ 'ticketStatus.' + status | transloco }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tickets.fields.priority' | transloco }}</mat-label>
            <mat-select
              [value]="ticket.priority"
              [disabled]="!canEdit() || closed()"
              (valueChange)="update(ticket, { priority: $event })"
            >
              @for (priority of priorities; track priority) {
                <mat-option [value]="priority">{{
                  'ticketPriority.' + priority | transloco
                }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tickets.fields.type' | transloco }}</mat-label>
            <mat-select
              [value]="ticket.type"
              [disabled]="!canEdit() || closed()"
              (valueChange)="update(ticket, { type: $event })"
            >
              @for (type of types; track type) {
                <mat-option [value]="type">{{ 'ticketType.' + type | transloco }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tickets.fields.assignee' | transloco }}</mat-label>
            <mat-select
              [value]="ticket.assignee?.id ?? null"
              [disabled]="!canEdit() || closed()"
              (valueChange)="assign(ticket, $event, ticket.team?.id ?? null)"
            >
              <mat-option [value]="null">{{ 'tickets.unassigned' | transloco }}</mat-option>
              @for (agent of agentOptions(); track agent.id) {
                <mat-option [value]="agent.id">{{ agent.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'tickets.fields.team' | transloco }}</mat-label>
            <mat-select
              [value]="ticket.team?.id ?? null"
              [disabled]="!canEdit() || closed()"
              (valueChange)="assign(ticket, ticket.assignee?.id ?? null, $event)"
            >
              <mat-option [value]="null">{{ 'tickets.noTeam' | transloco }}</mat-option>
              @for (team of teams(); track team.id) {
                <mat-option [value]="team.id">{{ team.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <app-tag-input
            [tags]="ticket.tags"
            [disabled]="!canEdit() || closed()"
            (tagsChange)="update(ticket, { tags: $event })"
          />
          <app-custom-field-inputs
            [fields]="customFields()"
            [values]="ticket.customFields"
            [disabled]="!canEdit() || closed()"
            (valueChange)="setCustomField(ticket, $event.key, $event.value)"
          />

          <section class="sla-box" [attr.aria-label]="'sla.column' | transloco">
            <h2>{{ 'sla.column' | transloco }}</h2>
            <app-sla-status [sla]="ticket.sla" [status]="ticket.status" />
          </section>

          <dl class="facts">
            <dt>{{ 'tickets.fields.requester' | transloco }}</dt>
            <dd>
              {{ ticket.requester.name }}
              <span dir="ltr">{{ ticket.requester.email }}</span>
            </dd>
            <dt>{{ 'tickets.detail.created' | transloco }}</dt>
            <dd>{{ ticket.createdAt | localDate }}</dd>
            @if (ticket.firstRespondedAt) {
              <dt>{{ 'tickets.detail.firstResponse' | transloco }}</dt>
              <dd>{{ ticket.firstRespondedAt | localDate }}</dd>
            }
            @if (ticket.solvedAt) {
              <dt>{{ 'tickets.detail.solved' | transloco }}</dt>
              <dd>{{ ticket.solvedAt | localDate }}</dd>
            }
            <dt>{{ 'tickets.detail.watchers' | transloco }}</dt>
            <dd>
              @for (watcher of ticket.watchers; track watcher.id) {
                <span class="tag">{{ watcher.name }}</span>
              } @empty {
                {{ 'tickets.timeline.none' | transloco }}
              }
            </dd>
          </dl>
        </aside>
      </div>
    } @else if (missing()) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">search_off</mat-icon>
        <h2>{{ 'tickets.detail.notFoundTitle' | transloco }}</h2>
        <p>{{ 'tickets.detail.notFoundBody' | transloco }}</p>
      </div>
    } @else {
      <div class="empty-state" role="status">
        <mat-spinner diameter="40" [attr.aria-label]="'common.loading' | transloco" />
      </div>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      text-decoration: none;
      margin-block-end: 12px;
    }

    .back mat-icon {
      font-size: 18px;
      inline-size: 18px;
      block-size: 18px;
    }

    :host-context([dir='rtl']) .back mat-icon {
      transform: scaleX(-1);
    }

    h1 .number {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
    }

    .page-header p {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 300px;
      gap: 24px;
      align-items: start;
    }

    .conversation {
      display: grid;
      gap: 16px;
      min-inline-size: 0;
    }

    .composer {
      display: grid;
      gap: 12px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 16px;
    }

    .composer mat-button-toggle-group {
      justify-self: start;
    }

    .composer-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 12px;
    }

    .submit-as {
      inline-size: 200px;
    }

    .properties {
      display: grid;
      gap: 12px;
    }

    .sla-box {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 12px 16px;
    }

    .sla-box h2 {
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 8px;
    }

    .facts {
      display: grid;
      gap: 4px;
      margin: 8px 0 0;
      font: var(--mat-sys-body-small);
    }

    .facts dt {
      color: var(--mat-sys-on-surface-variant);
      margin-block-start: 8px;
    }

    .facts dd {
      margin: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 4px 8px;
      overflow-wrap: anywhere;
    }

    @media (max-width: 960px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .properties {
        order: -1;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .properties app-tag-input,
      .facts {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class TicketDetail {
  private readonly api = inject(TicketsApi);
  private readonly auth = inject(AuthService);
  private readonly notifier = inject(Notifier);
  private readonly confirm = inject(Confirm);
  private readonly router = inject(Router);
  private readonly prompt = inject(Prompt);
  private readonly dialog = inject(MatDialog);

  readonly id = input.required<string>();

  protected readonly statuses = TICKET_STATUSES;
  protected readonly priorities = TICKET_PRIORITIES;
  protected readonly types = TICKET_TYPES;

  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly timeline = signal<readonly TimelineItem[]>([]);
  protected readonly missing = signal(false);
  private readonly agents = signal<readonly User[]>([]);
  protected readonly teams = signal<readonly Team[]>([]);
  protected readonly customFields = signal<readonly CustomField[]>([]);

  protected readonly mode = signal<ReplyMode>('reply');
  protected readonly body = signal('');
  protected readonly attachments = signal<readonly Attachment[]>([]);
  protected readonly submitAs = signal<TicketStatus | null>(null);
  protected readonly sending = signal(false);
  protected readonly composerError = signal<string | null>(null);

  protected readonly closed = computed(() => this.ticket()?.status === 'Closed');
  protected readonly canEdit = computed(() => this.auth.can('tickets.edit'));
  protected readonly canReply = computed(() => this.auth.can('tickets.reply'));
  protected readonly canDelete = computed(() => this.auth.can('tickets.delete'));

  /** Active agents, plus the current assignee even if they have since been deactivated. */
  protected readonly agentOptions = computed(() => {
    const options = this.agents().map((agent) => ({ id: agent.id, name: agent.fullName }));
    const assignee = this.ticket()?.assignee;
    return assignee && !options.some((option) => option.id === assignee.id)
      ? [...options, { id: assignee.id, name: assignee.name }]
      : options;
  });

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });

    inject(UsersApi)
      .list({ isActive: true, page: 1, pageSize: 100 })
      .subscribe((users) => this.agents.set(users.items.filter((user) => user.role !== 'Viewer')));
    inject(TeamsApi)
      .list()
      .subscribe((teams) => this.teams.set(teams));
    this.api.customFields().subscribe((fields) => this.customFields.set(fields));
  }

  protected update(ticket: Ticket, changes: Parameters<TicketsApi['update']>[1]): void {
    this.apply(this.api.update(ticket.id, changes, ticket.version));
  }

  protected assign(ticket: Ticket, assigneeId: string | null, teamId: string | null): void {
    this.apply(this.api.assign(ticket.id, assigneeId, teamId, ticket.version));
  }

  protected setCustomField(ticket: Ticket, key: string, value: string | null): void {
    this.update(ticket, { customFields: { [key]: value } });
  }

  protected merge(ticket: Ticket): void {
    this.dialog
      .open<MergeDialog, Ticket, TicketListItem>(MergeDialog, { data: ticket, width: '560px' })
      .afterClosed()
      .pipe(
        filter((target) => target !== undefined && target !== null),
        switchMap((target) => this.api.merge(ticket.id, target.id)),
      )
      .subscribe((target) => {
        this.notifier.success('tickets.merge.done', { number: target.number });
        void this.router.navigate(['/app/tickets', target.id]);
      });
  }

  protected toggleWatching(ticket: Ticket): void {
    this.api
      .setWatching(ticket.id, !ticket.isWatching)
      .subscribe((updated) => this.ticket.set(updated));
  }

  protected rename(ticket: Ticket): void {
    this.prompt
      .ask({
        title: this.notifier.translate('tickets.detail.rename'),
        label: this.notifier.translate('tickets.fields.subject'),
        value: ticket.subject,
        maxLength: 200,
      })
      .pipe(filter((subject) => subject !== ticket.subject))
      .subscribe((subject) => this.update(ticket, { subject }));
  }

  protected remove(ticket: Ticket): void {
    this.confirm
      .ask({
        title: this.notifier.translate('tickets.detail.deleteTitle', { number: ticket.number }),
        message: this.notifier.translate('tickets.detail.deleteBody'),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.delete(ticket.id)),
      )
      .subscribe(() => {
        this.notifier.success('tickets.detail.deleted', { number: ticket.number });
        void this.router.navigate(['/app/tickets']);
      });
  }

  protected send(ticket: Ticket): void {
    const body = this.body().trim();
    if (!body || this.sending()) {
      return;
    }

    this.sending.set(true);
    this.composerError.set(null);
    this.api
      .addMessage(ticket.id, {
        body,
        isInternal: this.mode() === 'note',
        attachmentIds: this.attachments().map((attachment) => attachment.id),
        setStatus: this.submitAs(),
      })
      .subscribe({
        next: (updated) => {
          this.ticket.set(updated);
          this.body.set('');
          this.attachments.set([]);
          this.submitAs.set(null);
          this.sending.set(false);
          this.loadTimeline(updated.id);
        },
        error: (failure: unknown) => {
          this.composerError.set(this.notifier.problemMessage(toProblem(failure)));
          this.sending.set(false);
        },
      });
  }

  private apply(request: Observable<Ticket>): void {
    request.subscribe({
      next: (updated) => {
        this.ticket.set(updated);
        this.loadTimeline(updated.id);
      },
      // The toast explains the failure; reloading puts the selects back to the saved values.
      error: () => this.load(this.id()),
    });
  }

  private load(id: string): void {
    this.missing.set(false);
    this.api.get(id).subscribe({
      next: (ticket) => {
        this.ticket.set(ticket);
        this.loadTimeline(id);
      },
      error: () => {
        this.ticket.set(null);
        this.missing.set(true);
      },
    });
  }

  private loadTimeline(id: string): void {
    this.api.timeline(id).subscribe((items) => this.timeline.set(items));
  }
}
