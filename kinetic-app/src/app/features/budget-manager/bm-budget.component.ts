import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { BudgetWorkspaceService, BmBudgetLine, BmProjectRow } from '../../services/budget-workspace.service';
import { ModalComponent } from '../../shared/components/ui/modal.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';

@Component({
  selector: 'app-bm-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, ModalComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-emerald-50/40 px-4 py-3.5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Budget lines</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            Choose a project to work in context — the same link is opened from <span class="font-medium text-slate-700">Projects</span> via “Budget”.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="text-[10px] font-semibold text-slate-500 uppercase tracking-wider sr-only">Project</label>
          <select [ngModel]="selectedProjectId() ?? ''" (ngModelChange)="onProjectChange($event)"
                  class="text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            <option value="">All projects</option>
            @for (p of ws.projects(); track p.id) {
              <option [value]="p.id">{{ p.name }} ({{ p.id }})</option>
            }
          </select>
          <a routerLink="/budget-manager/projects"
             class="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 px-2 py-2 rounded-lg hover:bg-primary/5">
            <span class="material-symbols-outlined text-[16px]">folder_open</span>
            Projects
          </a>
        </div>
      </div>

      @if (selectedProject(); as proj) {
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/15 text-xs text-primary">
          <span class="material-symbols-outlined text-[18px]">info</span>
          <span>Filtering budget data for <strong class="font-semibold">{{ proj.name }}</strong>. Totals below reflect this project only.</span>
        </div>
      }

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        @for (s of statCards(); track s.label) {
          <div class="bg-white rounded-lg border border-slate-100 px-4 py-3 shadow-sm">
            <p class="text-[10px] text-slate-400 uppercase tracking-wider font-medium">{{ s.label }}</p>
            <p class="text-xl font-bold mt-0.5 tabular-nums" [class]="s.color">{{ s.value }}</p>
            <p class="text-[10px] text-slate-400 mt-0.5">{{ s.sub }}</p>
          </div>
        }
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <span class="text-xs font-semibold text-slate-800">Categories & allocations</span>
            <button type="button"
                    class="inline-flex items-center gap-1 text-xs font-semibold text-white bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/90"
                    (click)="openLineModal(null)">
              <span class="material-symbols-outlined text-[15px]">add</span>
              Add line
            </button>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-xs min-w-[640px]">
              <thead>
                <tr class="bg-slate-50/90 border-b border-slate-100">
                  @if (!selectedProjectId()) {
                    <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Project</th>
                  }
                  <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th class="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Allocated</th>
                  <th class="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Spent</th>
                  <th class="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Remaining</th>
                  <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Usage</th>
                  <th class="text-left px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th class="text-right px-3 py-2.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (r of visibleLines(); track r.id) {
                  <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    @if (!selectedProjectId()) {
                      <td class="px-3 py-2.5 text-slate-600 max-w-[140px]">
                        <span class="truncate block font-medium text-slate-800">{{ projectName(r.projectId) }}</span>
                        <span class="text-[10px] text-slate-400 font-mono">{{ r.projectId }}</span>
                      </td>
                    }
                    <td class="px-3 py-2.5">
                      <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full flex-shrink-0" [class]="ws.dotForCategory(r.category)"></div>
                        <span class="font-semibold text-slate-800">{{ r.category }}</span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-right font-medium tabular-nums">{{ fmt(r.allocated) }}</td>
                    <td class="px-3 py-2.5 text-right text-slate-600 tabular-nums hidden sm:table-cell">{{ fmt(r.spent) }}</td>
                    <td class="px-3 py-2.5 text-right tabular-nums hidden sm:table-cell"
                        [class]="r.allocated - r.spent < 0 ? 'text-red-600 font-semibold' : 'text-emerald-700'">{{ fmt(r.allocated - r.spent) }}</td>
                    <td class="px-3 py-2.5 hidden md:table-cell">
                      <div class="flex items-center gap-2">
                        <div class="h-1.5 w-16 bg-slate-100 rounded-full overflow-hidden">
                          <div class="h-full rounded-full" [style.width.%]="linePct(r)" [class]="lineBarClass(r)"></div>
                        </div>
                        <span class="text-[10px] tabular-nums text-slate-500">{{ linePct(r) }}%</span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5">
                      <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold" [class]="statusClass(r.status)">{{ r.status }}</span>
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <div class="flex justify-end gap-0.5">
                        <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100" title="Edit"
                                (click)="openLineModal(r)">
                          <span class="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete"
                                (click)="deleteLineTarget.set(r)">
                          <span class="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td [attr.colspan]="selectedProjectId() ? 7 : 8" class="px-3 py-12 text-center text-slate-400 text-xs">
                      No budget lines yet. Add a line or pick another project.
                    </td>
                  </tr>
                }
              </tbody>
              @if (visibleLines().length) {
                <tfoot class="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td class="px-3 py-2.5 text-xs font-semibold text-slate-700" [attr.colspan]="selectedProjectId() ? 1 : 2">Total</td>
                    <td class="px-3 py-2.5 text-right text-xs font-bold text-slate-900 tabular-nums">{{ fmt(lineTotals().allocated) }}</td>
                    <td class="px-3 py-2.5 text-right text-xs font-semibold text-slate-600 tabular-nums hidden sm:table-cell">{{ fmt(lineTotals().spent) }}</td>
                    <td class="px-3 py-2.5 text-right text-xs font-semibold text-emerald-700 tabular-nums hidden sm:table-cell">{{ fmt(lineTotals().allocated - lineTotals().spent) }}</td>
                    <td class="hidden md:table-cell"></td>
                    <td class="px-3 py-2.5"></td>
                    <td class="px-3 py-2.5"></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>
        </div>

        <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div class="px-4 py-3 border-b border-slate-100">
            <span class="text-xs font-semibold text-slate-800">Monthly spend</span>
            <p class="text-[10px] text-slate-400 mt-0.5">{{ monthlyCaption() }}</p>
          </div>
          <div class="p-4 space-y-3 flex-1 overflow-y-auto max-h-[420px]">
            @for (m of monthly; track m.month) {
              <div>
                <div class="flex items-center justify-between mb-1">
                  <span class="text-[11px] text-slate-600">{{ m.month }}</span>
                  <span class="text-[11px] font-semibold text-slate-800 tabular-nums">{{ fmt(m.spent) }}</span>
                </div>
                <div class="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary/70 rounded-full transition-all" [style.width.%]="(m.spent / maxMonthly()) * 100"></div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    </div>

    <app-modal
      [open]="lineModalOpen()"
      [title]="editingLine() ? 'Edit budget line' : 'New budget line'"
      subtitle="Allocations roll up to the project’s approved budget on the Projects screen."
      size="md"
      (closed)="closeLineModal()"
      (backdropClose)="closeLineModal()">
      @if (lineForm) {
        <form [formGroup]="lineForm" class="space-y-3">
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
            <select formControlName="projectId"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
              @for (p of ws.projects(); track p.id) {
                <option [value]="p.id">{{ p.name }} ({{ p.id }})</option>
              }
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Category</label>
            <input formControlName="category" type="text" placeholder="e.g. Engineering"
                   class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            @if (lineForm.get('category')?.invalid && lineForm.get('category')?.touched) {
              <p class="text-red-600 text-[10px] mt-1">Category is required</p>
            }
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Allocated</label>
              <input formControlName="allocated" type="number" min="0" step="100" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
            <div>
              <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Spent</label>
              <input formControlName="spent" type="number" min="0" step="100" class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
          </div>
          <div>
            <label class="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
            <select formControlName="status"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
              <option>On Track</option>
              <option>Warning</option>
              <option>Over</option>
            </select>
          </div>
        </form>
      }
      <div modalFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                (click)="closeLineModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90"
                (click)="saveLine()">{{ editingLine() ? 'Save changes' : 'Add line' }}</button>
      </div>
    </app-modal>

    <app-confirm-dialog
      [open]="!!deleteLineTarget()"
      title="Delete budget line?"
      [message]="deleteLineTarget() ? 'Remove “' + deleteLineTarget()!.category + '” from this project?' : ''"
      confirmLabel="Delete"
      (confirm)="confirmDeleteLine()"
      (cancel)="deleteLineTarget.set(null)" />
  `
})
export class BmBudgetComponent implements OnInit, OnDestroy {
  selectedProjectId = signal<string | null>(null);

  lineModalOpen = signal(false);
  editingLine = signal<BmBudgetLine | null>(null);
  deleteLineTarget = signal<BmBudgetLine | null>(null);

  lineForm = this.fb.group({
    projectId: ['', Validators.required],
    category: ['', Validators.required],
    allocated: [0, [Validators.required, Validators.min(0)]],
    spent: [0, [Validators.required, Validators.min(0)]],
    status: ['On Track', Validators.required],
  });

  monthly = [
    { month: 'Oct 2024', spent: 18200 },
    { month: 'Nov 2024', spent: 22400 },
    { month: 'Dec 2024', spent: 15800 },
    { month: 'Jan 2025', spent: 24100 },
    { month: 'Feb 2025', spent: 26700 },
    { month: 'Mar 2025', spent: 29100 },
    { month: 'Apr 2025', spent: 28400 },
  ];

  private sub?: Subscription;

  constructor(
    public ws: BudgetWorkspaceService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.sub = this.route.queryParamMap.subscribe(q => {
      const p = q.get('project');
      this.selectedProjectId.set(p && this.ws.projects().some(x => x.id === p) ? p : null);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  selectedProject = computed((): BmProjectRow | null => {
    const id = this.selectedProjectId();
    if (!id) return null;
    return this.ws.projects().find(p => p.id === id) ?? null;
  });

  visibleLines = computed(() => {
    const id = this.selectedProjectId();
    return id ? this.ws.lines().filter(l => l.projectId === id) : [...this.ws.lines()];
  });

  lineTotals = computed(() => this.ws.totalsForLines(this.visibleLines()));

  statCards = computed(() => {
    const id = this.selectedProjectId();
    const t = this.lineTotals();
    const proj = id ? this.ws.projects().find(p => p.id === id) : null;
    const cap = proj?.budget ?? t.allocated;
    const rem = (proj?.budget ?? t.allocated) - t.spent;
    const util = cap ? Math.round((t.spent / cap) * 100) : 0;
    return [
      { label: 'Scope', value: id ? (proj?.name ?? 'Project') : 'All projects', sub: id ? proj?.id ?? '' : 'Combined lines', color: 'text-slate-800' },
      { label: 'Allocated (lines)', value: this.fmt(t.allocated), sub: 'Sum of categories', color: 'text-slate-800' },
      { label: 'Spent', value: this.fmt(t.spent), sub: util + '% of approved budget', color: 'text-amber-600' },
      { label: 'Remaining', value: this.fmt(rem), sub: 'Approved − spent', color: rem < 0 ? 'text-red-600' : 'text-emerald-600' },
    ];
  });

  monthlyCaption(): string {
    const p = this.selectedProject();
    return p ? `Illustrative trend scaled for ${p.name}` : 'Portfolio view (all projects)';
  }

  projectName(id: string): string {
    return this.ws.projects().find(p => p.id === id)?.name ?? id;
  }

  onProjectChange(value: string) {
    if (value) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { project: value }, queryParamsHandling: 'merge', replaceUrl: true });
    } else {
      this.router.navigate([], { relativeTo: this.route, queryParams: { project: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  fmt(n: number): string {
    return '$' + n.toLocaleString();
  }

  linePct(r: BmBudgetLine): number {
    if (!r.allocated) return 0;
    return Math.min(100, Math.round((r.spent / r.allocated) * 100));
  }

  lineBarClass(r: BmBudgetLine): string {
    const x = this.linePct(r);
    return x > 90 ? 'bg-red-500' : x > 70 ? 'bg-amber-400' : 'bg-emerald-500';
  }

  statusClass(s: string): string {
    return { 'On Track': 'bg-emerald-100 text-emerald-800', Warning: 'bg-amber-100 text-amber-800',
             Over: 'bg-red-100 text-red-800' }[s] ?? 'bg-slate-100 text-slate-600';
  }

  maxMonthly(): number {
    return Math.max(...this.monthly.map(m => m.spent), 1);
  }

  openLineModal(row: BmBudgetLine | null) {
    this.editingLine.set(row);
    const defaultProject = this.selectedProjectId() ?? this.ws.projects()[0]?.id ?? '';
    if (row) {
      this.lineForm.reset({
        projectId: row.projectId,
        category: row.category,
        allocated: row.allocated,
        spent: row.spent,
        status: row.status,
      });
    } else {
      this.lineForm.reset({
        projectId: defaultProject,
        category: '',
        allocated: 0,
        spent: 0,
        status: 'On Track',
      });
    }
    this.lineModalOpen.set(true);
  }

  closeLineModal() {
    this.lineModalOpen.set(false);
    this.editingLine.set(null);
  }

  saveLine() {
    this.lineForm.markAllAsTouched();
    if (this.lineForm.invalid) return;
    const v = this.lineForm.getRawValue();
    const cur = this.editingLine();
    const payload = {
      projectId: v.projectId!,
      category: v.category!,
      allocated: Number(v.allocated),
      spent: Number(v.spent),
      status: v.status!,
    };
    if (cur) {
      this.ws.updateLine(cur.id, payload);
    } else {
      this.ws.addLine(payload);
    }
    this.closeLineModal();
  }

  confirmDeleteLine() {
    const t = this.deleteLineTarget();
    if (t) this.ws.deleteLine(t.id);
    this.deleteLineTarget.set(null);
  }
}
