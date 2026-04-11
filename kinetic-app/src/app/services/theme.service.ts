import { Injectable, signal } from '@angular/core';

export type ThemeChoice = '1' | '2';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private static readonly STORAGE_KEY = 'kinetic_theme';

  /** Theme 1 = default (light). Theme 2 = dark view. */
  readonly theme = signal<ThemeChoice>('1');

  constructor() {
    this.restore();
  }

  setTheme(id: ThemeChoice): void {
    this.theme.set(id);
    localStorage.setItem(ThemeService.STORAGE_KEY, id);
    this.applyDom(id);
  }

  private restore(): void {
    const raw = localStorage.getItem(ThemeService.STORAGE_KEY);
    const id: ThemeChoice = raw === '2' ? '2' : '1';
    this.theme.set(id);
    this.applyDom(id);
  }

  private applyDom(id: ThemeChoice): void {
    document.documentElement.classList.toggle('dark', id === '2');
  }
}
