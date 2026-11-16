import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../../public/i18n/en.json';
import { Paged, User } from '../../core/api/workspace.api';
import { TEST_SESSION, authResponse } from '../../core/auth/auth-testing';
import { Session } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Users } from './users';

const OWNER: User = {
  id: 'user-1',
  email: 'olivia@example.test',
  fullName: 'Olivia Owner',
  role: 'Owner',
  isActive: true,
  availability: 'Online',
  emailVerified: true,
  lastLoginAt: null,
  createdAt: '2026-01-01T00:00:00Z',
};
const AGENT: User = {
  ...OWNER,
  id: 'user-2',
  email: 'aaron@example.test',
  fullName: 'Aaron Agent',
  role: 'Agent',
};

function page(items: User[]): Paged<User> {
  return { items, page: 1, pageSize: 25, totalCount: items.length };
}

describe('Users', () => {
  let fixture: ComponentFixture<Users>;
  let backend: HttpTestingController;

  async function render(session: Session): Promise<HTMLElement> {
    localStorage.clear();
    TestBed.configureTestingModule({
      imports: [
        Users,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthService).login('a', 'b').subscribe();
    backend.expectOne('/api/v1/auth/login').flush({ ...authResponse(), session });

    fixture = TestBed.createComponent(Users);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => backend.verify());

  it('lists users and pending invitations for someone who manages users', async () => {
    const element = await render(TEST_SESSION);

    backend
      .expectOne((request) => request.url === '/api/v1/users' && request.params.get('page') === '1')
      .flush(page([OWNER, AGENT]));
    backend.expectOne('/api/v1/invitations').flush([
      {
        id: 'inv-1',
        email: 'new@example.test',
        role: 'Agent',
        status: 'Pending',
        expiresAt: '2030-01-01T00:00:00Z',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ]);
    await fixture.whenStable();

    const rows = element.querySelectorAll('tr[mat-row]');
    expect(rows.length).toBe(2);
    expect(element.textContent).toContain('Aaron Agent');
    expect(element.textContent).toContain(en.users.invite.open);
    expect(element.textContent).toContain('new@example.test');
    // Nobody can edit themselves, so only the agent's row has an actions menu.
    expect(rows[0].querySelector('button')).toBeNull();
    expect(rows[1].querySelector('button')).not.toBeNull();
  });

  it('is read-only for someone without the manage permission', async () => {
    const element = await render({
      ...TEST_SESSION,
      user: { ...TEST_SESSION.user, id: 'user-2', role: 'Agent' },
      permissions: ['users.view'],
    });

    backend.expectOne((request) => request.url === '/api/v1/users').flush(page([OWNER, AGENT]));
    await fixture.whenStable();

    backend.expectNone('/api/v1/invitations');
    expect(element.textContent).not.toContain(en.users.invite.open);
    expect(element.querySelectorAll('tr[mat-row] button').length).toBe(0);
  });

  it('shows an empty message when nothing matches', async () => {
    const element = await render(TEST_SESSION);

    backend.expectOne((request) => request.url === '/api/v1/users').flush(page([]));
    backend.expectOne('/api/v1/invitations').flush([]);
    await fixture.whenStable();

    expect(element.textContent).toContain(en.users.empty);
  });
});
