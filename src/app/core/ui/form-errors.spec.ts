import { FormControl, FormGroup, Validators } from '@angular/forms';
import { applyServerErrors, fieldError, matches, passwordStrength } from './form-errors';

describe('form errors', () => {
  it('maps built-in validator failures to translation keys', () => {
    expect(fieldError(new FormControl('', Validators.required))).toEqual({
      key: 'validation.required',
    });
    expect(fieldError(new FormControl('nope', Validators.email))).toEqual({
      key: 'validation.email',
    });
    expect(fieldError(new FormControl('abc', Validators.minLength(8)))).toEqual({
      key: 'validation.minLength',
      params: { min: 8 },
    });
    expect(fieldError(new FormControl('fine'))).toBeNull();
  });

  it('requires a letter and a digit in passwords, in any script', () => {
    expect(passwordStrength(new FormControl('abcdefgh'))).toEqual({ passwordStrength: true });
    expect(passwordStrength(new FormControl('12345678'))).toEqual({ passwordStrength: true });
    expect(passwordStrength(new FormControl('abcd1234'))).toBeNull();
    expect(passwordStrength(new FormControl('كلمةسر١٢٣'))).toBeNull();
    expect(passwordStrength(new FormControl(''))).toBeNull();
  });

  it('flags a confirmation that differs from the other field', () => {
    const form = new FormGroup({
      password: new FormControl('abcd1234'),
      confirm: new FormControl('abcd9999', matches('password')),
    });

    form.controls.confirm.updateValueAndValidity();
    expect(fieldError(form.controls.confirm)).toEqual({ key: 'validation.passwordMismatch' });

    form.controls.confirm.setValue('abcd1234');
    expect(form.controls.confirm.valid).toBe(true);
  });

  it('puts API field messages on the matching controls', () => {
    const form = new FormGroup({ email: new FormControl('a@b.c'), name: new FormControl('x') });

    const applied = applyServerErrors(form, {
      status: 400,
      code: 'validation',
      errors: { email: ['Already used.'], unknownField: ['Ignored.'] },
    });

    expect(applied).toBe(true);
    expect(fieldError(form.controls.email)).toEqual({
      key: 'validation.server',
      text: 'Already used.',
    });
    expect(form.controls.name.valid).toBe(true);
  });

  it('reports when a problem has no field it can attach to', () => {
    const form = new FormGroup({ email: new FormControl('a@b.c') });

    expect(applyServerErrors(form, { status: 409, code: 'email-taken' })).toBe(false);
  });
});
