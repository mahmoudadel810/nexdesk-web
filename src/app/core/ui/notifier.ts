import { Injectable, Injector, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { AuthService } from '../auth/auth.service';
import { Problem } from '../http/problem';

/** The status the API answers with when the workspace's plan does not allow something. */
const PLAN_LIMIT_STATUS = 402;
const BILLING_PAGE = '/app/settings/billing';

@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);
  private readonly injector = inject(Injector);

  translate(key: string, params?: Record<string, unknown>): string {
    return this.transloco.translate(key, params);
  }

  success(key: string, params?: Record<string, unknown>): void {
    this.open(this.translate(key, params), 4000);
  }

  /** Shows text that is already translated. */
  message(text: string): void {
    this.open(text, 5000);
  }

  problem(problem: Problem): void {
    if (
      problem.status === PLAN_LIMIT_STATUS &&
      this.injector.get(AuthService).can('settings.manage')
    ) {
      this.offerUpgrade(this.problemMessage(problem));
    } else {
      this.open(this.problemMessage(problem), 7000);
    }
  }

  /** Translated text for a failure, falling back to a generic message for unknown codes. */
  problemMessage(problem: Problem): string {
    const key = `errors.${problem.code}`;
    const message = this.transloco.translate(key);
    return message === key ? this.transloco.translate('errors.generic') : message;
  }

  /** A plan limit comes with a way out: a button that leads to the plans. */
  private offerUpgrade(message: string): void {
    this.snackBar
      .open(message, this.transloco.translate('billing.viewPlans'), { duration: 12000 })
      .onAction()
      .subscribe(() => void this.injector.get(Router).navigateByUrl(BILLING_PAGE));
  }

  private open(message: string, duration: number): void {
    this.snackBar.open(message, this.transloco.translate('common.dismiss'), { duration });
  }
}
