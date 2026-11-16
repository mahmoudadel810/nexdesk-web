import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatStepper, MatStepperModule } from '@angular/material/stepper';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import {
  BusinessHours,
  InvitationsApi,
  TeamsApi,
  WorkspaceApi,
} from '../../core/api/workspace.api';
import { Role } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { PublicHeader } from '../../layout/public-header';
import { BusinessHoursForm } from '../../shared/business-hours-form';

const INVITE_ROLES: readonly Role[] = ['Admin', 'Agent', 'Viewer'];

@Component({
  selector: 'app-onboarding',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BusinessHoursForm,
    FieldErrorPipe,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatStepperModule,
    PublicHeader,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <app-public-header />
    <main class="page">
      <h1>{{ 'onboarding.title' | transloco: { workspace: auth.session()?.tenant?.name } }}</h1>
      <p class="lead">{{ 'onboarding.subtitle' | transloco }}</p>

      <mat-stepper #stepper orientation="vertical" [linear]="false">
        <mat-step [label]="'onboarding.hours.label' | transloco">
          <p class="step-lead">{{ 'onboarding.hours.body' | transloco }}</p>
          <app-business-hours-form [hours]="hours()" />
          @if (stepError(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <div class="step-actions">
            <button mat-flat-button type="button" [disabled]="busy()" (click)="saveHours(stepper)">
              {{ 'onboarding.next' | transloco }}
            </button>
          </div>
        </mat-step>

        <mat-step [label]="'onboarding.team.label' | transloco">
          <p class="step-lead">{{ 'onboarding.team.body' | transloco }}</p>
          <form class="form-stack narrow" [formGroup]="teamForm" novalidate>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'teams.name' | transloco }}</mat-label>
              <input matInput formControlName="name" />
              <mat-error>{{ teamForm.controls.name | fieldError }}</mat-error>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'teams.description' | transloco }}</mat-label>
              <input matInput formControlName="description" />
              <mat-error>{{ teamForm.controls.description | fieldError }}</mat-error>
            </mat-form-field>
          </form>
          @if (stepError(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <div class="step-actions">
            <button mat-flat-button type="button" [disabled]="busy()" (click)="saveTeam(stepper)">
              {{ 'onboarding.next' | transloco }}
            </button>
            <button mat-button type="button" [disabled]="busy()" (click)="skip(stepper)">
              {{ 'onboarding.skip' | transloco }}
            </button>
          </div>
        </mat-step>

        <mat-step [label]="'onboarding.invite.label' | transloco">
          <p class="step-lead">{{ 'onboarding.invite.body' | transloco }}</p>
          <form [formGroup]="inviteForm" novalidate>
            <div formArrayName="invites" class="invites">
              @for (row of inviteForm.controls.invites.controls; track row; let index = $index) {
                <div class="invite" [formGroupName]="index">
                  <mat-form-field appearance="outline" class="email">
                    <mat-label>{{ 'auth.fields.email' | transloco }}</mat-label>
                    <input matInput type="email" formControlName="email" autocomplete="off" />
                    <mat-error>{{ row.controls.email | fieldError }}</mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="role">
                    <mat-label>{{ 'users.role' | transloco }}</mat-label>
                    <mat-select formControlName="role">
                      @for (role of inviteRoles; track role) {
                        <mat-option [value]="role">{{ 'roles.' + role | transloco }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                </div>
              }
            </div>
            <button mat-button type="button" (click)="addInvite()">
              <mat-icon aria-hidden="true">add</mat-icon>
              {{ 'onboarding.invite.another' | transloco }}
            </button>
          </form>
          @if (stepError(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }
          <div class="step-actions">
            <button mat-flat-button type="button" [disabled]="busy()" (click)="finish()">
              {{ 'onboarding.finish' | transloco }}
            </button>
          </div>
        </mat-step>
      </mat-stepper>
    </main>
  `,
  styles: `
    .page {
      max-inline-size: 760px;
      margin-inline: auto;
      padding: 32px 16px 64px;
    }

    h1 {
      font: var(--mat-sys-headline-medium);
      margin: 0 0 8px;
    }

    .lead,
    .step-lead {
      color: var(--mat-sys-on-surface-variant);
      margin: 0 0 24px;
    }

    .step-lead {
      margin-block-end: 16px;
    }

    mat-stepper {
      background: transparent;
    }

    .narrow {
      max-inline-size: 420px;
    }

    .step-actions {
      display: flex;
      gap: 8px;
      margin-block-start: 16px;
    }

    .invite {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }

    .invite .email {
      flex: 1 1 260px;
    }

    .invite .role {
      inline-size: 160px;
    }
  `,
})
export class Onboarding {
  protected readonly auth = inject(AuthService);
  private readonly workspaceApi = inject(WorkspaceApi);
  private readonly teamsApi = inject(TeamsApi);
  private readonly invitationsApi = inject(InvitationsApi);
  private readonly notifier = inject(Notifier);
  private readonly router = inject(Router);
  private readonly formBuilder = inject(NonNullableFormBuilder);

  private readonly hoursForm = viewChild.required(BusinessHoursForm);

  protected readonly inviteRoles = INVITE_ROLES;
  protected readonly hours = signal<BusinessHours | null>(null);
  protected readonly busy = signal(false);
  protected readonly stepError = signal<string | null>(null);

  protected readonly teamForm = this.formBuilder.group({
    name: ['', [Validators.maxLength(80)]],
    description: ['', [Validators.maxLength(300)]],
  });
  protected readonly inviteForm = this.formBuilder.group({
    invites: this.formBuilder.array([this.inviteRow(), this.inviteRow()]),
  });

  constructor() {
    this.workspaceApi.businessHours().subscribe((hours) => this.hours.set(hours));
  }

  protected saveHours(stepper: MatStepper): void {
    const form = this.hoursForm();
    if (!form.isValid()) {
      return;
    }

    this.run(this.workspaceApi.updateBusinessHours(form.value()), () => stepper.next());
  }

  protected saveTeam(stepper: MatStepper): void {
    const { name, description } = this.teamForm.getRawValue();
    if (!name.trim()) {
      this.skip(stepper);
      return;
    }

    if (this.teamForm.invalid) {
      this.teamForm.markAllAsTouched();
      return;
    }

    const ownerId = this.auth.session()?.user.id;
    this.run(this.teamsApi.create(name, description || null, ownerId ? [ownerId] : []), () => {
      this.teamForm.reset();
      stepper.next();
    });
  }

  protected skip(stepper: MatStepper): void {
    this.stepError.set(null);
    stepper.next();
  }

  protected addInvite(): void {
    this.inviteForm.controls.invites.push(this.inviteRow());
  }

  protected finish(): void {
    const rows = this.inviteForm.controls.invites.controls.filter((row) =>
      row.controls.email.value.trim(),
    );
    if (rows.some((row) => row.invalid)) {
      this.inviteForm.markAllAsTouched();
      return;
    }

    const sends: Observable<string | null>[] = rows.map((row) =>
      this.invitationsApi.create(row.controls.email.value, row.controls.role.value).pipe(
        map(() => {
          row.reset();
          return null;
        }),
        catchError((failure: unknown) => {
          const message = this.notifier.problemMessage(toProblem(failure));
          row.controls.email.setErrors({ server: message });
          row.controls.email.markAsTouched();
          return of(message);
        }),
      ),
    );

    this.busy.set(true);
    this.stepError.set(null);
    (sends.length > 0 ? forkJoin(sends) : of([])).subscribe((results) => {
      if (results.some((result) => result !== null)) {
        this.busy.set(false);
        return;
      }

      this.workspaceApi.completeOnboarding().subscribe({
        next: () => {
          const session = this.auth.session();
          if (session?.tenant) {
            this.auth.updateSession({
              ...session,
              tenant: { ...session.tenant, onboardingCompleted: true },
            });
          }

          this.notifier.success('onboarding.done');
          void this.router.navigate(['/app']);
        },
        error: () => this.busy.set(false),
      });
    });
  }

  private run<T>(request: Observable<T>, onSuccess: () => void): void {
    this.busy.set(true);
    this.stepError.set(null);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        onSuccess();
      },
      error: (failure: unknown) => {
        this.stepError.set(this.notifier.problemMessage(toProblem(failure)));
        this.busy.set(false);
      },
    });
  }

  private inviteRow() {
    return this.formBuilder.group({
      email: ['', [Validators.email, Validators.maxLength(254)]],
      role: ['Agent' as Role],
    });
  }
}
