import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { TranslocoPipe } from '@jsverse/transloco';
import { debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { TicketDetail, TicketListItem, TicketsApi } from '../../core/api/tickets.api';

/** Lets the agent find the ticket a duplicate should be merged into. Closes with that ticket. */
@Component({
  selector: 'app-merge-dialog',
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
    <h2 mat-dialog-title>{{ 'tickets.merge.title' | transloco: { number: duplicate.number } }}</h2>
    <mat-dialog-content class="form-stack">
      <p class="dialog-lead">{{ 'tickets.merge.body' | transloco }}</p>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'tickets.merge.search' | transloco }}</mat-label>
        <input matInput type="search" cdkFocusInitial [formControl]="term" />
      </mat-form-field>
      <mat-selection-list
        [multiple]="false"
        [attr.aria-label]="'tickets.merge.results' | transloco"
        (selectionChange)="target.set($event.options[0].value)"
      >
        @for (ticket of results(); track ticket.id) {
          <mat-list-option [value]="ticket">
            <span matListItemTitle>
              <span dir="ltr">#{{ ticket.number }}</span> {{ ticket.subject }}
            </span>
            <span matListItemLine>
              {{ ticket.requester.name }} · {{ 'ticketStatus.' + ticket.status | transloco }}
            </span>
          </mat-list-option>
        } @empty {
          @if (searched()) {
            <p class="empty">{{ 'tickets.merge.noResults' | transloco }}</p>
          }
        }
      </mat-selection-list>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
      <button mat-flat-button type="button" [disabled]="!target()" [mat-dialog-close]="target()">
        {{ 'tickets.merge.submit' | transloco }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .empty {
      margin: 8px 0;
      color: var(--mat-sys-on-surface-variant);
    }
  `,
})
export class MergeDialog {
  protected readonly duplicate = inject<TicketDetail>(MAT_DIALOG_DATA);
  private readonly api = inject(TicketsApi);

  protected readonly term = new FormControl('', { nonNullable: true });
  protected readonly results = signal<readonly TicketListItem[]>([]);
  protected readonly searched = signal(false);
  protected readonly target = signal<TicketListItem | null>(null);

  constructor() {
    this.term.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        filter((value) => value.trim().length >= 2),
        switchMap((value) =>
          this.api.list({
            search: value.trim(),
            status: ['New', 'Open', 'Pending', 'OnHold', 'Solved'],
            page: 1,
            pageSize: 8,
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((page) => {
        this.results.set(page.items.filter((ticket) => ticket.id !== this.duplicate.id));
        this.searched.set(true);
        this.target.set(null);
      });
  }
}
