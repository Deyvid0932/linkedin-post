import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  { path: 'auth/login', loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent) },
  { path: 'auth/register', loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent) },
  { path: 'auth/accept-invitation', loadComponent: () => import('./features/auth/accept-invitation/accept-invitation.component').then(m => m.AcceptInvitationComponent) },
  { path: 'auth/forgot-password', loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent) },
  {
    path: 'settings', loadComponent: () => import('./layout/settings-layout.component').then(m => m.SettingsLayoutComponent), canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'profile', pathMatch: 'full' },
      { path: 'profile', loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent) },
      { path: 'security', loadComponent: () => import('./features/profile/security.component').then(m => m.SecurityComponent) },
      { path: 'appearance', loadComponent: () => import('./features/settings/appearance/appearance.component').then(m => m.AppearanceComponent) },
      { path: 'channels', loadComponent: () => import('./features/settings/linkedin/linkedin-settings.component').then(m => m.LinkedinSettingsComponent) },
      { path: 'linkedin', redirectTo: 'channels', pathMatch: 'full' },
      { path: 'schedule', loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent) },
      { path: 'voice', loadComponent: () => import('./features/settings/voice/voice-settings.component').then(m => m.VoiceSettingsComponent) },
      { path: 'ai-connections', loadComponent: () => import('./features/settings/ai-connections/ai-connections.component').then(m => m.AiConnectionsComponent) },
      { path: 'github', loadComponent: () => import('./features/settings/github/github-settings.component').then(m => m.GithubSettingsComponent) },
      { path: 'webhooks', loadComponent: () => import('./features/settings/webhooks/webhooks.component').then(m => m.WebhooksComponent) },
      { path: 'admin', canActivate: [adminGuard], loadComponent: () => import('./features/admin/admin.component').then(m => m.AdminComponent) },
    ],
  },
  { path: 'profile/security', redirectTo: 'settings/security', pathMatch: 'full' },
  { path: 'profile', redirectTo: ({ fragment, queryParams }) => inject(Router).createUrlTree([fragment === 'password' ? '/settings/security' : '/settings/profile'], { queryParams }), pathMatch: 'full' },
  { path: 'admin', redirectTo: 'settings/admin', pathMatch: 'full' },
  { path: 'connections', redirectTo: 'settings/channels', pathMatch: 'full' },
  {
    path: '', component: MainLayoutComponent, canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'compose', canDeactivate: [(component: { canLeave: () => boolean }) => component.canLeave()], loadComponent: () => import('./features/compose/compose.component').then(m => m.ComposeComponent) },
      { path: 'studio', redirectTo: ({ queryParams }) => inject(Router).createUrlTree(['/compose'], { queryParams: { ...queryParams, advanced: 'true' } }), pathMatch: 'full' },
      { path: 'calendar', loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: 'queue', loadComponent: () => import('./features/queue/queue.component').then(m => m.QueueComponent) },
      { path: 'publications/preview', redirectTo: 'studio', pathMatch: 'full' },
      { path: 'publications', loadComponent: () => import('./features/publications/history/publications.component').then(m => m.PublicationsComponent) },
      { path: 'topics', loadComponent: () => import('./features/topics/topics.component').then(m => m.TopicsComponent) },
      { path: 'library', loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent) },
      { path: 'insights', loadComponent: () => import('./features/insights/insights.component').then(m => m.InsightsComponent) },
      { path: 'how-it-works', loadComponent: () => import('./features/guide/how-it-works.component').then(m => m.HowItWorksComponent) },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
