import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged, switchMap, tap } from 'rxjs';
import {
  AUDIT_ENTITY_TYPES,
  AUDIT_OPERATIONS,
  AuditApi,
  AuditEntry,
  AuditFilter,
  AuditOperation,
} from '../../core/api/audit.api';
import { Actor } from '../../core/api/tickets.api';
import { LanguageService } from '../../core/i18n/language.service';
import { Notifier } from '../../core/ui/notifier';
import { LocalDatePipe } from '../../shared/local-date.pipe';

const OPERATION_ICONS: Record<AuditOperation, string> = {
  Created: 'add_circle',
  Updated: 'edit',
  Deleted: 'delete',
};

/** Turns a field name such as `firstResponseMinutes` into readable words: "First response minutes". */
export function fieldLabel(field: string): string {
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The start of a day, or the end of it, in the viewer's time zone, as an instant the API understands. */
export function dayBoundary(date: string, end: boolean): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return null;
  }

  const [year, month, day] = date.split('-').map(Number);
  const local = end
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  return local.toISOString();
}

@Component({
  selector: 'app-audit-log',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LocalDatePipe,
    MatButtonModule,
    MatExpansionModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'audit.title' | transloco }}</h1>
        <p>{{ 'audit.subtitle' | transloco }}</p>
      </div>
    </header>

    <form class="filters" role="search" (submit)="$event.preventDefault()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'audit.filters.search' | transloco }}</mat-label>
        <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        <input
          matInput
          name="search"
          [ngModel]="search()"
          (ngModelChange)="searches.next($event)"
          autocomplete="off"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'audit.filters.type' | transloco }}</mat-label>
        <mat-select name="type" [ngModel]="entityType()" (ngModelChange)="setEntityType($event)">
          <mat-option [value]="null">{{ 'audit.filters.all' | transloco }}</mat-option>
          @for (type of entityTypes; track type) {
            <mat-option [value]="type">{{ 'audit.types.' + type | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'audit.filters.operation' | transloco }}</mat-label>
        <mat-select name="operation" [ngModel]="operation()" (ngModelChange)="setOperation($event)">
          <mat-option [value]="null">{{ 'audit.filters.all' | transloco }}</mat-option>
          @for (op of operations; track op) {
            <mat-option [value]="op">{{ 'audit.operations.' + op | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'audit.filters.from' | transloco }}</mat-label>
        <input
          matInput
          type="date"
          name="from"
          [ngModel]="from()"
          (ngModelChange)="setRange($event, to())"
        />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'audit.filters.to' | transloco }}</mat-label>
        <input
          matInput
          type="date"
          name="to"
          [ngModel]="to()"
          (ngModelChange)="setRange(from(), $event)"
        />
      </mat-form-field>
      @if (filtered()) {
        <button mat-button type="button" (click)="clear()">
          {{ 'audit.filters.clear' | transloco }}
        </button>
      }
    </form>

    @if (loaded() && entries().length === 0) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">history</mat-icon>
        <h2>{{ (filtered() ? 'audit.noMatches' : 'audit.emptyTitle') | transloco }}</h2>
        <p>{{ (filtered() ? 'audit.noMatchesBody' : 'audit.emptyBody') | transloco }}</p>
      </div>
    }

    <mat-accordion class="entries" multi>
      @for (entry of entries(); track entry.id) {
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon class="op" [class]="'op ' + entry.operation" aria-hidden="true">{{
                icons[entry.operation]
              }}</mat-icon>
              <span class="summary">{{ summary(entry) }}</span>
            </mat-panel-title>
            <mat-panel-description>{{
              entry.occurredAt | localDate: 'relative'
            }}</mat-panel-description>
          </mat-expansion-panel-header>

          <dl class="facts">
            <div>
              <dt>{{ 'audit.when' | transloco }}</dt>
              <dd>{{ entry.occurredAt | localDate }}</dd>
            </div>
            <div>
              <dt>{{ 'audit.who' | transloco }}</dt>
              <dd>{{ actorName(entry.actor) }}</dd>
            </div>
            <div>
              <dt>{{ 'audit.address' | transloco }}</dt>
              <dd dir="ltr">{{ entry.ipAddress ?? ('audit.noAddress' | transloco) }}</dd>
            </div>
            <div>
              <dt>{{ 'audit.recordId' | transloco }}</dt>
              <dd dir="ltr" class="mono">{{ entry.entityId }}</dd>
            </div>
          </dl>

          @if (entry.changes.length > 0) {
            <div class="table-scroll">
              <table class="changes">
                <caption class="visually-hidden">
                  {{
                    'audit.changes' | transloco
                  }}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{{ 'audit.field' | transloco }}</th>
                    <th scope="col">{{ 'audit.before' | transloco }}</th>
                    <th scope="col">{{ 'audit.after' | transloco }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (change of entry.changes; track change.field) {
                    <tr>
                      <th scope="row">{{ label(change.field) }}</th>
                      <td dir="auto" [class.none]="change.before === null">
                        {{ change.before ?? '—' }}
                      </td>
                      <td dir="auto" [class.none]="change.after === null">
                        {{ change.after ?? '—' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          } @else {
            <p class="muted">{{ 'audit.noFields' | transloco }}</p>
          }
        </mat-expansion-panel>
      }
    </mat-accordion>

    @if (total() > pageSize) {
      <mat-paginator
        [length]="total()"
        [pageIndex]="page() - 1"
        [pageSize]="pageSize"
        [hidePageSize]="true"
        (page)="onPage($event)"
      />
    }
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
      margin-block-end: 16px;
    }

    .filters mat-form-field {
      flex: 1 1 180px;
      min-inline-size: 0;
    }

    .filters mat-form-field:first-child {
      flex-basis: 260px;
    }

    .entries {
      display: block;
      max-inline-size: 1000px;
    }

    mat-panel-title {
      display: flex;
      align-items: center;
      gap: 12px;
      min-inline-size: 0;
    }

    .summary {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    mat-panel-description {
      flex: none;
      justify-content: flex-end;
    }

    .op {
      flex: none;
      color: var(--mat-sys-primary);
    }

    .op.Deleted {
      color: var(--mat-sys-error);
    }

    .op.Created {
      color: var(--mat-sys-tertiary);
    }

    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 0 0 16px;
    }

    .facts dt {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .facts dd {
      margin: 2px 0 0;
      overflow-wrap: anywhere;
    }

    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 0.85em;
    }

    .table-scroll {
      overflow-x: auto;
    }

    .changes {
      inline-size: 100%;
      border-collapse: collapse;
    }

    .changes th,
    .changes td {
      padding: 8px 12px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
      text-align: start;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    .changes thead th {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }

    .changes tbody th {
      font-weight: 500;
      white-space: nowrap;
    }

    .changes td.none,
    .muted {
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 600px) {
      mat-panel-description {
        display: none;
      }
    }
  `,
})
export class AuditLog {
  private readonly api = inject(AuditApi);
  private readonly notifier = inject(Notifier);
  private readonly language = inject(LanguageService);

  protected readonly entityTypes = AUDIT_ENTITY_TYPES;
  protected readonly operations = AUDIT_OPERATIONS;
  protected readonly icons = OPERATION_ICONS;
  protected readonly pageSize = 25;

  protected readonly entries = signal<readonly AuditEntry[]>([]);
  protected readonly total = signal(0);
  protected readonly loaded = signal(false);
  protected readonly page = signal(1);
  protected readonly search = signal('');
  protected readonly entityType = signal<string | null>(null);
  protected readonly operation = signal<AuditOperation | null>(null);
  protected readonly from = signal('');
  protected readonly to = signal('');

  protected readonly searches = new Subject<string>();
  private readonly requests = new Subject<AuditFilter>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.requests
      .pipe(
        switchMap((filter) => this.api.list(filter)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((result) => {
        this.entries.set(result.items);
        this.total.set(result.totalCount);
        this.loaded.set(true);
      });

    this.searches
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => this.search.set(term)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe(() => this.reload());

    this.reload();
  }

  protected filtered(): boolean {
    return !!(this.search() || this.entityType() || this.operation() || this.from() || this.to());
  }

  protected setEntityType(type: string | null): void {
    this.entityType.set(type);
    this.reload();
  }

  protected setOperation(operation: AuditOperation | null): void {
    this.operation.set(operation);
    this.reload();
  }

  protected setRange(from: string, to: string): void {
    this.from.set(from ?? '');
    this.to.set(to ?? '');
    this.reload();
  }

  protected clear(): void {
    this.search.set('');
    this.entityType.set(null);
    this.operation.set(null);
    this.from.set('');
    this.to.set('');
    this.reload();
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.load();
  }

  protected summary(entry: AuditEntry): string {
    this.language.translations();
    return this.notifier.translate(`audit.summary.${entry.operation}`, {
      actor: this.actorName(entry.actor),
      type: this.notifier.translate(`audit.types.${entry.entityType}`),
      label: entry.entityLabel ?? '',
    });
  }

  protected actorName(actor: Actor): string {
    this.language.translations();
    if (actor.type === 'ApiKey') {
      return this.notifier.translate('audit.apiKeyActor', {
        name: actor.name ?? this.notifier.translate('tickets.timeline.actors.ApiKey'),
      });
    }

    return actor.name ?? this.notifier.translate(`tickets.timeline.actors.${actor.type}`);
  }

  protected label(field: string): string {
    return fieldLabel(field);
  }

  private reload(): void {
    this.page.set(1);
    this.load();
  }

  private load(): void {
    this.requests.next({
      search: this.search().trim() || null,
      entityType: this.entityType(),
      operation: this.operation(),
      from: this.from() ? dayBoundary(this.from(), false) : null,
      to: this.to() ? dayBoundary(this.to(), true) : null,
      page: this.page(),
      pageSize: this.pageSize,
    });
  }
}
