import { Routes } from '@angular/router';
import { authGuard, guestGuard, onboardingGuard, permissionGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then((m) => m.Landing),
    title: 'NexDesk',
  },
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login').then((m) => m.Login),
        title: 'NexDesk',
      },
      {
        path: 'register',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register').then((m) => m.Register),
        title: 'NexDesk',
      },
      {
        path: 'verify-email',
        loadComponent: () => import('./features/auth/verify-email').then((m) => m.VerifyEmail),
        title: 'NexDesk',
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/auth/forgot-password').then((m) => m.ForgotPassword),
        title: 'NexDesk',
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./features/auth/reset-password').then((m) => m.ResetPassword),
        title: 'NexDesk',
      },
      {
        path: 'accept-invite',
        loadComponent: () => import('./features/auth/accept-invite').then((m) => m.AcceptInvite),
        title: 'NexDesk',
      },
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
  {
    path: 'onboarding',
    canActivate: [authGuard, permissionGuard('settings.manage')],
    loadComponent: () => import('./features/onboarding/onboarding').then((m) => m.Onboarding),
    title: 'NexDesk',
  },
  {
    path: 'app',
    canActivate: [authGuard, onboardingGuard],
    loadComponent: () => import('./layout/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
        title: 'NexDesk',
      },
      {
        path: 'tickets',
        canActivate: [permissionGuard('tickets.view')],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/tickets/tickets').then((m) => m.Tickets),
            title: 'NexDesk',
          },
          {
            path: 'new',
            canActivate: [permissionGuard('tickets.create')],
            loadComponent: () => import('./features/tickets/ticket-new').then((m) => m.TicketNew),
            title: 'NexDesk',
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/tickets/ticket-detail').then((m) => m.TicketDetail),
            title: 'NexDesk',
          },
        ],
      },
      {
        path: 'users',
        canActivate: [permissionGuard('users.view')],
        loadComponent: () => import('./features/users/users').then((m) => m.Users),
        title: 'NexDesk',
      },
      {
        path: 'teams',
        canActivate: [permissionGuard('users.view')],
        loadComponent: () => import('./features/teams/teams').then((m) => m.Teams),
        title: 'NexDesk',
      },
      {
        path: 'kb',
        canActivate: [permissionGuard('kb.view')],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./features/kb/kb').then((m) => m.Kb),
            title: 'NexDesk',
          },
          {
            path: 'new',
            canActivate: [permissionGuard('kb.manage')],
            loadComponent: () =>
              import('./features/kb/kb-article-editor').then((m) => m.KbArticleEditor),
            title: 'NexDesk',
          },
          {
            path: ':id',
            loadComponent: () =>
              import('./features/kb/kb-article-editor').then((m) => m.KbArticleEditor),
            title: 'NexDesk',
          },
        ],
      },
      {
        path: 'settings/sla',
        canActivate: [permissionGuard('sla.manage')],
        loadComponent: () => import('./features/settings/sla-settings').then((m) => m.SlaSettings),
        title: 'NexDesk',
      },
      {
        path: 'settings/custom-fields',
        canActivate: [permissionGuard('custom-fields.manage')],
        loadComponent: () =>
          import('./features/settings/custom-fields').then((m) => m.CustomFields),
        title: 'NexDesk',
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
        title: 'NexDesk',
      },
    ],
  },
  {
    path: 'portal',
    loadChildren: () => import('./portal/portal.routes').then((m) => m.portalRoutes),
  },
  { path: '**', redirectTo: '' },
];
