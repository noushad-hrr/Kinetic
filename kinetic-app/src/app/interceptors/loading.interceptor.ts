import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { LoaderService } from '../services/loader.service';

/** Map GAS `action` query param to user-facing loading copy. */
const ACTION_LABELS: Record<string, string> = {
  loginWithRBAC: 'Signing in…',
  getRoles: 'Loading roles…',
  getPermissions: 'Loading permissions…',
  getRolePermissions: 'Loading role permissions…',
  updateRolePermissions: 'Saving permissions…',
  createRole: 'Creating role…',
  updateRole: 'Updating role…',
  deleteRole: 'Deleting role…',
  getUsers: 'Loading users…',
  createUser: 'Creating user…',
  updateUser: 'Updating user…',
  deleteUser: 'Removing user…',
  getMasters: 'Loading reference data…',
};

/** Angular often keeps query params on `req.params`, not in `req.url`. */
function extractAction(req: HttpRequest<unknown>): string {
  const fromParams = req.params.get('action')?.trim();
  if (fromParams) return fromParams;

  const url = req.url;
  try {
    const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
    let action = new URLSearchParams(q).get('action')?.trim() || '';
    if (!action) {
      const m = url.match(/[?&]action=([^&]+)/);
      if (m?.[1]) {
        try {
          action = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim();
        } catch {
          action = m[1].trim();
        }
      }
    }
    return action;
  } catch {
    return '';
  }
}

function messageForRequest(req: HttpRequest<unknown>): string {
  const action = extractAction(req);
  if (action && ACTION_LABELS[action]) return ACTION_LABELS[action]!;
  if (action) return `Running ${action.replace(/([A-Z])/g, ' $1').trim()}…`;
  return 'Loading…';
}

export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  const loader = inject(LoaderService);
  const message = messageForRequest(req);
  const id = loader.startTask(message);
  return next(req).pipe(finalize(() => loader.endTask(id)));
};
