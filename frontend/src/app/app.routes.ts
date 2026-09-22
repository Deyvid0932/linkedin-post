import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout.component';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./features/auth/register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'auth/forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'studio',
        loadComponent: () => import('./features/studio/swipe-studio.component').then(m => m.SwipeStudioComponent)
      },
      {
        path: 'library',
        loadComponent: () => import('./features/library/library.component').then(m => m.LibraryComponent)
      },
      {
        path: 'connections',
        loadComponent: () => import('./features/connections/connections.component').then(m => m.ConnectionsComponent)
      },
      {
        path: 'publications',
        loadComponent: () => import('./features/publications/history/publications.component').then(m => m.PublicationsComponent)
      },
      {
        path: 'publications/preview',
        redirectTo: 'studio',
        pathMatch: 'full'
      },
      {
        path: 'topics',
        loadComponent: () => import('./features/topics/topics.component').then(m => m.TopicsComponent)
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent)
      },
      {
        path: 'settings/linkedin',
        loadComponent: () => import('./features/settings/linkedin/linkedin-settings.component').then(m => m.LinkedinSettingsComponent)
      },
      {
        path: 'settings/github',
        loadComponent: () => import('./features/settings/github/github-settings.component').then(m => m.GithubSettingsComponent)
      },
      {
        path: 'how-it-works',
        loadComponent: () => import('./features/guide/how-it-works.component').then(m => m.HowItWorksComponent)
      }
    ]

  },
  {
    path: '**',
    redirectTo: 'dashboard'
  }
];
