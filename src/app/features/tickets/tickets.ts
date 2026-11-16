import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, switchMap } from 'rxjs';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketListItem,
  TicketPriority,
  TicketStatus,
  TicketsApi,
} from '../../core/api/tickets.api';
import { Paged, Team, TeamsApi, User, UsersApi } from '../../core/api/workspace.api';
import { AuthService } from '../../core/auth/auth.service';
import { LocalDatePipe } from '../../shared/local-date.pipe';

type AssigneeFilter = 'anyone' | 'me' | 'unassigned' | string;

const SORTS = ['-lastActivityAt', '-createdAt', 'createdAt', '-priority', 'number'] as const;

@Component({
  selector: 'app-tickets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'tickets.title' | transloco }}</h1>
        <p>{{ 'tickets.subtitle' | transloco }}</p>
      </div>
      @if (canCreate()) {
        <a mat-flat-button routerLink="/app/tickets/new">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'tickets.new.open' | transloco }}
        </a>
      }
    </header>

    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.fields.status' | transloco }}</mat-label>
        <mat-select
          multiple
          [value]="statuses()"
          (valueChange)="statuses.set($event); reload(true)"
        >
          @for (status of allStatuses; track status) {
            <mat-option [value]="status">{{ 'ticketStatus.' + status | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.fields.priority' | transloco }}</mat-label>
        <mat-select
          multiple
          [value]="priorities()"
          (valueChange)="priorities.set($event); reload(true)"
        >
          @for (priority of allPriorities; track priority) {
            <mat-option [value]="priority">{{
              'ticketPriority.' + priority | transloco
            }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.fields.assignee' | transloco }}</mat-label>
        <mat-select [value]="assignee()" (valueChange)="assignee.set($event); reload(true)">
          <mat-option value="anyone">{{ 'tickets.filters.anyone' | transloco }}</mat-option>
          <mat-option value="me">{{ 'tickets.filters.me' | transloco }}</mat-option>
          <mat-option value="unassigned">{{ 'tickets.filters.unassigned' | transloco }}</mat-option>
          @for (agent of agents(); track agent.id) {
            <mat-option [value]="agent.id">{{ agent.fullName }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.fields.team' | transloco }}</mat-label>
        <mat-select [value]="teamId()" (valueChange)="teamId.set($event); reload(true)">
          <mat-option [value]="null">{{ 'tickets.filters.anyTeam' | transloco }}</mat-option>
          @for (team of teams(); track team.id) {
            <mat-option [value]="team.id">{{ team.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.sort.label' | transloco }}</mat-label>
        <mat-select [value]="sort()" (valueChange)="sort.set($event); reload(true)">
          @for (option of sorts; track option) {
            <mat-option [value]="option">{{ 'tickets.sort.' + option | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    <div class="table-card">
      <table mat-table [dataSource]="tickets()" [attr.aria-label]="'tickets.title' | transloco">
        <ng-container matColumnDef="subject">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.subject' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            <a class="subject" [routerLink]="['/app/tickets', ticket.id]">
              <span class="number" dir="ltr">#{{ ticket.number }}</span>
              {{ ticket.subject }}
            </a>
            @if (ticket.tags.length > 0) {
              <span class="tags">
                @for (tag of ticket.tags; track tag) {
                  <span class="tag">{{ tag }}</span>
                }
              </span>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="requester">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.requester' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">{{ ticket.requester.name }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.status' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            <span class="status-badge" [attr.data-status]="ticket.status">
              {{ 'ticketStatus.' + ticket.status | transloco }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="priority">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.priority' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            <span class="priority" [attr.data-priority]="ticket.priority">
              {{ 'ticketPriority.' + ticket.priority | transloco }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="assignee">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.assignee' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            @if (ticket.assignee) {
              {{ ticket.assignee.name }}
            } @else {
              <span class="muted">{{ 'tickets.unassigned' | transloco }}</span>
            }
          </td>
        </ng-container>
        <ng-container matColumnDef="activity">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.lastActivity' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            {{ ticket.lastActivityAt | localDate: 'relative' }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
        <tr class="mat-mdc-row" *matNoDataRow>
          <td class="mat-mdc-cell empty" [attr.colspan]="columns.length">
            {{ (loaded() ? 'tickets.empty' : 'common.loading') | transloco }}
          </td>
        </tr>
      </table>
      <mat-paginator
        [length]="total()"
        [pageIndex]="page() - 1"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 25, 50]"
        (page)="onPage($event)"
      />
    </div>
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-block-end: 16px;
    }

    .filters mat-form-field {
      flex: 1 1 160px;
      max-inline-size: 240px;
    }

    .subject {
      display: block;
      color: var(--mat-sys-on-surface);
      font: var(--mat-sys-title-small);
      text-decoration: none;
      padding-block: 10px 2px;
    }

    .subject:hover,
    .subject:focus-visible {
      color: var(--mat-sys-primary);
      text-decoration: underline;
    }

    .number {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
      margin-inline-end: 6px;
    }

    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding-block-end: 8px;
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Tickets {
  private readonly ticketsApi = inject(TicketsApi);
  private readonly auth = inject(AuthService);

  protected readonly allStatuses = TICKET_STATUSES;
  protected readonly allPriorities = TICKET_PRIORITIES;
  protected readonly sorts = SORTS;
  protected readonly columns = [
    'subject',
    'requester',
    'status',
    'priority',
    'assignee',
    'activity',
  ];

  protected readonly statuses = signal<TicketStatus[]>(['New', 'Open', 'Pending', 'OnHold']);
  protected readonly priorities = signal<TicketPriority[]>([]);
  protected readonly assignee = signal<AssigneeFilter>('anyone');
  protected readonly teamId = signal<string | null>(null);
  protected readonly sort = signal<string>('-lastActivityAt');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  private readonly result = signal<Paged<TicketListItem> | null>(null);
  protected readonly tickets = computed(() => [...(this.result()?.items ?? [])]);
  protected readonly total = computed(() => this.result()?.totalCount ?? 0);
  protected readonly loaded = computed(() => this.result() !== null);
  protected readonly agents = signal<readonly User[]>([]);
  protected readonly teams = signal<readonly Team[]>([]);
  protected readonly canCreate = computed(() => this.auth.can('tickets.create'));

  private readonly loads = new Subject<void>();

  constructor() {
    this.loads
      .pipe(
        switchMap(() => {
          const assignee = this.assignee();
          return this.ticketsApi.list({
            status: this.statuses(),
            priority: this.priorities(),
            unassigned: assignee === 'unassigned',
            assigneeId:
              assignee === 'me'
                ? this.auth.session()?.user.id
                : assignee === 'anyone' || assignee === 'unassigned'
                  ? null
                  : assignee,
            teamId: this.teamId(),
            sort: this.sort(),
            page: this.page(),
            pageSize: this.pageSize(),
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.result.set(result));

    this.reload(false);
    inject(UsersApi)
      .list({ isActive: true, page: 1, pageSize: 100 })
      .subscribe((users) => this.agents.set(users.items.filter((user) => user.role !== 'Viewer')));
    inject(TeamsApi)
      .list()
      .subscribe((teams) => this.teams.set(teams));
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.reload(false);
  }

  protected reload(resetPage: boolean): void {
    if (resetPage) {
      this.page.set(1);
    }

    this.loads.next();
  }
}
