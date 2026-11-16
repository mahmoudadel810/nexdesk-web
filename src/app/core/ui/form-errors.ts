import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { Problem } from '../http/problem';

export interface FieldError {
  readonly key: string;
  readonly params?: Record<string, unknown>;
  /** Untranslated message from the API, shown as-is. */
  readonly text?: string;
}

/** The first validation failure of a control, as a translation key. */
export function fieldError(control: AbstractControl | null): FieldError | null {
  const errors = control?.errors;
  if (!errors) {
    return null;
  }

  if (errors['required']) {
    return { key: 'validation.required' };
  }

  if (errors['email']) {
    return { key: 'validation.email' };
  }

  if (errors['minlength']) {
    return { key: 'validation.minLength', params: { min: errors['minlength'].requiredLength } };
  }

  if (errors['maxlength']) {
    return { key: 'validation.maxLength', params: { max: errors['maxlength'].requiredLength } };
  }

  if (errors['passwordStrength']) {
    return { key: 'validation.passwordStrength' };
  }

  if (errors['mismatch']) {
    return { key: 'validation.passwordMismatch' };
  }

  if (typeof errors['server'] === 'string') {
    return { key: 'validation.server', text: errors['server'] };
  }

  return { key: 'validation.invalid' };
}

/** Copies per-field messages from a validation problem onto the matching controls. */
export function applyServerErrors(form: FormGroup, problem: Problem): boolean {
  let applied = false;
  for (const [field, messages] of Object.entries(problem.errors ?? {})) {
    const control = form.get(field);
    if (control && messages.length > 0) {
      control.setErrors({ ...control.errors, server: messages[0] });
      control.markAsTouched();
      applied = true;
    }
  }

  return applied;
}

export const passwordStrength: ValidatorFn = (control): ValidationErrors | null => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return /\p{L}/u.test(value) && /\p{Nd}/u.test(value) ? null : { passwordStrength: true };
};

export function matches(otherControlName: string): ValidatorFn {
  return (control) => {
    const other = control.parent?.get(otherControlName);
    return other && control.value !== other.value ? { mismatch: true } : null;
  };
}
