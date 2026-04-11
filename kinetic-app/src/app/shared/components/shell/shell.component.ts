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
  '/budget-manager/projects':  { breadcrumb: ['Budget Manager'],  title: 'Projects'            },
  '/budget-manager/budget':    { breadcrumb: ['Budget Manager'],  title: 'Budget'              },
  '/admin/overview':           { breadcrumb: ['Administration'],  title: 'Overview'            },
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

    <div class="flex h-screen overflow-hidden bg-slate-50">

      <!-- Mobile overlay -->
      @if (sidebarOpen()) {
        <div class="fixed inset-0 bg-black/30 z-30 lg:hidden" (click)="sidebarOpen.set(false)"></div>
      }

      <!-- ── Sidebar ── -->
      <aside class="fixed left-0 top-0 h-full flex flex-col w-56 bg-white border-r border-slate-100 z-40 transition-transform duration-300"
             [class.-translate-x-full]="!sidebarOpen()"
             [class.translate-x-0]="sidebarOpen()"
             [class.lg:translate-x-0]="true">

        <!-- Brand -->
        <div class="px-4 py-3 flex items-center gap-2.5 border-b border-slate-100 flex-shrink-0">
          <div class="w-7 h-7 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
            <span class="material-symbols-outlined text-white text-base" style="font-variation-settings:'FILL' 1;">bolt</span>
          </div>
          <span class="text-base font-bold tracking-tight text-slate-900">Kinetic</span>
        </div>

        <!-- Nav -->
        <nav class="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">

          <a routerLink="/dashboard" routerLinkActive="bg-primary text-white"
             class="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
             (click)="sidebarOpen.set(false)">
            <span class="material-symbols-outlined text-[18px]">dashboard</span>
            Dashboard
          </a>

          <!-- Tasks Manager -->
          <div>
            <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    [class]="isGroupActive('/tasks-manager') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'"
                    (click)="tasksOpen.set(!tasksOpen())">
              <span class="material-symbols-outlined text-[18px]">task_alt</span>
              <span class="flex-1 text-left">Tasks Manager</span>
              <span class="material-symbols-outlined text-[16px] transition-transform duration-200"
                    [class.rotate-180]="tasksOpen()">expand_more</span>
            </button>
            @if (tasksOpen()) {
              <div class="mt-0.5 ml-4 pl-2.5 border-l-2 border-slate-200 space-y-0.5">
                <a routerLink="/tasks-manager/projects" routerLinkActive="bg-primary text-white"
                   class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                   (click)="sidebarOpen.set(false)">
                  <span class="material-symbols-outlined text-[15px]">folder_open</span>
                  Projects
                </a>
                <a routerLink="/tasks-manager/tasks" routerLinkActive="bg-primary text-white"
                   class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                   (click)="sidebarOpen.set(false)">
                  <span class="material-symbols-outlined text-[15px]">check_circle</span>
                  Tasks
                </a>
              </div>
            }
          </div>

          <!-- Budget Manager -->
          <div>
            <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    [class]="isGroupActive('/budget-manager') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'"
                    (click)="budgetOpen.set(!budgetOpen())">
              <span class="material-symbols-outlined text-[18px]">account_balance_wallet</span>
              <span class="flex-1 text-left">Budget Manager</span>
              <span class="material-symbols-outlined text-[16px] transition-transform duration-200"
                    [class.rotate-180]="budgetOpen()">expand_more</span>
            </button>
            @if (budgetOpen()) {
              <div class="mt-0.5 ml-4 pl-2.5 border-l-2 border-slate-200 space-y-0.5">
                <a routerLink="/budget-manager/projects" routerLinkActive="bg-primary text-white"
                   class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                   (click)="sidebarOpen.set(false)">
                  <span class="material-symbols-outlined text-[15px]">folder_open</span>
                  Projects
                </a>
                <a routerLink="/budget-manager/budget" routerLinkActive="bg-primary text-white"
                   class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                   (click)="sidebarOpen.set(false)">
                  <span class="material-symbols-outlined text-[15px]">account_balance_wallet</span>
                  Budget
                </a>
              </div>
            }
          </div>

          <!-- Administration -->
          @if (auth.hasPermission('USER_MANAGE') || auth.hasPermission('ROLE_MANAGE')) {
            <div>
              <button class="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      [class]="isGroupActive('/admin') ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100'"
                      (click)="adminOpen.set(!adminOpen())">
                <span class="material-symbols-outlined text-[18px]">shield_person</span>
                <span class="flex-1 text-left">Administration</span>
                <span class="material-symbols-outlined text-[16px] transition-transform duration-200"
                      [class.rotate-180]="adminOpen()">expand_more</span>
              </button>
              @if (adminOpen()) {
                <div class="mt-0.5 ml-4 pl-2.5 border-l-2 border-slate-200 space-y-0.5">
                  <a routerLink="/admin/overview" routerLinkActive="bg-primary text-white"
                     [routerLinkActiveOptions]="{ exact: true }"
                     class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                     (click)="sidebarOpen.set(false)">
                    <span class="material-symbols-outlined text-[15px]">dashboard</span>
                    Overview
                  </a>
                  @if (auth.hasPermission('USER_MANAGE')) {
                    <a routerLink="/admin/users" routerLinkActive="bg-primary text-white"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">manage_accounts</span>
                      Users
                    </a>
                  }
                  @if (auth.hasPermission('ROLE_MANAGE')) {
                    <a routerLink="/admin/roles" routerLinkActive="bg-primary text-white"
                       class="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                       (click)="sidebarOpen.set(false)">
                      <span class="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                      Roles & Permissions
                    </a>
                  }
                </div>
              }
            </div>
          }
        </nav>

        <!-- User area -->
        <div class="px-3 py-2.5 border-t border-slate-100 flex-shrink-0">
          <div class="flex items-center gap-2 mb-1.5">
            <div class="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
              {{ userInitials() }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-xs font-semibold text-slate-900 truncate">{{ auth.currentUser()?.display_name }}</p>
              <p class="text-[10px] text-slate-400 truncate">{{ auth.currentUser()?.role_name }}</p>
            </div>
          </div>
          <button (click)="logout()"
                  class="flex items-center gap-2 px-2 py-1.5 text-slate-500 hover:text-red-600 w-full rounded-md hover:bg-red-50 transition-colors text-xs">
            <span class="material-symbols-outlined text-[15px]">logout</span>
            Logout
          </button>
        </div>
      </aside>

      <!-- ── Main ── -->
      <div class="flex-1 flex flex-col min-h-screen lg:ml-56 overflow-hidden">

        <!-- Header -->
        <header class="sticky top-0 z-30 flex items-center h-11 px-4 bg-white border-b border-slate-100 flex-shrink-0 gap-3">
          <button class="lg:hidden p-1 text-slate-500 hover:text-slate-800 rounded" (click)="sidebarOpen.set(!sidebarOpen())">
            <span class="material-symbols-outlined text-[20px]">menu</span>
          </button>
          <!-- Breadcrumb -->
          <div class="flex items-center gap-1.5 text-sm min-w-0">
            @for (crumb of pageInfo().breadcrumb; track crumb) {
              <span class="text-slate-400 text-xs hidden sm:block">{{ crumb }}</span>
              <span class="text-slate-300 text-xs hidden sm:block">/</span>
            }
            <span class="font-semibold text-slate-800 text-sm truncate">{{ pageInfo().title }}</span>
          </div>
        </header>

        <!-- Page content (min-h-0 so nested flex pages can fill height) -->
        <main class="flex-1 min-h-0 overflow-y-auto bg-slate-50 flex flex-col">
          <router-outlet />
        </main>
      </div>
    </div>
  `
})
export class ShellComponent implements OnInit, OnDestroy {
  sidebarOpen = signal(true);
  tasksOpen   = signal(false);
  budgetOpen  = signal(false);
  adminOpen   = signal(false);
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
