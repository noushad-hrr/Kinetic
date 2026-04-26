import { Injectable, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Task, Project, ApiResponse } from '../models';
import { firstValueFrom } from 'rxjs';

export interface TmProjectRow {
  id: string;
  name: string;
  status: string;
  done: number;
  total: number;
  start: string;
  due: string;
}

export interface TmTaskRow {
  id: string;
  projectId: string;
  title: string;
  status: string;
  statusId: string;
  priority: string;
  priorityId: string;
  typeId: string;
  typeLabel: string;
  hasRemarks: boolean;
  assignee: string;
  assigneeIds: string[];
  due: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  dueDate: string; // Alias for startDate
  task_remarks?: string;
  estimated_hours?: number;
  spent_hours?: number;
  artifacts: any[];
  created_by?: string;
  created_on?: string;
  last_modified_by?: string;
  last_modified_on?: string;
  /** Minutes from midnight (timeline start), e.g. 9:30 → 570 */
  scheduleStartMins: number;
  scheduleDurationMins: number;
}

@Injectable({ providedIn: 'root' })
export class TaskWorkspaceService {
  readonly projects = signal<TmProjectRow[]>([]);
  readonly tasks = signal<TmTaskRow[]>([]);
  readonly loading = signal(false);

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {
    this.loadAll();
  }

  async loadAll() {
    this.loading.set(true);
    try {
      const userId = this.auth.currentUser()?.user_id;
      if (!userId) return;

      const [pRes, tRes] = await Promise.all([
        firstValueFrom(this.api.get<Project[]>('getProjects', { user_id: userId })),
        firstValueFrom(this.api.get<Task[]>('getTasks', { user_id: userId }))
      ]) as [ApiResponse<Project[]>, ApiResponse<Task[]>];

      if (pRes.success && pRes.data) {
        this.projects.set(pRes.data.map(p => ({
          id: p.project_id,
          name: p.project_name,
          status: p.project_status || 'Unknown',
          done: p.task_done || 0,
          total: p.task_total || 0,
          start: p.project_start_date,
          due: p.project_end_date
        })));
      }

      if (tRes.success && tRes.data) {
        this.tasks.set(tRes.data.map(t => this.mapToRow(t)));
      }
    } catch (err) {
      console.error('Failed to load tasks workspace:', err);
    } finally {
      this.loading.set(false);
    }
  }

  private mapToRow(t: Task): TmTaskRow {
    return {
      id: t.task_id,
      projectId: t.project_id_fk,
      title: t.task_title,
      status: t.status_label || 'Open',
      statusId: t.task_status_id,
      priority: t.priority_label || 'Medium',
      priorityId: t.priority_id,
      typeId: t.type_id || 'T001',
      typeLabel: t.type_label || 'Task',
      hasRemarks: !!(t.task_remarks && t.task_remarks.trim()),
      assignee: t.assignee_names || '',
      assigneeIds: (t.task_assignees || '').split('|').filter(Boolean),
      due: t.task_end_date ? new Date(t.task_end_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
      startDate: t.task_start_date || '',
      endDate: t.task_end_date || '',
      startTime: t.task_start_time || '',
      endTime: t.task_end_time || '',
      dueDate: t.task_start_date || '',
      task_remarks: t.task_remarks,
      estimated_hours: t.estimated_hours,
      spent_hours: t.spent_hours,
      artifacts: t.artifacts || [],
      created_by: t.created_by,
      created_on: t.created_on,
      last_modified_by: t.last_modified_by,
      last_modified_on: t.last_modified_on,
      scheduleStartMins: this.timeToMins(t.task_start_time || '10:00'),
      scheduleDurationMins: this.calcDuration(t.task_start_time, t.task_end_time)
    };
  }

  private timeToMins(s: string): number {
    const parts = (s || '00:00').split(':');
    const h = parseInt(parts[0] || '0', 10) || 0;
    const m = parseInt(parts[1] || '0', 10) || 0;
    return h * 60 + m;
  }

  private calcDuration(start?: string, end?: string): number {
    if (!start || !end) return 45;
    const s = this.timeToMins(start);
    const e = this.timeToMins(end);
    return Math.max(15, e - s);
  }

  projectById(id: string): TmProjectRow | undefined {
    return this.projects().find(p => p.id === id);
  }

  projectName(id: string): string {
    return this.projectById(id)?.name ?? 'Unknown project';
  }

  async addTask(row: any) {
    const userId = this.auth.currentUser()?.user_id;
    const payload = {
      ...row,
      created_by: userId
    };
    const res = await firstValueFrom(this.api.post<Task>('createTask', payload)) as ApiResponse<Task>;
    if (res.success && res.data) {
      this.loadAll();
      return res.data;
    }
    throw new Error(res.error || 'Failed to create task');
  }

  async updateTask(id: string, patch: any) {
    const payload = {
      task_id: id,
      ...patch,
      last_modified_by: this.auth.currentUser()?.user_id
    };
    const res = await firstValueFrom(this.api.post<any>('updateTask', payload)) as ApiResponse<any>;
    if (res.success) {
      // Re-fetch or locally update
      this.loadAll(); 
      return true;
    }
    throw new Error(res.error || 'Failed to update task');
  }

  async deleteTask(id: string) {
    const res = await firstValueFrom(this.api.get<any>('deleteTask', { task_id: id })) as ApiResponse<any>;
    if (res.success) {
      this.loadAll();
      return true;
    }
    throw new Error(res.error || 'Failed to delete task');
  }
}
