import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  model,
  signal,
  untracked,
} from '@angular/core';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Attachment } from '../core/api/tickets.api';
import { toProblem } from '../core/http/problem';
import { FieldErrorPipe } from '../core/ui/field-error.pipe';
import { Notifier } from '../core/ui/notifier';
import { AttachmentPicker } from '../features/tickets/attachment-picker';
import { FileSizePipe } from '../shared/file-size.pipe';
import { LocalDatePipe } from '../shared/local-date.pipe';
import { PortalCard } from './portal-shell';
import {
  Csat,
  CsatSurvey,
  PortalService,
  PortalTicket as Ticket,
  PortalTicketListItem,
} from './portal.service';

/** Five stars the customer picks from, usable with a keyboard and a screen reader. */
@Component({
  selector: 'app-rating-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, TranslocoPipe],
  template: `
    <div class="stars" role="radiogroup" [attr.aria-label]="'portal.csat.ratingLabel' | transloco">
      @for (star of stars; track star) {
        <button
          type="button"
          role="radio"
          class="star"
          [class.on]="star <= rating()"
          [attr.aria-checked]="star === rating()"
          [attr.aria-label]="'portal.csat.stars' | transloco: { count: star }"
          (click)="rating.set(star)"
        >
          <mat-icon aria-hidden="true">star</mat-icon>
        </button>
      }
    </div>
  `,
  styles: `
    .stars {
      display: inline-flex;
      gap: 4px;
    }

    .star {
      display: grid;
      place-items: center;
      inline-size: 44px;
      block-size: 44px;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: var(--mat-sys-outline);
      cursor: pointer;
    }

    .star.on {
      color: #f9ab00;
    }

    .star.on mat-icon {
      font-variation-settings: 'FILL' 1;
    }

    .star:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .star mat-icon {
      font-size: 32px;
      inline-size: 32px;
      block-size: 32px;
    }
  `,
})
export class RatingInput {
  readonly rating = model(0);
  protected readonly stars = [1, 2, 3, 4, 5];
}

@Component({
  selector: 'app-portal-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatIconModule, RouterLink, TranslocoPipe],
  template: `
    <section class="hero">
      <h1>{{ 'portal.welcome.title' | transloco: { name: portal.info()?.name } }}</h1>
      <p>{{ 'portal.welcome.body' | transloco }}</p>
      <p class="actions">
        <a mat-flat-button [routerLink]="[base(), 'tickets', 'new']">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'portal.requests.new' | transloco }}
        </a>
        <a mat-stroked-button [routerLink]="[base(), 'tickets']">{{
          'portal.nav.requests' | transloco
        }}</a>
      </p>
    </section>
  `,
  styles: `
    .hero {
      text-align: center;
      padding-block: 32px;
    }

    h1 {
      font: var(--mat-sys-headline-medium);
      margin: 0 0 12px;
    }

    p {
      color: var(--mat-sys-on-surface-variant);
      max-inline-size: 520px;
      margin: 0 auto;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 12px;
      margin-block-start: 24px;
    }
  `,
})
export class PortalHome {
  protected readonly portal = inject(PortalService);
  protected readonly base = computed(() => `/portal/${this.portal.info()?.slug ?? ''}`);
}

@Component({
  selector: 'app-portal-tickets',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LocalDatePipe, MatButtonModule, MatIconModule, RouterLink, TranslocoPipe],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'portal.requests.title' | transloco }}</h1>
        <p>{{ 'portal.requests.subtitle' | transloco }}</p>
      </div>
      <a mat-flat-button [routerLink]="[base(), 'tickets', 'new']">
        <mat-icon aria-hidden="true">add</mat-icon>
        {{ 'portal.requests.new' | transloco }}
      </a>
    </header>

    @if (loaded() && tickets().length === 0) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">inbox</mat-icon>
        <h2>{{ 'portal.requests.emptyTitle' | transloco }}</h2>
        <p>{{ 'portal.requests.emptyBody' | transloco }}</p>
      </div>
    } @else {
      <ul class="requests">
        @for (ticket of tickets(); track ticket.id) {
          <li>
            <a [routerLink]="[base(), 'tickets', ticket.id]">
              <span class="subject">
                <span class="number" dir="ltr">#{{ ticket.number }}</span>
                {{ ticket.subject }}
              </span>
              <span class="meta">
                <span class="status-badge" [attr.data-status]="ticket.status">
                  {{ 'portal.status.' + ticket.status | transloco }}
                </span>
                {{ ticket.lastActivityAt | localDate: 'relative' }}
              </span>
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .requests {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      overflow: hidden;
    }

    .requests li + li {
      border-block-start: 1px solid var(--mat-sys-outline-variant);
    }

    .requests a {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px 16px;
      padding: 16px;
      color: inherit;
      text-decoration: none;
    }

    .requests a:hover,
    .requests a:focus-visible {
      background: var(--mat-sys-surface-container-low);
    }

    .subject {
      font: var(--mat-sys-title-small);
    }

    .number {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
      margin-inline-end: 6px;
    }

    .meta {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }
  `,
})
export class PortalTickets {
  private readonly portal = inject(PortalService);

  protected readonly base = computed(() => `/portal/${this.portal.info()?.slug ?? ''}`);
  protected readonly tickets = signal<readonly PortalTicketListItem[]>([]);
  protected readonly loaded = signal(false);

  constructor() {
    this.portal.tickets(this.portal.info()?.slug ?? '').subscribe((page) => {
      this.tickets.set(page.items);
      this.loaded.set(true);
    });
  }
}

@Component({
  selector: 'app-portal-ticket-new',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AttachmentPicker,
    FieldErrorPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'portal.requests.newTitle' | transloco }}</h1>
        <p>{{ 'portal.requests.newSubtitle' | transloco }}</p>
      </div>
    </header>
    <form class="form-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      @if (error(); as message) {
        <p class="form-alert" role="alert">{{ message }}</p>
      }
      <mat-form-field appearance="outline">
        <mat-label>{{ 'tickets.fields.subject' | transloco }}</mat-label>
        <input matInput formControlName="subject" />
        <mat-error>{{ form.controls.subject | fieldError }}</mat-error>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>{{ 'portal.requests.description' | transloco }}</mat-label>
        <textarea matInput rows="8" formControlName="description"></textarea>
        <mat-error>{{ form.controls.description | fieldError }}</mat-error>
      </mat-form-field>
      <app-attachment-picker [(attachments)]="attachments" [uploader]="upload" />
      <div class="form-actions">
        <a mat-button [routerLink]="[base(), 'tickets']">{{ 'common.cancel' | transloco }}</a>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{ 'portal.requests.submit' | transloco }}
        </button>
      </div>
    </form>
  `,
})
export class PortalTicketNew {
  private readonly portal = inject(PortalService);
  private readonly router = inject(Router);
  private readonly notifier = inject(Notifier);

  private readonly slug = this.portal.info()?.slug ?? '';
  protected readonly base = computed(() => `/portal/${this.slug}`);
  protected readonly attachments = signal<readonly Attachment[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly upload = (file: File) => this.portal.upload(this.slug, file);
  protected readonly form = inject(NonNullableFormBuilder).group({
    subject: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(20000)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { subject, description } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.portal
      .createTicket(
        this.slug,
        subject,
        description,
        this.attachments().map((attachment) => attachment.id),
      )
      .subscribe({
        next: (ticket) => {
          this.notifier.success('portal.requests.created', { number: ticket.number });
          void this.router.navigate([this.base(), 'tickets', ticket.id]);
        },
        error: (failure: unknown) => {
          this.error.set(this.notifier.problemMessage(toProblem(failure)));
          this.submitting.set(false);
        },
      });
  }
}

@Component({
  selector: 'app-portal-ticket',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AttachmentPicker,
    FileSizePipe,
    FormsModule,
    LocalDatePipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    RatingInput,
    RouterLink,
    TranslocoPipe,
  ],
  template: `
    <a class="back" [routerLink]="[base(), 'tickets']">
      <mat-icon aria-hidden="true">arrow_back</mat-icon>
      {{ 'portal.nav.requests' | transloco }}
    </a>

    @if (ticket(); as ticket) {
      <header class="page-header">
        <div>
          <h1>
            <span class="number" dir="ltr">#{{ ticket.number }}</span>
            {{ ticket.subject }}
          </h1>
          <p>
            <span class="status-badge" [attr.data-status]="ticket.status">
              {{ 'portal.status.' + ticket.status | transloco }}
            </span>
          </p>
        </div>
      </header>

      <ol class="thread" [attr.aria-label]="'portal.requests.conversation' | transloco">
        @for (message of ticket.messages; track message.id) {
          <li class="message" [class.support]="message.fromSupport">
            <header>
              <strong>{{ message.authorName }}</strong>
              @if (message.fromSupport) {
                <span class="badge">{{ 'portal.requests.supportTeam' | transloco }}</span>
              }
              <time [attr.datetime]="message.createdAt" [title]="message.createdAt | localDate">
                {{ message.createdAt | localDate: 'relative' }}
              </time>
            </header>
            <p class="body" dir="auto">{{ message.body }}</p>
            @if (message.attachments.length > 0) {
              <ul class="attachments">
                @for (attachment of message.attachments; track attachment.id) {
                  <li>
                    <button type="button" class="attachment" (click)="download(attachment)">
                      <mat-icon aria-hidden="true">download</mat-icon>
                      <span>{{ attachment.fileName }}</span>
                      <span class="size">{{ attachment.sizeBytes | fileSize }}</span>
                    </button>
                  </li>
                }
              </ul>
            }
          </li>
        }
      </ol>

      @if (ticket.canRate) {
        <mat-card appearance="outlined" class="rate">
          <h2>{{ (ticket.csat ? 'portal.csat.thanksTitle' : 'portal.csat.title') | transloco }}</h2>
          <app-rating-input [(rating)]="rating" />
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'portal.csat.comment' | transloco }}</mat-label>
            <textarea
              matInput
              rows="2"
              maxlength="1000"
              [ngModel]="comment()"
              (ngModelChange)="comment.set($event)"
            ></textarea>
          </mat-form-field>
          <div class="form-actions">
            <button
              mat-flat-button
              type="button"
              [disabled]="rating() === 0 || busy()"
              (click)="rate(ticket)"
            >
              {{ (ticket.csat ? 'portal.csat.update' : 'portal.csat.submit') | transloco }}
            </button>
          </div>
        </mat-card>
      }

      @if (ticket.canReply) {
        <form class="composer" (ngSubmit)="send(ticket)">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>
              {{
                (ticket.status === 'Solved'
                  ? 'portal.requests.replyReopens'
                  : 'portal.requests.reply'
                ) | transloco
              }}
            </mat-label>
            <textarea
              matInput
              rows="4"
              name="body"
              maxlength="20000"
              [ngModel]="body()"
              (ngModelChange)="body.set($event)"
            ></textarea>
          </mat-form-field>
          @if (error(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <app-attachment-picker [(attachments)]="attachments" [uploader]="upload" />
          <div class="form-actions">
            <button mat-flat-button type="submit" [disabled]="busy() || !body().trim()">
              {{ 'portal.requests.send' | transloco }}
            </button>
          </div>
        </form>
      } @else {
        <p class="form-notice">{{ 'portal.requests.closed' | transloco }}</p>
      }
    } @else if (missing()) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">search_off</mat-icon>
        <h2>{{ 'portal.requests.notFoundTitle' | transloco }}</h2>
        <p>{{ 'portal.requests.notFoundBody' | transloco }}</p>
      </div>
    } @else {
      <div class="empty-state" role="status">
        <mat-spinner diameter="40" [attr.aria-label]="'common.loading' | transloco" />
      </div>
    }
  `,
  styles: `
    .back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      text-decoration: none;
      margin-block-end: 12px;
    }

    .back mat-icon {
      font-size: 18px;
      inline-size: 18px;
      block-size: 18px;
    }

    :host-context([dir='rtl']) .back mat-icon {
      transform: scaleX(-1);
    }

    h1 .number {
      color: var(--mat-sys-on-surface-variant);
      font-weight: 400;
    }

    .thread {
      list-style: none;
      margin: 0 0 16px;
      padding: 0;
      display: grid;
      gap: 12px;
    }

    .message {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 12px 16px;
    }

    .message.support {
      background: var(--mat-sys-surface-container-low);
    }

    .message header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-block-end: 8px;
    }

    time {
      margin-inline-start: auto;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .body {
      margin: 0;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      text-align: start;
    }

    .attachments {
      list-style: none;
      margin: 12px 0 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .attachment {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px 4px 8px;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 16px;
      background: transparent;
      color: inherit;
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }

    .attachment:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .size {
      opacity: 0.7;
      font: var(--mat-sys-body-small);
    }

    .rate,
    .composer {
      display: grid;
      gap: 12px;
      padding: 16px;
      margin-block-end: 16px;
    }

    .composer {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .rate h2 {
      font: var(--mat-sys-title-medium);
      margin: 0;
    }
  `,
})
export class PortalTicket {
  private readonly portal = inject(PortalService);
  private readonly notifier = inject(Notifier);

  readonly id = input.required<string>();

  private readonly slug = this.portal.info()?.slug ?? '';
  protected readonly base = computed(() => `/portal/${this.slug}`);
  protected readonly ticket = signal<Ticket | null>(null);
  protected readonly missing = signal(false);
  protected readonly body = signal('');
  protected readonly attachments = signal<readonly Attachment[]>([]);
  protected readonly rating = signal(0);
  protected readonly comment = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly upload = (file: File) => this.portal.upload(this.slug, file);

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() =>
        this.portal.ticket(this.slug, id).subscribe({
          next: (ticket) => this.show(ticket),
          error: () => this.missing.set(true),
        }),
      );
    });
  }

  protected send(ticket: Ticket): void {
    const body = this.body().trim();
    if (!body || this.busy()) {
      return;
    }

    this.busy.set(true);
    this.error.set(null);
    this.portal
      .reply(
        this.slug,
        ticket.id,
        body,
        this.attachments().map((attachment) => attachment.id),
      )
      .subscribe({
        next: (updated) => {
          this.show(updated);
          this.body.set('');
          this.attachments.set([]);
          this.busy.set(false);
        },
        error: (failure: unknown) => {
          this.error.set(this.notifier.problemMessage(toProblem(failure)));
          this.busy.set(false);
        },
      });
  }

  protected rate(ticket: Ticket): void {
    this.busy.set(true);
    this.portal.rate(this.slug, ticket.id, this.rating(), this.comment().trim() || null).subscribe({
      next: (updated) => {
        this.show(updated);
        this.notifier.success('portal.csat.saved');
        this.busy.set(false);
      },
      error: () => this.busy.set(false),
    });
  }

  protected download(attachment: Attachment): void {
    this.portal
      .download(this.slug, attachment.id)
      .subscribe((blob) => saveBlob(blob, attachment.fileName));
  }

  private show(ticket: Ticket): void {
    this.ticket.set(ticket);
    this.showRating(ticket.csat);
  }

  private showRating(csat: Csat | null): void {
    this.rating.set(csat?.rating ?? 0);
    this.comment.set(csat?.comment ?? '');
  }
}

/** Rates a request from the link in the "solved" email, without signing in. */
@Component({
  selector: 'app-portal-csat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    PortalCard,
    RatingInput,
    TranslocoPipe,
  ],
  template: `
    @if (survey(); as survey) {
      <app-portal-card
        [heading]="(done() ? 'portal.csat.thanksTitle' : 'portal.csat.title') | transloco"
        [subheading]="
          'portal.csat.about'
            | transloco: { number: survey.ticketNumber, subject: survey.ticketSubject }
        "
      >
        <div class="form-stack">
          <app-rating-input [(rating)]="rating" />
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>{{ 'portal.csat.comment' | transloco }}</mat-label>
            <textarea
              matInput
              rows="3"
              maxlength="1000"
              [ngModel]="comment()"
              (ngModelChange)="comment.set($event)"
            ></textarea>
          </mat-form-field>
          <button
            mat-flat-button
            type="button"
            [disabled]="rating() === 0 || busy()"
            (click)="submit()"
          >
            {{ (done() ? 'portal.csat.update' : 'portal.csat.submit') | transloco }}
          </button>
        </div>
      </app-portal-card>
    } @else if (invalid()) {
      <app-portal-card
        [heading]="'portal.csat.invalidTitle' | transloco"
        [subheading]="'portal.csat.invalidBody' | transloco"
      />
    } @else {
      <app-portal-card [heading]="'common.loading' | transloco">
        <mat-spinner diameter="40" [attr.aria-label]="'common.loading' | transloco" />
      </app-portal-card>
    }
  `,
})
export class PortalCsat implements OnInit {
  private readonly portal = inject(PortalService);
  private readonly notifier = inject(Notifier);

  readonly token = input<string>();

  private readonly slug = this.portal.info()?.slug ?? '';
  protected readonly survey = signal<CsatSurvey | null>(null);
  protected readonly invalid = signal(false);
  protected readonly done = signal(false);
  protected readonly busy = signal(false);
  protected readonly rating = signal(0);
  protected readonly comment = signal('');

  ngOnInit(): void {
    this.portal.survey(this.slug, this.token() ?? '').subscribe({
      next: (survey) => this.show(survey),
      error: () => this.invalid.set(true),
    });
  }

  protected submit(): void {
    this.busy.set(true);
    this.portal
      .submitSurvey(this.slug, this.token() ?? '', this.rating(), this.comment().trim() || null)
      .subscribe({
        next: (survey) => {
          this.show(survey);
          this.notifier.success('portal.csat.saved');
          this.busy.set(false);
        },
        error: (failure: unknown) => {
          this.notifier.problem(toProblem(failure));
          this.busy.set(false);
        },
      });
  }

  private show(survey: CsatSurvey): void {
    this.survey.set(survey);
    this.done.set(survey.csat !== null);
    this.rating.set(survey.csat?.rating ?? 0);
    this.comment.set(survey.csat?.comment ?? '');
  }
}

function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
