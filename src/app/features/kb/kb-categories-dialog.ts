import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { KbApi, KbCategory } from '../../core/api/kb.api';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';

/** Lists the article categories and lets a manager add, change and remove them. */
@Component({
  selector: 'app-kb-categories-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <h2 mat-dialog-title>{{ 'kb.categories.title' | transloco }}</h2>
    <mat-dialog-content>
      <p class="dialog-lead">{{ 'kb.categories.lead' | transloco }}</p>
      <ul class="categories">
        @for (category of categories(); track category.id) {
          <li [class.editing]="editing()?.id === category.id">
            <div class="text">
              <strong>{{ category.name }}</strong>
              <span>{{
                'kb.categories.articleCount' | transloco: { count: category.articleCount }
              }}</span>
            </div>
            <button
              mat-icon-button
              type="button"
              [attr.aria-label]="'kb.categories.edit' | transloco: { name: category.name }"
              (click)="edit(category)"
            >
              <mat-icon aria-hidden="true">edit</mat-icon>
            </button>
            <button
              mat-icon-button
              type="button"
              [disabled]="category.articleCount > 0"
              [attr.aria-label]="'kb.categories.delete' | transloco: { name: category.name }"
              (click)="remove(category)"
            >
              <mat-icon aria-hidden="true">delete</mat-icon>
            </button>
          </li>
        } @empty {
          <li class="none">{{ 'kb.categories.empty' | transloco }}</li>
        }
      </ul>

      <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h3>
          {{ (editing() ? 'kb.categories.editTitle' : 'kb.categories.addTitle') | transloco }}
        </h3>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }
        <mat-form-field appearance="outline">
          <mat-label>{{ 'kb.categories.name' | transloco }}</mat-label>
          <input matInput formControlName="name" />
          <mat-error>{{ form.controls.name | fieldError }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'kb.categories.description' | transloco }}</mat-label>
          <input matInput formControlName="description" />
          <mat-error>{{ form.controls.description | fieldError }}</mat-error>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'kb.categories.position' | transloco }}</mat-label>
          <input matInput type="number" min="0" max="1000" formControlName="position" />
          <mat-hint>{{ 'kb.categories.positionHint' | transloco }}</mat-hint>
          <mat-error>{{ form.controls.position | fieldError }}</mat-error>
        </mat-form-field>
        <div class="form-actions">
          @if (editing()) {
            <button mat-button type="button" (click)="reset()">
              {{ 'common.cancel' | transloco }}
            </button>
          }
          <button mat-flat-button type="submit" [disabled]="submitting()">
            {{ (editing() ? 'common.save' : 'kb.categories.add') | transloco }}
          </button>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>
        {{ 'kb.categories.done' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .categories {
      list-style: none;
      margin: 0 0 24px;
      padding: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .categories li {
      display: flex;
      align-items: center;
      gap: 4px;
      padding-block: 4px;
      padding-inline: 16px 8px;
    }

    .categories li + li {
      border-block-start: 1px solid var(--mat-sys-outline-variant);
    }

    .categories li.editing {
      background: var(--mat-sys-surface-container-high);
    }

    .categories li.none {
      padding-block: 16px;
      color: var(--mat-sys-on-surface-variant);
    }

    .text {
      display: grid;
      flex: 1 1 auto;
      min-inline-size: 0;
    }

    .text span {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    h3 {
      font: var(--mat-sys-title-medium);
      margin: 0;
    }
  `,
})
export class KbCategoriesDialog {
  private readonly api = inject(KbApi);
  private readonly notifier = inject(Notifier);

  protected readonly categories = signal<readonly KbCategory[]>([]);
  protected readonly editing = signal<KbCategory | null>(null);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(300)]],
    position: [0, [Validators.required, Validators.min(0), Validators.max(1000)]],
  });

  constructor() {
    this.load();
  }

  protected edit(category: KbCategory): void {
    this.editing.set(category);
    this.error.set(null);
    this.form.reset({
      name: category.name,
      description: category.description ?? '',
      position: category.position,
    });
  }

  protected reset(): void {
    this.editing.set(null);
    this.error.set(null);
    this.form.reset({ name: '', description: '', position: this.categories().length });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description, position } = this.form.getRawValue();
    const input = { name, description: description || null, position };
    const editing = this.editing();
    this.submitting.set(true);
    this.error.set(null);
    (editing
      ? this.api.updateCategory(editing.id, input)
      : this.api.createCategory(input)
    ).subscribe({
      next: (saved) => {
        this.notifier.success('kb.categories.saved', { name: saved.name });
        this.submitting.set(false);
        this.editing.set(null);
        this.load();
      },
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        if (!applyServerErrors(this.form, problem)) {
          this.error.set(this.notifier.problemMessage(problem));
        }

        this.submitting.set(false);
      },
    });
  }

  protected remove(category: KbCategory): void {
    this.api.deleteCategory(category.id).subscribe(() => {
      this.notifier.success('kb.categories.deleted', { name: category.name });
      if (this.editing()?.id === category.id) {
        this.editing.set(null);
      }

      this.load();
    });
  }

  private load(): void {
    this.api.categories().subscribe((categories) => {
      this.categories.set(categories);
      if (!this.editing()) {
        this.form.reset({ name: '', description: '', position: categories.length });
      }
    });
  }
}
