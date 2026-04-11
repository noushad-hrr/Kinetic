import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskWorkspaceService, TmTaskRow } from '../../services/task-workspace.service';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';

@Component({
  selector: 'app-tm-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, ModalComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-violet-50/40 px-4 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Tasks</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Scoped by project when you arrive from <span class="font-medium text-slate-700">Projects</span> — change scope anytime below.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select [ngModel]="projectScope()" (ngModelChange)="onProjectScope($event)"
                  class="text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            <option value="">All projects</option>
            @for (p of ws.projects(); track p.id) {
              <option [value]="p.id">{{ p.name }} ({{ p.id }})</option>
            }
          </select>
          <a routerLink="/tasks-manager/projects"
             class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 px-2 py-2 rounded-lg hover:bg-primary/5">
            <span class="material-symbols-outlined text-[16px]">folder_open</span>
            Projects
          </a>
        </div>
      </div>

      @if (scopedProject(); as sp) {
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/15 text-xs text-primary">
          <span class="material-symbols-outlined text-[18px]">filter_alt</span>
          <span>Showing tasks for <strong class="font-semibold">{{ sp.name }}</strong>. Clear the project filter to see everything.</span>
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
          <input [(ngModel)]="search" type="text" placeholder="Search tasks…"
                 class="pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white w-48 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
        </div>
        <select [(ngModel)]="statusFilter"
                class="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
          <option value="">All status</option>
          <option>Open</option><option>In Progress</option><option>Completed</option><option>Overdue</option><option>Triage</option>
        </select>
        <select [(ngModel)]="priorityFilter"
                class="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
          <option value="">All priority</option>
          <option>High</option><option>Medium</option><option>Low</option>
        </select>
        <div class="flex-1"></div>
        <button type="button"
                class="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 shadow-sm"
                (click)="openTaskModal(null)">
          <span class="material-symbols-outlined text-[16px]">add</span>
          New task
        </button>
      </div>

      <div class="flex items-center gap-1.5 flex-wrap">
        @for (tab of statusTabs; track tab) {
          <button type="button" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                  [class]="activeTab() === tab ? 'bg-primary text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:border-primary/40 hover:text-primary'"
                  (click)="activeTab.set(tab)">
            {{ tab }}
            <span class="ml-1 text-[10px] opacity-80 tabular-nums">{{ countByStatus(tab) }}</span>
          </button>
        }
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-50/90 border-b border-slate-100">
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Task</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Project</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Priority</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Assignee</th>
              <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Due</th>
              <th class="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (t of filtered(); track t.id) {
              <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td class="px-3 py-2.5">
                  <p class="font-semibold text-slate-800 truncate max-w-[240px]">{{ t.title }}</p>
                  <p class="text-[10px] text-slate-400 font-mono">{{ t.id }}</p>
                </td>
                <td class="px-3 py-2.5 text-slate-600 hidden sm:table-cell">
                  <span class="truncate block max-w-[140px] font-medium">{{ ws.projectName(t.projectId) }}</span>
                </td>
                <td class="px-3 py-2.5">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold" [class]="statusClass(t.status)">{{ t.status }}</span>
                </td>
                <td class="px-3 py-2.5 hidden md:table-cell">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold" [class]="priorityClass(t.priority)">{{ t.priority }}</span>
                </td>
                <td class="px-3 py-2.5 text-slate-600 hidden lg:table-cell">
                  <div class="flex items-center gap-1.5">
                    <div class="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[9px] font-bold text-primary">
                      {{ initials(t.assignee) }}
                    </div>
                    <span class="truncate max-w-[100px]">{{ t.assignee }}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 hidden lg:table-cell" [class]="t.status === 'Overdue' ? 'text-red-600 font-semibold' : 'text-slate-500'">{{ t.due || '—' }}</td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex justify-end gap-0.5">
                    <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100" title="Edit"
                            (click)="openTaskModal(t)">
                      <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete"
                            (click)="deleteTarget.set(t)">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-3 py-12 text-center text-slate-400 text-xs">No tasks match your filters.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-[10px] text-slate-400">Showing {{ filtered().length }} of {{ tasksInScope().length }} tasks in scope</p>
    </div>

    <app-modal
      [open]="taskModalOpen()"
      [title]="editingTask() ? 'Edit task' : 'New task'"
      subtitle="Tasks are stored against a single project for clear rollups."
      size="lg"
      (closed)="closeTaskModal()"
      (backdropClose)="closeTaskModal()">
      @if (taskForm) {
        <form [formGroup]="taskForm" class="space-y-3">
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Title</label>
            <input formControlName="title" type="text" placeholder="What needs to be done?"
                   class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            @if (taskForm.get('title')?.invalid && taskForm.get('title')?.touched) {
              <p class="text-red-600 text-[10px] mt-1">Title is required</p>
            }
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
            <select formControlName="projectId"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
              @for (p of ws.projects(); track p.id) {
                <option [value]="p.id">{{ p.name }} ({{ p.id }})</option>
              }
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select formControlName="status"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
                <option>Open</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Overdue</option>
                <option>Triage</option>
              </select>
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
              <select formControlName="priority"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Assignee</label>
              <input formControlName="assignee" type="text" placeholder="Name"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Due</label>
              <input formControlName="due" type="text" placeholder="e.g. Apr 20"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
          </div>
        </form>
      }
      <div modalFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                (click)="closeTaskModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90"
                (click)="saveTask()">{{ editingTask() ? 'Save changes' : 'Create task' }}</button>
      </div>
    </app-modal>

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete task?"
      [message]="deleteTarget() ? 'Remove “' + deleteTarget()!.title + '” permanently?' : ''"
      confirmLabel="Delete"
      (confirm)="confirmDeleteTask()"
      (cancel)="deleteTarget.set(null)" />
  `
})
export class TmTasksComponent implements OnInit, OnDestroy {
  search = '';
  statusFilter = '';
  priorityFilter = '';
  activeTab = signal('All');
  projectScope = signal('');
  statusTabs = ['All', 'Open', 'In Progress', 'Overdue', 'Completed', 'Triage'];

  taskModalOpen = signal(false);
  editingTask = signal<TmTaskRow | null>(null);
  deleteTarget = signal<TmTaskRow | null>(null);

  taskForm = this.fb.group({
    title: ['', Validators.required],
    projectId: ['', Validators.required],
    status: ['Open', Validators.required],
    priority: ['Medium', Validators.required],
    assignee: ['', Validators.required],
    due: [''],
  });

  private sub?: Subscription;

  constructor(
    public ws: TaskWorkspaceService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.sub = this.route.queryParamMap.subscribe(q => {
      const p = q.get('project') ?? '';
      const valid = p && this.ws.projects().some(x => x.id === p);
      this.projectScope.set(valid ? p : '');
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  scopedProject() {
    const id = this.projectScope();
    if (!id) return null;
    return this.ws.projectById(id) ?? null;
  }

  tasksInScope(): TmTaskRow[] {
    const id = this.projectScope();
    const all = this.ws.tasks();
    return id ? all.filter(t => t.projectId === id) : all;
  }

  countByStatus(tab: string): number {
    const base = this.tasksInScope();
    if (tab === 'All') return base.length;
    return base.filter(t => t.status === tab).length;
  }

  filtered(): TmTaskRow[] {
    return this.tasksInScope().filter(t => {
      if (this.activeTab() !== 'All' && t.status !== this.activeTab()) return false;
      if (this.statusFilter && t.status !== this.statusFilter) return false;
      if (this.priorityFilter && t.priority !== this.priorityFilter) return false;
      if (this.search && !t.title.toLowerCase().includes(this.search.toLowerCase()) && !t.id.toLowerCase().includes(this.search.toLowerCase())) return false;
      return true;
    });
  }

  onProjectScope(value: string) {
    if (value) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { project: value }, queryParamsHandling: 'merge', replaceUrl: true });
    } else {
      this.router.navigate([], { relativeTo: this.route, queryParams: { project: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  statusClass(s: string): string {
    return { 'In Progress': 'bg-amber-100 text-amber-800', Open: 'bg-blue-100 text-blue-800',
             Overdue: 'bg-red-100 text-red-800', Completed: 'bg-emerald-100 text-emerald-800',
             Triage: 'bg-slate-100 text-slate-600' }[s] ?? 'bg-slate-100 text-slate-500';
  }

  priorityClass(p: string): string {
    return { High: 'bg-red-100 text-red-700', Medium: 'bg-amber-100 text-amber-800',
             Low: 'bg-slate-100 text-slate-600' }[p] ?? 'bg-slate-100 text-slate-500';
  }

  openTaskModal(row: TmTaskRow | null) {
    this.editingTask.set(row);
    const defaultProject = this.projectScope() || this.ws.projects()[0]?.id || '';
    if (row) {
      this.taskForm.reset({
        title: row.title,
        projectId: row.projectId,
        status: row.status,
        priority: row.priority,
        assignee: row.assignee,
        due: row.due,
      });
    } else {
      this.taskForm.reset({
        title: '',
        projectId: defaultProject,
        status: 'Open',
        priority: 'Medium',
        assignee: '',
        due: '',
      });
    }
    this.taskModalOpen.set(true);
  }

  closeTaskModal() {
    this.taskModalOpen.set(false);
    this.editingTask.set(null);
  }

  saveTask() {
    this.taskForm.markAllAsTouched();
    if (this.taskForm.invalid) return;
    const v = this.taskForm.getRawValue();
    const cur = this.editingTask();
    const payload = {
      title: v.title!,
      projectId: v.projectId!,
      status: v.status!,
      priority: v.priority!,
      assignee: v.assignee!,
      due: v.due || '',
    };
    if (cur) {
      this.ws.updateTask(cur.id, payload);
    } else {
      this.ws.addTask(payload);
    }
    this.closeTaskModal();
  }

  confirmDeleteTask() {
    const t = this.deleteTarget();
    if (t) this.ws.deleteTask(t.id);
    this.deleteTarget.set(null);
  }
}
