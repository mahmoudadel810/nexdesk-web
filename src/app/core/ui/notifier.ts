import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoService } from '@jsverse/transloco';
import { Problem } from '../http/problem';

@Injectable({ providedIn: 'root' })
export class Notifier {
  private readonly snackBar = inject(MatSnackBar);
  private readonly transloco = inject(TranslocoService);

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
    this.open(this.problemMessage(problem), 7000);
  }

  /** Translated text for a failure, falling back to a generic message for unknown codes. */
  problemMessage(problem: Problem): string {
    const key = `errors.${problem.code}`;
    const message = this.transloco.translate(key);
    return message === key ? this.transloco.translate('errors.generic') : message;
  }

  private open(message: string, duration: number): void {
    this.snackBar.open(message, this.transloco.translate('common.dismiss'), { duration });
  }
}
