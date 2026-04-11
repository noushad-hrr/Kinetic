import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

/** Right-hand slide-over panel for create/edit forms (matches Admin Users & Roles pattern). */
@Component({
  selector: 'app-drawer-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-[470] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="drawer-panel-title">
        <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
             (click)="backdropClose.emit()"></div>
        <aside
          class="relative flex h-full w-full flex-col bg-white dark:bg-neutral-950 shadow-2xl border-l border-slate-200/90 dark:border-zinc-800 drawer-panel-slide"
          [ngClass]="widthClass()">
          <div class="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0 bg-slate-50/70 dark:bg-zinc-900/90">
            <div class="min-w-0 pr-2">
              <h2 id="drawer-panel-title" class="text-sm font-semibold text-slate-900 dark:text-neutral-50 tracking-tight">{{ title() }}</h2>
              @if (subtitle()) {
                <p class="text-xs text-slate-500 dark:text-neutral-400 mt-1 leading-snug">{{ subtitle() }}</p>
              }
            </div>
            <button type="button"
                    class="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-neutral-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors flex-shrink-0 -mr-1"
                    (click)="closed.emit()" aria-label="Close">
              <span class="material-symbols-outlined text-[22px]">close</span>
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4">
            <ng-content />
          </div>
          @if (showFooter()) {
            <div class="px-4 py-3 border-t border-slate-100 dark:border-zinc-800 flex flex-wrap items-center justify-end gap-2 flex-shrink-0 bg-white dark:bg-neutral-950">
              <ng-content select="[drawerFooter]" />
            </div>
          }
        </aside>
      </div>
    }
  `,
  styles: [`
    @keyframes drawer-panel-in {
      from { transform: translateX(100%); opacity: 0.96; }
      to { transform: translateX(0); opacity: 1; }
    }
    .drawer-panel-slide {
      animation: drawer-panel-in 0.22s cubic-bezier(0.32, 0.72, 0, 1) both;
    }
    @media (prefers-reduced-motion: reduce) {
      .drawer-panel-slide { animation: none; }
    }
  `],
})
export class DrawerPanelComponent {
  open = input(false);
  title = input.required<string>();
  subtitle = input('');
  /** sm ≈ users/roles; md/lg for wider forms (tasks, budget). */
  size = input<'sm' | 'md' | 'lg' | 'xl'>('md');
  showFooter = input(true);

  closed = output<void>();
  backdropClose = output<void>();

  widthClass(): string {
    const map: Record<string, string> = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
    };
    return map[this.size()] ?? 'max-w-md';
  }
}
