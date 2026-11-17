import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import {
  ADMIN_TENANT_SORTS,
  AdminApi,
  AdminTenant,
  AdminTenantFilter,
  AdminTenantSort,
  TenantStatus,
} from '../core/api/admin.api';
import { formatMoney } from '../core/api/billing.api';
import { LanguageService } from '../core/i18n/language.service';
import { LocalDatePipe } from '../shared/local-date.pipe';

const PLANS = ['free', 'pro', 'business'] as const;

@Component({
  selector: 'app-admin-tenants',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LocalDatePipe,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'admin.tenants.title' | transloco }}</h1>
        <p>{{ 'admin.tenants.subtitle' | transloco: { count: total() } }}</p>
      </div>
    </header>

    <form class="filters" role="search" (submit)="$event.preventDefault()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-label>{{ 'admin.tenants.search' | transloco }}</mat-label>
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
        <mat-label>{{ 'admin.tenants.status' | transloco }}</mat-label>
        <mat-select
          name="status"
          [ngModel]="status()"
          (ngModelChange)="status.set($event); reload()"
        >
          <mat-option [value]="null">{{ 'admin.tenants.all' | transloco }}</mat-option>
          <mat-option value="Active">{{ 'admin.status.Active' | transloco }}</mat-option>
          <mat-option value="Suspended">{{ 'admin.status.Suspended' | transloco }}</mat-option>
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'admin.tenants.plan' | transloco }}</mat-label>
        <mat-select name="plan" [ngModel]="plan()" (ngModelChange)="plan.set($event); reload()">
          <mat-option [value]="null">{{ 'admin.tenants.all' | transloco }}</mat-option>
          @for (code of plans; track code) {
            <mat-option [value]="code">{{ 'admin.plans.' + code | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'admin.tenants.sort' | transloco }}</mat-label>
        <mat-select name="sort" [ngModel]="sort()" (ngModelChange)="sort.set($event); reload()">
          @for (option of sorts; track option) {
            <mat-option [value]="option">{{
              'admin.tenants.sorts.' + option | transloco
            }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </form>

    <div class="table-wrapper">
      <table mat-table [dataSource]="tenants()">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>{{ 'admin.tenants.workspace' | transloco }}</th>
          <td mat-cell *matCellDef="let tenant">
            <a class="name" [routerLink]="['/admin/tenants', tenant.id]">{{ tenant.name }}</a>
            <span class="sub" dir="ltr">{{ tenant.slug }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>{{ 'admin.tenants.status' | transloco }}</th>
          <td mat-cell *matCellDef="let tenant">
            <span class="badge" [class.muted]="tenant.status === 'Suspended'">{{
              'admin.status.' + tenant.status | transloco
            }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="plan">
          <th mat-header-cell *matHeaderCellDef>{{ 'admin.tenants.plan' | transloco }}</th>
          <td mat-cell *matCellDef="let tenant">
            {{ tenant.planName }}
            <span class="sub">{{ money(tenant.monthlyPriceCents) }}</span>
          </td>
        </ng-container>
        <ng-container matColumnDef="agents">
          <th mat-header-cell *matHeaderCellDef class="number">
            {{ 'admin.tenants.agents' | transloco }}
          </th>
          <td mat-cell *matCellDef="let tenant" class="number">{{ tenant.agents }}</td>
        </ng-container>
        <ng-container matColumnDef="tickets">
          <th mat-header-cell *matHeaderCellDef class="number">
            {{ 'admin.tenants.tickets' | transloco }}
          </th>
          <td mat-cell *matCellDef="let tenant" class="number">{{ tenant.ticketsThisMonth }}</td>
        </ng-container>
        <ng-container matColumnDef="owner">
          <th mat-header-cell *matHeaderCellDef>{{ 'admin.tenants.owner' | transloco }}</th>
          <td mat-cell *matCellDef="let tenant" dir="ltr" class="owner">
            {{ tenant.ownerEmail ?? '—' }}
          </td>
        </ng-container>
        <ng-container matColumnDef="created">
          <th mat-header-cell *matHeaderCellDef>{{ 'admin.tenants.created' | transloco }}</th>
          <td mat-cell *matCellDef="let tenant">{{ tenant.createdAt | localDate: 'date' }}</td>
        </ng-container>
        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
        <tr class="mat-mdc-row" *matNoDataRow>
          <td class="mat-mdc-cell empty" [attr.colspan]="columns.length">
            {{ (loaded() ? 'admin.tenants.none' : 'common.loading') | transloco }}
          </td>
        </tr>
      </table>
      <mat-paginator
        [length]="total()"
        [pageIndex]="page() - 1"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[25, 50, 100]"
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
    }

    .filters .search {
      flex-basis: 280px;
    }

    .table-wrapper {
      overflow-x: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .name {
      display: block;
      color: var(--mat-sys-primary);
      font-weight: 500;
      text-decoration: none;
    }

    .name:hover,
    .name:focus-visible {
      text-decoration: underline;
    }

    .sub {
      display: block;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .number {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }

    .owner {
      overflow-wrap: anywhere;
    }

    .empty {
      padding: 24px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class AdminTenants {
  private readonly api = inject(AdminApi);
  private readonly language = inject(LanguageService);

  protected readonly plans = PLANS;
  protected readonly sorts = ADMIN_TENANT_SORTS;
  protected readonly columns = ['name', 'status', 'plan', 'agents', 'tickets', 'owner', 'created'];

  protected readonly tenants = signal<AdminTenant[]>([]);
  protected readonly total = signal(0);
  protected readonly loaded = signal(false);
  protected readonly search = signal('');
  protected readonly status = signal<TenantStatus | null>(null);
  protected readonly plan = signal<string | null>(
    inject(ActivatedRoute).snapshot.queryParamMap.get('plan'),
  );
  protected readonly sort = signal<AdminTenantSort>('Newest');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  protected readonly searches = new Subject<string>();
  private readonly requests = new Subject<AdminTenantFilter>();

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.requests
      .pipe(
        switchMap((filter) => this.api.tenants(filter)),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe((result) => {
        this.tenants.set([...result.items]);
        this.total.set(result.totalCount);
        this.loaded.set(true);
      });
    this.searches
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(destroyRef))
      .subscribe((term) => {
        this.search.set(term);
        this.reload();
      });
    this.load();
  }

  protected money(cents: number): string {
    return formatMoney(cents, 'USD', this.language.language());
  }

  protected reload(): void {
    this.page.set(1);
    this.load();
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  private load(): void {
    this.requests.next({
      search: this.search().trim() || null,
      status: this.status(),
      plan: this.plan(),
      sort: this.sort(),
      page: this.page(),
      pageSize: this.pageSize(),
    });
  }
}
