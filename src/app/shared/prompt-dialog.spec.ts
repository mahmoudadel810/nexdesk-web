import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../public/i18n/en.json';
import { PromptDialog, PromptOptions } from './prompt-dialog';

describe('PromptDialog', () => {
  async function render(options: PromptOptions) {
    const dialogRef = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [
        PromptDialog,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: options },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(PromptDialog);
    await fixture.whenStable();
    return { element: fixture.nativeElement as HTMLElement, dialogRef };
  }

  it('closes with the trimmed text and keeps the page from reloading', async () => {
    const { element, dialogRef } = await render({
      title: 'Name the view',
      label: 'Name',
      value: '',
      maxLength: 50,
    });
    const input = element.querySelector('input')!;
    input.value = '  Urgent tickets  ';
    input.dispatchEvent(new Event('input'));

    const submit = new Event('submit', { cancelable: true });
    element.querySelector('form')!.dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
    expect(dialogRef.close).toHaveBeenCalledWith('Urgent tickets');
  });

  it('stays open while the text is blank and names the action on its button', async () => {
    const { element, dialogRef } = await render({
      title: 'Suspend?',
      label: 'Reason',
      value: '   ',
      maxLength: 50,
      confirmLabel: 'Suspend workspace',
    });

    element.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(element.querySelector('button[type="submit"]')?.textContent?.trim()).toBe(
      'Suspend workspace',
    );
  });
});
