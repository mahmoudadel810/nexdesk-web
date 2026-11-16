import { Directionality } from '@angular/cdk/bidi';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  function setup(): LanguageService {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { en: {}, ar: {} },
          translocoConfig: { availableLangs: ['en', 'ar'], defaultLang: 'en' },
        }),
      ],
    });
    return TestBed.inject(LanguageService);
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
  });

  it('starts in English with a left-to-right layout', () => {
    const service = setup();
    TestBed.tick();

    expect(service.language()).toBe('en');
    expect(service.direction()).toBe('ltr');
    expect(document.documentElement.dir).toBe('ltr');
  });

  it('switches the document, Material and Transloco to Arabic right-to-left', () => {
    const service = setup();

    service.use('ar');
    TestBed.tick();

    expect(service.direction()).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(TestBed.inject(Directionality).value).toBe('rtl');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('ar');
  });

  it('remembers the chosen language', () => {
    setup().use('ar');
    TestBed.resetTestingModule();

    expect(setup().language()).toBe('ar');
  });

  it('ignores an unsupported stored language', () => {
    localStorage.setItem('nexdesk.language', 'fr');

    expect(setup().language()).toBe('en');
  });
});
