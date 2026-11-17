import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { BillingApi, Plan, Subscription, formatMoney } from '../../core/api/billing.api';
import { toProblem } from '../../core/http/problem';
import { LanguageService } from '../../core/i18n/language.service';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';

export interface CheckoutDialogData {
  readonly plan: Plan;
  readonly current: Plan;
}

/** The card payment providers publish for testing. It passes every checksum and belongs to nobody. */
const TEST_CARD = '4242 4242 4242 4242';

/**
 * Confirms a plan change. A paid plan asks for a card, but the payment is simulated: nothing is
 * charged, and the page says so before anything is typed.
 */
@Component({
  selector: 'app-checkout-dialog',
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
    <h2 mat-dialog-title>
      {{ 'billing.checkout.title' | transloco: { plan: data.plan.name } }}
    </h2>
    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <mat-dialog-content class="form-stack">
        <p class="dialog-lead">
          @if (paid) {
            {{ 'billing.checkout.summary' | transloco: { plan: data.plan.name, price: price() } }}
          } @else {
            {{ 'billing.checkout.freeSummary' | transloco: { plan: data.current.name } }}
          }
        </p>
        @if (error(); as message) {
          <p class="form-alert" role="alert">{{ message }}</p>
        }

        @if (paid) {
          <div class="form-notice" role="note">
            <mat-icon aria-hidden="true">science</mat-icon>
            <span>
              {{ 'billing.checkout.simulated' | transloco }}
              <button mat-button type="button" (click)="fillTestCard()">
                {{ 'billing.checkout.useTestCard' | transloco }}
              </button>
            </span>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>{{ 'billing.checkout.cardholder' | transloco }}</mat-label>
            <input matInput formControlName="cardholderName" autocomplete="off" />
            <mat-error>{{ form.controls.cardholderName | fieldError }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'billing.checkout.cardNumber' | transloco }}</mat-label>
            <input
              matInput
              formControlName="cardNumber"
              inputmode="numeric"
              autocomplete="off"
              dir="ltr"
              maxlength="23"
            />
            <mat-error>{{ form.controls.cardNumber | fieldError }}</mat-error>
          </mat-form-field>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'billing.checkout.expiryMonth' | transloco }}</mat-label>
              <input
                matInput
                type="number"
                min="1"
                max="12"
                formControlName="expiryMonth"
                autocomplete="off"
              />
              <mat-error>{{ form.controls.expiryMonth | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'billing.checkout.expiryYear' | transloco }}</mat-label>
              <input
                matInput
                type="number"
                [min]="thisYear"
                [max]="thisYear + 20"
                formControlName="expiryYear"
                autocomplete="off"
              />
              <mat-error>{{ form.controls.expiryYear | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'billing.checkout.cvc' | transloco }}</mat-label>
              <input
                matInput
                formControlName="cvc"
                inputmode="numeric"
                autocomplete="off"
                dir="ltr"
                maxlength="4"
              />
              <mat-error>{{ form.controls.cvc | fieldError }}</mat-error>
            </mat-form-field>
          </div>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>{{ 'common.cancel' | transloco }}</button>
        <button mat-flat-button type="submit" [disabled]="submitting()">
          {{
            (paid ? 'billing.checkout.pay' : 'billing.checkout.confirm')
              | transloco: { price: price() }
          }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .row {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }

    .form-notice {
      display: flex;
      align-items: flex-start;
      gap: 12px;
    }

    .form-notice mat-icon {
      flex: none;
    }

    @media (max-width: 480px) {
      .row {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class CheckoutDialog {
  protected readonly data = inject<CheckoutDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject<MatDialogRef<CheckoutDialog, Subscription>>(MatDialogRef);
  private readonly api = inject(BillingApi);
  private readonly notifier = inject(Notifier);
  private readonly language = inject(LanguageService);

  protected readonly paid = this.data.plan.priceCentsMonthly > 0;
  protected readonly thisYear = new Date().getFullYear();
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly price = computed(() =>
    formatMoney(
      this.data.plan.priceCentsMonthly,
      this.data.plan.currency,
      this.language.language(),
    ),
  );
  protected readonly form = inject(NonNullableFormBuilder).group({
    cardholderName: ['', [Validators.required, Validators.maxLength(100)]],
    cardNumber: ['', [Validators.required, Validators.pattern(/^[0-9 -]{13,23}$/)]],
    expiryMonth: [
      null as number | null,
      [Validators.required, Validators.min(1), Validators.max(12)],
    ],
    expiryYear: [null as number | null, [Validators.required, Validators.min(this.thisYear)]],
    cvc: ['', [Validators.required, Validators.pattern(/^[0-9]{3,4}$/)]],
  });

  protected fillTestCard(): void {
    this.form.patchValue({
      cardNumber: TEST_CARD,
      expiryMonth: 12,
      expiryYear: this.thisYear + 2,
      cvc: '123',
    });
  }

  protected submit(): void {
    if (this.paid && this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { cardholderName, cardNumber, expiryMonth, expiryYear, cvc } = this.form.getRawValue();
    const card = this.paid
      ? {
          cardholderName: cardholderName.trim(),
          cardNumber,
          expiryMonth: expiryMonth ?? 0,
          expiryYear: expiryYear ?? 0,
          cvc,
        }
      : null;
    this.submitting.set(true);
    this.error.set(null);
    this.api.checkout(this.data.plan.code, card).subscribe({
      next: (subscription) => this.dialogRef.close(subscription),
      error: (failure: unknown) => {
        this.error.set(this.notifier.problemMessage(toProblem(failure)));
        this.submitting.set(false);
      },
    });
  }
}
