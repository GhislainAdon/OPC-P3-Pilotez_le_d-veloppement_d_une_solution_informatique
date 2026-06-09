import { Routes } from '@angular/router';
import { authGuard } from './auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/upload.component').then(m => m.UploadComponent)
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/history.component').then(m => m.HistoryComponent),
    canActivate: [authGuard]
  },
  {
    path: 'download/:uuid',
    loadComponent: () => import('./components/download.component').then(m => m.DownloadComponent)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
