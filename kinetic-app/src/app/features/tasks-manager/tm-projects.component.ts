import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TaskWorkspaceService, TmProjectRow } from '../../services/task-workspace.service';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';

@Component({
  selector: 'app-tm-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, ModalComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-blue-50/50 px-4 py-3.5 shadow-sm">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Task projects</h1>
            <p class="text-xs text-slate-500 mt-0.5 max-w-xl">
              Progress and task counts stay in sync when you add or complete tasks. Open <span class="font-medium text-slate-700">Tasks</span> for the selected project.
            </p>
          </div>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
          <input [(ngModel)]="search" type="text" placeholder="Search projects…"
                 class="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
        </div>
        <select [(ngModel)]="statusFilter"
                class="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
          <option value="">All statuses</option>
          <option>Active</option><option>Triage</option><option>On Hold</option><option>Completed</option>
        </select>
        <div class="flex-1"></div>
        <button type="button"
                class="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 shadow-sm"
                (click)="openProjectModal(null)">
          <span class="material-symbols-outlined text-[16px]">add</span>
          New project
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        @for (s of summaryStats(); track s.label) {
          <div class="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
            <span class="font-bold text-slate-900 tabular-nums">{{ s.value }}</span>
            <span class="text-[11px] text-slate-500">{{ s.label }}</span>
          </div>
        }
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-50/90 border-b border-slate-100">
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tasks</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Progress</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Start</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Due</th>
              <th class="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td class="px-3 py-2.5">
                  <p class="font-semibold text-slate-800">{{ p.name }}</p>
                  <p class="text-[10px] text-slate-400 font-mono">{{ p.id }}</p>
                </td>
                <td class="px-3 py-2.5">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold" [class]="statusClass(p.status)">{{ p.status }}</span>
                </td>
                <td class="px-3 py-2.5 hidden sm:table-cell tabular-nums text-slate-700 font-medium">{{ p.done }}/{{ p.total }}</td>
                <td class="px-3 py-2.5 hidden md:table-cell">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full bg-primary rounded-full transition-all" [style.width.%]="progressPct(p)"></div>
                    </div>
                    <span class="text-[10px] text-slate-500 tabular-nums">{{ progressPct(p) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-slate-500 hidden lg:table-cell">{{ p.start }}</td>
                <td class="px-3 py-2.5 text-slate-500 hidden lg:table-cell">{{ p.due || '—' }}</td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-0.5 flex-wrap">
                    <a [routerLink]="['/tasks-manager/tasks']" [queryParams]="{ project: p.id }"
                       class="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors">
                      <span class="material-symbols-outlined text-[14px]">check_circle</span>
                      Tasks
                    </a>
                    <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100" title="Edit"
                            (click)="openProjectModal(p)">
                      <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete"
                            (click)="deleteTarget.set(p)">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-3 py-12 text-center text-slate-400 text-xs">No projects match your filters.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-[10px] text-slate-400">Showing {{ filtered().length }} of {{ ws.projects().length }} projects</p>
    </div>

    <app-modal
      [open]="projectModalOpen()"
      [title]="editingProject() ? 'Edit project' : 'New project'"
      subtitle="Dates are for planning; task completion drives the progress bar."
      size="md"
      (closed)="closeProjectModal()"
      (backdropClose)="closeProjectModal()">
      @if (projectForm) {
        <form [formGroup]="projectForm" class="space-y-3">
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Name</label>
            <input formControlName="name" type="text" placeholder="e.g. Mobile App"
                   class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            @if (projectForm.get('name')?.invalid && projectForm.get('name')?.touched) {
              <p class="text-red-600 text-[10px] mt-1">Name is required</p>
            }
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select formControlName="status"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
              <option>Active</option>
              <option>Triage</option>
              <option>On Hold</option>
              <option>Completed</option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Start</label>
              <input formControlName="start" type="text" placeholder="Mar 01"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Due</label>
              <input formControlName="due" type="text" placeholder="Optional"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
          </div>
        </form>
      }
      <div modalFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                (click)="closeProjectModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90"
                (click)="saveProject()">{{ editingProject() ? 'Save changes' : 'Create project' }}</button>
      </div>
    </app-modal>

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete project?"
      [message]="deleteTarget() ? 'Remove “' + deleteTarget()!.name + '” and all of its tasks? This cannot be undone.' : ''"
      confirmLabel="Delete"
      (confirm)="confirmDeleteProject()"
      (cancel)="deleteTarget.set(null)" />
  `
})
export class TmProjectsComponent {
  search = '';
  statusFilter = '';

  projectModalOpen = signal(false);
  editingProject = signal<TmProjectRow | null>(null);
  deleteTarget = signal<TmProjectRow | null>(null);

  projectForm = this.fb.group({
    name: ['', Validators.required],
    status: ['Active', Validators.required],
    start: [''],
    due: [''],
  });

  constructor(
    public ws: TaskWorkspaceService,
    private fb: FormBuilder,
    private router: Router,
  ) {}

  summaryStats = computed(() => {
    const list = this.ws.projects();
    const tasks = this.ws.tasks();
    return [
      { value: list.length, label: 'Projects' },
      { value: list.filter(p => p.status === 'Active').length, label: 'Active' },
      { value: list.filter(p => p.status === 'Triage').length, label: 'Triage' },
      { value: list.filter(p => p.status === 'On Hold').length, label: 'On hold' },
      { value: list.filter(p => p.status === 'Completed').length, label: 'Completed' },
      { value: tasks.length, label: 'Tasks' },
    ];
  });

  filtered() {
    return this.ws.projects().filter(p => {
      const matchSearch = !this.search || p.name.toLowerCase().includes(this.search.toLowerCase()) || p.id.toLowerCase().includes(this.search.toLowerCase());
      const matchStatus = !this.statusFilter || p.status === this.statusFilter;
      return matchSearch && matchStatus;
    });
  }

  progressPct(p: TmProjectRow): number {
    if (!p.total) return 0;
    return Math.min(100, Math.round((p.done / p.total) * 100));
  }

  statusClass(s: string): string {
    return { Active: 'bg-emerald-100 text-emerald-800', Triage: 'bg-slate-100 text-slate-700',
             'On Hold': 'bg-amber-100 text-amber-800', Completed: 'bg-blue-100 text-blue-800' }[s] ?? 'bg-slate-100 text-slate-600';
  }

  openProjectModal(row: TmProjectRow | null) {
    this.editingProject.set(row);
    if (row) {
      this.projectForm.reset({ name: row.name, status: row.status, start: row.start, due: row.due });
    } else {
      this.projectForm.reset({ name: '', status: 'Active', start: '', due: '' });
    }
    this.projectModalOpen.set(true);
  }

  closeProjectModal() {
    this.projectModalOpen.set(false);
    this.editingProject.set(null);
  }

  saveProject() {
    this.projectForm.markAllAsTouched();
    if (this.projectForm.invalid) return;
    const v = this.projectForm.getRawValue();
    const cur = this.editingProject();
    if (cur) {
      this.ws.updateProject(cur.id, {
        name: v.name!,
        status: v.status!,
        start: v.start || '',
        due: v.due || '',
      });
    } else {
      const p = this.ws.addProject({
        name: v.name!,
        status: v.status!,
        done: 0,
        total: 0,
        start: v.start || '—',
        due: v.due || '',
      });
      this.router.navigate(['/tasks-manager/tasks'], { queryParams: { project: p.id } });
    }
    this.closeProjectModal();
  }

  confirmDeleteProject() {
    const t = this.deleteTarget();
    if (t) this.ws.deleteProject(t.id);
    this.deleteTarget.set(null);
  }
}
