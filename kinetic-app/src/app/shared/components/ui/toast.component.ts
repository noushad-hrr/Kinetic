import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      @for (t of toastService.toasts(); track t.id) {
        <div class="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg max-w-sm w-full animate-slide-up"
             [ngClass]="{
               'bg-emerald-50 text-emerald-800 border border-emerald-200': t.type === 'success',
               'bg-red-50 text-red-800 border border-red-200': t.type === 'error',
               'bg-amber-50 text-amber-800 border border-amber-200': t.type === 'warning',
               'bg-blue-50 text-blue-800 border border-blue-200': t.type === 'info'
             }">
          <span class="material-symbols-outlined text-[20px]"
                [ngClass]="{
                  'text-emerald-600': t.type === 'success',
                  'text-red-600': t.type === 'error',
                  'text-amber-600': t.type === 'warning',
                  'text-blue-600': t.type === 'info'
                }">
            {{ icon(t.type) }}
          </span>
          <p class="text-sm font-medium flex-1">{{ t.message }}</p>
          <button type="button" class="text-slate-400 hover:text-slate-600" (click)="toastService.remove(t.id)">
            <span class="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    @keyframes slide-up {
      from { transform: translateY(100%); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .animate-slide-up {
      animation: slide-up 0.2s ease-out forwards;
    }
  `]
})
export class ToastComponent {
  constructor(public toastService: ToastService) {}

  icon(type: string): string {
    switch (type) {
      case 'success': return 'check_circle';
      case 'error': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'info';
    }
  }
}
