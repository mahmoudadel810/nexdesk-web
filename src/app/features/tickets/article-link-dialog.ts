import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { KbArticleListItem, KbApi } from '../../core/api/kb.api';

/** Finds a published article to link in a reply. Closes with the chosen article. */
@Component({
  selector: 'app-article-link-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'tickets.articles.title' | transloco }}</h2>
    <mat-dialog-content class="form-stack">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.articles.search' | transloco }}</mat-label>
        <input matInput type="search" cdkFocusInitial [formControl]="term" />
      </mat-form-field>
      <mat-action-list [attr.aria-label]="'tickets.articles.results' | transloco">
        @for (article of results(); track article.id) {
          <button mat-list-item type="button" (click)="dialog.close(article)">
            <span matListItemTitle>{{ article.title }}</span>
            <span matListItemLine>{{ article.categoryName }}</span>
          </button>
        } @empty {
          @if (searched()) {
            <p class="empty">{{ 'tickets.articles.noResults' | transloco }}</p>
          }
        }
      </mat-action-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .empty {
      margin: 8px 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class ArticleLinkDialog {
  protected readonly dialog =
    inject<MatDialogRef<ArticleLinkDialog, KbArticleListItem>>(MatDialogRef);
  private readonly api = inject(KbApi);

  protected readonly term = new FormControl('', { nonNullable: true });
  protected readonly results = signal<readonly KbArticleListItem[]>([]);
  protected readonly searched = signal(false);

  constructor() {
    this.term.valueChanges
      .pipe(
        debounceTime(250),
        startWith(''),
        distinctUntilChanged(),
        // Drafts are for the team only: the customer could not open their link.
        switchMap((value) =>
          this.api.articles({ status: 'Published', search: value, page: 1, pageSize: 10 }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.results.set(page.items);
        this.searched.set(true);
      });
  }
}
