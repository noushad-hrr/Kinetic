import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeChoice } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 max-w-2xl mx-auto space-y-6">
      <div class="k-page-intro py-3.5">
        <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Settings</h1>
        <p class="text-xs text-slate-500 mt-0.5">Workspace preferences and appearance.</p>
      </div>

      <section class="bg-white dark:bg-[#252526] rounded-xl border border-slate-100 dark:border-[#3c3c3c] shadow-sm overflow-hidden">
        <div class="px-4 py-3 border-b border-slate-100 dark:border-[#3c3c3c]">
          <h2 class="text-xs font-semibold text-slate-800 dark:text-neutral-100 uppercase tracking-wider">Theme</h2>
          <p class="text-2xs text-slate-500 dark:text-neutral-500 mt-0.5">Choose light or dark. Dark mode uses a neutral editor-style palette.</p>
        </div>
        <div class="p-4 grid sm:grid-cols-2 gap-3">
          <button type="button"
                  class="flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:border-slate-300 dark:hover:border-neutral-600"
                  [class.border-slate-900]="theme.theme() === '1'"
                  [class.ring-2]="theme.theme() === '1'"
                  [class.ring-slate-300]="theme.theme() === '1'"
                  [class.border-slate-200]="theme.theme() !== '1'"
                  [class.dark:border-[#3c3c3c]]="theme.theme() !== '1'"
                  (click)="pick('1')">
            <span class="material-symbols-outlined text-[28px] text-amber-500">light_mode</span>
            <span class="text-sm font-semibold text-slate-900 dark:text-neutral-100">Light</span>
            <span class="text-2xs text-slate-500 dark:text-neutral-500">Default bright workspace with indigo accents.</span>
          </button>
          <button type="button"
                  class="flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all hover:border-slate-300 dark:hover:border-neutral-600 bg-slate-50/80 dark:bg-[#1e1e1e]"
                  [class.dark:border-neutral-200]="theme.theme() === '2'"
                  [class.border-slate-900]="theme.theme() === '2'"
                  [class.ring-2]="theme.theme() === '2'"
                  [class.ring-slate-300]="theme.theme() === '2'"
                  [class.dark:ring-neutral-600]="theme.theme() === '2'"
                  [class.border-slate-200]="theme.theme() !== '2'"
                  [class.dark:border-[#3c3c3c]]="theme.theme() !== '2'"
                  (click)="pick('2')">
            <span class="material-symbols-outlined text-[28px] text-neutral-400">dark_mode</span>
            <span class="text-sm font-semibold text-slate-900 dark:text-neutral-100">Dark</span>
            <span class="text-2xs text-slate-500 dark:text-neutral-500">Neutral dark UI similar to Cursor / VS Code (no blue chrome).</span>
          </button>
        </div>
      </section>
    </div>
  `,
})
export class SettingsComponent {
  constructor(public theme: ThemeService) {}

  pick(id: ThemeChoice): void {
    this.theme.setTheme(id);
  }
}
