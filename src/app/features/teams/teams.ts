import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, switchMap } from 'rxjs';
import { Team, TeamsApi, User, UsersApi } from '../../core/api/workspace.api';
import { AuthService } from '../../core/auth/auth.service';
import { Notifier } from '../../core/ui/notifier';
import { Confirm } from '../../shared/confirm-dialog';
import { TeamDialog, TeamDialogData } from './team-dialog';

@Component({
  selector: 'app-teams',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatButtonModule, MatCardModule, MatIconModule, TranslocoPipe],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'teams.title' | transloco }}</h1>
        <p>{{ 'teams.subtitle' | transloco }}</p>
      </div>
      @if (canManage()) {
        <button mat-flat-button type="button" (click)="edit(null)">
          <mat-icon aria-hidden="true">add</mat-icon>
          {{ 'teams.create' | transloco }}
        </button>
      }
    </header>

    @if (loaded() && teams().length === 0) {
      <div class="empty-state">
        <mat-icon aria-hidden="true">diversity_3</mat-icon>
        <h2>{{ 'teams.emptyTitle' | transloco }}</h2>
        <p>{{ 'teams.emptyBody' | transloco }}</p>
      </div>
    }

    <div class="grid">
      @for (team of teams(); track team.id) {
        <mat-card appearance="outlined">
          <mat-card-header>
            <mat-card-title>{{ team.name }}</mat-card-title>
            <mat-card-subtitle>
              {{ 'teams.memberCount' | transloco: { count: team.members.length } }}
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            @if (team.description) {
              <p class="description">{{ team.description }}</p>
            }
            <ul class="members" [attr.aria-label]="'teams.members' | transloco">
              @for (member of team.members; track member.userId) {
                <li [class.muted]="!member.isActive">{{ member.fullName }}</li>
              } @empty {
                <li class="muted">{{ 'teams.noMembers' | transloco }}</li>
              }
            </ul>
          </mat-card-content>
          @if (canManage()) {
            <mat-card-actions align="end">
              <button mat-button type="button" (click)="edit(team)">
                {{ 'common.edit' | transloco }}
              </button>
              <button mat-button type="button" (click)="remove(team)">
                {{ 'common.delete' | transloco }}
              </button>
            </mat-card-actions>
          }
        </mat-card>
      }
    </div>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .description {
      color: var(--mat-sys-on-surface-variant);
      margin: 8px 0 0;
    }

    .members {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      list-style: none;
      margin: 16px 0 0;
      padding: 0;
    }

    .members li {
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      padding: 4px 12px;
      font: var(--mat-sys-label-large);
    }

    .members li.muted {
      color: var(--mat-sys-on-surface-variant);
      border-style: dashed;
    }
  `,
})
export class Teams {
  private readonly teamsApi = inject(TeamsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(Confirm);
  private readonly notifier = inject(Notifier);

  protected readonly teams = signal<readonly Team[]>([]);
  protected readonly loaded = signal(false);
  protected readonly canManage = computed(() => this.auth.can('teams.manage'));
  private readonly users = signal<readonly User[]>([]);

  constructor() {
    this.load();
    if (this.canManage()) {
      this.usersApi
        .list({ isActive: true, page: 1, pageSize: 100 })
        .subscribe((page) => this.users.set(page.items));
    }
  }

  protected edit(team: Team | null): void {
    this.dialog
      .open<TeamDialog, TeamDialogData, Team>(TeamDialog, {
        data: { team, users: this.users() },
        width: '520px',
      })
      .afterClosed()
      .pipe(filter((saved) => saved !== undefined))
      .subscribe((saved) => {
        this.notifier.success('teams.saved', { name: saved.name });
        this.load();
      });
  }

  protected remove(team: Team): void {
    this.confirm
      .ask({
        title: this.notifier.translate('teams.delete.title', { name: team.name }),
        message: this.notifier.translate('teams.delete.body'),
        confirmLabel: this.notifier.translate('common.delete'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.teamsApi.delete(team.id)),
      )
      .subscribe(() => {
        this.notifier.success('teams.deleted', { name: team.name });
        this.load();
      });
  }

  private load(): void {
    this.teamsApi.list().subscribe((teams) => {
      this.teams.set(teams);
      this.loaded.set(true);
    });
  }
}
