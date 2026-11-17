import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SKIP_ERROR_TOAST } from '../http/problem';
import { Paged } from './workspace.api';

export type KbArticleStatus = 'Draft' | 'Published';

export interface KbCategory {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
  readonly articleCount: number;
}

export interface KbArticleListItem {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly status: KbArticleStatus;
  readonly publishedAt: string | null;
  readonly updatedAt: string | null;
  readonly viewCount: number;
  readonly helpfulCount: number;
  readonly notHelpfulCount: number;
}

export interface KbArticle extends KbArticleListItem {
  readonly bodyMarkdown: string;
  readonly bodyHtml: string;
}

export interface KbArticleQuery {
  readonly categoryId?: string | null;
  readonly status?: KbArticleStatus | null;
  readonly search?: string | null;
  readonly page: number;
  readonly pageSize: number;
}

export interface KbArticleInput {
  readonly categoryId: string;
  readonly title: string;
  readonly bodyMarkdown: string;
  /** True publishes, false turns the article back into a draft, null leaves the status alone. */
  readonly publish: boolean | null;
}

export interface KbCategoryInput {
  readonly name: string;
  readonly description: string | null;
  readonly position: number;
}

const API = `${environment.apiUrl}/kb`;

function inline(): { context: HttpContext } {
  return { context: new HttpContext().set(SKIP_ERROR_TOAST, true) };
}

@Injectable({ providedIn: 'root' })
export class KbApi {
  private readonly http = inject(HttpClient);

  categories(): Observable<KbCategory[]> {
    return this.http.get<KbCategory[]>(`${API}/categories`);
  }

  createCategory(input: KbCategoryInput): Observable<KbCategory> {
    return this.http.post<KbCategory>(`${API}/categories`, input, inline());
  }

  updateCategory(categoryId: string, input: KbCategoryInput): Observable<KbCategory> {
    return this.http.put<KbCategory>(`${API}/categories/${categoryId}`, input, inline());
  }

  deleteCategory(categoryId: string): Observable<void> {
    return this.http.delete<void>(`${API}/categories/${categoryId}`);
  }

  articles(query: KbArticleQuery): Observable<Paged<KbArticleListItem>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.categoryId) {
      params = params.set('categoryId', query.categoryId);
    }

    if (query.status) {
      params = params.set('status', query.status);
    }

    if (query.search?.trim()) {
      params = params.set('search', query.search.trim());
    }

    return this.http.get<Paged<KbArticleListItem>>(`${API}/articles`, { params });
  }

  article(articleId: string): Observable<KbArticle> {
    return this.http.get<KbArticle>(`${API}/articles/${articleId}`, inline());
  }

  createArticle(input: KbArticleInput): Observable<KbArticle> {
    return this.http.post<KbArticle>(`${API}/articles`, input, inline());
  }

  updateArticle(articleId: string, input: KbArticleInput): Observable<KbArticle> {
    return this.http.put<KbArticle>(`${API}/articles/${articleId}`, input, inline());
  }

  setPublished(articleId: string, published: boolean): Observable<KbArticle> {
    const action = published ? 'publish' : 'unpublish';
    return this.http.post<KbArticle>(`${API}/articles/${articleId}/${action}`, null);
  }

  deleteArticle(articleId: string): Observable<void> {
    return this.http.delete<void>(`${API}/articles/${articleId}`);
  }

  preview(markdown: string): Observable<{ html: string }> {
    return this.http.post<{ html: string }>(`${API}/preview`, { markdown });
  }
}
