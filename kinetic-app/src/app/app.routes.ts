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
        canActivate: [permissionGuard('DASHBOARD_READ')],
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      {
        path: 'settings',
        canActivate: [permissionGuard('SETTINGS_READ')],
        loadComponent: () => import('./features/settings/settings.component').then(m => m.SettingsComponent),
      },

      // Tasks Manager
      { path: 'tasks-manager', redirectTo: 'tasks-manager/tasks', pathMatch: 'full' },
      {
        path: 'tasks-manager/projects',
        canActivate: [permissionGuard('TASK_MANAGER_PROJECTS_READ')],
        loadComponent: () => import('./features/tasks-manager/tm-projects.component').then(m => m.TmProjectsComponent),
      },
      {
        path: 'tasks-manager/tasks',
        canActivate: [permissionGuard('TASK_MANAGER_TASKS_READ')],
        loadComponent: () => import('./features/tasks-manager/tm-tasks.component').then(m => m.TmTasksComponent),
      },

      // Budget Manager
      { path: 'budget-manager', redirectTo: 'budget-manager/projects', pathMatch: 'full' },
      {
        path: 'budget-manager/projects',
        canActivate: [permissionGuard('BUDGET_MANAGER_PROJECTS_READ')],
        loadComponent: () => import('./features/budget-manager/bm-projects.component').then(m => m.BmProjectsComponent),
      },
      {
        path: 'budget-manager/budget',
        canActivate: [permissionGuard('BUDGET_MANAGER_BUDGET_READ')],
        loadComponent: () => import('./features/budget-manager/bm-budget.component').then(m => m.BmBudgetComponent),
      },

      // Admin
      {
        path: 'admin',
        canActivate: [permissionGuardAny('USER_READ', 'ROLE_READ')],
        loadComponent: () => import('./features/admin/admin-redirect.component').then(m => m.AdminRedirectComponent),
      },
      {
        path: 'admin/users',
        canActivate: [permissionGuard('USER_READ')],
        loadComponent: () => import('./features/admin/users.component').then(m => m.UsersComponent),
      },
      {
        path: 'admin/roles',
        canActivate: [permissionGuard('ROLE_READ')],
        loadComponent: () => import('./features/admin/roles.component').then(m => m.RolesComponent),
      },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
