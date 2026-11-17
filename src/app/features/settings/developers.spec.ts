import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Subject } from 'rxjs';
import en from '../../../../public/i18n/en.json';
import {
  ApiKey,
  WebhookDelivery,
  WebhookEndpoint,
  isKeyActive,
} from '../../core/api/developer.api';
import { ApiKeyDialog } from './api-key-dialog';
import { Developers } from './developers';
import { deliveryState, formatPayload } from './webhook-deliveries-dialog';
import { WEBHOOK_URL_PATTERN } from './webhook-dialog';

const KEY: ApiKey = {
  id: 'key-1',
  name: 'Order sync',
  hint: 'ndk_3f9a0c1b7e42_…',
  scopes: ['tickets:read', 'tickets:write'],
  expiresAt: null,
  lastUsedAt: null,
  revokedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
};
const ENDPOINT: WebhookEndpoint = {
  id: 'hook-1',
  url: 'https://hooks.example.com/nexdesk',
  description: 'Order system',
  events: ['ticket.created', 'ticket.solved'],
  isEnabled: true,
  createdAt: '2026-11-01T00:00:00Z',
};

const translations = TranslocoTestingModule.forRoot({
  langs: { en },
  translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
  preloadLangs: true,
});

function configure(extra: Provider[] = []): HttpTestingController {
  TestBed.configureTestingModule({
    imports: [translations],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...extra],
  });
  return TestBed.inject(HttpTestingController);
}

describe('Developer helpers', () => {
  it('treats revoked and expired keys as inactive', () => {
    const now = new Date('2026-11-17T00:00:00Z');
    expect(isKeyActive(KEY, now)).toBe(true);
    expect(isKeyActive({ ...KEY, revokedAt: '2026-11-02T00:00:00Z' }, now)).toBe(false);
    expect(isKeyActive({ ...KEY, expiresAt: '2026-11-16T00:00:00Z' }, now)).toBe(false);
    expect(isKeyActive({ ...KEY, expiresAt: '2026-12-01T00:00:00Z' }, now)).toBe(true);
  });

  it('accepts only full http and https addresses without credentials', () => {
    expect(WEBHOOK_URL_PATTERN.test('https://hooks.example.com/nexdesk?x=1')).toBe(true);
    expect(WEBHOOK_URL_PATTERN.test('http://localhost:9000')).toBe(true);
    expect(WEBHOOK_URL_PATTERN.test('ftp://files.example.com')).toBe(false);
    expect(WEBHOOK_URL_PATTERN.test('https://user:pass@example.com')).toBe(false);
    expect(WEBHOOK_URL_PATTERN.test('hooks.example.com')).toBe(false);
  });

  it('calls a pending delivery queued until its first attempt', () => {
    const queued = { status: 'Pending', attempts: 0 } as WebhookDelivery;
    expect(deliveryState(queued)).toBe('Queued');
    expect(deliveryState({ ...queued, attempts: 1 })).toBe('Pending');
    expect(deliveryState({ ...queued, status: 'Failed', attempts: 6 })).toBe('Failed');
  });

  it('pretty-prints JSON payloads and leaves anything else alone', () => {
    expect(formatPayload('{"event":"ping"}')).toBe('{\n  "event": "ping"\n}');
    expect(formatPayload('not json')).toBe('not json');
  });
});

describe('Developers', () => {
  let backend: HttpTestingController;

  afterEach(() => backend.verify());

  async function render(apiAccess: boolean): Promise<HTMLElement> {
    backend = configure();
    const fixture = TestBed.createComponent(Developers);
    await fixture.whenStable();
    backend.expectOne('/api/v1/billing/usage').flush({ apiAccess });
    if (apiAccess) {
      backend
        .expectOne('/api/v1/api-keys')
        .flush([KEY, { ...KEY, id: 'key-2', name: 'Old', revokedAt: '2026-11-02T00:00:00Z' }]);
      backend.expectOne('/api/v1/webhooks').flush([ENDPOINT]);
    }

    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers the upgrade instead of keys and webhooks when the plan has no API access', async () => {
    const element = await render(false);

    expect(element.textContent).toContain('API access is part of the Business plan');
    expect(element.querySelector('a[href="/app/settings/billing"]')).not.toBeNull();
    expect(element.textContent).not.toContain('New API key');
  });

  it('lists keys by their hint and state, and endpoints with their events', async () => {
    const element = await render(true);

    expect(element.textContent).toContain('ndk_3f9a0c1b7e42_…');
    const states = [...element.querySelectorAll('.keys .badge')].map((b) => b.textContent?.trim());
    expect(states).toEqual(['Active', 'Revoked']);
    expect(element.querySelectorAll('.keys button.danger')).toHaveLength(1);
    expect(element.textContent).toContain('https://hooks.example.com/nexdesk');
    expect(element.textContent).toContain('ticket.solved');
  });
});

describe('ApiKeyDialog', () => {
  it('issues a key with the chosen access and then shows it once, holding the dialog open', async () => {
    const closed = new Subject<void>();
    const dialogRef = {
      disableClose: false,
      backdropClick: () => closed,
      close: vi.fn(),
    };
    const backend = configure([{ provide: MatDialogRef, useValue: dialogRef }]);
    const fixture = TestBed.createComponent(ApiKeyDialog);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    expect(dialogRef.disableClose).toBe(true);

    const name = element.querySelector<HTMLInputElement>('input[formcontrolname="name"]')!;
    name.value = 'Order sync';
    name.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit'));
    const request = backend.expectOne('/api/v1/api-keys');
    expect(request.request.body).toEqual({
      name: 'Order sync',
      scopes: ['tickets:read'],
      expiresInDays: null,
    });
    request.flush({ apiKey: KEY, key: 'ndk_3f9a0c1b7e42_secret' });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(element.querySelector('code')?.textContent).toBe('ndk_3f9a0c1b7e42_secret');
    expect(element.textContent).toContain('will not be shown again');
    closed.next();
    expect(dialogRef.close).not.toHaveBeenCalled();
    backend.verify();
  });
});
