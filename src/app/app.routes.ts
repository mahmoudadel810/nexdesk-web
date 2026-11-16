import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guards';

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
      { path: '', pathMatch: 'full', redirectTo: 'login' },
    ],
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/home/home').then((m) => m.Home),
        title: 'NexDesk',
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
