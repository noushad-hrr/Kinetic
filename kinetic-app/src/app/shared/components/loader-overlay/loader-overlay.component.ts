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
                bg-slate-900/[0.06] backdrop-blur-[2px]"
         role="alert" aria-live="polite" aria-busy="true">
      <div class="flex flex-col items-center text-center max-w-[min(20rem,90vw)] px-2">
        <div class="k-loader-brand" aria-hidden="true">
          <span class="material-symbols-outlined k-loader-bolt">bolt</span>
        </div>
        <p class="mt-6 text-[15px] font-medium text-slate-700 leading-snug tracking-tight">
          {{ headline() }}
        </p>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }
    .k-loader-brand {
      width: 4rem;
      height: 4rem;
      border-radius: 0.875rem;
      background: linear-gradient(145deg, #3d2ed4 0%, #3525cd 45%, #2a1fa8 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow:
        0 0 0 1px rgba(255, 255, 255, 0.14) inset,
        0 10px 28px rgba(53, 37, 205, 0.35);
      animation: k-loader-brand-pulse 1.25s ease-in-out infinite;
    }
    .k-loader-bolt {
      font-size: 2rem;
      line-height: 1;
      color: #ffffff;
      font-variation-settings: 'FILL' 1, 'wght' 600;
    }
    @keyframes k-loader-brand-pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.04); }
    }
    @media (prefers-reduced-motion: reduce) {
      .k-loader-brand { animation: none; }
    }
  `]
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
