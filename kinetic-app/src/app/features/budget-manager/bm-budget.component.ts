import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BudgetEntriesService } from '../../services/budget-entries.service';
import { BudgetManagerBudget } from '../../models';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';
import { ToastService } from '../../services/toast.service';

function rowDone(r: BudgetManagerBudget): boolean {
  const v = r.is_done;
  return v === true || v === 1 || v === 'TRUE' || v === 'true' || v === '1';
}

function rowType(r: BudgetManagerBudget): 'CREDIT' | 'DEBIT' {
  const s = String(r.transaction_type || '').trim().toUpperCase();
  return s === 'DEBIT' ? 'DEBIT' : 'CREDIT';
}

@Component({
  selector: 'app-bm-budget',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DrawerPanelComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="k-page-intro py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Budget</h1>
          <p class="text-xs text-slate-500 mt-0.5 max-w-xl">
            Ledger rows from <span class="font-mono text-2xs">budget_manager_budget</span> — credits, debits, status, and dates.
            <a routerLink="/budget-manager/projects" class="font-medium text-primary hover:text-primary/80 ml-1">Projects</a> stays separate.
          </p>
        </div>
        <button type="button"
                class="inline-flex items-center gap-1 text-xs font-semibold text-white bg-primary px-3 py-2 rounded-lg hover:bg-primary/90"
                [disabled]="entries.loading()"
                (click)="openModal(null)">
          <span class="material-symbols-outlined text-[15px]">add</span>
          New entry
        </button>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        @for (s of statCards(); track s.label) {
          <div class="bg-white rounded-lg border border-slate-100 px-4 py-3 shadow-sm">
            <p class="text-2xs text-slate-400 uppercase tracking-wider font-medium">{{ s.label }}</p>
            <p class="text-xl font-bold mt-0.5 tabular-nums" [class]="s.color">{{ s.value }}</p>
            <p class="text-2xs text-slate-400 mt-0.5">{{ s.sub }}</p>
          </div>
        }
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
        <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
          <span class="text-xs font-semibold text-slate-800">Entries</span>
          @if (entries.loading()) {
            <span class="text-2xs text-slate-400">Loading…</span>
          }
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs min-w-[720px]">
            <thead>
              <tr class="bg-slate-50/90 border-b border-slate-100">
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">ID</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Title</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Description</th>
                <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                <th class="text-center px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Done</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Txn date</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Updated</th>
                <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (r of entries.entries(); track r.budget_id) {
                <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td class="px-3 py-2.5 font-mono text-2xs text-slate-500">{{ r.budget_id }}</td>
                  <td class="px-3 py-2.5 font-semibold text-slate-800">{{ r.title }}</td>
                  <td class="px-3 py-2.5 text-slate-600 max-w-[220px] truncate hidden md:table-cell" [title]="r.description || ''">{{ r.description || '—' }}</td>
                  <td class="px-3 py-2.5 text-right font-medium tabular-nums"
                      [class]="txnType(r) === 'DEBIT' ? 'text-red-700' : 'text-emerald-700'">{{ fmt(r.amount) }}</td>
                  <td class="px-3 py-2.5 text-center">
                    <input type="checkbox" class="rounded border-slate-300 text-primary focus:ring-primary/30"
                           [checked]="isDone(r)"
                           [disabled]="rowBusy() === r.budget_id"
                           (change)="onDoneToggle(r, $any($event.target).checked)">
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="px-2 py-0.5 rounded-md text-2xs font-semibold" [class]="typeClass(r)">{{ txnType(r) }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-slate-600 tabular-nums">{{ r.transaction_date || '—' }}</td>
                  <td class="px-3 py-2.5 text-2xs text-slate-400 hidden lg:table-cell">{{ r.updated_on || r.created_on || '—' }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex justify-end gap-0.5">
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100" title="Edit"
                              (click)="openModal(r)">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete"
                              (click)="deleteTarget.set(r)">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="9" class="px-3 py-12 text-center text-slate-400 text-xs">
                    @if (entries.loading()) { Loading… } @else { No rows yet. Add one or confirm the sheet tab <span class="font-mono">budget_manager_budget</span> exists in the spreadsheet. }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <app-drawer-panel
      [open]="modalOpen()"
      [title]="editing() ? 'Edit entry' : 'New entry'"
      subtitle="Matches spreadsheet columns: title, description, amount, done, type, transaction date."
      size="md"
      (closed)="closeModal()"
      (backdropClose)="closeModal()">
      @if (form) {
        <form [formGroup]="form" class="space-y-3">
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Title</label>
            <input formControlName="title" type="text" placeholder="e.g. from slice"
                   class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            @if (form.get('title')?.invalid && form.get('title')?.touched) {
              <p class="text-red-600 text-2xs mt-1">Title is required</p>
            }
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
            <textarea formControlName="description" rows="2" placeholder="Optional notes"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Amount</label>
              <input formControlName="amount" type="number" min="0" step="1"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Transaction date</label>
              <input formControlName="transaction_date" type="date"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Type</label>
              <select formControlName="transaction_type"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
                <option value="CREDIT">CREDIT</option>
                <option value="DEBIT">DEBIT</option>
              </select>
            </div>
            <div class="flex items-end pb-0.5">
              <label class="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" formControlName="is_done" class="rounded border-slate-300 text-primary focus:ring-primary/30">
                <span>Done</span>
              </label>
            </div>
          </div>
        </form>
      }
      <div drawerFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                (click)="closeModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90"
                [disabled]="saveBusy()"
                (click)="save()">{{ editing() ? 'Save' : 'Create' }}</button>
      </div>
    </app-drawer-panel>

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete budget row?"
      [message]="deleteTarget() ? 'Remove entry #' + deleteTarget()!.budget_id + ' — “' + deleteTarget()!.title + '”?' : ''"
      confirmLabel="Delete"
      (confirm)="confirmDelete()"
      (cancel)="deleteTarget.set(null)" />
  `,
})
export class BmBudgetComponent implements OnInit {
  modalOpen = signal(false);
  editing = signal<BudgetManagerBudget | null>(null);
  deleteTarget = signal<BudgetManagerBudget | null>(null);
  saveBusy = signal(false);
  rowBusy = signal<string | number | null>(null);

  form = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    amount: [0, [Validators.required, Validators.min(0)]],
    is_done: [false],
    transaction_type: ['CREDIT' as 'CREDIT' | 'DEBIT', Validators.required],
    transaction_date: ['', Validators.required],
  });

  statCards = computed(() => {
    const t = this.entries.totals();
    return [
      { label: 'Credits', value: this.fmt(t.credits), sub: 'Sum of CREDIT amounts', color: 'text-emerald-700' },
      { label: 'Debits', value: this.fmt(t.debits), sub: 'Sum of DEBIT amounts', color: 'text-red-700' },
      { label: 'Net (C − D)', value: this.fmt(t.net), sub: 'Credits minus debits', color: t.net >= 0 ? 'text-slate-800' : 'text-red-600' },
      { label: 'Open', value: String(t.openCount), sub: 'Rows not marked done', color: 'text-amber-600' },
    ];
  });

  constructor(
    public entries: BudgetEntriesService,
    private fb: FormBuilder,
    private toast: ToastService,
  ) {}

  async ngOnInit() {
    try {
      await this.entries.load();
    } catch {
      this.toast.error('Could not load budget entries. Check the API and the budget_manager_budget sheet.');
    }
  }

  fmt(n: number): string {
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  isDone(r: BudgetManagerBudget): boolean {
    return rowDone(r);
  }

  txnType(r: BudgetManagerBudget): 'CREDIT' | 'DEBIT' {
    return rowType(r);
  }

  typeClass(r: BudgetManagerBudget): string {
    return this.txnType(r) === 'DEBIT'
      ? 'bg-red-100 text-red-800'
      : 'bg-emerald-100 text-emerald-800';
  }

  openModal(row: BudgetManagerBudget | null) {
    this.editing.set(row);
    if (row) {
      this.form.reset({
        title: row.title,
        description: row.description ?? '',
        amount: Number(row.amount) || 0,
        is_done: this.isDone(row),
        transaction_type: this.txnType(row),
        transaction_date: this.toInputDate(row.transaction_date),
      });
    } else {
      const today = new Date().toISOString().slice(0, 10);
      this.form.reset({
        title: '',
        description: '',
        amount: 0,
        is_done: false,
        transaction_type: 'CREDIT',
        transaction_date: today,
      });
    }
    this.modalOpen.set(true);
  }

  private toInputDate(raw: string | null | undefined): string {
    if (!raw) return new Date().toISOString().slice(0, 10);
    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) {
      const d = m[1]!.padStart(2, '0');
      const mo = m[2]!.padStart(2, '0');
      const y = m[3]!;
      return `${y}-${mo}-${d}`;
    }
    return new Date().toISOString().slice(0, 10);
  }

  closeModal() {
    this.modalOpen.set(false);
    this.editing.set(null);
  }

  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    this.saveBusy.set(true);
    try {
      const cur = this.editing();
      if (cur) {
        await this.entries.update(cur.budget_id, {
          title: v.title!,
          description: v.description ?? '',
          amount: Number(v.amount),
          is_done: !!v.is_done,
          transaction_type: v.transaction_type!,
          transaction_date: v.transaction_date!,
        });
        this.toast.success('Entry updated');
      } else {
        await this.entries.create({
          title: v.title!,
          description: v.description ?? '',
          amount: Number(v.amount),
          is_done: !!v.is_done,
          transaction_type: v.transaction_type!,
          transaction_date: v.transaction_date!,
        });
        this.toast.success('Entry created');
      }
      this.closeModal();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Save failed';
      this.toast.error(msg);
    } finally {
      this.saveBusy.set(false);
    }
  }

  async onDoneToggle(r: BudgetManagerBudget, checked: boolean) {
    if (this.isDone(r) === checked) return;
    this.rowBusy.set(r.budget_id);
    try {
      await this.entries.update(r.budget_id, { is_done: checked });
    } catch {
      this.toast.error('Could not update done flag');
      await this.entries.load();
    } finally {
      this.rowBusy.set(null);
    }
  }

  async confirmDelete() {
    const t = this.deleteTarget();
    if (!t) return;
    try {
      await this.entries.remove(t.budget_id);
      this.toast.success('Deleted');
    } catch {
      this.toast.error('Delete failed');
    }
    this.deleteTarget.set(null);
  }
}
