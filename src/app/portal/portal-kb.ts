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
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { LocalDatePipe } from '../shared/local-date.pipe';
import { HelpArticle, HelpArticleSummary, PortalService } from './portal.service';

const SEARCH_DELAY_MS = 250;

interface ArticleGroup {
  readonly name: string;
  readonly description: string | null;
  readonly articles: readonly HelpArticleSummary[];
}

/** The help centre's front page: a search box over the published articles, grouped by category. */
@Component({
  selector: 'app-portal-help-browser',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    @if (hasArticles()) {
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-label>{{ 'portal.kb.search' | transloco }}</mat-label>
        <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        <input matInput type="search" [ngModel]="term()" (ngModelChange)="terms.next($event)" />
      </mat-form-field>

      @if (results(); as found) {
        <section [attr.aria-label]="'portal.kb.results' | transloco" aria-live="polite">
          <h2>{{ 'portal.kb.resultCount' | transloco: { count: found.length } }}</h2>
          @if (found.length === 0) {
            <p class="none">{{ 'portal.kb.noResults' | transloco }}</p>
          }
          <ul class="articles">
            @for (article of found; track article.slug) {
              <li>
                <a [routerLink]="[base(), 'kb', article.slug]">{{ article.title }}</a>
                <span class="category">{{ article.categoryName }}</span>
                <p>{{ article.excerpt }}</p>
              </li>
            }
          </ul>
        </section>
      } @else {
        <div class="groups">
          @for (group of groups(); track group.name) {
            <section>
              <h2>{{ group.name }}</h2>
              @if (group.description) {
                <p class="description">{{ group.description }}</p>
              }
              <ul class="links">
                @for (article of group.articles; track article.slug) {
                  <li>
                    <a [routerLink]="[base(), 'kb', article.slug]">{{ article.title }}</a>
                  </li>
                }
              </ul>
            </section>
          }
        </div>
      }
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .search {
      display: block;
      max-inline-size: 560px;
      margin: 0 auto 32px;
    }

    h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 8px;
    }

    .groups {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 24px 32px;
    }

    .description,
    .none,
    .articles p {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 8px;
    }

    ul {
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .links li {
      padding-block: 4px;
    }

    a {
      color: var(--mat-sys-primary);
      text-decoration: none;
    }

    a:hover {
      text-decoration: underline;
    }

    .articles li {
      padding-block: 12px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }

    .articles a {
      font: var(--mat-sys-title-medium);
    }

    .articles p {
      margin: 4px 0 0;
    }

    .category {
      margin-inline-start: 8px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-medium);
    }
  `,
})
export class PortalHelpBrowser {
  private readonly portal = inject(PortalService);
  private readonly slug = this.portal.info()?.slug ?? '';

  protected readonly base = computed(() => `/portal/${this.slug}`);
  protected readonly term = signal('');
  protected readonly terms = new Subject<string>();
  protected readonly groups = signal<readonly ArticleGroup[]>([]);
  /** Null while the reader is browsing; a list, possibly empty, while they are searching. */
  protected readonly results = signal<readonly HelpArticleSummary[] | null>(null);
  protected readonly hasArticles = computed(() => this.groups().length > 0);

  constructor() {
    this.portal.helpCategories(this.slug).subscribe((categories) => {
      this.portal.helpArticles(this.slug).subscribe((articles) =>
        this.groups.set(
          categories.map((category) => ({
            name: category.name,
            description: category.description,
            articles: articles.filter((article) => article.categoryName === category.name),
          })),
        ),
      );
    });

    this.terms
      .pipe(
        map((term) => term.trim()),
        debounceTime(SEARCH_DELAY_MS),
        distinctUntilChanged(),
        switchMap((term) => {
          this.term.set(term);
          return term
            ? this.portal.helpArticles(this.slug, term, 20).pipe(catchError(() => of([])))
            : of(null);
        }),
        takeUntilDestroyed(),
      )
      .subscribe((found) => this.results.set(found));
  }
}

/** Shows articles that may already answer what the customer is about to ask. */
@Component({
  selector: 'app-portal-help-suggestions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, RouterLink, TranslocoPipe],
  template: `
    @if (suggestions().length > 0) {
      <aside class="suggestions" aria-live="polite">
        <h2>
          <mat-icon aria-hidden="true">lightbulb</mat-icon>
          {{ 'portal.kb.suggestionsTitle' | transloco }}
        </h2>
        <ul>
          @for (article of suggestions(); track article.slug) {
            <li>
              <a [routerLink]="[base(), 'kb', article.slug]" target="_blank" rel="noopener">
                {{ article.title }}
              </a>
            </li>
          }
        </ul>
      </aside>
    }
  `,
  styles: `
    .suggestions {
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    h2 {
      display: flex;
      align-items: center;
      gap: 8px;
      font: var(--mat-sys-title-small);
      margin: 0 0 4px;
    }

    ul {
      margin: 0;
      padding-inline-start: 32px;
    }

    li {
      padding-block: 2px;
    }

    a {
      color: inherit;
    }
  `,
})
export class PortalHelpSuggestions {
  private static readonly MinimumLength = 3;

  private readonly portal = inject(PortalService);
  private readonly slug = this.portal.info()?.slug ?? '';

  /** What the customer has typed so far. */
  readonly term = input('');

  protected readonly base = computed(() => `/portal/${this.slug}`);
  protected readonly suggestions = signal<readonly HelpArticleSummary[]>([]);

  constructor() {
    toObservable(this.term)
      .pipe(
        map((term) => term.trim()),
        debounceTime(SEARCH_DELAY_MS + 150),
        distinctUntilChanged(),
        switchMap((term) =>
          term.length < PortalHelpSuggestions.MinimumLength
            ? of([])
            : this.portal.helpArticles(this.slug, term, 4).pipe(catchError(() => of([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((articles) => this.suggestions.set(articles));
  }
}

@Component({
  selector: 'app-portal-article',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LocalDatePipe, MatButtonModule, MatIconModule, RouterLink, TranslocoPipe],
  template: `
    <a class="back" [routerLink]="base()">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ 'portal.kb.back' | transloco }}
    </a>

    @if (missing()) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">search_off</mat-icon>
        <h1>{{ 'portal.kb.notFoundTitle' | transloco }}</h1>
        <p>{{ 'portal.kb.notFoundBody' | transloco }}</p>
      </div>
    } @else {
      @if (article(); as current) {
        <article>
          <p class="category">{{ current.categoryName }}</p>
          <h1>{{ current.title }}</h1>
          @if (current.updatedAt ?? current.publishedAt; as date) {
            <p class="updated">
              {{ 'portal.kb.updated' | transloco }} {{ date | localDate: 'date' }}
            </p>
          }
          <div class="markdown-body" [innerHTML]="current.bodyHtml"></div>
        </article>

        <section class="feedback" aria-live="polite">
          @if (voted()) {
            <p>{{ 'portal.kb.feedbackThanks' | transloco }}</p>
          } @else {
            <p id="feedback-question">{{ 'portal.kb.feedbackQuestion' | transloco }}</p>
            <div role="group" aria-labelledby="feedback-question" class="votes">
              <button mat-stroked-button type="button" (click)="vote(true)">
                <mat-icon aria-hidden="true">thumb_up</mat-icon>
                {{ 'portal.kb.yes' | transloco }}
              </button>
              <button mat-stroked-button type="button" (click)="vote(false)">
                <mat-icon aria-hidden="true">thumb_down</mat-icon>
                {{ 'portal.kb.no' | transloco }}
              </button>
            </div>
          }
          <p class="more">
            {{ 'portal.kb.stillNeedHelp' | transloco }}
            <a [routerLink]="[base(), 'tickets', 'new']">{{ 'portal.requests.new' | transloco }}</a>
          </p>
        </section>
      }
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

    h1 {
      font: var(--mat-sys-headline-medium);
      margin: 0 0 8px;
    }

    .category {
      margin: 0 0 4px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
    }

    .updated {
      margin: 0 0 24px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .feedback {
      margin-block-start: 40px;
      padding-block-start: 24px;
      border-block-start: 1px solid var(--mat-sys-outline-variant);
      text-align: center;
    }

    .feedback p {
      margin: 0 0 12px;
    }

    .votes {
      display: flex;
      justify-content: center;
      gap: 12px;
    }

    .more {
      margin-block-start: 24px !important;
      color: var(--mat-sys-on-surface-variant);
    }

    .more a {
      color: var(--mat-sys-primary);
    }
  `,
})
export class PortalArticle {
  private readonly portal = inject(PortalService);
  private readonly slug = this.portal.info()?.slug ?? '';

  /** The article's address, taken from the route. */
  readonly articleSlug = input.required<string>();

  protected readonly base = computed(() => `/portal/${this.slug}`);
  protected readonly article = signal<HelpArticle | null>(null);
  protected readonly missing = signal(false);
  protected readonly voted = signal(false);

  constructor() {
    effect(() => {
      const articleSlug = this.articleSlug();
      untracked(() => this.load(articleSlug));
    });
  }

  protected vote(helpful: boolean): void {
    this.voted.set(true);
    this.portal.rateHelpArticle(this.slug, this.articleSlug(), helpful).subscribe({
      error: () => this.voted.set(false),
    });
  }

  private load(articleSlug: string): void {
    this.missing.set(false);
    this.voted.set(false);
    this.article.set(null);
    this.portal.helpArticle(this.slug, articleSlug).subscribe({
      next: (article) => this.article.set(article),
      error: () => this.missing.set(true),
    });
  }
}
