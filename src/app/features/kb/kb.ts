import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { KbApi, KbArticleListItem, KbArticleStatus, KbCategory } from '../../core/api/kb.api';
import { AuthService } from '../../core/auth/auth.service';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { KbCategoriesDialog } from './kb-categories-dialog';

@Component({
  selector: 'app-kb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LocalDatePipe,
    MatButtonModule,
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
        <h1>{{ 'kb.title' | transloco }}</h1>
        <p>{{ 'kb.subtitle' | transloco }}</p>
      </div>
      <div class="header-actions">
        <a mat-button [href]="helpCentreUrl()" target="_blank" rel="noopener">
          <mat-icon aria-hidden="true">open_in_new</mat-icon>
          {{ 'kb.openHelpCentre' | transloco }}
        </a>
        @if (canManage()) {
          <button mat-stroked-button type="button" (click)="manageCategories()">
            <mat-icon aria-hidden="true">category</mat-icon>
            {{ 'kb.categories.manage' | transloco }}
          </button>
          <a mat-flat-button routerLink="/app/kb/new" [class.disabled]="categories().length === 0">
            <mat-icon aria-hidden="true">add</mat-icon>
            {{ 'kb.newArticle' | transloco }}
          </a>
        }
      </div>
    </header>

    @if (loaded() && categories().length === 0) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">menu_book</mat-icon>
        <h2>{{ 'kb.emptyTitle' | transloco }}</h2>
        <p>{{ (canManage() ? 'kb.emptyBodyManager' : 'kb.emptyBody') | transloco }}</p>
        @if (canManage()) {
          <button mat-flat-button type="button" (click)="manageCategories()">
            {{ 'kb.categories.addFirst' | transloco }}
          </button>
        }
      </div>
    } @else {
      <div class="filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
          <mat-label>{{ 'kb.search' | transloco }}</mat-label>
          <mat-icon matPrefix aria-hidden="true">search</mat-icon>
          <input
            matInput
            type="search"
            [ngModel]="search()"
            (ngModelChange)="searchChanges.next($event)"
          />
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'kb.fields.category' | transloco }}</mat-label>
          <mat-select [ngModel]="categoryId()" (ngModelChange)="setCategory($event)">
            <mat-option [value]="null">{{ 'kb.allCategories' | transloco }}</mat-option>
            @for (category of categories(); track category.id) {
              <mat-option [value]="category.id">{{ category.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>{{ 'kb.fields.status' | transloco }}</mat-label>
          <mat-select [ngModel]="status()" (ngModelChange)="setStatus($event)">
            <mat-option [value]="null">{{ 'kb.allStatuses' | transloco }}</mat-option>
            <mat-option value="Published">{{ 'kb.status.Published' | transloco }}</mat-option>
            <mat-option value="Draft">{{ 'kb.status.Draft' | transloco }}</mat-option>
          </mat-select>
        </mat-form-field>
      </div>

      <div class="table-card">
        <table mat-table [dataSource]="articles()" [attr.aria-label]="'kb.title' | transloco">
          <ng-container matColumnDef="title">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.title' | transloco }}</th>
            <td mat-cell *matCellDef="let article">
              <a class="title" [routerLink]="['/app/kb', article.id]">{{ article.title }}</a>
            </td>
          </ng-container>
          <ng-container matColumnDef="category">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.category' | transloco }}</th>
            <td mat-cell *matCellDef="let article">{{ article.categoryName }}</td>
          </ng-container>
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.status' | transloco }}</th>
            <td mat-cell *matCellDef="let article">
              <span class="badge" [class.muted]="article.status === 'Draft'">
                {{ 'kb.status.' + article.status | transloco }}
              </span>
            </td>
          </ng-container>
          <ng-container matColumnDef="views">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.views' | transloco }}</th>
            <td mat-cell *matCellDef="let article">{{ article.viewCount }}</td>
          </ng-container>
          <ng-container matColumnDef="helpful">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.helpful' | transloco }}</th>
            <td mat-cell *matCellDef="let article">
              {{ helpfulShare(article) }}
            </td>
          </ng-container>
          <ng-container matColumnDef="updated">
            <th mat-header-cell *matHeaderCellDef>{{ 'kb.fields.updated' | transloco }}</th>
            <td mat-cell *matCellDef="let article">
              {{ article.updatedAt | localDate: 'relative' }}
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns"></tr>
          <tr class="mat-mdc-row" *matNoDataRow>
            <td class="mat-mdc-cell empty" [attr.colspan]="columns.length">
              {{ (loaded() ? 'kb.noArticles' : 'common.loading') | transloco }}
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
    }
  `,
  styles: `
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .disabled {
      pointer-events: none;
      opacity: 0.5;
    }

    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-block-end: 16px;
    }

    .filters mat-form-field {
      flex: 1 1 180px;
      max-inline-size: 260px;
    }

    .filters .search {
      flex: 2 1 240px;
      max-inline-size: 420px;
    }

    .title {
      color: var(--mat-sys-primary);
      font-weight: 500;
      text-decoration: none;
    }

    .title:hover {
      text-decoration: underline;
    }

    .empty {
      padding: 24px 16px;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class Kb {
  private readonly api = inject(KbApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  protected readonly columns = ['title', 'category', 'status', 'views', 'helpful', 'updated'];
  protected readonly categories = signal<readonly KbCategory[]>([]);
  protected readonly articles = signal<readonly KbArticleListItem[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);
  protected readonly search = signal('');
  protected readonly categoryId = signal<string | null>(null);
  protected readonly status = signal<KbArticleStatus | null>(null);
  protected readonly loaded = signal(false);
  protected readonly searchChanges = new Subject<string>();
  protected readonly canManage = computed(() => this.auth.can('kb.manage'));
  protected readonly helpCentreUrl = computed(
    () => `/portal/${this.auth.session()?.tenant?.slug ?? ''}`,
  );

  constructor() {
    this.searchChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((term) => {
        this.search.set(term);
        this.page.set(1);
        this.loadArticles();
      });
    this.loadCategories();
    this.loadArticles();
  }

  protected helpfulShare(article: KbArticleListItem): string {
    const votes = article.helpfulCount + article.notHelpfulCount;
    return votes === 0 ? '–' : `${Math.round((article.helpfulCount / votes) * 100)}% (${votes})`;
  }

  protected setCategory(categoryId: string | null): void {
    this.categoryId.set(categoryId);
    this.page.set(1);
    this.loadArticles();
  }

  protected setStatus(status: KbArticleStatus | null): void {
    this.status.set(status);
    this.page.set(1);
    this.loadArticles();
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.loadArticles();
  }

  protected manageCategories(): void {
    this.dialog
      .open(KbCategoriesDialog, { width: '560px' })
      .afterClosed()
      .subscribe(() => {
        this.loadCategories();
        this.loadArticles();
      });
  }

  private loadCategories(): void {
    this.api.categories().subscribe((categories) => {
      this.categories.set(categories);
      if (this.categoryId() && !categories.some((category) => category.id === this.categoryId())) {
        this.categoryId.set(null);
      }
    });
  }

  private loadArticles(): void {
    this.api
      .articles({
        categoryId: this.categoryId(),
        status: this.status(),
        search: this.search(),
        page: this.page(),
        pageSize: this.pageSize(),
      })
      .subscribe((result) => {
        this.articles.set(result.items);
        this.total.set(result.totalCount);
        this.loaded.set(true);
      });
  }
}
