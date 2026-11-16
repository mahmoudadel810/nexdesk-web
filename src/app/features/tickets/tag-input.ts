import { COMMA, ENTER } from '@angular/cdk/keycodes';
import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { MatChipInputEvent, MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 30;

export function normalizeTag(value: string): string {
  return value.trim().toLowerCase().slice(0, MAX_TAG_LENGTH);
}

@Component({
  selector: 'app-tag-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatChipsModule, MatFormFieldModule, MatIconModule, TranslocoPipe],
  template: `
    <mat-form-field appearance="outline" subscriptSizing="dynamic">
      <mat-label>{{ 'tickets.fields.tags' | transloco }}</mat-label>
      <mat-chip-grid
        #grid
        [disabled]="disabled()"
        [attr.aria-label]="'tickets.fields.tags' | transloco"
      >
        @for (tag of tags(); track tag) {
          <mat-chip-row (removed)="remove(tag)">
            {{ tag }}
            <button
              matChipRemove
              type="button"
              [attr.aria-label]="'tickets.tags.remove' | transloco: { tag }"
            >
              <mat-icon aria-hidden="true">cancel</mat-icon>
            </button>
          </mat-chip-row>
        }
      </mat-chip-grid>
      <input
        [placeholder]="'tickets.tags.placeholder' | transloco"
        [matChipInputFor]="grid"
        [matChipInputSeparatorKeyCodes]="separators"
        [matChipInputAddOnBlur]="true"
        (matChipInputTokenEnd)="add($event)"
      />
    </mat-form-field>
  `,
  styles: `
    mat-form-field {
      inline-size: 100%;
    }
  `,
})
export class TagInput {
  readonly tags = model<readonly string[]>([]);
  readonly disabled = input(false);

  protected readonly separators = [ENTER, COMMA];

  protected add(event: MatChipInputEvent): void {
    const tag = normalizeTag(event.value);
    if (tag && !this.tags().includes(tag) && this.tags().length < MAX_TAGS) {
      this.tags.update((tags) => [...tags, tag]);
    }

    event.chipInput.clear();
  }

  protected remove(tag: string): void {
    this.tags.update((tags) => tags.filter((item) => item !== tag));
  }
}
