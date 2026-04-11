import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap, map } from 'rxjs';
import { ApiService } from './api.service';
import { SessionUser } from '../models';

const SESSION_KEY = 'kinetic_session';
const PERM_CODES_KEY = 'kinetic_perm_codes';

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<SessionUser | null>(null);
  permissionCodes = signal<string[]>([]);

  constructor(private api: ApiService, private router: Router) {
    this.restoreSession();
  }

  private restoreSession() {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) this.currentUser.set(JSON.parse(stored));

    const codes = sessionStorage.getItem(PERM_CODES_KEY);
    if (codes) this.permissionCodes.set(JSON.parse(codes));
  }

  login(username: string, password: string): Observable<{ user: SessionUser }> {
    return this.api.login(username, password).pipe(
      tap(res => {
        this.currentUser.set(res.user);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(res.user));

        const codes = res.permissions || [];
        this.permissionCodes.set(codes);
        sessionStorage.setItem(PERM_CODES_KEY, JSON.stringify(codes));
      }),
      map(res => ({ user: res.user }))
    );
  }

  hasPermission(code: string): boolean {
    return this.permissionCodes().includes(code);
  }

  isAdmin(): boolean {
    return this.hasPermission('USER_MANAGE') || this.hasPermission('ROLE_MANAGE');
  }

  logout() {
    this.currentUser.set(null);
    this.permissionCodes.set([]);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(PERM_CODES_KEY);
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return this.currentUser() !== null;
  }
}
