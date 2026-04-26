import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { BudgetWorkspaceService, BmProjectRow } from '../../services/budget-workspace.service';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';

@Component({
  selector: 'app-bm-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DrawerPanelComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="k-page-intro py-3.5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Budget projects</h1>
            <p class="text-xs text-slate-500 mt-0.5 max-w-xl">
              Each project has an approved budget here. The <span class="font-medium text-slate-700">Budget</span> screen is the transaction ledger (<span class="font-mono text-2xs">budget_manager_budget</span>).
            </p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        @for (s of summaryCards(); track s.label) {
          <div class="bg-white rounded-lg border border-slate-100 px-4 py-3 shadow-sm">
            <p class="text-2xs text-slate-400 uppercase tracking-wider font-medium">{{ s.label }}</p>
            <p class="text-lg font-bold mt-0.5 tabular-nums" [class]="s.color">{{ s.value }}</p>
          </div>
        }
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
          <input [(ngModel)]="search" type="text" placeholder="Search projects…"
                 class="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
        </div>
        <div class="flex-1"></div>
        <button type="button"
                class="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
                (click)="openProjectModal(null)">
          <span class="material-symbols-outlined text-[16px]">add</span>
          New project
        </button>
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-50/90 border-b border-slate-100">
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Project</th>
              <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Budget</th>
              <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Spent</th>
              <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Remaining</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Utilisation</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Status</th>
              <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            @for (p of filtered(); track p.id) {
              <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                <td class="px-3 py-2.5">
                  <p class="font-semibold text-slate-800">{{ p.name }}</p>
                  <p class="text-2xs text-slate-400 font-mono">{{ p.id }}</p>
                </td>
                <td class="px-3 py-2.5 text-right font-semibold text-slate-700 tabular-nums">{{ fmt(p.budget) }}</td>
                <td class="px-3 py-2.5 text-right text-slate-600 tabular-nums hidden sm:table-cell">{{ fmt(p.spent) }}</td>
                <td class="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell"
                    [class]="p.remaining < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700 font-medium'">{{ fmt(p.remaining) }}</td>
                <td class="px-3 py-2.5 hidden md:table-cell">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                      <div class="h-full rounded-full transition-all" [style.width.%]="pct(p)" [class]="barClass(p)"></div>
                    </div>
                    <span class="text-2xs tabular-nums font-medium" [class]="pct(p) > 90 ? 'text-red-600' : 'text-slate-500'">{{ pct(p) }}%</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 hidden lg:table-cell">
                  <span class="px-2 py-0.5 rounded-md text-2xs font-semibold" [class]="statusClass(p.status)">{{ p.status }}</span>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <div class="flex items-center justify-end gap-0.5 flex-wrap">
                    <a routerLink="/budget-manager/budget"
                       class="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-2xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors">
                      <span class="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                      Budget
                    </a>
                    <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100 transition-colors" title="Edit"
                            (click)="openProjectModal(p)">
                      <span class="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors" title="Delete"
                            (click)="deleteTarget.set(p)">
                      <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="px-3 py-12 text-center text-slate-400 text-xs">No projects match your search.</td></tr>
            }
          </tbody>
          @if (filtered().length) {
            <tfoot class="bg-slate-50 border-t border-slate-200">
              <tr>
                <td class="px-3 py-2.5 text-xs font-semibold text-slate-700">Total</td>
                <td class="px-3 py-2.5 text-right text-xs font-bold text-slate-900 tabular-nums">{{ fmt(foot().budget) }}</td>
                <td class="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 tabular-nums hidden sm:table-cell">{{ fmt(foot().spent) }}</td>
                <td class="px-3 py-2.5 text-right text-xs font-semibold text-emerald-700 tabular-nums hidden sm:table-cell">{{ fmt(foot().remaining) }}</td>
                <td class="hidden md:table-cell"></td>
                <td class="hidden lg:table-cell"></td>
                <td></td>
              </tr>
            </tfoot>
          }
        </table>
      </div>
    </div>

    <app-drawer-panel
      [open]="projectModalOpen()"
      [title]="editingProject() ? 'Edit project' : 'New project'"
      subtitle="Set the approved budget and status. The Budget screen holds the cashbook-style ledger."
      size="md"
      (closed)="closeProjectModal()"
      (backdropClose)="closeProjectModal()">
      @if (projectForm) {
        <form [formGroup]="projectForm" class="space-y-3" (ngSubmit)="saveProject()">
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Name</label>
            <input formControlName="name" type="text" placeholder="e.g. Web Revamp"
                   class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            @if (projectForm.get('name')?.invalid && projectForm.get('name')?.touched) {
              <p class="text-red-600 text-2xs mt-1">Name is required</p>
            }
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Approved budget (USD)</label>
            <input formControlName="budget" type="number" min="0" step="100"
                   class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary tabular-nums">
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select formControlName="status"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
              <option>Active</option>
              <option>On Hold</option>
              <option>Completed</option>
            </select>
          </div>
        </form>
      }
      <div drawerFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-white bg-white"
                (click)="closeProjectModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90"
                (click)="saveProject()">{{ editingProject() ? 'Save changes' : 'Create project' }}</button>
      </div>
    </app-drawer-panel>

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete project?"
      [message]="deleteTarget() ? 'Remove “' + deleteTarget()!.name + '” and all of its budget lines? This cannot be undone.' : ''"
      confirmLabel="Delete"
      (confirm)="confirmDeleteProject()"
      (cancel)="deleteTarget.set(null)" />
  `
})
export class BmProjectsComponent {
  search = '';

  projectModalOpen = signal(false);
  editingProject = signal<BmProjectRow | null>(null);
  deleteTarget = signal<BmProjectRow | null>(null);
  projectForm = this.fb.group({
    name: ['', Validators.required],
    budget: [0, [Validators.required, Validators.min(0)]],
    status: ['Active', Validators.required],
  });

  constructor(
    public ws: BudgetWorkspaceService,
    private fb: FormBuilder,
    private router: Router,
  ) {}

  private derivedList() {
    return this.ws.projects().map(p => this.ws.projectWithDerived(p));
  }

  summaryCards = computed(() => {
    const list = this.derivedList();
    const tb = list.reduce((s, p) => s + p.budget, 0);
    const ts = list.reduce((s, p) => s + p.spent, 0);
    const rem = tb - ts;
    const avg = list.length ? Math.round(list.reduce((a, p) => a + (p.budget ? (p.spent / p.budget) * 100 : 0), 0) / list.length) : 0;
    return [
      { label: 'Total budget', value: this.fmtNum(tb), color: 'text-slate-800' },
      { label: 'Total spent', value: this.fmtNum(ts), color: 'text-amber-600' },
      { label: 'Remaining', value: this.fmtNum(rem), color: 'text-emerald-600' },
      { label: 'Avg utilisation', value: avg + '%', color: 'text-primary' },
    ];
  });

  filtered() {
    const list = this.derivedList();
    if (!this.search.trim()) return list;
    const q = this.search.toLowerCase();
    return list.filter(p => p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
  }

  foot() {
    const f = this.filtered();
    const budget = f.reduce((s, p) => s + p.budget, 0);
    const spent = f.reduce((s, p) => s + p.spent, 0);
    return { budget, spent, remaining: budget - spent };
  }

  fmt(n: number): string {
    return '$' + n.toLocaleString();
  }

  fmtNum(n: number): string {
    return '$' + n.toLocaleString();
  }

  pct(p: { budget: number; spent: number }): number {
    if (!p.budget) return 0;
    return Math.min(100, Math.round((p.spent / p.budget) * 100));
  }

  barClass(p: { budget: number; spent: number }): string {
    const x = this.pct(p);
    return x > 90 ? 'bg-red-500' : x > 70 ? 'bg-amber-400' : 'bg-emerald-500';
  }

  statusClass(s: string): string {
    return { Active: 'bg-emerald-100 text-emerald-800', 'On Hold': 'bg-amber-100 text-amber-800',
            Completed: 'bg-stone-200 text-stone-800' }[s] ?? 'bg-slate-100 text-slate-600';
  }

  openProjectModal(row: BmProjectRow | null) {
    this.editingProject.set(row);
    if (row) {
      this.projectForm.reset({ name: row.name, budget: row.budget, status: row.status });
    } else {
      this.projectForm.reset({ name: '', budget: 0, status: 'Active' });
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
      this.ws.updateProject(cur.id, { name: v.name!, budget: Number(v.budget), status: v.status! });
    } else {
      const p = this.ws.addProject({ name: v.name!, budget: Number(v.budget), status: v.status! });
      this.router.navigate(['/budget-manager/budget']);
    }
    this.closeProjectModal();
  }

  confirmDeleteProject() {
    const t = this.deleteTarget();
    if (t) this.ws.deleteProject(t.id);
    this.deleteTarget.set(null);
  }
}
