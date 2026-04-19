import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { MastersService } from '../../services/masters.service';
import { AuthService } from '../../services/auth.service';
import { Role, Permission } from '../../models';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DrawerPanelComponent],
  host: { class: 'flex flex-1 flex-col min-h-0 w-full' },
  template: `
    <div class="flex flex-col flex-1 min-h-0 p-4 max-w-7xl w-full mx-auto gap-4">

      <div class="k-page-intro">
        <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Roles &amp; permissions</h1>
        <p class="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Select a role to inspect capability codes, then save when you are ready — changes apply on the next request.
        </p>
      </div>

      @if (errorMsg()) {
        <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex-shrink-0">{{ errorMsg() }}</div>
      }

      <div class="flex items-center gap-2 flex-shrink-0">
        <div class="flex-1"></div>
        <button class="flex items-center gap-1.5 bg-primary text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
                (click)="openCreate()">
          <span class="material-symbols-outlined text-[15px]">add</span>
          Add Role
        </button>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3 flex-1 min-h-0 lg:items-stretch">

        <!-- Roles list -->
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[240px] lg:min-h-0 h-full">
          <div class="px-3 py-2.5 border-b border-slate-100 bg-slate-50/60 flex-shrink-0">
            <span class="text-xs font-semibold text-slate-700">Roles</span>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-50">
            @if (loading()) {
              @for (_ of [1,2,3,4,5,6]; track $index) {
                <div class="px-3 py-2.5">
                  <div class="h-3 bg-slate-100 rounded animate-pulse w-1/2"></div>
                </div>
              }
            } @else if (roles().length === 0) {
              <div class="px-3 py-12 text-center text-slate-400 text-xs">No roles found.</div>
            } @else {
              @for (role of roles(); track role.role_id) {
                <div class="px-3 py-2.5 flex items-center justify-between cursor-pointer transition-colors"
                     [class]="isSelected(role) ? 'bg-primary/5 border-l-2 border-primary' : 'hover:bg-slate-50/50'"
                     (click)="selectRole(role)">
                  <div class="flex items-center gap-2 min-w-0">
                    <div class="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
                         [class]="isSelected(role) ? 'bg-primary' : 'bg-slate-100'">
                      <span class="material-symbols-outlined text-[13px]"
                            [class]="isSelected(role) ? 'text-white' : 'text-slate-500'">shield_person</span>
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <p class="font-medium text-xs" [class]="isActive(role) ? 'text-slate-800' : 'text-slate-400'">{{ role.role_name }}</p>
                        @if (!isActive(role)) {
                          <span class="text-2xs font-medium px-1 py-0.5 rounded bg-slate-100 text-slate-400">Inactive</span>
                        }
                      </div>
                      <p class="text-2xs text-slate-400 truncate">{{ role.role_description }}</p>
                    </div>
                  </div>
                  <div class="flex items-center gap-0.5 flex-shrink-0 ml-2">
                    <button class="p-1 text-slate-400 rounded transition-colors hover:text-primary hover:bg-slate-100"
                            title="Edit" (click)="openEdit(role); $event.stopPropagation()">
                      <span class="material-symbols-outlined text-[15px]">edit</span>
                    </button>
                    <button class="p-1 text-slate-400 rounded transition-colors disabled:opacity-40"
                            [class]="isActive(role) ? 'hover:text-amber-500 hover:bg-amber-50' : 'hover:text-green-600 hover:bg-green-50'"
                            [title]="isActive(role) ? 'Deactivate' : 'Activate'"
                            [disabled]="togglingId() === role.role_id"
                            (click)="toggleStatus(role); $event.stopPropagation()">
                      @if (togglingId() === role.role_id) {
                        <span class="material-symbols-outlined text-[15px] animate-spin">progress_activity</span>
                      } @else {
                        <span class="material-symbols-outlined text-[15px]">{{ isActive(role) ? 'person_off' : 'person' }}</span>
                      }
                    </button>
                  </div>
                </div>
              }
            }
          </div>
        </div>

        <!-- Permissions panel -->
        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[240px] lg:min-h-0 h-full">
          <div class="px-3 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between flex-shrink-0">
            <span class="text-xs font-semibold text-slate-700">
              @if (selectedRole()) { Permissions — {{ selectedRole()!.role_name }} }
              @else { Permissions }
            </span>
            @if (selectedRole() && permsDirty()) {
              <button class="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-primary text-white rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                      [disabled]="savingPerms()" (click)="savePermissions()">
                @if (savingPerms()) { <span class="material-symbols-outlined text-[12px] animate-spin">progress_activity</span> }
                Save
              </button>
            }
          </div>

          <div class="flex-1 min-h-0 overflow-y-auto flex flex-col">
            @if (!selectedRole()) {
              <div class="flex-1 min-h-[12rem] flex flex-col items-center justify-center px-4 py-8 text-center text-slate-400 text-xs">
                <span class="material-symbols-outlined text-4xl mb-2 text-slate-200">admin_panel_settings</span>
                <p class="font-medium text-slate-500">Select a role</p>
                <p class="mt-1 text-slate-400 max-w-xs leading-relaxed">Choose a role on the left to view and edit its permissions. This panel expands to use the full height of the page.</p>
              </div>
            } @else if (permsLoading()) {
              <div class="p-4 space-y-2 flex-1">
                @for (_ of [1,2,3,4,5,6,8]; track $index) {
                  <div class="h-3 bg-slate-100 rounded animate-pulse"></div>
                }
              </div>
            } @else {
              <div class="divide-y divide-slate-50">
                @for (perm of allPermissions(); track perm.permission_id) {
                  <label class="flex items-start gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-slate-50/50 transition-colors">
                    <input type="checkbox" class="mt-0.5 accent-primary"
                           [checked]="hasPermission(perm.permission_code)"
                           (change)="togglePermission(perm.permission_code, $event)">
                    <div>
                      <p class="text-xs font-medium text-slate-800">{{ perm.permission_name }}</p>
                      <p class="text-2xs text-slate-400">{{ perm.permission_description }}</p>
                      <code class="text-2xs text-slate-400 font-mono">{{ perm.permission_code }}</code>
                    </div>
                  </label>
                }
              </div>
            }
          </div>
        </div>

      </div>
    </div>

    <app-drawer-panel
      [open]="drawerOpen()"
      [title]="editingRole() ? 'Edit role' : 'Add role'"
      subtitle="Name and describe the role here. Select the role in the list to edit its permissions in the adjacent panel."
      size="sm"
      (closed)="closeDrawer()"
      (backdropClose)="closeDrawer()">
      @if (form) {
        <form [formGroup]="form" class="space-y-3">
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Role name *</label>
            <input formControlName="role_name" type="text" placeholder="e.g. Editor"
                   class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary">
            @if (form.get('role_name')?.invalid && form.get('role_name')?.touched) {
              <p class="text-red-500 text-2xs mt-1">Role name is required</p>
            }
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
            <textarea formControlName="role_description" rows="3" placeholder="Describe what this role can do…"
                      class="w-full px-3 py-2 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-primary resize-none"></textarea>
          </div>
        </form>
      }
      <div drawerFooter>
        <button type="button" class="px-3 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                (click)="closeDrawer()">Cancel</button>
        <button type="button" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
                [disabled]="saving()" (click)="save()">
          @if (saving()) { <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> }
          {{ editingRole() ? 'Save changes' : 'Create role' }}
        </button>
      </div>
    </app-drawer-panel>

  `
})
export class RolesComponent implements OnInit {
  roles = signal<Role[]>([]);
  allPermissions = signal<Permission[]>([]);
  selectedRole = signal<Role | null>(null);
  rolePermCodes = signal<string[]>([]);
  pendingPermCodes = signal<string[]>([]);

  loading = signal(false);
  permsLoading = signal(false);
  saving = signal(false);
  savingPerms = signal(false);
  errorMsg = signal('');
  drawerOpen = signal(false);
  editingRole = signal<Role | null>(null);
  form!: FormGroup;

  permsDirty = signal(false);
  togglingId = signal<string | null>(null);

  constructor(
    private api: ApiService,
    public auth: AuthService,
    public masters: MastersService,
    private fb: FormBuilder
  ) {}

  ngOnInit() {
    this.loadRoles();
    this.loadAllPermissions();
  }

  isSelected(role: Role): boolean {
    return this.selectedRole()?.role_id === role.role_id;
  }

  loadRoles() {
    this.loading.set(true);
    this.api.getRoles().subscribe({
      next: r => { this.roles.set(r); this.loading.set(false); },
      error: (e: Error) => { this.errorMsg.set(e.message); this.loading.set(false); }
    });
  }

  loadAllPermissions() {
    this.api.getPermissions().subscribe({
      next: p => this.allPermissions.set(p),
      error: () => {}
    });
  }

  selectRole(role: Role) {
    this.selectedRole.set(role);
    this.permsDirty.set(false);
    this.permsLoading.set(true);
    this.api.getRolePermissions(role.role_id).subscribe({
      next: perms => {
        const codes = perms.map(p => p.permission_code).filter(Boolean);
        this.rolePermCodes.set(codes);
        this.pendingPermCodes.set([...codes]);
        this.permsLoading.set(false);
      },
      error: () => this.permsLoading.set(false)
    });
  }

  hasPermission(code: string): boolean {
    return this.pendingPermCodes().includes(code);
  }

  togglePermission(code: string, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    const current = [...this.pendingPermCodes()];
    if (checked) {
      if (!current.includes(code)) current.push(code);
    } else {
      const idx = current.indexOf(code);
      if (idx !== -1) current.splice(idx, 1);
    }
    this.pendingPermCodes.set(current);
    this.permsDirty.set(true);
  }

  savePermissions() {
    const role = this.selectedRole();
    if (!role) return;
    this.savingPerms.set(true);
    this.api.updateRolePermissions(role.role_id, this.pendingPermCodes()).subscribe({
      next: () => {
        this.rolePermCodes.set([...this.pendingPermCodes()]);
        this.permsDirty.set(false);
        this.savingPerms.set(false);
      },
      error: (e: Error) => { this.errorMsg.set(e.message); this.savingPerms.set(false); }
    });
  }

  openCreate() {
    this.editingRole.set(null);
    this.form = this.fb.group({
      role_name: ['', Validators.required],
      role_description: [''],
    });
    this.errorMsg.set('');
    this.drawerOpen.set(true);
  }

  openEdit(role: Role) {
    this.editingRole.set(role);
    this.form = this.fb.group({
      role_name: [role.role_name, Validators.required],
      role_description: [role.role_description],
    });
    this.errorMsg.set('');
    this.drawerOpen.set(true);
  }

  closeDrawer() {
    this.drawerOpen.set(false);
    this.editingRole.set(null);
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMsg.set('');
    const v = this.form.value;
    const editing = this.editingRole();

    if (editing) {
      this.api.updateRole(editing.role_id, { role_name: v.role_name, role_description: v.role_description }).subscribe({
        next: () => { this.saving.set(false); this.closeDrawer(); this.loadRoles(); this.masters.reload(); },
        error: (e: Error) => { this.saving.set(false); this.errorMsg.set(e.message); }
      });
    } else {
      this.api.createRole({ role_name: v.role_name, role_description: v.role_description, created_by: this.auth.currentUser()?.user_id ?? '' }).subscribe({
        next: () => { this.saving.set(false); this.closeDrawer(); this.loadRoles(); this.masters.reload(); },
        error: (e: Error) => { this.saving.set(false); this.errorMsg.set(e.message); }
      });
    }
  }

  isActive(role: Role): boolean {
    return String(role.is_active).toUpperCase() === 'TRUE' || role.is_active === true;
  }

  toggleStatus(role: Role) {
    const newStatus = !this.isActive(role);
    this.togglingId.set(role.role_id);
    this.api.updateRole(role.role_id, { is_active: newStatus }).subscribe({
      next: () => {
        this.togglingId.set(null);
        this.loadRoles();
        this.masters.reload();
      },
      error: (e: Error) => {
        this.togglingId.set(null);
        this.errorMsg.set(e.message);
      }
    });
  }
}
