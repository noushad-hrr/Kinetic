import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[470] flex items-center justify-center p-4" role="alertdialog" aria-modal="true">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" (click)="cancel.emit()"></div>
        <div class="relative w-full max-w-md rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
          <div class="px-5 pt-5 pb-2">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                   [class]="variant() === 'danger'
                     ? 'bg-red-100 text-red-600'
                     : 'bg-amber-100 text-amber-700'">
                <span class="material-symbols-outlined text-[22px]">{{ icon() }}</span>
              </div>
              <div class="min-w-0 pt-0.5">
                <h2 class="text-base font-semibold text-slate-900">{{ title() }}</h2>
                <p class="text-sm text-slate-600 mt-1.5 leading-relaxed">{{ message() }}</p>
              </div>
            </div>
          </div>
          <div class="px-5 py-4 flex justify-end gap-2 bg-slate-50 border-t border-slate-100">
            <button type="button"
                    class="px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    (click)="cancel.emit()">{{ cancelLabel() }}</button>
            <button type="button"
                    class="px-3.5 py-2 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                    [class]="variant() === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-primary hover:bg-primary/90'"
                    [disabled]="pending()"
                    (click)="confirm.emit()">
              @if (pending()) {
                <span class="material-symbols-outlined text-[14px] align-middle animate-spin">progress_activity</span>
              }
              {{ confirmLabel() }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  open = input(false);
  title = input('Confirm');
  message = input('');
  confirmLabel = input('Confirm');
  cancelLabel = input('Cancel');
  variant = input<'danger' | 'neutral'>('danger');
  pending = input(false);
  icon = input('warning');

  confirm = output<void>();
  cancel = output<void>();
}
