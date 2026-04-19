import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Masters, Role } from '../models';

@Injectable({ providedIn: 'root' })
export class MastersService {
  roles = signal<Role[]>([]);
  statuses = signal<{ status_id: string; status_name: string; status_label: string; sort_order: number }[]>([]);
  loaded = signal(false);

  constructor(private api: ApiService) {}

  load() {
    if (this.loaded()) return;
    this.api.getMasters().subscribe({
      next: (m: Masters) => {
        this.roles.set(m.roles || []);
        if (m.statuses) {
          this.statuses.set(m.statuses.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
        }
        this.loaded.set(true);
      }
    });
  }

  reload() {
    this.loaded.set(false);
    this.load();
  }
}
