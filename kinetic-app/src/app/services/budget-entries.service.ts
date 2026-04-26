import { Injectable, computed, signal } from '@angular/core';
import { ApiService } from './api.service';
import { BudgetManagerBudget } from '../models';
import { firstValueFrom } from 'rxjs';

function asBool(v: boolean | string | number | undefined | null): boolean {
  if (v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1') return true;
  return false;
}

function normType(v: string | undefined | null): 'CREDIT' | 'DEBIT' {
  const s = String(v || '').trim().toUpperCase();
  return s === 'DEBIT' ? 'DEBIT' : 'CREDIT';
}

@Injectable({ providedIn: 'root' })
export class BudgetEntriesService {
  readonly entries = signal<BudgetManagerBudget[]>([]);
  readonly loading = signal(false);

  readonly totals = computed(() => {
    let credits = 0;
    let debits = 0;
    let openCount = 0;
    for (const r of this.entries()) {
      const amt = Number(r.amount) || 0;
      if (normType(r.transaction_type) === 'DEBIT') debits += amt;
      else credits += amt;
      if (!asBool(r.is_done)) openCount++;
    }
    return { credits, debits, net: credits - debits, openCount };
  });

  constructor(private api: ApiService) {}

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await firstValueFrom(this.api.getBudgetEntries());
      this.entries.set(Array.isArray(rows) ? rows : []);
    } catch {
      this.entries.set([]);
      throw new Error('Failed to load budget entries');
    } finally {
      this.loading.set(false);
    }
  }

  async create(payload: Omit<BudgetManagerBudget, 'budget_id' | 'created_on' | 'updated_on'>): Promise<BudgetManagerBudget> {
    const row = await firstValueFrom(
      this.api.createBudgetEntry({
        title: payload.title,
        description: payload.description ?? '',
        amount: payload.amount,
        is_done: asBool(payload.is_done),
        transaction_type: normType(payload.transaction_type),
        transaction_date: payload.transaction_date,
      })
    );
    await this.load();
    return row;
  }

  async update(
    budgetId: string | number,
    patch: Partial<Pick<BudgetManagerBudget, 'title' | 'description' | 'amount' | 'is_done' | 'transaction_type' | 'transaction_date'>>
  ): Promise<BudgetManagerBudget> {
    const body: Partial<BudgetManagerBudget> & { budget_id: string | number } = { budget_id: budgetId };
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.amount !== undefined) body.amount = patch.amount;
    if (patch.is_done !== undefined) body.is_done = asBool(patch.is_done);
    if (patch.transaction_type !== undefined) body.transaction_type = normType(patch.transaction_type);
    if (patch.transaction_date !== undefined) body.transaction_date = patch.transaction_date;
    const row = await firstValueFrom(this.api.updateBudgetEntry(body));
    await this.load();
    return row;
  }

  async remove(budgetId: string | number): Promise<void> {
    await firstValueFrom(this.api.deleteBudgetEntry(budgetId));
    await this.load();
  }
}
