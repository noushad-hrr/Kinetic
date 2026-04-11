import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="p-4 max-w-5xl mx-auto space-y-6">

      <div class="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-slate-900 via-slate-800 to-primary text-white shadow-lg">
        <div class="absolute inset-0 opacity-[0.07] pointer-events-none"
             style="background-image: radial-gradient(circle at 20% 20%, white 0, transparent 45%), radial-gradient(circle at 80% 60%, white 0, transparent 40%);"></div>
        <div class="relative px-5 py-6 sm:px-8 sm:py-8">
          <div class="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-white/60">
            <span class="material-symbols-outlined text-[16px]">shield_person</span>
            Administration
          </div>
          <h1 class="mt-2 text-xl sm:text-2xl font-bold tracking-tight">Control centre</h1>
          <p class="mt-2 text-sm text-white/75 max-w-xl leading-relaxed">
            Manage who can access Kinetic and what they are allowed to do. Pick an area below — each screen is optimised for the data you are changing.
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        @if (auth.hasPermission('USER_MANAGE')) {
          <a routerLink="/admin/users"
             class="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
            <div class="flex items-start justify-between gap-3">
              <div class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <span class="material-symbols-outlined text-[24px]">manage_accounts</span>
              </div>
              <span class="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors text-[20px]">arrow_forward</span>
            </div>
            <h2 class="mt-4 text-sm font-bold text-slate-900">Users</h2>
            <p class="mt-1 text-xs text-slate-500 leading-relaxed">
              Create and edit accounts, assign roles, and control activation. Best for day‑to‑day identity operations.
            </p>
          </a>
        }

        @if (auth.hasPermission('ROLE_MANAGE')) {
          <a routerLink="/admin/roles"
             class="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-primary/30 transition-all">
            <div class="flex items-start justify-between gap-3">
              <div class="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <span class="material-symbols-outlined text-[24px]">admin_panel_settings</span>
              </div>
              <span class="material-symbols-outlined text-slate-300 group-hover:text-emerald-600 transition-colors text-[20px]">arrow_forward</span>
            </div>
            <h2 class="mt-4 text-sm font-bold text-slate-900">Roles &amp; permissions</h2>
            <p class="mt-1 text-xs text-slate-500 leading-relaxed">
              Define roles and fine‑grain access with permission toggles. Use when you are shaping security policy.
            </p>
          </a>
        }
      </div>

      @if (!auth.hasPermission('USER_MANAGE') && !auth.hasPermission('ROLE_MANAGE')) {
        <p class="text-center text-sm text-slate-500 py-8">You do not have access to administration features.</p>
      }
    </div>
  `
})
export class AdminOverviewComponent {
  constructor(public auth: AuthService) {}
}
