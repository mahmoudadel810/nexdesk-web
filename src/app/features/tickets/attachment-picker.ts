import { ChangeDetectionStrategy, Component, inject, input, model, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable } from 'rxjs';
import { Attachment, TicketsApi } from '../../core/api/tickets.api';
import { toProblem } from '../../core/http/problem';
import { Notifier } from '../../core/ui/notifier';
import { FileSizePipe } from '../../shared/file-size.pipe';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;

/** Uploads files as soon as they are chosen and exposes the uploaded attachments as a two-way model. */
@Component({
  selector: 'app-attachment-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FileSizePipe, MatButtonModule, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  template: `
    <input
      #input
      type="file"
      multiple
      class="visually-hidden"
      tabindex="-1"
      [attr.aria-label]="'tickets.attachments.add' | transloco"
      (change)="onFiles(input)"
    />
    <button
      mat-button
      type="button"
      [disabled]="uploading() > 0 || attachments().length >= max"
      (click)="input.click()"
    >
      <mat-icon aria-hidden="true">attach_file</mat-icon>
      {{ 'tickets.attachments.add' | transloco }}
    </button>
    @if (uploading() > 0) {
      <mat-spinner diameter="20" [attr.aria-label]="'tickets.attachments.uploading' | transloco" />
    }
    @if (attachments().length > 0) {
      <ul class="files" [attr.aria-label]="'tickets.attachments.title' | transloco">
        @for (attachment of attachments(); track attachment.id) {
          <li>
            <mat-icon aria-hidden="true">draft</mat-icon>
            <span class="name">{{ attachment.fileName }}</span>
            <span class="size">{{ attachment.sizeBytes | fileSize }}</span>
            <button
              mat-icon-button
              type="button"
              [attr.aria-label]="
                'tickets.attachments.remove' | transloco: { name: attachment.fileName }
              "
              (click)="remove(attachment)"
            >
              <mat-icon aria-hidden="true">close</mat-icon>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .files {
      flex: 1 1 100%;
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 4px;
    }

    .files li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding-inline-start: 8px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
    }

    .name {
      flex: 1 1 auto;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .size {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class AttachmentPicker {
  private readonly api = inject(TicketsApi);
  private readonly notifier = inject(Notifier);

  readonly attachments = model<readonly Attachment[]>([]);

  /** How a file is uploaded. Defaults to the staff endpoint; the help centre passes its own. */
  readonly uploader = input<(file: File) => Observable<Attachment>>((file) =>
    this.api.upload(file),
  );

  protected readonly max = MAX_ATTACHMENTS;
  protected readonly uploading = signal(0);

  protected onFiles(input: HTMLInputElement): void {
    const files = [...(input.files ?? [])].slice(0, MAX_ATTACHMENTS - this.attachments().length);
    input.value = '';

    for (const file of files) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        this.notifier.problem({ status: 400, code: 'file-too-large' });
        continue;
      }

      this.uploading.update((count) => count + 1);
      this.uploader()(file).subscribe({
        next: (attachment) => {
          this.attachments.update((current) => [...current, attachment]);
          this.uploading.update((count) => count - 1);
        },
        error: (failure: unknown) => {
          this.notifier.problem(toProblem(failure));
          this.uploading.update((count) => count - 1);
        },
      });
    }
  }

  protected remove(attachment: Attachment): void {
    this.attachments.update((current) => current.filter((item) => item.id !== attachment.id));
  }
}
