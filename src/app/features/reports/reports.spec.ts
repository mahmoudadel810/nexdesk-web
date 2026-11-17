import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Chart } from 'chart.js';
import en from '../../../../public/i18n/en.json';
import { Overview, isoDate, lastDays } from '../../core/api/reports.api';
import { axisDate, change, formatDuration, totals } from './report-format';
import { Reports } from './reports';

const translate = (key: string, params?: Record<string, unknown>) =>
  `${String(params?.['count'])} ${key.split('.').pop()}`;

const OVERVIEW: Overview = {
  range: { from: '2026-10-19', to: '2026-11-17', timezone: 'Europe/London', bucket: 'Day' },
  created: 120,
  solved: 90,
  previousCreated: 100,
  previousSolved: 120,
  openBacklog: 14,
  avgFirstResponseMinutes: 45,
  avgResolutionMinutes: 1500,
  slaCompliancePercent: 92.5,
  csatAverage: 4.4,
  csatResponses: 31,
};

describe('Report formatting', () => {
  it('says durations in minutes, hours or days', () => {
    expect(formatDuration(null, translate, 'en')).toBe('–');
    expect(formatDuration(45.4, translate, 'en')).toBe('45 minutes');
    expect(formatDuration(90, translate, 'en')).toBe('1.5 hours');
    expect(formatDuration(1440, translate, 'en')).toBe('1 days');
    expect(formatDuration(3600, translate, 'en')).toBe('2.5 days');
  });

  it('compares a figure with the period before', () => {
    expect(change(120, 100)).toBe(20);
    expect(change(90, 120)).toBe(-25);
    expect(change(5, 0)).toBeNull();
  });

  it('builds date ranges and axis labels in the local calendar', () => {
    const today = new Date(2026, 10, 17, 23, 30);
    expect(lastDays(30, today)).toEqual({ from: '2026-10-19', to: '2026-11-17' });
    expect(lastDays(1, today)).toEqual({ from: '2026-11-17', to: '2026-11-17' });
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(axisDate('2026-03-09', 'en')).toBe('Mar 9');
  });

  it('adds up a volume series', () => {
    expect(
      totals([
        { date: '2026-03-09', created: 2, solved: 1 },
        { date: '2026-03-10', created: 3, solved: 4 },
      ]),
    ).toEqual({ created: 5, solved: 5 });
  });
});

describe('Reports', () => {
  let fixture: ComponentFixture<Reports>;
  let backend: HttpTestingController;
  let element: HTMLElement;

  function flush(query: string): void {
    const url = (path: string) => `/api/v1/reports/${path}${query}`;
    backend.expectOne(url('overview')).flush(OVERVIEW);
    backend.expectOne(url('volume')).flush([
      { date: '2026-11-16', created: 4, solved: 2 },
      { date: '2026-11-17', created: 1, solved: 3 },
    ]);
    backend.expectOne('/api/v1/reports/backlog').flush({
      byStatus: [
        { status: 'New', count: 3 },
        { status: 'Open', count: 11 },
      ],
      byPriority: [{ priority: 'Urgent', count: 2 }],
      unassigned: 5,
    });
    backend
      .expectOne(url('response-times'))
      .flush([{ date: '2026-11-16', avgFirstResponseMinutes: 30, avgResolutionMinutes: null }]);
    backend.expectOne(url('sla-compliance')).flush({
      firstResponsePercent: 90,
      resolutionPercent: 95,
      byPriority: [
        {
          priority: 'Urgent',
          firstResponseMet: 9,
          firstResponseBreached: 1,
          resolutionMet: 19,
          resolutionBreached: 1,
          firstResponsePercent: 90,
          resolutionPercent: 95,
        },
      ],
    });
    backend.expectOne(url('csat')).flush({
      average: 4.4,
      responses: 31,
      satisfiedPercent: 87.1,
      distribution: [{ rating: 5, count: 20 }],
      trend: [],
    });
    backend.expectOne(url('agents')).flush([
      {
        userId: 'u1',
        name: 'Aaron Agent',
        assignedOpen: 4,
        solved: 37,
        avgFirstResponseMinutes: 25,
        avgResolutionMinutes: 300,
        csatAverage: 4.8,
        csatResponses: 12,
      },
    ]);
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [
        Reports,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    backend = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Reports);
    await fixture.whenStable();
    const range = lastDays(30);
    flush(`?from=${range.from}&to=${range.to}`);
    await fixture.whenStable();
    element = fixture.nativeElement as HTMLElement;
  });

  afterEach(() => {
    backend.verify();
    fixture.destroy();
  });

  it('shows the headline figures with their trend', () => {
    const cards = [...element.querySelectorAll('.kpis mat-card')].map((card) =>
      [...card.querySelectorAll('p')].map((line) => line.textContent?.trim()).join(' '),
    );

    expect(cards).toEqual([
      'Tickets created 120 Up 20% on the period before',
      'Tickets solved 90 Down 25% on the period before',
      'Open backlog 14 Right now',
      'Avg. first response 45 min',
      'Avg. resolution 1 d',
      'SLA compliance 92.5%',
      'Customer satisfaction 4.4 / 5 Ratings: 31',
    ]);
    expect(element.querySelector('.period')?.textContent).toContain('Europe/London');
  });

  it('draws every chart and repeats its numbers in a table for screen readers', () => {
    const charts = [...element.querySelectorAll('app-chart')];
    expect(charts.length).toBe(6);
    expect(Object.keys(Chart.instances).length).toBe(6);

    const volume = charts[0];
    expect(volume.querySelector('canvas')?.getAttribute('aria-label')).toBe('Ticket volume');
    const rows = [...volume.querySelectorAll('tbody tr')].map((row) =>
      [...row.children].map((cell) => cell.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['Nov 16', '4', '2'],
      ['Nov 17', '1', '3'],
    ]);
    expect(element.querySelector('.table-card')?.textContent).toContain('Aaron Agent');
    expect(element.querySelector('.table-card')?.textContent).toContain('4.8 (12)');
  });

  it('reloads everything for another period and shows why a range was refused', async () => {
    const toggles = [
      ...element.querySelectorAll('mat-button-toggle button'),
    ] as HTMLButtonElement[];
    toggles[0].click();
    await fixture.whenStable();
    const week = lastDays(7);
    flush(`?from=${week.from}&to=${week.to}`);
    await fixture.whenStable();

    toggles[3].click();
    await fixture.whenStable();
    (element.querySelector('.dates button') as HTMLButtonElement).click();
    await fixture.whenStable();
    const month = lastDays(30);
    const failing = backend.match((request) => request.url.startsWith('/api/v1/reports/'));
    expect(failing.length).toBe(7);
    expect(failing[0].request.urlWithParams).toContain(`from=${month.from}&to=${month.to}`);
    failing[0].flush({ code: 'invalid-report-range' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();

    expect(element.querySelector('.form-alert')?.textContent).toContain('at most 366 days apart');
  });
});
