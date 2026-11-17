import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { WorkspaceSettings } from '../../core/api/settings.api';
import { brandTokens, contrastRatio, luminance, onColor } from '../../shared/brand';
import { WorkspaceSettingsPage, logoProblem } from './workspace-settings';

const SETTINGS: WorkspaceSettings = {
  name: 'Acme Support',
  slug: 'acme',
  timezone: 'Europe/London',
  defaultLanguage: 'en',
  brandColor: null,
  portalWelcomeText: null,
  logoUrl: null,
};

describe('Brand colours', () => {
  it('measures luminance and contrast the way WCAG does', () => {
    expect(luminance('#ffffff')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  it('puts white text on dark colours and dark text on light ones', () => {
    expect(onColor('#1a237e')).toBe('#ffffff');
    expect(onColor('#ffeb3b')).toBe('#1b1b1f');
  });

  it('overrides the primary tokens for a valid colour only, lighter in dark mode', () => {
    const tokens = brandTokens('#2e7d32');
    expect(tokens['--mat-sys-primary']).toBe(
      'light-dark(#2e7d32, color-mix(in srgb, #2e7d32 60%, white))',
    );
    expect(tokens['--mat-sys-on-primary']).toContain('#ffffff');
    expect(brandTokens(null)).toEqual({});
    expect(brandTokens('red')).toEqual({});
  });

  it('checks a picked logo before uploading it', () => {
    expect(logoProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(logoProblem({ type: 'image/svg+xml', size: 1000 })).toBe('errors.logo-type');
    expect(logoProblem({ type: 'image/webp', size: 600 * 1024 })).toBe('errors.logo-too-large');
  });
});

describe('WorkspaceSettingsPage', () => {
  let backend: HttpTestingController;

  async function render(): Promise<{ element: HTMLElement; detect: () => Promise<void> }> {
    TestBed.configureTestingModule({
      imports: [
        WorkspaceSettingsPage,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(WorkspaceSettingsPage);
    await fixture.whenStable();
    backend.expectOne('/api/v1/settings').flush(SETTINGS);
    fixture.detectChanges();
    await fixture.whenStable();
    return {
      element: fixture.nativeElement as HTMLElement,
      detect: async () => {
        fixture.detectChanges();
        await fixture.whenStable();
      },
    };
  }

  afterEach(() => backend.verify());

  function type(element: HTMLElement, selector: string, value: string): void {
    const input = element.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  it('saves the changed settings, sending blank branding as cleared', async () => {
    const { element, detect } = await render();
    type(element, 'input[formcontrolname="name"]', 'Acme Help');
    type(element, 'input[formcontrolname="brandColor"]', '#2E7D32');
    type(element, 'textarea[formcontrolname="portalWelcomeText"]', '  Hello!  ');
    await detect();

    expect(element.querySelector('.portal-bar')?.textContent).toContain('Acme Help');
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const request = backend.expectOne('/api/v1/settings');
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({
      name: 'Acme Help',
      timezone: 'Europe/London',
      defaultLanguage: 'en',
      brandColor: '#2E7D32',
      portalWelcomeText: 'Hello!',
    });
    request.flush({
      ...SETTINGS,
      name: 'Acme Help',
      brandColor: '#2e7d32',
      portalWelcomeText: 'Hello!',
    });
  });

  it('refuses a malformed colour and warns about one too light to read', async () => {
    const { element, detect } = await render();
    type(element, 'input[formcontrolname="brandColor"]', 'green');
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    await detect();
    expect(element.textContent).toContain('Enter # followed by six hexadecimal digits');

    type(element, 'input[formcontrolname="brandColor"]', '#fff59d');
    await detect();
    expect(element.textContent).toContain('This colour is light');
  });
});
