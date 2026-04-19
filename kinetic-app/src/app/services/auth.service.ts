import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import { SessionUser } from '../models';

const SESSION_KEY = 'kinetic_session';
const PERM_CODES_KEY = 'kinetic_perm_codes';
const TASKS_PROJ_KEY = 'kinetic_tasks_project_ids';
const BUDGET_PROJ_KEY = 'kinetic_budget_project_ids';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<SessionUser | null>(null);
  permissionCodes = signal<string[]>([]);
  allowedTasksProjectIds = signal<string[]>([]);
  allowedBudgetProjectIds = signal<string[]>([]);

  constructor(private api: ApiService, private router: Router) {
    this.restoreSession();
  }

  private restoreSession() {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) this.currentUser.set(JSON.parse(stored));

    const codes = sessionStorage.getItem(PERM_CODES_KEY);
    if (codes) this.permissionCodes.set(JSON.parse(codes));

    const tpids = sessionStorage.getItem(TASKS_PROJ_KEY);
    if (tpids) this.allowedTasksProjectIds.set(JSON.parse(tpids));

    const bpids = sessionStorage.getItem(BUDGET_PROJ_KEY);
    if (bpids) this.allowedBudgetProjectIds.set(JSON.parse(bpids));
  }

  login(username: string, password: string): Observable<{ user: SessionUser }> {
    return this.api.login(username, password).pipe(
      tap(res => {
        this.currentUser.set(res.user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(res.user));

        const codes = res.permissions || [];
        this.permissionCodes.set(codes);
        sessionStorage.setItem(PERM_CODES_KEY, JSON.stringify(codes));

        const tpids = res.tasksProjectIds || [];
        this.allowedTasksProjectIds.set(tpids);
        sessionStorage.setItem(TASKS_PROJ_KEY, JSON.stringify(tpids));

        const bpids = res.budgetProjectIds || [];
        this.allowedBudgetProjectIds.set(bpids);
        sessionStorage.setItem(BUDGET_PROJ_KEY, JSON.stringify(bpids));
      }),
      map(res => ({ user: res.user }))
    );
  }

  hasPermission(code: string): boolean {
    const u = this.currentUser();
    if (u && (u.is_super_admin === true || String(u.is_super_admin).toUpperCase() === 'TRUE')) return true;
    return this.permissionCodes().includes(code);
  }

  isAdmin(): boolean {
    return this.hasPermission('USER_READ') || this.hasPermission('ROLE_READ');
  }

  hasTasksProjectAccess(projectId: string): boolean {
    const u = this.currentUser();
    if (u && (u.is_super_admin === true || String(u.is_super_admin).toUpperCase() === 'TRUE')) return true;
    return this.allowedTasksProjectIds().includes(projectId);
  }

  hasBudgetProjectAccess(projectId: string): boolean {
    const u = this.currentUser();
    if (u && (u.is_super_admin === true || String(u.is_super_admin).toUpperCase() === 'TRUE')) return true;
    return this.allowedBudgetProjectIds().includes(projectId);
  }

  logout() {
    this.currentUser.set(null);
    this.permissionCodes.set([]);
    this.allowedTasksProjectIds.set([]);
    this.allowedBudgetProjectIds.set([]);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PERM_CODES_KEY);
    sessionStorage.removeItem(TASKS_PROJ_KEY);
    sessionStorage.removeItem(BUDGET_PROJ_KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }
}
