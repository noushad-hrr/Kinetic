import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  ApiResponse, SessionUser, Masters,
  Role, Permission, AdminUser
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private base = environment.gasApiUrl;

  constructor(private http: HttpClient) {}

  /**
   * All requests use GET to avoid CORS preflight.
   * Write operations pass body as JSON in the 'data' query param.
   */
  private call<T>(action: string, params: Record<string, string> = {}, body?: unknown): Observable<T> {
    let httpParams = new HttpParams().set('action', action);

    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
        httpParams = httpParams.set(k, params[k]);
      }
    });

    if (body) {
      httpParams = httpParams.set('data', JSON.stringify(body));
    }

    return this.http.get<ApiResponse<T>>(this.base, { params: httpParams }).pipe(
      map(res => {
        if (!res.success) throw new Error(res.error || 'API error');
        return res.data as T;
      }),
      catchError(err => {
        const msg = err?.error?.error || err?.message || 'Network error';
        return throwError(() => new Error(msg));
      })
    );
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  login(username: string, password: string) {
    return this.call<{ user: SessionUser; permissions: string[] }>(
      'loginWithRBAC', { username, password }
    );
  }

  // ─── Admin: Roles ─────────────────────────────────────────────────────────────

  getRoles() {
    return this.call<Role[]>('getRoles');
  }

  createRole(data: { role_name: string; role_description?: string; created_by: string }) {
    return this.call<Role>('createRole', {}, data);
  }

  updateRole(roleId: string, data: Partial<Role>) {
    return this.call<{ message: string }>('updateRole', { role_id: roleId }, data);
  }

  deleteRole(roleId: string) {
    return this.call<{ message: string }>('deleteRole', { role_id: roleId });
  }

  // ─── Admin: Permissions ───────────────────────────────────────────────────────

  getPermissions() {
    return this.call<Permission[]>('getPermissions');
  }

  getRolePermissions(roleId: string) {
    return this.call<{ mapping_id: string; role_id_fk: string; permission_id_fk: string; permission_code: string }[]>(
      'getRolePermissions', { role_id: roleId }
    );
  }

  updateRolePermissions(roleId: string, permissions: string[]) {
    return this.call<{ message: string }>('updateRolePermissions', { role_id: roleId }, { permissions });
  }

  // ─── Admin: Users ─────────────────────────────────────────────────────────────

  getUsers() {
    return this.call<AdminUser[]>('getUsers');
  }

  createUser(data: { username: string; password: string; display_name: string; email: string; role_id: string }) {
    return this.call<AdminUser>('createUser', {}, data);
  }

  updateUser(data: Partial<AdminUser> & { user_id: string; password?: string }) {
    return this.call<{ message: string }>('updateUser', {}, data);
  }

  deleteUser(userId: string) {
    return this.call<{ message: string }>('deleteUser', { user_id: userId });
  }

  // ─── Masters ─────────────────────────────────────────────────────────────────

  getMasters() {
    return this.call<Masters>('getMasters');
  }
}
