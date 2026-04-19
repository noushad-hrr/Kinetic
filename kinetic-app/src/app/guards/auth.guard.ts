import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/login']);
};

/** Protects a route by a specific permission code. Redirects to Tasks Day chart if not granted. */
export const permissionGuard = (code: string): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (auth.hasPermission(code)) return true;
  return router.createUrlTree(['/login']);
};

/** User may access if they have any of the listed permissions. */
export const permissionGuardAny = (...codes: string[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (codes.some(c => auth.hasPermission(c))) return true;
  return router.createUrlTree(['/login']);
};
