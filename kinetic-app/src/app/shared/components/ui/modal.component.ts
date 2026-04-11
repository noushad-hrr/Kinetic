import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[460] flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
        <div class="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] transition-opacity"
             (click)="backdropClose.emit()"></div>
        <div class="relative w-full rounded-xl bg-white shadow-2xl border border-slate-200/80 flex flex-col max-h-[min(90vh,720px)] animate-in fade-in zoom-in-95 duration-200"
             [ngClass]="widthClass()">
          <div class="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 flex-shrink-0 bg-slate-50/60">
            <div class="min-w-0">
              <h2 class="text-base font-semibold text-slate-900 tracking-tight">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="text-xs text-slate-500 mt-0.5">{{ subtitle() }}</p>
              }
            </div>
            <button type="button"
                    class="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
                    (click)="closed.emit()" aria-label="Close">
              <span class="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <ng-content />
          </div>
          @if (showFooter()) {
            <div class="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-end gap-2 flex-shrink-0 bg-slate-50/80">
              <ng-content select="[modalFooter]" />
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
    @keyframes zoom-in-95 { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
    .animate-in { animation-fill-mode: both; }
    .fade-in { animation-name: fade-in; }
    .zoom-in-95 { animation-name: zoom-in-95; }
    .duration-200 { animation-duration: 200ms; }
  `]
})
export class ModalComponent {
  open = input(false);
  title = input.required<string>();
  subtitle = input<string>('');
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  showFooter = input(true);

  closed = output<void>();
  backdropClose = output<void>();

  widthClass(): string {
    const map = {
      sm: 'max-w-md',
      md: 'max-w-lg',
      lg: 'max-w-2xl',
      xl: 'max-w-4xl',
    };
    return map[this.size()];
  }
}
