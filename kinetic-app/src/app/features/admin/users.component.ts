import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { MastersService } from '../../services/masters.service';
import { AdminUser, Project, UserProjectMapping } from '../../models';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DrawerPanelComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="k-page-intro">
        <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Users</h1>
        <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Accounts, roles, and activation — keep this list accurate so the rest of the app stays permission-aware.
        </p>
      </div>

      @if (errorMsg()) {
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">{{ errorMsg() }}</div>
      }

      <!-- Toolbar -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1 max-w-xs">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
          <input [(ngModel)]="search" type="text" placeholder="Search users…"
                 class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-md bg-white placeholder-slate-400 focus:outline-none focus:border-primary">
        </div>
        <div class="flex-1"></div>
        <button class="flex items-center gap-1.5 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
                (click)="openCreate()">
          <span class="material-symbols-outlined text-[15px]">person_add</span>
          Add User
        </button>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-lg border border-slate-100 overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-50 border-b border-slate-100">
              <th class="text-left px-3 py-2 text-2xs font-semibold text-slate-400 uppercase tracking-wider">User</th>
              <th class="text-left px-3 py-2 text-2xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Email</th>
              <th class="text-left px-3 py-2 text-2xs font-semibold text-slate-400 uppercase tracking-wider">Role</th>
              <th class="text-left px-3 py-2 text-2xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
              <th class="text-left px-3 py-2 text-2xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Last Login</th>
              <th class="text-right px-3 py-2 text-2xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              @for (_ of [1,2,3,4]; track $index) {
                <tr class="border-b border-slate-50">
                  <td colspan="6" class="px-3 py-2.5">
                    <div class="h-3 bg-slate-100 rounded animate-pulse w-3/4"></div>
                  </td>
                </tr>
              }
            } @else if (filtered().length === 0) {
              <tr><td colspan="6" class="px-3 py-8 text-center text-slate-400">No users found.</td></tr>
            } @else {
              @for (user of filtered(); track user.user_id) {
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td class="px-3 py-2.5">
                    <div class="flex items-center gap-2">
                      <div class="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
                        {{ initials(user.display_name) }}
                      </div>
                      <div>
                        <p class="font-medium text-slate-800">{{ user.display_name }}</p>
                        <p class="text-2xs text-slate-400">{{ user.username }}</p>
                      </div>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-slate-500 hidden sm:table-cell">{{ user.email }}</td>
                  <td class="px-3 py-2.5">
                    <span class="px-1.5 py-0.5 rounded text-2xs font-semibold bg-primary/10 text-primary">{{ getRoleName(user.role_id) }}</span>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="px-1.5 py-0.5 rounded text-2xs font-semibold"
                          [class]="toBool(user.is_active) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'">
                      {{ toBool(user.is_active) ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-slate-400 hidden md:table-cell">{{ user.last_login_on || '—' }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-0.5">
                      <button class="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-100 transition-colors"
                              title="Edit" (click)="openEdit(user)">
                        <span class="material-symbols-outlined text-[15px]">edit</span>
                      </button>
                      <button class="p-1 text-slate-400 rounded transition-colors"
                              [class]="toBool(user.is_active) ? 'hover:text-amber-500 hover:bg-amber-50' : 'hover:text-green-600 hover:bg-green-50'"
                              [title]="toBool(user.is_active) ? 'Deactivate' : 'Activate'"
                              (click)="toggleActive(user)">
                        <span class="material-symbols-outlined text-[15px]">{{ toBool(user.is_active) ? 'person_off' : 'person' }}</span>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (!loading()) {
        <p class="text-2xs text-slate-400">{{ filtered().length }} user{{ filtered().length !== 1 ? 's' : '' }}</p>
      }
    </div>

    <app-drawer-panel
      [open]="drawerOpen()"
      [title]="editingUser() ? 'Edit user' : 'Add user'"
      subtitle="Account details and role assignment apply on the next sign-in for permission changes."
      size="md"
      (closed)="closeDrawer()"
      (backdropClose)="closeDrawer()">
      @if (form) {
        <form [formGroup]="form" class="space-y-3">

          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Username {{ editingUser() ? '' : '*' }}
            </label>
            <input formControlName="username" type="text" placeholder="e.g. john.doe"
                   class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary"
                   [readOnly]="!!editingUser()">
            @if (form.get('username')?.invalid && form.get('username')?.touched) {
              <p class="text-red-500 text-2xs mt-1">Username is required</p>
            }
          </div>

          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Password {{ editingUser() ? '(leave blank to keep)' : '*' }}
            </label>
            <div class="relative">
              <input formControlName="password" [type]="showPassword() ? 'text' : 'password'"
                     placeholder="{{ editingUser() ? 'Leave blank to keep current' : 'Enter password' }}"
                     class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary pr-8">
              <button type="button" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      (click)="showPassword.set(!showPassword())">
                <span class="material-symbols-outlined text-[16px]">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span>
              </button>
            </div>
          </div>

          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Display Name *</label>
            <input formControlName="display_name" type="text" placeholder="e.g. John Doe"
                   class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary">
            @if (form.get('display_name')?.invalid && form.get('display_name')?.touched) {
              <p class="text-red-500 text-2xs mt-1">Display name is required</p>
            }
          </div>

          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Email *</label>
            <input formControlName="email" type="email" placeholder="e.g. john@example.com"
                   class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary">
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <p class="text-red-500 text-2xs mt-1">Valid email is required</p>
            }
          </div>

          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Role *</label>
            <select formControlName="role_id"
                    class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary bg-white">
              <option value="">Select a role</option>
              @for (role of masters.roles(); track role.role_id) {
                <option [value]="role.role_id">{{ role.role_name }}</option>
              }
            </select>
            @if (form.get('role_id')?.invalid && form.get('role_id')?.touched) {
              <p class="text-red-500 text-2xs mt-1">Role is required</p>
            }
          </div>

        </form>
      }

      @if (editingUser()) {
        <div class="mt-5 border-t border-slate-100 pt-4 space-y-4">
          @if (projectsLoading()) {
            <div class="flex items-center gap-2 py-3 text-xs text-slate-400">
              <span class="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Loading projects…
            </div>
          } @else if (allProjects().length === 0) {
            <p class="text-xs text-slate-400 py-2">No projects found.</p>
          } @else {
            @for (cat of projectCategories; track cat) {
              <div>
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="material-symbols-outlined text-[14px] text-slate-400">{{ cat === 'TASKS' ? 'task_alt' : 'account_balance_wallet' }}</span>
                  <p class="text-2xs font-semibold text-slate-500 uppercase tracking-wider">{{ cat === 'TASKS' ? 'Tasks Projects' : 'Budget Projects' }}</p>
                </div>
                <div class="space-y-0.5 -mx-1">
                  @for (proj of allProjects(); track proj.project_id) {
                    @let mapping = getMappingForProject(proj.project_id, cat);
                    @let active = mapping !== undefined && toBool(mapping.is_active);
                    <div class="flex items-center justify-between px-2 py-1.5 rounded hover:bg-slate-50 transition-colors">
                      <div class="min-w-0 flex-1 pr-3">
                        <p class="text-xs font-medium text-slate-700 truncate">{{ proj.project_name }}</p>
                        <p class="text-2xs text-slate-400 font-mono">{{ proj.project_id }}</p>
                      </div>
                      <div class="flex items-center gap-2 flex-shrink-0">
                        <span class="text-2xs px-1.5 py-0.5 rounded font-semibold"
                              [class]="active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'">
                          {{ active ? 'Access' : 'No access' }}
                        </span>
                        <button class="p-1 text-slate-400 rounded transition-colors disabled:opacity-40"
                                [class]="active ? 'hover:text-amber-500 hover:bg-amber-50' : 'hover:text-green-600 hover:bg-green-50'"
                                [title]="active ? 'Revoke access' : 'Grant access'"
                                [disabled]="togglingProject() === proj.project_id + ':' + cat"
                                (click)="toggleProjectAccess(proj.project_id, cat, mapping)">
                          <span class="material-symbols-outlined text-[15px]">{{ active ? 'person_off' : 'person_add' }}</span>
                        </button>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }
          }
        </div>
      }
      <div drawerFooter>
        <button type="button" class="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                (click)="closeDrawer()">Cancel</button>
        <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                [disabled]="saving()" (click)="save()">
          @if (saving()) { <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> }
          {{ editingUser() ? 'Save changes' : 'Create user' }}
        </button>
      </div>
    </app-drawer-panel>
  `
})
export class UsersComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  loading = signal(false);
  saving = signal(false);
  errorMsg = signal('');
  drawerOpen = signal(false);
  editingUser = signal<AdminUser | null>(null);
  showPassword = signal(false);
  form!: FormGroup;
  search = '';

  allProjects = signal<Project[]>([]);
  userMappings = signal<UserProjectMapping[]>([]);
  projectsLoading = signal(false);
  togglingProject = signal('');

  constructor(
    private api: ApiService,
    public auth: AuthService,
    public masters: MastersService,
    private fb: FormBuilder
  ) {}

  ngOnInit() { this.loadUsers(); }

  loadUsers() {
    this.loading.set(true);
    this.api.getUsers().subscribe({
      next: u => { this.users.set(u); this.loading.set(false); },
      error: (e: Error) => { this.errorMsg.set(e.message); this.loading.set(false); }
    });
  }

  filtered(): AdminUser[] {
    if (!this.search) return this.users();
    const q = this.search.toLowerCase();
    return this.users().filter(u =>
      u.display_name.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  }

  getRoleName(roleId: string): string {
    return this.masters.roles().find(r => r.role_id === roleId)?.role_name ?? roleId;
  }

  toBool(val: boolean | string): boolean {
    return String(val).toUpperCase() === 'TRUE' || val === true;
  }

  initials(name: string): string {
    return (name || '').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  openCreate() {
    this.editingUser.set(null);
    this.showPassword.set(false);
    this.form = this.fb.group({
      username:     ['', Validators.required],
      password:     ['', Validators.required],
      display_name: ['', Validators.required],
      email:        ['', [Validators.required, Validators.email]],
      role_id:      ['', Validators.required],
    });
    this.errorMsg.set('');
    this.drawerOpen.set(true);
  }

  openEdit(user: AdminUser) {
    this.editingUser.set(user);
    this.showPassword.set(false);
    this.form = this.fb.group({
      username:     [{ value: user.username, disabled: true }],
      password:     [''],
      display_name: [user.display_name, Validators.required],
      email:        [user.email, [Validators.required, Validators.email]],
      role_id:      [user.role_id, Validators.required],
    });
    this.errorMsg.set('');
    this.drawerOpen.set(true);
    this.loadUserProjects(user.user_id);
  }

  loadUserProjects(userId: string) {
    this.projectsLoading.set(true);
    forkJoin([this.api.getAllProjects(), this.api.getUserProjectMappings(userId)]).subscribe({
      next: ([projects, mappings]) => {
        this.allProjects.set(projects);
        this.userMappings.set(mappings);
        this.projectsLoading.set(false);
      },
      error: () => this.projectsLoading.set(false)
    });
  }

  readonly projectCategories: Array<'TASKS' | 'BUDGET'> = ['TASKS', 'BUDGET'];

  getMappingForProject(projectId: string, category: string): UserProjectMapping | undefined {
    return this.userMappings().find(m => m.project_id_fk === projectId && m.project_category === category);
  }

  toggleProjectAccess(projectId: string, category: string, mapping: UserProjectMapping | undefined) {
    const user = this.editingUser();
    if (!user) return;
    const cat = category as 'TASKS' | 'BUDGET';
    const key = projectId + ':' + cat;
    this.togglingProject.set(key);

    if (mapping && this.toBool(mapping.is_active)) {
      this.api.removeUserFromProject(mapping.mapping_id).subscribe({
        next: () => {
          this.userMappings.update(ms => ms.map(m => m.mapping_id === mapping.mapping_id ? { ...m, is_active: false } : m));
          this.togglingProject.set('');
        },
        error: () => this.togglingProject.set('')
      });
    } else {
      this.api.assignUserToProject(user.user_id, projectId, cat).subscribe({
        next: (result) => {
          const existing = this.userMappings().find(m => m.project_id_fk === projectId && m.project_category === cat);
          if (existing) {
            this.userMappings.update(ms => ms.map(m =>
              m.project_id_fk === projectId && m.project_category === cat ? { ...m, is_active: true } : m
            ));
          } else {
            this.userMappings.update(ms => [...ms, result]);
          }
          this.togglingProject.set('');
        },
        error: () => this.togglingProject.set('')
      });
    }
  }

  closeDrawer() { this.drawerOpen.set(false); this.editingUser.set(null); }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set('');
    const v = this.form.getRawValue();
    const editing = this.editingUser();

    if (editing) {
      const payload: Partial<AdminUser> & { user_id: string; password?: string } = {
        user_id: editing.user_id, display_name: v.display_name, email: v.email, role_id: v.role_id
      };
      if (v.password) payload.password = v.password;
      this.api.updateUser(payload).subscribe({
        next: () => { this.saving.set(false); this.closeDrawer(); this.loadUsers(); },
        error: (e: Error) => { this.saving.set(false); this.errorMsg.set(e.message); }
      });
    } else {
      this.api.createUser({ username: v.username, password: v.password, display_name: v.display_name, email: v.email, role_id: v.role_id }).subscribe({
        next: () => { this.saving.set(false); this.closeDrawer(); this.loadUsers(); },
        error: (e: Error) => { this.saving.set(false); this.errorMsg.set(e.message); }
      });
    }
  }

  toggleActive(user: AdminUser) {
    this.api.updateUser({ user_id: user.user_id, is_active: !this.toBool(user.is_active) }).subscribe({
      next: () => this.loadUsers(),
      error: (e: Error) => this.errorMsg.set(e.message)
    });
  }
}
