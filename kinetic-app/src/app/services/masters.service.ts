import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Masters, Role } from '../models';

@Injectable({ providedIn: 'root' })
export class MastersService {
  roles = signal<Role[]>([]);
  statuses = signal<{ status_id: string; status_name: string; status_label: string; sort_order: number }[]>([]);
  priorities = signal<{ priority_id: string; priority_name: string; priority_label: string; color_code: string }[]>([]);
  taskTypes = signal<{ type_id: string; type_name: string; type_label: string; icon_name: string }[]>([]);
  users = signal<{ user_id: string; display_name: string; username: string; email: string }[]>([]);
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
        this.priorities.set(m.priorities || []);
        this.taskTypes.set(m.task_types || []);
        this.users.set(m.users || []);
        this.loaded.set(true);
      }
    });
  }

  reload() {
    this.loaded.set(false);
    this.load();
  }
}
