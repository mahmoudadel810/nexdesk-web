import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import {
  BulkChanges,
  SavedView,
  SlaFilter,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TicketListItem,
  TicketPriority,
  TicketStatus,
  TicketsApi,
  ViewFilter,
} from '../../core/api/tickets.api';
import { Paged, Team, TeamsApi, User, UsersApi } from '../../core/api/workspace.api';
import { AuthService } from '../../core/auth/auth.service';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { Prompt } from '../../shared/prompt-dialog';
import { SlaStatus } from '../../shared/sla-status';
import { SaveViewDialog, SaveViewDialogData } from './save-view-dialog';
import { normalizeTag } from './tag-input';

type AssigneeFilter = 'anyone' | 'me' | 'unassigned' | string;

const SORTS = ['-lastActivityAt', 'due', '-createdAt', 'createdAt', '-priority', 'number'] as const;
const DEFAULT_STATUSES: readonly TicketStatus[] = ['New', 'Open', 'Pending', 'OnHold'];
const DEFAULT_SORT = '-lastActivityAt';

@Component({
  selector: 'app-tickets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    SlaStatus,
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

    <div class="views">
      <mat-chip-listbox
        [attr.aria-label]="'tickets.views.label' | transloco"
        [value]="activeViewId()"
        (change)="applyView($event.value)"
      >
        <mat-chip-option [value]="null">{{ 'tickets.views.default' | transloco }}</mat-chip-option>
        @for (view of views(); track view.id) {
          <mat-chip-option [value]="view.id">
            {{ view.name }}
            @if (view.isShared) {
              <mat-icon
                matChipTrailingIcon
                aria-hidden="false"
                [attr.aria-label]="'tickets.views.shared' | transloco"
              >
                group
              </mat-icon>
            }
          </mat-chip-option>
        }
      </mat-chip-listbox>
      <button mat-button type="button" (click)="saveView()">
        <mat-icon aria-hidden="true">bookmark_add</mat-icon>
        {{ 'tickets.views.save' | transloco }}
      </button>
      @if (deletableView(); as view) {
        <button mat-button type="button" (click)="deleteView(view)">
          <mat-icon aria-hidden="true">delete</mat-icon>
          {{ 'tickets.views.delete' | transloco }}
        </button>
      }
    </div>

    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-label>{{ 'tickets.search' | transloco }}</mat-label>
        <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        <input matInput type="search" [value]="search()" (input)="onSearch($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.fields.status' | transloco }}</mat-label>
        <mat-select multiple [value]="statuses()" (valueChange)="statuses.set($event); changed()">
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
          (valueChange)="priorities.set($event); changed()"
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
        <mat-select [value]="assignee()" (valueChange)="assignee.set($event); changed()">
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
        <mat-select [value]="teamId()" (valueChange)="teamId.set($event); changed()">
          <mat-option [value]="null">{{ 'tickets.filters.anyTeam' | transloco }}</mat-option>
          @for (team of teams(); track team.id) {
            <mat-option [value]="team.id">{{ team.name }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'sla.column' | transloco }}</mat-label>
        <mat-select [value]="sla()" (valueChange)="sla.set($event); changed()">
          <mat-option [value]="null">{{ 'sla.filters.any' | transloco }}</mat-option>
          <mat-option value="AtRisk">{{ 'sla.filters.AtRisk' | transloco }}</mat-option>
          <mat-option value="Breached">{{ 'sla.filters.Breached' | transloco }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.sort.label' | transloco }}</mat-label>
        <mat-select [value]="sort()" (valueChange)="sort.set($event); changed()">
          @for (option of sorts; track option) {
            <mat-option [value]="option">{{ 'tickets.sort.' + option | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    @if (selected().size > 0) {
      <div class="bulk" role="region" [attr.aria-label]="'tickets.bulk.label' | transloco">
        <strong>{{ 'tickets.bulk.selected' | transloco: { count: selected().size } }}</strong>
        <button mat-button type="button" [matMenuTriggerFor]="bulkStatus">
          {{ 'tickets.bulk.setStatus' | transloco }}
        </button>
        <mat-menu #bulkStatus="matMenu">
          @for (status of allStatuses; track status) {
            <button mat-menu-item type="button" (click)="bulk({ status })">
              {{ 'ticketStatus.' + status | transloco }}
            </button>
          }
        </mat-menu>
        <button mat-button type="button" [matMenuTriggerFor]="bulkPriority">
          {{ 'tickets.bulk.setPriority' | transloco }}
        </button>
        <mat-menu #bulkPriority="matMenu">
          @for (priority of allPriorities; track priority) {
            <button mat-menu-item type="button" (click)="bulk({ priority })">
              {{ 'ticketPriority.' + priority | transloco }}
            </button>
          }
        </mat-menu>
        <button mat-button type="button" [matMenuTriggerFor]="bulkAssign">
          {{ 'tickets.bulk.assign' | transloco }}
        </button>
        <mat-menu #bulkAssign="matMenu">
          <button
            mat-menu-item
            type="button"
            (click)="bulk({ setAssignee: true, assigneeId: null })"
          >
            {{ 'tickets.unassigned' | transloco }}
          </button>
          @for (agent of agents(); track agent.id) {
            <button
              mat-menu-item
              type="button"
              (click)="bulk({ setAssignee: true, assigneeId: agent.id })"
            >
              {{ agent.fullName }}
            </button>
          }
        </mat-menu>
        <button mat-button type="button" (click)="bulkTag()">
          {{ 'tickets.bulk.addTag' | transloco }}
        </button>
        <span class="spacer"></span>
        <button mat-button type="button" (click)="selected.set(empty)">
          {{ 'tickets.bulk.clear' | transloco }}
        </button>
      </div>
    }

    <div class="table-card">
      <table mat-table [dataSource]="tickets()" [attr.aria-label]="'tickets.title' | transloco">
        <ng-container matColumnDef="select">
          <th mat-header-cell *matHeaderCellDef class="select">
            <mat-checkbox
              [checked]="allSelected()"
              [indeterminate]="selected().size > 0 && !allSelected()"
              [aria-label]="'tickets.bulk.selectAll' | transloco"
              (change)="toggleAll($event.checked)"
            />
          </th>
          <td mat-cell *matCellDef="let ticket" class="select">
            <mat-checkbox
              [checked]="selected().has(ticket.id)"
              [aria-label]="'tickets.bulk.selectOne' | transloco: { number: ticket.number }"
              (change)="toggle(ticket.id, $event.checked)"
            />
          </td>
        </ng-container>
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
        <ng-container matColumnDef="sla">
          <th mat-header-cell *matHeaderCellDef>{{ 'sla.column' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            <app-sla-status [sla]="ticket.sla" [status]="ticket.status" compact />
          </td>
        </ng-container>
        <ng-container matColumnDef="activity">
          <th mat-header-cell *matHeaderCellDef>{{ 'tickets.fields.lastActivity' | transloco }}</th>
          <td mat-cell *matCellDef="let ticket">
            {{ ticket.lastActivityAt | localDate: 'relative' }}
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns()"></tr>
        <tr mat-row *matRowDef="let row; columns: columns()"></tr>
        <tr class="mat-mdc-row" *matNoDataRow>
          <td class="mat-mdc-cell empty" [attr.colspan]="columns().length">
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
    .views {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: 16px;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-block-end: 16px;
    }

    .filters mat-form-field {
      flex: 1 1 150px;
      max-inline-size: 220px;
    }

    .filters .search {
      flex: 2 1 240px;
      max-inline-size: 360px;
    }

    .bulk {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 4px;
      padding: 4px 16px;
      margin-block-end: 12px;
      border-radius: 12px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .bulk .spacer {
      flex: 1 1 auto;
    }

    .select {
      inline-size: 48px;
      padding-inline: 4px;
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
  private readonly dialog = inject(MatDialog);
  private readonly notifier = inject(Notifier);
  private readonly confirm = inject(Confirm);
  private readonly prompt = inject(Prompt);

  protected readonly allStatuses = TICKET_STATUSES;
  protected readonly allPriorities = TICKET_PRIORITIES;
  protected readonly sorts = SORTS;
  protected readonly empty: ReadonlySet<string> = new Set<string>();

  protected readonly search = signal('');
  protected readonly statuses = signal<readonly TicketStatus[]>(DEFAULT_STATUSES);
  protected readonly priorities = signal<readonly TicketPriority[]>([]);
  protected readonly assignee = signal<AssigneeFilter>('anyone');
  protected readonly teamId = signal<string | null>(null);
  protected readonly sla = signal<SlaFilter | null>(null);
  protected readonly sort = signal<string>(DEFAULT_SORT);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  private readonly result = signal<Paged<TicketListItem> | null>(null);
  protected readonly tickets = computed(() => [...(this.result()?.items ?? [])]);
  protected readonly total = computed(() => this.result()?.totalCount ?? 0);
  protected readonly loaded = computed(() => this.result() !== null);
  protected readonly agents = signal<readonly User[]>([]);
  protected readonly teams = signal<readonly Team[]>([]);
  protected readonly views = signal<readonly SavedView[]>([]);
  protected readonly activeViewId = signal<string | null>(null);
  protected readonly selected = signal<ReadonlySet<string>>(this.empty);

  protected readonly canCreate = computed(() => this.auth.can('tickets.create'));
  private readonly canEdit = computed(() => this.auth.can('tickets.edit'));
  private readonly canShare = computed(() => this.auth.can('views.manage-shared'));
  protected readonly columns = computed(() => [
    ...(this.canEdit() ? ['select'] : []),
    'subject',
    'requester',
    'status',
    'priority',
    'assignee',
    'sla',
    'activity',
  ]);
  protected readonly allSelected = computed(
    () => this.tickets().length > 0 && this.tickets().every((t) => this.selected().has(t.id)),
  );
  protected readonly deletableView = computed(() => {
    const view = this.views().find((item) => item.id === this.activeViewId());
    return view && (view.isMine || this.canShare()) ? view : null;
  });

  private readonly loads = new Subject<void>();
  private readonly searches = new Subject<string>();

  constructor() {
    this.loads
      .pipe(
        switchMap(() => {
          const assignee = this.assignee();
          return this.ticketsApi.list({
            search: this.search().trim() || undefined,
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
            sla: this.sla(),
            sort: this.sort(),
            page: this.page(),
            pageSize: this.pageSize(),
          });
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.result.set(result);
        this.selected.set(this.empty);
      });

    this.searches
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.changed());

    // Someone else created or changed a ticket: refresh, unless a selection is in progress.
    inject(RealtimeService)
      .ticketChanges.pipe(debounceTime(600), takeUntilDestroyed())
      .subscribe(() => {
        if (this.selected().size === 0) {
          this.reload(false);
        }
      });

    this.reload(false);
    this.ticketsApi.views().subscribe((views) => this.views.set(views));
    inject(UsersApi)
      .list({ isActive: true, page: 1, pageSize: 100 })
      .subscribe((users) => this.agents.set(users.items.filter((user) => user.role !== 'Viewer')));
    inject(TeamsApi)
      .list()
      .subscribe((teams) => this.teams.set(teams));
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.searches.next(this.search());
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.reload(false);
  }

  /** A filter was edited by hand, so the list no longer shows a saved view. */
  protected changed(): void {
    this.activeViewId.set(null);
    this.reload(true);
  }

  protected reload(resetPage: boolean): void {
    if (resetPage) {
      this.page.set(1);
    }

    this.loads.next();
  }

  protected applyView(viewId: string | null | undefined): void {
    const view = this.views().find((item) => item.id === viewId);
    this.search.set(view?.filter.search ?? '');
    this.statuses.set(view ? (view.filter.status ?? []) : DEFAULT_STATUSES);
    this.priorities.set(view?.filter.priority ?? []);
    this.assignee.set(view?.filter.assignee ?? 'anyone');
    this.teamId.set(view?.filter.teamId ?? null);
    this.sort.set(view?.filter.sort ?? DEFAULT_SORT);
    this.activeViewId.set(view?.id ?? null);
    this.reload(true);
  }

  protected saveView(): void {
    const assignee = this.assignee();
    const filterToSave: ViewFilter = {
      status: this.statuses(),
      priority: this.priorities(),
      assignee: assignee === 'anyone' ? null : assignee,
      teamId: this.teamId(),
      tag: null,
      search: this.search().trim() || null,
      sort: this.sort(),
    };
    this.dialog
      .open<SaveViewDialog, SaveViewDialogData, SavedView>(SaveViewDialog, {
        data: { filter: filterToSave, canShare: this.canShare() },
        width: '480px',
      })
      .afterClosed()
      .pipe(filter((view) => view !== undefined))
      .subscribe((view) => {
        this.views.update((views) => [...views, view]);
        this.activeViewId.set(view.id);
        this.notifier.success('tickets.views.saved', { name: view.name });
      });
  }

  protected deleteView(view: SavedView): void {
    this.confirm
      .ask({
        title: this.notifier.translate('tickets.views.deleteTitle', { name: view.name }),
        message: this.notifier.translate(
          view.isShared ? 'tickets.views.deleteSharedBody' : 'tickets.views.deleteBody',
        ),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.ticketsApi.deleteView(view.id)),
      )
      .subscribe(() => {
        this.views.update((views) => views.filter((item) => item.id !== view.id));
        this.applyView(null);
      });
  }

  protected toggle(ticketId: string, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(ticketId);
      } else {
        next.delete(ticketId);
      }

      return next;
    });
  }

  protected toggleAll(checked: boolean): void {
    this.selected.set(checked ? new Set(this.tickets().map((ticket) => ticket.id)) : this.empty);
  }

  protected bulk(changes: BulkChanges): void {
    this.ticketsApi.bulk([...this.selected()], changes).subscribe((result) => {
      if (result.failed.length > 0) {
        this.notifier.success('tickets.bulk.partial', {
          updated: result.updated,
          failed: result.failed.length,
        });
      } else {
        this.notifier.success('tickets.bulk.done', { count: result.updated });
      }

      this.reload(false);
    });
  }

  protected bulkTag(): void {
    this.prompt
      .ask({
        title: this.notifier.translate('tickets.bulk.addTag'),
        label: this.notifier.translate('tickets.bulk.tagLabel'),
        value: '',
        maxLength: 30,
      })
      .subscribe((value) => {
        const tag = normalizeTag(value);
        if (tag) {
          this.bulk({ addTags: [tag] });
        }
      });
  }
}
