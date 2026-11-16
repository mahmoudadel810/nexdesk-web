import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import ar from '../../../../public/i18n/ar.json';
import en from '../../../../public/i18n/en.json';
import { LanguageService } from '../../core/i18n/language.service';
import { Landing } from './landing';

describe('Landing', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [
        Landing,
        TranslocoTestingModule.forRoot({
          langs: { en, ar },
          translocoConfig: {
            availableLangs: ['en', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
          },
          preloadLangs: true,
        }),
      ],
      providers: [provideRouter([])],
    });
  });

  it('renders the pitch and all four highlights', async () => {
    const fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain(en.landing.title);
    expect(element.querySelectorAll('mat-card').length).toBe(4);
  });

  it('re-renders in Arabic when the language changes', async () => {
    const fixture = TestBed.createComponent(Landing);
    await fixture.whenStable();

    TestBed.inject(LanguageService).use('ar');

    TestBed.tick();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('h1')?.textContent).toContain(ar.landing.title);
  });
});
