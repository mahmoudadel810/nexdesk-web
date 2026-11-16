import { Pipe, PipeTransform, inject } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslocoService } from '@jsverse/transloco';
import { fieldError } from './form-errors';

/** Translated message for a control's first validation error. Impure because errors change in place. */
@Pipe({ name: 'fieldError', pure: false })
export class FieldErrorPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(control: AbstractControl | null): string {
    const error = fieldError(control);
    if (!error) {
      return '';
    }

    return error.text ?? this.transloco.translate(error.key, error.params);
  }
}
