import { Routes } from '@angular/router';
import { portalAuthGuard, portalWorkspaceGuard } from './portal-shell';

export const portalRoutes: Routes = [
  {
    path: ':tenantSlug',
    canActivate: [portalWorkspaceGuard],
    loadComponent: () => import('./portal-shell').then((m) => m.PortalShell),
    title: 'NexDesk',
    children: [
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./portal-requests').then((m) => m.PortalHome),
      },
      {
        path: 'login',
        loadComponent: () => import('./portal-auth-pages').then((m) => m.PortalLogin),
      },
      {
        path: 'register',
        loadComponent: () => import('./portal-auth-pages').then((m) => m.PortalRegister),
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./portal-auth-pages').then((m) => m.PortalForgotPassword),
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./portal-auth-pages').then((m) => m.PortalResetPassword),
      },
      {
        path: 'csat',
        loadComponent: () => import('./portal-requests').then((m) => m.PortalCsat),
      },
      {
        path: 'tickets',
        canActivate: [portalAuthGuard],
        children: [
          {
            path: '',
            pathMatch: 'full',
            loadComponent: () => import('./portal-requests').then((m) => m.PortalTickets),
          },
          {
            path: 'new',
            loadComponent: () => import('./portal-requests').then((m) => m.PortalTicketNew),
          },
          {
            path: ':id',
            loadComponent: () => import('./portal-requests').then((m) => m.PortalTicket),
          },
        ],
      },
    ],
  },
];
