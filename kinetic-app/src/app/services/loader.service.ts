import { Injectable, computed, signal } from '@angular/core';

export interface LoaderTask {
  id: string;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class LoaderService {
  private readonly _tasks = signal<Map<string, string>>(new Map());

  /** Active tasks in start order (for debugging / future multi-line UI). */
  readonly tasks = computed((): LoaderTask[] => {
    const m = this._tasks();
    return [...m.entries()].map(([id, message]) => ({ id, message }));
  });

  /** Most recently started task (shown in the shell). */
  readonly primaryTask = computed(() => {
    const list = this.tasks();
    return list.length ? list[list.length - 1]!.message : '';
  });

  readonly isLoading = computed(() => this._tasks().size > 0);

  startTask(message: string): string {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._tasks.update(m => new Map(m).set(id, message));
    return id;
  }

  endTask(id: string): void {
    this._tasks.update(m => {
      const next = new Map(m);
      next.delete(id);
      return next;
    });
  }
}
