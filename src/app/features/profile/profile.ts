import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  NotificationPreference,
  NotificationType,
  NotificationsApi,
} from '../../core/api/notifications.api';
import { UsersApi } from '../../core/api/workspace.api';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import {
  LanguageService,
  SUPPORTED_LANGUAGES,
  isSupportedLanguage,
} from '../../core/i18n/language.service';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { applyServerErrors, matches, passwordStrength } from '../../core/ui/form-errors';
import { Notifier } from '../../core/ui/notifier';

@Component({
  selector: 'app-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'profile.title' | transloco }}</h1>
        <p>{{ 'profile.subtitle' | transloco }}</p>
      </div>
    </header>

    <div class="cards">
      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'profile.details' | transloco }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <form class="form-stack" [formGroup]="profileForm" (ngSubmit)="saveProfile()" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
              <input matInput [value]="auth.session()?.user?.email" readonly dir="ltr" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.fields.fullName' | transloco }}</mat-label>
              <input matInput formControlName="fullName" autocomplete="name" />
              <mat-error>{{ profileForm.controls.fullName | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.language' | transloco }}</mat-label>
              <mat-select formControlName="language">
                @for (language of languages; track language) {
                  <mat-option [value]="language">{{
                    'languages.' + language | transloco
                  }}</mat-option>
                }
              </mat-select>
              <mat-hint>{{ 'profile.languageHint' | transloco }}</mat-hint>
            </mat-form-field>
            <div class="form-actions">
              <button mat-flat-button type="submit" [disabled]="savingProfile()">
                {{ 'common.save' | transloco }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined">
        <mat-card-header>
          <mat-card-title>{{ 'profile.password.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'profile.password.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <form
            class="form-stack"
            [formGroup]="passwordForm"
            (ngSubmit)="changePassword()"
            novalidate
          >
            @if (passwordError(); as message) {
              <p class="form-alert" role="alert">{{ message }}</p>
            }
            <mat-form-field appearance="outline">
              <mat-label>{{ 'profile.password.current' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                formControlName="currentPassword"
                autocomplete="current-password"
              />
              <mat-error>{{ passwordForm.controls.currentPassword | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.fields.newPassword' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                formControlName="newPassword"
                autocomplete="new-password"
                (input)="passwordForm.controls.confirmPassword.updateValueAndValidity()"
              />
              <mat-hint>{{ 'auth.fields.passwordHint' | transloco }}</mat-hint>
              <mat-error>{{ passwordForm.controls.newPassword | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'auth.fields.confirmPassword' | transloco }}</mat-label>
              <input
                matInput
                type="password"
                formControlName="confirmPassword"
                autocomplete="new-password"
              />
              <mat-error>{{ passwordForm.controls.confirmPassword | fieldError }}</mat-error>
            </mat-form-field>
            <div class="form-actions">
              <button mat-flat-button type="submit" [disabled]="savingPassword()">
                {{ 'profile.password.submit' | transloco }}
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      <mat-card appearance="outlined" class="wide">
        <mat-card-header>
          <mat-card-title>{{ 'profile.notifications.title' | transloco }}</mat-card-title>
          <mat-card-subtitle>{{ 'profile.notifications.subtitle' | transloco }}</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <table class="preferences">
            <thead>
              <tr>
                <th scope="col">{{ 'profile.notifications.event' | transloco }}</th>
                <th scope="col">{{ 'profile.notifications.inApp' | transloco }}</th>
                <th scope="col">{{ 'profile.notifications.email' | transloco }}</th>
                <th scope="col">{{ 'profile.notifications.push' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (preference of preferences(); track preference.type) {
                <tr>
                  <th scope="row">
                    {{ 'profile.notifications.types.' + preference.type | transloco }}
                  </th>
                  <td>
                    <mat-checkbox
                      [checked]="preference.inApp"
                      [aria-label]="
                        ('profile.notifications.types.' + preference.type | transloco) +
                        ' – ' +
                        ('profile.notifications.inApp' | transloco)
                      "
                      (change)="setPreference(preference.type, { inApp: $event.checked })"
                    />
                  </td>
                  <td>
                    <mat-checkbox
                      [checked]="preference.email"
                      [aria-label]="
                        ('profile.notifications.types.' + preference.type | transloco) +
                        ' – ' +
                        ('profile.notifications.email' | transloco)
                      "
                      (change)="setPreference(preference.type, { email: $event.checked })"
                    />
                  </td>
                  <td>
                    <mat-checkbox
                      [checked]="preference.push"
                      [aria-label]="
                        ('profile.notifications.types.' + preference.type | transloco) +
                        ' – ' +
                        ('profile.notifications.push' | transloco)
                      "
                      (change)="setPreference(preference.type, { push: $event.checked })"
                    />
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 440px));
      gap: 16px;
      align-items: start;
    }

    mat-card-content {
      padding-block-start: 16px;
    }

    .wide {
      grid-column: 1 / -1;
      max-inline-size: 896px;
    }

    .preferences {
      inline-size: 100%;
      border-collapse: collapse;
    }

    .preferences th,
    .preferences td {
      padding: 4px 8px;
      text-align: start;
      font: var(--mat-sys-body-medium);
    }

    .preferences thead th {
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
    }

    .preferences td,
    .preferences thead th:not(:first-child) {
      inline-size: 96px;
      text-align: center;
    }
  `,
})
export class Profile {
  protected readonly auth = inject(AuthService);
  private readonly usersApi = inject(UsersApi);
  private readonly languageService = inject(LanguageService);
  private readonly notifier = inject(Notifier);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  private readonly notificationsApi = inject(NotificationsApi);

  protected readonly languages = SUPPORTED_LANGUAGES;
  protected readonly preferences = signal<readonly NotificationPreference[]>([]);
  protected readonly savingProfile = signal(false);
  protected readonly savingPassword = signal(false);
  protected readonly passwordError = signal<string | null>(null);

  protected readonly profileForm = this.formBuilder.group({
    fullName: [
      this.auth.session()?.user.fullName ?? '',
      [Validators.required, Validators.maxLength(100)],
    ],
    language: [this.auth.session()?.user.language ?? 'en', [Validators.required]],
  });

  protected readonly passwordForm = this.formBuilder.group({
    currentPassword: ['', [Validators.required]],
    newPassword: [
      '',
      [Validators.required, Validators.minLength(8), Validators.maxLength(128), passwordStrength],
    ],
    confirmPassword: ['', [Validators.required, matches('newPassword')]],
  });

  constructor() {
    this.notificationsApi
      .preferences()
      .subscribe((preferences) => this.preferences.set(preferences));
  }

  protected setPreference(
    type: NotificationType,
    change: Partial<Pick<NotificationPreference, 'inApp' | 'email' | 'push'>>,
  ): void {
    const current = this.preferences().find((preference) => preference.type === type);
    if (current) {
      this.notificationsApi
        .updatePreferences([{ ...current, ...change }])
        .subscribe((preferences) => this.preferences.set(preferences));
    }
  }

  protected saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const { fullName, language } = this.profileForm.getRawValue();
    this.savingProfile.set(true);
    this.usersApi.updateProfile(fullName, language).subscribe({
      next: (session) => {
        this.auth.updateSession(session);
        if (isSupportedLanguage(language)) {
          this.languageService.use(language);
        }

        this.notifier.success('profile.saved');
        this.savingProfile.set(false);
      },
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        if (!applyServerErrors(this.profileForm, problem)) {
          this.notifier.problem(problem);
        }

        this.savingProfile.set(false);
      },
    });
  }

  protected changePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.savingPassword.set(true);
    this.passwordError.set(null);
    this.auth.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.notifier.success('profile.password.changed');
        this.savingPassword.set(false);
      },
      error: (failure: unknown) => {
        const problem = toProblem(failure);
        if (!applyServerErrors(this.passwordForm, problem)) {
          this.passwordError.set(this.notifier.problemMessage(problem));
        }

        this.savingPassword.set(false);
      },
    });
  }
}
