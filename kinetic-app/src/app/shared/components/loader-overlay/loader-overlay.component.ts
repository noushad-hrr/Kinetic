import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoaderService } from '../../../services/loader.service';

/** Full-page loader: light overlay + Kinetic mark; specific text only when the interceptor resolves a label. */
@Component({
  selector: 'app-loader-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 z-[600] flex items-center justify-center p-4 sm:p-6
                bg-slate-900/[0.06] dark:bg-black/55 backdrop-blur-[2px]"
         role="alert" aria-live="polite" aria-busy="true">
      <div class="flex flex-col items-center text-center max-w-[min(20rem,90vw)] px-2">
        <div class="k-loader-brand" aria-hidden="true">
          <span class="material-symbols-outlined k-loader-bolt">bolt</span>
        </div>
        <p class="mt-6 text-[15px] font-medium text-slate-700 dark:text-neutral-200 leading-snug tracking-tight">
          {{ headline() }}
        </p>
      </div>
    </div>
  `,
  styleUrls: ['./loader-overlay.component.css']
})
export class LoaderOverlayComponent {
  private static readonly GENERIC = new Set(['Loading…', 'Loading...', 'Loading']);

  constructor(public loader: LoaderService) {}

  headline(): string {
    const firstSpecific = this.loader
      .tasks()
      .find(t => !LoaderOverlayComponent.GENERIC.has(t.message.trim()));
    if (firstSpecific) {
      return this.truncate(firstSpecific.message.trim());
    }
    return 'Just a moment…';
  }

  private truncate(s: string, max = 56): string {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
}
