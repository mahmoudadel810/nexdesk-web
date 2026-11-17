import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, startWith, switchMap } from 'rxjs';
import {
  LOGO_MAX_BYTES,
  LOGO_TYPES,
  SettingsApi,
  WorkspaceSettings,
} from '../../core/api/settings.api';
import { AuthService } from '../../core/auth/auth.service';
import { toProblem } from '../../core/http/problem';
import { FieldErrorPipe } from '../../core/ui/field-error.pipe';
import { Notifier } from '../../core/ui/notifier';
import { brandTokens, contrastRatio } from '../../shared/brand';
import { TIMEZONES } from '../../shared/business-hours-form';
import { Confirm } from '../../shared/confirm-dialog';

const DEFAULT_COLOR = '#415f91';
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Why a picked file cannot be a logo, before it is uploaded; null when it looks fine. */
export function logoProblem(file: { type: string; size: number }): string | null {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
    return 'errors.logo-type';
  }

  return file.size > LOGO_MAX_BYTES ? 'errors.logo-too-large' : null;
}

@Component({
  selector: 'app-workspace-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FieldErrorPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule,
    TranslocoPipe,
  ],
  template: `
    <header class="page-header">
      <div>
        <h1>{{ 'settings.title' | transloco }}</h1>
        <p>{{ 'settings.subtitle' | transloco }}</p>
      </div>
    </header>

    @if (settings(); as current) {
      <div class="layout">
        <form [formGroup]="form" (ngSubmit)="save()" novalidate class="sections">
          @if (error(); as message) {
            <p class="form-alert" role="alert">{{ message }}</p>
          }

          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-card-title>{{ 'settings.general' | transloco }}</mat-card-title>
            </mat-card-header>
            <mat-card-content class="form-stack">
              <mat-form-field appearance="outline">
                <mat-label>{{ 'settings.name' | transloco }}</mat-label>
                <input
                  matInput
                  formControlName="name"
                  maxlength="100"
                  autocomplete="organization"
                />
                <mat-error>{{ form.controls.name | fieldError }}</mat-error>
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>{{ 'settings.address' | transloco }}</mat-label>
                <input matInput [value]="portalAddress(current.slug)" readonly dir="ltr" />
                <mat-hint>{{ 'settings.addressHint' | transloco }}</mat-hint>
              </mat-form-field>
              <div class="row">
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'settings.timezone' | transloco }}</mat-label>
                  <mat-select formControlName="timezone">
                    @for (zone of timezones; track zone) {
                      <mat-option [value]="zone"
                        ><span dir="ltr">{{ zone }}</span></mat-option
                      >
                    }
                  </mat-select>
                  <mat-hint>{{ 'settings.timezoneHint' | transloco }}</mat-hint>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>{{ 'settings.language' | transloco }}</mat-label>
                  <mat-select formControlName="defaultLanguage">
                    <mat-option value="en">{{ 'languages.en' | transloco }}</mat-option>
                    <mat-option value="ar">{{ 'languages.ar' | transloco }}</mat-option>
                  </mat-select>
                  <mat-hint>{{ 'settings.languageHint' | transloco }}</mat-hint>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-card-title>{{ 'settings.branding' | transloco }}</mat-card-title>
              <mat-card-subtitle>{{ 'settings.brandingHint' | transloco }}</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content class="form-stack">
              <div class="logo-row">
                <div class="logo-box">
                  @if (current.logoUrl) {
                    <img [src]="current.logoUrl" [alt]="'settings.logoAlt' | transloco" />
                  } @else {
                    <mat-icon aria-hidden="true">image</mat-icon>
                  }
                </div>
                <div class="logo-actions">
                  <input
                    #picker
                    type="file"
                    class="visually-hidden"
                    accept="image/png,image/jpeg,image/webp"
                    (change)="pickLogo(picker)"
                    [attr.aria-label]="'settings.uploadLogo' | transloco"
                  />
                  <button
                    mat-stroked-button
                    type="button"
                    [disabled]="uploading()"
                    (click)="picker.click()"
                  >
                    <mat-icon aria-hidden="true">upload</mat-icon>
                    {{
                      (current.logoUrl ? 'settings.replaceLogo' : 'settings.uploadLogo') | transloco
                    }}
                  </button>
                  @if (current.logoUrl) {
                    <button mat-button type="button" (click)="removeLogo()">
                      {{ 'settings.removeLogo' | transloco }}
                    </button>
                  }
                  <p class="hint">{{ 'settings.logoHint' | transloco }}</p>
                </div>
              </div>

              <div class="color-row">
                <input
                  type="color"
                  class="swatch"
                  [value]="colorValue() || defaultColor"
                  (input)="setColor($any($event.target).value)"
                  [attr.aria-label]="'settings.pickColor' | transloco"
                />
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>{{ 'settings.color' | transloco }}</mat-label>
                  <input
                    matInput
                    formControlName="brandColor"
                    dir="ltr"
                    maxlength="7"
                    placeholder="#415f91"
                  />
                  <mat-error>{{ 'settings.colorInvalid' | transloco }}</mat-error>
                </mat-form-field>
                @if (colorValue()) {
                  <button mat-button type="button" (click)="setColor('')">
                    {{ 'settings.resetColor' | transloco }}
                  </button>
                }
              </div>
              @if (lowContrast()) {
                <p class="form-notice" role="note">{{ 'settings.lowContrast' | transloco }}</p>
              }

              <mat-form-field appearance="outline">
                <mat-label>{{ 'settings.welcome' | transloco }}</mat-label>
                <textarea
                  matInput
                  formControlName="portalWelcomeText"
                  rows="3"
                  maxlength="1000"
                  dir="auto"
                ></textarea>
                <mat-hint>{{ 'settings.welcomeHint' | transloco }}</mat-hint>
                <mat-hint align="end"
                  >{{ form.controls.portalWelcomeText.value.length }} / 1000</mat-hint
                >
              </mat-form-field>
            </mat-card-content>
          </mat-card>

          <div class="actions">
            <button mat-flat-button type="submit" [disabled]="saving() || form.pristine">
              {{ 'common.save' | transloco }}
            </button>
          </div>
        </form>

        <aside class="preview" [attr.aria-label]="'settings.preview' | transloco">
          <h2>{{ 'settings.preview' | transloco }}</h2>
          <div class="portal" [style]="previewStyle()">
            <div class="portal-bar">
              @if (current.logoUrl) {
                <img [src]="current.logoUrl" alt="" />
              }
              <span>{{ form.controls.name.value || current.name }}</span>
            </div>
            <div class="portal-body">
              <strong>{{
                'portal.welcome.title'
                  | transloco: { name: form.controls.name.value || current.name }
              }}</strong>
              <p dir="auto">
                {{ form.controls.portalWelcomeText.value || ('portal.welcome.body' | transloco) }}
              </p>
              <span class="portal-button">{{ 'portal.requests.new' | transloco }}</span>
            </div>
          </div>
          <a mat-button [href]="'/portal/' + current.slug" target="_blank" rel="noopener">
            <mat-icon aria-hidden="true">open_in_new</mat-icon>
            {{ 'settings.openPortal' | transloco }}
          </a>
        </aside>
      </div>
    }
  `,
  styles: `
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(240px, 320px);
      gap: 24px;
      align-items: start;
      max-inline-size: 1100px;
    }

    .sections {
      display: grid;
      gap: 16px;
    }

    mat-card-content {
      padding-block-start: 16px;
    }

    .row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }

    .logo-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
    }

    .logo-box {
      display: grid;
      place-items: center;
      inline-size: 96px;
      block-size: 96px;
      border: 1px dashed var(--mat-sys-outline);
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
      color: var(--mat-sys-on-surface-variant);
      overflow: hidden;
    }

    .logo-box img {
      max-inline-size: 88px;
      max-block-size: 88px;
      object-fit: contain;
    }

    .logo-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }

    .hint {
      flex-basis: 100%;
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-body-small);
    }

    .color-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 12px;
    }

    .swatch {
      inline-size: 48px;
      block-size: 48px;
      padding: 0;
      border: 1px solid var(--mat-sys-outline);
      border-radius: 12px;
      background: none;
      cursor: pointer;
    }

    .swatch:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
    }

    .preview {
      position: sticky;
      inset-block-start: 16px;
      display: grid;
      gap: 12px;
    }

    .preview h2 {
      margin: 0;
      font: var(--mat-sys-title-medium);
    }

    .portal {
      overflow: hidden;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 16px;
      background: var(--mat-sys-surface);
    }

    .portal-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      border-block-end: 1px solid var(--mat-sys-outline-variant);
      color: var(--mat-sys-primary);
      font: var(--mat-sys-title-small);
      font-weight: 600;
    }

    .portal-bar img {
      block-size: 24px;
      max-inline-size: 96px;
      object-fit: contain;
    }

    .portal-body {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 24px 16px;
      text-align: center;
    }

    .portal-body p {
      margin: 0;
      color: var(--mat-sys-on-surface-variant);
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .portal-button {
      padding: 8px 16px;
      border-radius: 999px;
      background: var(--mat-sys-primary);
      color: var(--mat-sys-on-primary);
      font: var(--mat-sys-label-large);
    }

    @media (max-width: 1200px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }

      .preview {
        position: static;
      }
    }

    @media (max-width: 600px) {
      .row {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class WorkspaceSettingsPage {
  private readonly api = inject(SettingsApi);
  private readonly auth = inject(AuthService);
  private readonly notifier = inject(Notifier);
  private readonly confirm = inject(Confirm);

  protected readonly timezones = TIMEZONES;
  protected readonly defaultColor = DEFAULT_COLOR;
  protected readonly settings = signal<WorkspaceSettings | null>(null);
  protected readonly saving = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    timezone: ['UTC', Validators.required],
    defaultLanguage: ['en' as 'en' | 'ar', Validators.required],
    brandColor: ['', Validators.pattern(HEX)],
    portalWelcomeText: ['', Validators.maxLength(1000)],
  });

  protected readonly colorValue = toSignal(
    this.form.controls.brandColor.valueChanges.pipe(startWith(this.form.controls.brandColor.value)),
    { initialValue: '' },
  );

  /** The brand colour against a white page; below 3:1 buttons and links become hard to read. */
  protected readonly lowContrast = computed(() => {
    const color = this.colorValue();
    return HEX.test(color) && contrastRatio(color, '#ffffff') < 3;
  });

  protected readonly previewStyle = computed(() => {
    const color = this.colorValue();
    return brandTokens(HEX.test(color) ? color : null);
  });

  constructor() {
    this.api.get().subscribe((settings) => this.apply(settings));
  }

  protected portalAddress(slug: string): string {
    return `${location.origin}/portal/${slug}`;
  }

  protected setColor(color: string): void {
    this.form.controls.brandColor.setValue(color.toLowerCase());
    this.form.controls.brandColor.markAsDirty();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .update({
        name: value.name.trim(),
        timezone: value.timezone,
        defaultLanguage: value.defaultLanguage,
        brandColor: value.brandColor || null,
        portalWelcomeText: value.portalWelcomeText.trim() || null,
      })
      .subscribe({
        next: (saved) => {
          this.apply(saved);
          this.saving.set(false);
          this.notifier.success('settings.saved');
        },
        error: (failure: unknown) => {
          this.error.set(this.notifier.problemMessage(toProblem(failure)));
          this.saving.set(false);
        },
      });
  }

  protected pickLogo(input: HTMLInputElement): void {
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    const problem = logoProblem(file);
    if (problem) {
      this.notifier.message(this.notifier.translate(problem));
      return;
    }

    this.uploading.set(true);
    this.api.uploadLogo(file).subscribe({
      next: (saved) => {
        this.settings.set(saved);
        this.uploading.set(false);
        this.notifier.success('settings.logoSaved');
      },
      error: (failure: unknown) => {
        this.uploading.set(false);
        this.notifier.problem(toProblem(failure));
      },
    });
  }

  protected removeLogo(): void {
    this.confirm
      .ask({
        title: this.notifier.translate('settings.removeLogoTitle'),
        message: this.notifier.translate('settings.removeLogoBody'),
        confirmLabel: this.notifier.translate('settings.removeLogo'),
        destructive: true,
      })
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.removeLogo()),
      )
      .subscribe((saved) => this.settings.set(saved));
  }

  private apply(settings: WorkspaceSettings): void {
    this.settings.set(settings);
    this.form.reset({
      name: settings.name,
      timezone: settings.timezone,
      defaultLanguage: settings.defaultLanguage,
      brandColor: settings.brandColor ?? '',
      portalWelcomeText: settings.portalWelcomeText ?? '',
    });

    // The header shows the workspace name from the session; keep it in step.
    const session = this.auth.session();
    if (session?.tenant) {
      this.auth.updateSession({
        ...session,
        tenant: {
          ...session.tenant,
          name: settings.name,
          timezone: settings.timezone,
          defaultLanguage: settings.defaultLanguage,
        },
      });
    }
  }
}
