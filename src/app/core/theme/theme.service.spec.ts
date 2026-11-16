import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.colorScheme = '';
  });

  it('follows the system setting until the user chooses', () => {
    const service = TestBed.inject(ThemeService);

    expect(service.preference()).toBe('system');
  });

  it('applies the dark colour scheme to the document', () => {
    const service = TestBed.inject(ThemeService);

    service.set('dark');
    TestBed.tick();

    expect(service.isDark()).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });

  it('toggles between dark and light', () => {
    const service = TestBed.inject(ThemeService);
    service.set('dark');

    service.toggle();
    TestBed.tick();

    expect(service.preference()).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('remembers the chosen theme', () => {
    TestBed.inject(ThemeService).set('dark');
    TestBed.resetTestingModule();

    expect(TestBed.inject(ThemeService).preference()).toBe('dark');
  });
});
