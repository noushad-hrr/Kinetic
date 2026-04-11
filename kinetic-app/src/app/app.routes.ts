import { Routes } from '@angular/router';
import { authGuard, permissionGuard, permissionGuardAny } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then(m => m.LoginComponent),
  },
  {
    path: '',
    loadComponent: () => import('./shared/components/shell/shell.component').then(m => m.ShellComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // Tasks Manager
      { path: 'tasks-manager', redirectTo: 'tasks-manager/projects', pathMatch: 'full' },
      {
        path: 'tasks-manager/projects',
        loadComponent: () => import('./features/tasks-manager/tm-projects.component').then(m => m.TmProjectsComponent),
      },
      {
        path: 'tasks-manager/tasks',
        loadComponent: () => import('./features/tasks-manager/tm-tasks.component').then(m => m.TmTasksComponent),
      },

      // Budget Manager
      { path: 'budget-manager', redirectTo: 'budget-manager/projects', pathMatch: 'full' },
      {
        path: 'budget-manager/projects',
        loadComponent: () => import('./features/budget-manager/bm-projects.component').then(m => m.BmProjectsComponent),
      },
      {
        path: 'budget-manager/budget',
        loadComponent: () => import('./features/budget-manager/bm-budget.component').then(m => m.BmBudgetComponent),
      },

      // Admin
      { path: 'admin', redirectTo: 'admin/overview', pathMatch: 'full' },
      {
        path: 'admin/overview',
        canActivate: [permissionGuardAny('USER_MANAGE', 'ROLE_MANAGE')],
        loadComponent: () => import('./features/admin/admin-overview.component').then(m => m.AdminOverviewComponent),
      },
      {
        path: 'admin/users',
        canActivate: [permissionGuard('USER_MANAGE')],
        loadComponent: () => import('./features/admin/users.component').then(m => m.UsersComponent),
      },
      {
        path: 'admin/roles',
        canActivate: [permissionGuard('ROLE_MANAGE')],
        loadComponent: () => import('./features/admin/roles.component').then(m => m.RolesComponent),
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
