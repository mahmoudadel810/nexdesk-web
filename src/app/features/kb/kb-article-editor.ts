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
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, switchMap } from 'rxjs';
import { KbApi, KbArticle, KbCategory } from '../../core/api/kb.api';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { LocalDatePipe } from '../../shared/local-date.pipe';

/** Writes or edits a help article. People who may only read the knowledge base see the rendered article. */
@Component({
  selector: 'app-kb-article-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    LocalDatePipe,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <a class="back" routerLink="/app/kb">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ 'kb.back' | transloco }}
    </a>

    @if (missing()) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">search_off</mat-icon>
        <h2>{{ 'kb.notFoundTitle' | transloco }}</h2>
        <p>{{ 'kb.notFoundBody' | transloco }}</p>
      </div>
    } @else if (!canManage()) {
      @if (article(); as current) {
        <header class="page-header">
          <div>
            <h1>{{ current.title }}</h1>
            <p>
              {{ current.categoryName }} ·
              <span class="badge" [class.muted]="current.status === 'Draft'">
                {{ 'kb.status.' + current.status | transloco }}
              </span>
            </p>
          </div>
        </header>
        <article class="markdown-body" [innerHTML]="current.bodyHtml"></article>
      }
    } @else if (ready()) {
      <header class="page-header">
        <div>
          <h1>{{ (article() ? 'kb.editor.editTitle' : 'kb.editor.newTitle') | transloco }}</h1>
          @if (article(); as current) {
            <p>
              <span class="badge" [class.muted]="current.status === 'Draft'">
                {{ 'kb.status.' + current.status | transloco }}
              </span>
              · {{ 'kb.editor.updated' | transloco }}
              {{ current.updatedAt | localDate: 'relative' }} ·
              {{ 'kb.editor.stats' | transloco: stats() }}
            </p>
          } @else {
            <p>{{ 'kb.editor.newSubtitle' | transloco }}</p>
          }
        </div>
        @if (article(); as current) {
          <div class="header-actions">
            @if (current.status === 'Published') {
              <a mat-button [href]="publicUrl()" target="_blank" rel="noopener">
                <mat-icon aria-hidden="true">open_in_new</mat-icon>
                {{ 'kb.editor.view' | transloco }}
              </a>
            }
            <button mat-button type="button" (click)="remove(current)">
              <mat-icon aria-hidden="true">delete</mat-icon>
              {{ 'common.delete' | transloco }}
            </button>
          </div>
        }
      </header>

      <form class="form-stack editor" [formGroup]="form" (ngSubmit)="save(null)" novalidate>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }
        <div class="row">
          <mat-form-field appearance="outline" class="grow">
            <mat-label>{{ 'kb.fields.title' | transloco }}</mat-label>
            <input matInput formControlName="title" />
            <mat-error>{{ form.controls.title | fieldError }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'kb.fields.category' | transloco }}</mat-label>
            <mat-select formControlName="categoryId">
              @for (category of categories(); track category.id) {
                <mat-option [value]="category.id">{{ category.name }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ form.controls.categoryId | fieldError }}</mat-error>
          </mat-form-field>
        </div>

        <mat-button-toggle-group
          [value]="mode()"
          (change)="setMode($event.value)"
          [attr.aria-label]="'kb.editor.modeLabel' | transloco"
          hideSingleSelectionIndicator
        >
          <mat-button-toggle value="write">{{ 'kb.editor.write' | transloco }}</mat-button-toggle>
          <mat-button-toggle value="preview">{{
            'kb.editor.preview' | transloco
          }}</mat-button-toggle>
        </mat-button-toggle-group>

        @if (mode() === 'write') {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'kb.fields.body' | transloco }}</mat-label>
            <textarea matInput rows="18" class="source" formControlName="bodyMarkdown"></textarea>
            <mat-hint>{{ 'kb.editor.markdownHint' | transloco }}</mat-hint>
            <mat-error>{{ form.controls.bodyMarkdown | fieldError }}</mat-error>
          </mat-form-field>
        } @else {
          <section class="preview" [attr.aria-label]="'kb.editor.preview' | transloco">
            @if (previewHtml() === null) {
              <p class="muted">{{ 'common.loading' | transloco }}</p>
            } @else if (previewHtml() === '') {
              <p class="muted">{{ 'kb.editor.previewEmpty' | transloco }}</p>
            } @else {
              <article class="markdown-body" [innerHTML]="previewHtml()"></article>
            }
          </section>
        }

        <div class="form-actions">
          <a mat-button routerLink="/app/kb">{{ 'common.cancel' | transloco }}</a>
          @if (article()?.status === 'Published') {
            <button
              mat-stroked-button
              type="button"
              [disabled]="submitting()"
              (click)="save(false)"
            >
              {{ 'kb.editor.unpublish' | transloco }}
            </button>
            <button mat-flat-button type="submit" [disabled]="submitting()">
              {{ 'kb.editor.saveChanges' | transloco }}
            </button>
          } @else {
            <button mat-stroked-button type="submit" [disabled]="submitting()">
              {{ 'kb.editor.saveDraft' | transloco }}
            </button>
            <button mat-flat-button type="button" [disabled]="submitting()" (click)="save(true)">
              {{ 'kb.editor.publish' | transloco }}
            </button>
          }
        </div>
      </form>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-block-end: 16px;
      color: var(--mat-sys-primary);
      text-decoration: none;
    }

    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .editor {
      max-inline-size: 960px;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
    }

    .row mat-form-field {
      flex: 1 1 220px;
    }

    .row .grow {
      flex: 3 1 320px;
    }

    mat-button-toggle-group {
      align-self: flex-start;
    }

    .source {
      font-family: ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .preview {
      min-block-size: 240px;
      padding: 16px 24px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .muted {
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class KbArticleEditor {
  private readonly api = inject(KbApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);
  private readonly confirm = inject(Confirm);

  /** The article's id, taken from the route. Absent when writing a new article. */
  readonly id = input<string>();

  protected readonly categories = signal<readonly KbCategory[]>([]);
  protected readonly article = signal<KbArticle | null>(null);
  protected readonly missing = signal(false);
  protected readonly ready = signal(false);
  protected readonly mode = signal<'write' | 'preview'>('write');
  protected readonly previewHtml = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canManage = computed(() => this.auth.can('kb.manage'));
  protected readonly publicUrl = computed(
    () => `/portal/${this.auth.session()?.tenant?.slug ?? ''}/kb/${this.article()?.slug ?? ''}`,
  );
  protected readonly stats = computed(() => {
    const article = this.article();
    return {
      views: article?.viewCount ?? 0,
      helpful: article?.helpfulCount ?? 0,
      notHelpful: article?.notHelpfulCount ?? 0,
    };
  });
  protected readonly form = inject(NonNullableFormBuilder).group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    categoryId: ['', [Validators.required]],
    bodyMarkdown: ['', [Validators.required, Validators.maxLength(100000)]],
  });

  constructor() {
    if (this.canManage()) {
      this.api.categories().subscribe((categories) => {
        this.categories.set(categories);
        if (!this.form.controls.categoryId.value && categories.length > 0) {
          this.form.controls.categoryId.setValue(categories[0].id);
        }
      });
    }

    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  protected setMode(mode: 'write' | 'preview'): void {
    this.mode.set(mode);
    if (mode === 'write') {
      return;
    }

    const markdown = this.form.controls.bodyMarkdown.value;
    if (!markdown.trim()) {
      this.previewHtml.set('');
      return;
    }

    this.previewHtml.set(null);
    this.api.preview(markdown).subscribe({
      next: (preview) => this.previewHtml.set(preview.html),
      error: () => this.mode.set('write'),
    });
  }

  /** Saves the article. `publish` true publishes it, false unpublishes it, null keeps its status. */
  protected save(publish: boolean | null): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.mode.set('write');
      return;
    }

    const input = { ...this.form.getRawValue(), publish };
    const current = this.article();
    this.submitting.set(true);
    this.error.set(null);
    (current ? this.api.updateArticle(current.id, input) : this.api.createArticle(input)).subscribe(
      {
        next: (saved) => {
          this.submitting.set(false);
          this.notifier.success(
            publish === true
              ? 'kb.editor.published'
              : publish === false
                ? 'kb.editor.unpublished'
                : 'kb.editor.saved',
          );
          if (current) {
            this.article.set(saved);
          } else {
            void this.router.navigate(['/app/kb', saved.id], { replaceUrl: true });
          }
        },
        error: (failure: unknown) => {
          const problem = toProblem(failure);
          if (applyServerErrors(this.form, problem)) {
            this.mode.set('write');
          } else {
            this.error.set(this.notifier.problemMessage(problem));
          }

          this.submitting.set(false);
        },
      },
    );
  }

  protected remove(article: KbArticle): void {
    this.confirm
      .ask({
        title: this.notifier.translate('kb.delete.title', { title: article.title }),
        message: this.notifier.translate('kb.delete.body'),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteArticle(article.id)),
      )
      .subscribe(() => {
        this.notifier.success('kb.delete.done');
        void this.router.navigate(['/app/kb']);
      });
  }

  private load(id: string | undefined): void {
    this.missing.set(false);
    this.mode.set('write');
    if (!id) {
      this.article.set(null);
      this.ready.set(true);
      return;
    }

    this.api.article(id).subscribe({
      next: (article) => {
        this.article.set(article);
        this.form.reset({
          title: article.title,
          categoryId: article.categoryId,
          bodyMarkdown: article.bodyMarkdown,
        });
        this.ready.set(true);
      },
      error: () => this.missing.set(true),
    });
  }
}
