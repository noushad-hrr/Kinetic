import { Injectable, signal } from '@angular/core';
import { ApiService } from './api.service';
import { Masters, Role } from '../models';

@Injectable({ providedIn: 'root' })
export class MastersService {
  roles = signal<Role[]>([]);
  loaded = signal(false);

  constructor(private api: ApiService) {}

  load() {
    if (this.loaded()) return;
    this.api.getMasters().subscribe({
      next: (m: Masters) => {
        this.roles.set(m.roles || []);
        this.loaded.set(true);
      }
    });
  }

  reload() {
    this.loaded.set(false);
    this.load();
  }
}
