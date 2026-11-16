import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TranslocoPipe } from '@jsverse/transloco';
import { Subject, debounceTime, distinctUntilChanged, filter, switchMap } from 'rxjs';
import { Invitation, InvitationsApi, Paged, User, UsersApi } from '../../core/api/workspace.api';
import { ROLES, Role } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { LocalDatePipe } from '../../shared/local-date.pipe';
import { ChangeRoleDialog, ChangeRoleDialogData } from './change-role-dialog';
import { InviteDialog, InviteDialogData } from './invite-dialog';

type StatusFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-users',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LocalDatePipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatPaginatorModule,
    MatSelectModule,
    MatTableModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'users.title' | transloco }}</h1>
        <p>{{ 'users.subtitle' | transloco }}</p>
      </div>
      @if (canManage()) {
        <button mat-flat-button type="button" (click)="invite()">
          <mat-icon aria-hidden="true">person_add</mat-icon>
          {{ 'users.invite.open' | transloco }}
        </button>
      }
    </header>

    <div class="filters">
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="search">
        <mat-label>{{ 'users.search' | transloco }}</mat-label>
        <mat-icon matPrefix aria-hidden="true">search</mat-icon>
        <input matInput type="search" [value]="search()" (input)="onSearch($event)" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'users.role' | transloco }}</mat-label>
        <mat-select [value]="role()" (valueChange)="role.set($event); reload(true)">
          <mat-option [value]="null">{{ 'users.allRoles' | transloco }}</mat-option>
          @for (option of roles; track option) {
            <mat-option [value]="option">{{ 'roles.' + option | transloco }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ 'users.status' | transloco }}</mat-label>
        <mat-select [value]="status()" (valueChange)="status.set($event); reload(true)">
          <mat-option value="all">{{ 'users.statusAll' | transloco }}</mat-option>
          <mat-option value="active">{{ 'users.active' | transloco }}</mat-option>
          <mat-option value="inactive">{{ 'users.inactive' | transloco }}</mat-option>
        </mat-select>
      </mat-form-field>
    </div>

    <div class="table-card">
      <table mat-table [dataSource]="users()" [attr.aria-label]="'users.title' | transloco">
        <ng-container matColumnDef="name">
          <th mat-header-cell *matHeaderCellDef>{{ 'users.name' | transloco }}</th>
          <td mat-cell *matCellDef="let user">
            <div class="person">
              <strong>{{ user.fullName }}</strong>
              <span dir="ltr">{{ user.email }}</span>
            </div>
          </td>
        </ng-container>
        <ng-container matColumnDef="role">
          <th mat-header-cell *matHeaderCellDef>{{ 'users.role' | transloco }}</th>
          <td mat-cell *matCellDef="let user">{{ 'roles.' + user.role | transloco }}</td>
        </ng-container>
        <ng-container matColumnDef="status">
          <th mat-header-cell *matHeaderCellDef>{{ 'users.status' | transloco }}</th>
          <td mat-cell *matCellDef="let user">
            <span class="badge" [class.muted]="!user.isActive">
              {{ (user.isActive ? 'users.active' : 'users.inactive') | transloco }}
            </span>
          </td>
        </ng-container>
        <ng-container matColumnDef="lastLogin">
          <th mat-header-cell *matHeaderCellDef>{{ 'users.lastLogin' | transloco }}</th>
          <td mat-cell *matCellDef="let user">
            {{
              user.lastLoginAt
                ? (user.lastLoginAt | localDate: 'relative')
                : ('users.never' | transloco)
            }}
          </td>
        </ng-container>
        <ng-container matColumnDef="actions">
          <th mat-header-cell *matHeaderCellDef>
            <span class="visually-hidden">{{ 'common.actions' | transloco }}</span>
          </th>
          <td mat-cell *matCellDef="let user" class="actions">
            @if (canEdit(user)) {
              <button
                mat-icon-button
                type="button"
                [matMenuTriggerFor]="rowMenu"
                [matMenuTriggerData]="{ user }"
                [attr.aria-label]="'users.actionsFor' | transloco: { name: user.fullName }"
              >
                <mat-icon aria-hidden="true">more_vert</mat-icon>
              </button>
            }
          </td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="columns"></tr>
        <tr mat-row *matRowDef="let row; columns: columns"></tr>
        <tr class="mat-mdc-row" *matNoDataRow>
          <td class="mat-mdc-cell empty" [attr.colspan]="columns.length">
            {{ 'users.empty' | transloco }}
          </td>
        </tr>
      </table>
      <mat-paginator
        [length]="total()"
        [pageIndex]="page() - 1"
        [pageSize]="pageSize()"
        [pageSizeOptions]="[10, 25, 50]"
        (page)="onPage($event)"
      />
    </div>

    <mat-menu #rowMenu="matMenu">
      <ng-template matMenuContent let-user="user">
        <button mat-menu-item type="button" (click)="changeRole(user)">
          <mat-icon aria-hidden="true">shield_person</mat-icon>
          <span>{{ 'users.changeRole.open' | transloco }}</span>
        </button>
        @if (user.isActive) {
          <button mat-menu-item type="button" (click)="deactivate(user)">
            <mat-icon aria-hidden="true">person_off</mat-icon>
            <span>{{ 'users.deactivate.open' | transloco }}</span>
          </button>
        } @else {
          <button mat-menu-item type="button" (click)="reactivate(user)">
            <mat-icon aria-hidden="true">person_check</mat-icon>
            <span>{{ 'users.reactivate' | transloco }}</span>
          </button>
        }
      </ng-template>
    </mat-menu>

    @if (canManage() && invitations().length > 0) {
      <section class="invitations" aria-labelledby="invitations-title">
        <h2 id="invitations-title">{{ 'users.invitations.title' | transloco }}</h2>
        <ul>
          @for (invitation of invitations(); track invitation.id) {
            <li>
              <div class="person">
                <strong dir="ltr">{{ invitation.email }}</strong>
                <span>
                  {{ 'roles.' + invitation.role | transloco }} ·
                  @if (invitation.status === 'Expired') {
                    {{ 'users.invitations.expired' | transloco }}
                  } @else {
                    {{
                      'users.invitations.expires'
                        | transloco: { when: (invitation.expiresAt | localDate: 'relative') }
                    }}
                  }
                </span>
              </div>
              <span class="row-actions">
                <button mat-button type="button" (click)="resend(invitation)">
                  {{ 'users.invitations.resend' | transloco }}
                </button>
                <button mat-button type="button" (click)="revoke(invitation)">
                  {{ 'users.invitations.revoke' | transloco }}
                </button>
              </span>
            </li>
          }
        </ul>
      </section>
    }
  `,
  styles: `
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-block-end: 16px;
    }

    .filters mat-form-field {
      inline-size: 180px;
    }

    .filters .search {
      flex: 1 1 240px;
    }

    .person {
      display: grid;
      gap: 2px;
      padding-block: 8px;
    }

    .person span {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
      text-align: start;
    }

    .actions {
      text-align: end;
    }

    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--mat-sys-on-surface-variant);
    }

    .invitations {
      margin-block-start: 32px;
    }

    .invitations h2 {
      font: var(--mat-sys-title-medium);
      margin: 0 0 8px;
    }

    .invitations ul {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
    }

    .invitations li {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 4px 16px;
    }

    .invitations li + li {
      border-block-start: 1px solid var(--mat-sys-outline-variant);
    }
  `,
})
export class Users {
  private readonly usersApi = inject(UsersApi);
  private readonly invitationsApi = inject(InvitationsApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(Confirm);
  private readonly notifier = inject(Notifier);

  protected readonly roles = ROLES;
  protected readonly columns = ['name', 'role', 'status', 'lastLogin', 'actions'];

  protected readonly search = signal('');
  protected readonly role = signal<Role | null>(null);
  protected readonly status = signal<StatusFilter>('all');
  protected readonly page = signal(1);
  protected readonly pageSize = signal(25);

  private readonly result = signal<Paged<User> | null>(null);
  protected readonly users = computed(() => [...(this.result()?.items ?? [])]);
  protected readonly total = computed(() => this.result()?.totalCount ?? 0);
  protected readonly invitations = signal<readonly Invitation[]>([]);

  protected readonly canManage = computed(() => this.auth.can('users.manage'));
  private readonly isOwner = computed(() => this.auth.session()?.user.role === 'Owner');
  private readonly assignableRoles = computed(() =>
    this.isOwner() ? ROLES : ROLES.filter((role) => role !== 'Owner'),
  );

  private readonly searches = new Subject<string>();
  private readonly loads = new Subject<void>();

  constructor() {
    this.loads
      .pipe(
        switchMap(() =>
          this.usersApi.list({
            search: this.search().trim() || undefined,
            role: this.role(),
            isActive: this.status() === 'all' ? null : this.status() === 'active',
            page: this.page(),
            pageSize: this.pageSize(),
          }),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => this.result.set(result));

    this.searches
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.reload(true));

    this.reload(false);
    if (this.canManage()) {
      this.loadInvitations();
    }
  }

  protected canEdit(user: User): boolean {
    return (
      this.canManage() &&
      user.id !== this.auth.session()?.user.id &&
      (user.role !== 'Owner' || this.isOwner())
    );
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.searches.next(this.search());
  }

  protected onPage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.reload(false);
  }

  protected reload(resetPage: boolean): void {
    if (resetPage) {
      this.page.set(1);
    }

    this.loads.next();
  }

  protected invite(): void {
    this.dialog
      .open<InviteDialog, InviteDialogData, Invitation>(InviteDialog, {
        data: { roles: this.assignableRoles() },
        width: '480px',
      })
      .afterClosed()
      .pipe(filter((invitation) => invitation !== undefined))
      .subscribe((invitation) => {
        this.notifier.success('users.invite.sent', { email: invitation.email });
        this.loadInvitations();
      });
  }

  protected changeRole(user: User): void {
    this.dialog
      .open<ChangeRoleDialog, ChangeRoleDialogData, Role>(ChangeRoleDialog, {
        data: { user, roles: this.assignableRoles() },
        width: '480px',
      })
      .afterClosed()
      .pipe(
        filter((role): role is Role => Boolean(role) && role !== user.role),
        switchMap((role) => this.usersApi.changeRole(user.id, role)),
      )
      .subscribe((updated) => {
        this.notifier.success('users.changeRole.done', { name: updated.fullName });
        this.reload(false);
      });
  }

  protected deactivate(user: User): void {
    this.confirm
      .ask({
        title: this.notifier.translate('users.deactivate.title', { name: user.fullName }),
        message: this.notifier.translate('users.deactivate.body'),
        confirmLabel: this.notifier.translate('users.deactivate.open'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.usersApi.deactivate(user.id)),
      )
      .subscribe((updated) => {
        this.notifier.success('users.deactivate.done', { name: updated.fullName });
        this.reload(false);
      });
  }

  protected reactivate(user: User): void {
    this.usersApi.reactivate(user.id).subscribe((updated) => {
      this.notifier.success('users.reactivated', { name: updated.fullName });
      this.reload(false);
    });
  }

  protected resend(invitation: Invitation): void {
    this.invitationsApi.resend(invitation.id).subscribe(() => {
      this.notifier.success('users.invite.sent', { email: invitation.email });
      this.loadInvitations();
    });
  }

  protected revoke(invitation: Invitation): void {
    this.invitationsApi.revoke(invitation.id).subscribe(() => {
      this.notifier.success('users.invitations.revoked', { email: invitation.email });
      this.loadInvitations();
    });
  }

  private loadInvitations(): void {
    this.invitationsApi.list().subscribe((invitations) => this.invitations.set(invitations));
  }
}
