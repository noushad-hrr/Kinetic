import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../../services/auth.service';
import { MastersService } from '../../../services/masters.service';
import { LoaderService } from '../../../services/loader.service';
import { LoaderOverlayComponent } from '../loader-overlay/loader-overlay.component';

interface PageInfo { breadcrumb: string[]; title: string; }

const TITLE_MAP: Record<string, PageInfo> = {
  '/dashboard':                { breadcrumb: [],                  title: 'Dashboard'           },
  '/tasks-manager/projects':   { breadcrumb: ['Tasks Manager'],   title: 'Projects'            },
  '/tasks-manager/tasks':      { breadcrumb: ['Tasks Manager'],   title: 'Tasks'               },
  '/settings':                 { breadcrumb: [],                  title: 'Settings'            },
  '/budget-manager/projects':  { breadcrumb: ['Budget Manager'],  title: 'Projects'            },
  '/budget-manager/budget':    { breadcrumb: ['Budget Manager'],  title: 'Budget'              },
  '/admin/users':              { breadcrumb: ['Administration'],  title: 'Users'               },
  '/admin/roles':              { breadcrumb: ['Administration'],  title: 'Roles & Permissions' },
};

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, LoaderOverlayComponent],
  template: `
    @if (loader.isLoading()) {
      <app-loader-overlay />
    }

    <div class="flex h-screen overflow-hidden bg-surface dark:bg-[#1e1e1e]">

      <!-- Mobile overlay -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 bg-black/30 z-30 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- ── Sidebar ── -->
      <aside class="fixed left-0 top-0 h-full flex flex-col w-56 bg-surface-container-lowest border-r border-surface-container-high z-40 transition-transform duration-300
                    dark:bg-[#252526] dark:border-[#3c3c3c]"
             [class.-translate-x-full]="!sidebarOpen()"
             [class.translate-x-0]="sidebarOpen()"
             [class.lg:translate-x-0]="true">

        <!-- Brand -->
        <div class="px-4 py-3 flex items-center gap-2.5 border-b border-surface-container-high dark:border-[#3c3c3c] flex-shrink-0">
          <div class="w-7 h-7 rounded-md bg-primary dark:bg-[#3c3c3c] flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-white dark:text-neutral-200 text-base k-shell-brand-bolt"
                  [class.k-shell-brand-bolt--busy]="loader.isLoading()"
                  style="font-variation-settings:'FILL' 1;">bolt</span>
          </div>
          <span class="text-base font-bold tracking-tight text-slate-900 dark:text-neutral-50">Kinetic</span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">

          @if (auth.hasPermission('DASHBOARD_READ')) {
            <a routerLink="/dashboard" routerLinkActive="bg-primary" #rlaDash="routerLinkActive"
               [ngClass]="rlaDash.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
               class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium hover:bg-surface-container-low dark:hover:bg-zinc-900 transition-colors"
               (click)="sidebarOpen.set(false)">
              <span class="material-symbols-outlined text-[18px]">dashboard</span>
              Dashboard
            </a>
          }

          <!-- Tasks Manager -->
          @if (auth.hasPermission('TASK_MANAGER_PROJECTS_READ') || auth.hasPermission('TASK_MANAGER_TASKS_READ')) {
            <div>
              <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      [class]="isGroupActive('/tasks-manager') ? 'bg-primary/10 text-primary dark:bg-white/[0.06] dark:text-neutral-200' : 'text-slate-600 hover:bg-surface-container-low dark:text-neutral-300 dark:hover:bg-[#2a2d2e]'"
                      (click)="tasksOpen.set(!tasksOpen())">
                <span class="material-symbols-outlined text-[18px]">task_alt</span>
                <span class="flex-1 text-left">Tasks Manager</span>
                <span class="material-symbols-outlined text-[16px] transition-transform duration-200"
                      [class.rotate-180]="tasksOpen()">expand_more</span>
              </button>
              @if (tasksOpen()) {
                <div class="mt-0.5 ml-4 pl-2.5 border-l-2 border-surface-container-high dark:border-[#3c3c3c] space-y-0.5">
                  @if (auth.hasPermission('TASK_MANAGER_PROJECTS_READ')) {
                    <a routerLink="/tasks-manager/projects" routerLinkActive="bg-primary" #rlaTP="routerLinkActive"
                       [ngClass]="rlaTP.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">folder_open</span>
                      Projects
                    </a>
                  }
                  @if (auth.hasPermission('TASK_MANAGER_TASKS_READ')) {
                    <a routerLink="/tasks-manager/tasks"
                       routerLinkActive="bg-primary" #rlaTT="routerLinkActive"
                       [routerLinkActiveOptions]="{ paths: 'exact', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' }"
                       [ngClass]="rlaTT.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">calendar_view_day</span>
                      Tasks
                    </a>
                  }
                </div>
              }
            </div>
          }

          <!-- Budget Manager -->
          @if (auth.hasPermission('BUDGET_MANAGER_PROJECTS_READ') || auth.hasPermission('BUDGET_MANAGER_BUDGET_READ')) {
            <div>
              <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                        [class]="isGroupActive('/budget-manager') ? 'bg-primary/10 text-primary dark:bg-white/[0.06] dark:text-neutral-200' : 'text-slate-600 hover:bg-surface-container-low dark:text-neutral-300 dark:hover:bg-[#2a2d2e]'"
                      (click)="budgetOpen.set(!budgetOpen())">
                <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
                <span class="flex-1 text-left">Budget Manager</span>
                <span class="material-symbols-outlined text-[16px] transition-transform duration-200"
                      [class.rotate-180]="budgetOpen()">expand_more</span>
              </button>
              @if (budgetOpen()) {
                <div class="mt-0.5 ml-4 pl-2.5 border-l-2 border-surface-container-high dark:border-[#3c3c3c] space-y-0.5">
                  @if (auth.hasPermission('BUDGET_MANAGER_PROJECTS_READ')) {
                    <a routerLink="/budget-manager/projects" routerLinkActive="bg-primary" #rlaBP="routerLinkActive"
                       [ngClass]="rlaBP.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">folder_open</span>
                      Projects
                    </a>
                  }
                  @if (auth.hasPermission('BUDGET_MANAGER_BUDGET_READ')) {
                    <a routerLink="/budget-manager/budget" routerLinkActive="bg-primary" #rlaBB="routerLinkActive"
                       [ngClass]="rlaBB.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">account_balance_wallet</span>
                      Budget
                    </a>
                  }
                </div>
              }
            </div>
          }

          @if (auth.hasPermission('SETTINGS_READ')) {
            <a routerLink="/settings" routerLinkActive="bg-primary" #rlaSettings="routerLinkActive"
               [ngClass]="rlaSettings.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
               class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
               (click)="sidebarOpen.set(false)">
              <span class="material-symbols-outlined text-[18px]">settings</span>
              Settings
            </a>
          }

          <!-- Administration -->
          @if (auth.hasPermission('USER_READ') || auth.hasPermission('ROLE_READ')) {
            <div>
              <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      [class]="isGroupActive('/admin') ? 'bg-primary/10 text-primary dark:bg-white/[0.06] dark:text-neutral-200' : 'text-slate-600 hover:bg-surface-container-low dark:text-neutral-300 dark:hover:bg-[#2a2d2e]'"
                      (click)="adminOpen.set(!adminOpen())">
                <span class="material-symbols-outlined text-[18px]">shield_person</span>
                <span class="flex-1 text-left">Administration</span>
                <span class="material-symbols-outlined text-[16px] transition-transform duration-200"
                      [class.rotate-180]="adminOpen()">expand_more</span>
              </button>
              @if (adminOpen()) {
                <div class="mt-0.5 ml-4 pl-2.5 border-l-2 border-surface-container-high dark:border-[#3c3c3c] space-y-0.5">
                  @if (auth.hasPermission('ROLE_READ')) {
                    <a routerLink="/admin/roles" routerLinkActive="bg-primary" #rlaRoles="routerLinkActive"
                       [ngClass]="rlaRoles.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                      Roles & Permissions
                    </a>
                  }@if (auth.hasPermission('USER_READ')) {
                    <a routerLink="/admin/users" routerLinkActive="bg-primary" #rlaUsers="routerLinkActive"
                       [ngClass]="rlaUsers.isActive ? 'text-white' : 'text-slate-600 dark:text-neutral-300'"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium hover:bg-surface-container-low dark:hover:bg-[#2a2d2e] transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">manage_accounts</span>
                      Users
                    </a>
                  }
                </div>
              }
            </div>
          }
        </nav>

        <!-- User area -->
        <div class="px-3 py-2.5 border-t border-surface-container-high dark:border-[#3c3c3c] flex-shrink-0">
          <div class="flex items-center gap-2 mb-1.5">
            <div class="w-7 h-7 rounded-full bg-primary dark:bg-[#3c3c3c] flex items-center justify-center text-white dark:text-neutral-100 text-2xs font-bold flex-shrink-0">
              {{ userInitials() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-slate-900 dark:text-neutral-50 truncate">{{ auth.currentUser()?.display_name }}</p>
              <p class="text-2xs text-slate-400 truncate">{{ auth.currentUser()?.role_name }}</p>
            </div>
          </div>
          <button (click)="logout()"
                  class="flex items-center gap-2 px-2 py-1.5 text-slate-500 hover:text-red-600 w-full rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors text-xs">
            <span class="material-symbols-outlined text-[15px]">logout</span>
            Logout
          </button>
        </div>
      </aside>

      <!-- ── Main ── -->
      <div class="flex-1 flex flex-col min-h-screen lg:ml-56 overflow-hidden">

        <!-- Header -->
        <header class="sticky top-0 z-30 flex items-center h-11 px-4 bg-surface-container-lowest border-b border-surface-container-high dark:bg-[#252526] dark:border-[#3c3c3c] flex-shrink-0 gap-3">
          <button class="lg:hidden p-1 text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-100 rounded" (click)="sidebarOpen.set(!sidebarOpen())">
            <span class="material-symbols-outlined text-[20px]">menu</span>
          </button>
          <!-- Breadcrumb -->
          <div class="flex items-center gap-1.5 text-sm min-w-0">
            @for (crumb of pageInfo().breadcrumb; track crumb) {
              <span class="text-slate-400 dark:text-neutral-500 text-xs hidden sm:block">{{ crumb }}</span>
              <span class="text-slate-300 dark:text-neutral-600 text-xs hidden sm:block">/</span>
            }
            <span class="font-semibold text-slate-800 dark:text-neutral-50 text-sm truncate">{{ pageInfo().title }}</span>
          </div>
        </header>

        <!-- Page content (min-h-0 so nested flex pages can fill height) -->
        <main class="k-app-data flex-1 min-h-0 overflow-y-auto bg-surface dark:bg-[#1e1e1e] flex flex-col text-sm leading-normal text-slate-800 dark:text-neutral-200">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    /* Same as loader overlay: global * { transition: opacity } would dampen keyframes. */
    .k-shell-brand-bolt--busy {
      transition: none;
      opacity: 0.32;
      animation: k-shell-brand-bolt-blink 0.95s ease-in-out infinite;
    }
    @keyframes k-shell-brand-bolt-blink {
      0%, 28%, 100% { opacity: 0.32; }
      34% { opacity: 1; }
      40% { opacity: 0.32; }
      52% { opacity: 1; }
      58% { opacity: 0.32; }
    }
    @media (prefers-reduced-motion: reduce) {
      .k-shell-brand-bolt--busy { animation: none; opacity: 1; }
    }
  `]
})
export class ShellComponent implements OnInit, OnDestroy {
  sidebarOpen = signal(true);
  tasksOpen   = signal(false);
  budgetOpen  = signal(false);
  adminOpen    = signal(false);
  pageInfo    = signal<PageInfo>({ breadcrumb: [], title: 'Dashboard' });

  private sub?: Subscription;

  constructor(
    public auth: AuthService,
    public masters: MastersService,
    public loader: LoaderService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.masters.load();
    if (window.innerWidth < 1024) this.sidebarOpen.set(false);

    // Set initial page title
    this.pageInfo.set(this.resolveTitle(this.router.url));

    // Auto-expand active group on load
    const url = this.router.url;
    if (url.startsWith('/tasks-manager')) this.tasksOpen.set(true);
    if (url.startsWith('/budget-manager')) this.budgetOpen.set(true);
    if (url.startsWith('/admin'))          this.adminOpen.set(true);

    // Update title on navigation
    this.sub = this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe(e => {
      const nav = e as NavigationEnd;
      this.pageInfo.set(this.resolveTitle(nav.urlAfterRedirects));
    });
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  private resolveTitle(url: string): PageInfo {
    // Strip query params
    const path = url.split('?')[0];
    return TITLE_MAP[path] ?? { breadcrumb: [], title: '' };
  }

  isGroupActive(prefix: string): boolean {
    return this.router.url.startsWith(prefix);
  }

  userInitials(): string {
    const name = this.auth.currentUser()?.display_name || '';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  logout() { this.auth.logout(); }
}
