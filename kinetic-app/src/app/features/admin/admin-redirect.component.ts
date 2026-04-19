import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/** Picks the first admin route the user may access (replaces removed /admin/overview landing). */
@Component({
  selector: 'app-admin-redirect',
  standalone: true,
  template: '',
})
export class AdminRedirectComponent implements OnInit {
  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    if (this.auth.hasPermission('USER_READ')) {
      void this.router.navigateByUrl('/admin/users', { replaceUrl: true });
    } else if (this.auth.hasPermission('ROLE_READ')) {
      void this.router.navigateByUrl('/admin/roles', { replaceUrl: true });
    } else {
      void this.router.navigateByUrl('/tasks-manager/tasks?view=day', { replaceUrl: true });
    }
  }
}
