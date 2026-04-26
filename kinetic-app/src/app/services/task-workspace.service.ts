import { Injectable, signal, computed } from '@angular/core';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { Task, TaskSchedule, Project, ApiResponse } from '../models';
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
  /** Stable list key (composite when one row per schedule) */
  id: string;
  /** Real task id for update/delete APIs */
  taskId: string;
  projectId: string;
  title: string;
  description?: string;
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
  taskDate: string;
  dueDate: string; // Alias for taskDate (used by day chart filter)
  startTime: string;
  endTime: string;
  task_remarks?: string;
  estimated_hours?: number;
  spent_hours?: number;
  artifacts: any[];
  /** Multiple schedule rows (tasks_manager_tasks_periodicty) */
  schedules: TaskSchedule[];
  scheduleCount: number;
  /** Min schedule date across task schedules */
  startDate: string;
  /** Max schedule date across task schedules */
  endDate: string;
  created_by?: string;
  created_on?: string;
  last_modified_by?: string;
  last_modified_on?: string;
  /** Minutes from midnight (timeline start), e.g. 9:30 → 570 */
  scheduleStartMins: number;
  scheduleDurationMins: number;
  /** Day-chart slice only: when set, PATCH updates this schedule row */
  periodicityId?: string;
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
    const schedules = this.normalizeSchedules(t);
    const activePid = t.task_periodicity_id;
    const primary =
      activePid ? schedules.find(s => s.task_periodicity_id === activePid) : schedules[0];
    const taskDate = t.task_date || primary?.task_date || '';
    const startTime = t.task_start_time || primary?.task_start_time || '';
    const endTime = t.task_end_time || primary?.task_end_time || '';
    const statusId = primary?.task_status_id || t.task_status_id;
    const statusLabel = primary?.status_label || t.status_label || 'Open';
    const remarks = primary?.task_remarks ?? t.task_remarks;
    const dateRange = this.getScheduleDateRange(schedules, taskDate);
    const pid = activePid || primary?.task_periodicity_id;
    const taskId = t.task_id;
    const rowId = pid ? `${taskId}__${pid}` : taskId;

    return {
      id: rowId,
      taskId,
      projectId: t.project_id_fk,
      title: t.task_title,
      description: t.task_description,
      status: statusLabel,
      statusId,
      priority: t.priority_label || 'Medium',
      priorityId: t.priority_id,
      typeId: t.type_id || 'T001',
      typeLabel: t.type_label || 'Task',
      hasRemarks: schedules.some(s => !!(s.task_remarks && String(s.task_remarks).trim())),
      assignee: t.assignee_names || '',
      assigneeIds: (t.task_assignees || '').split('|').filter(Boolean),
      due: taskDate ? new Date(taskDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '',
      taskDate,
      dueDate: taskDate,
      startTime,
      endTime,
      task_remarks: remarks,
      estimated_hours: primary?.estimated_hours ?? t.estimated_hours,
      spent_hours: primary?.spent_hours ?? t.spent_hours,
      artifacts: t.artifacts || [],
      schedules,
      scheduleCount: schedules.length,
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      created_by: t.created_by,
      created_on: t.created_on,
      last_modified_by: t.last_modified_by,
      last_modified_on: t.last_modified_on,
      scheduleStartMins: this.timeToMins(startTime || '10:00'),
      scheduleDurationMins: this.calcDuration(startTime, endTime),
      periodicityId: pid || undefined
    };
  }

  /** Build schedule list from API (schedules[]) or legacy flat task fields */
  private normalizeSchedules(t: Task): TaskSchedule[] {
    const raw = t.schedules;
    if (raw && Array.isArray(raw) && raw.length > 0) {
      return raw.map(s => ({
        task_periodicity_id: s.task_periodicity_id,
        task_id_fk: s.task_id_fk,
        task_remarks: s.task_remarks,
        task_status_id: s.task_status_id,
        task_date: s.task_date || '',
        task_start_time: s.task_start_time || '',
        task_end_time: s.task_end_time || '',
        task_order_id: s.task_order_id as number | undefined,
        estimated_hours: s.estimated_hours,
        spent_hours: s.spent_hours,
        created_by: s.created_by,
        created_on: s.created_on,
        last_modified_by: s.last_modified_by,
        last_modified_on: s.last_modified_on,
        status_label: s.status_label
      }));
    }
    return [
      {
        task_periodicity_id: t.task_periodicity_id,
        task_status_id: t.task_status_id,
        task_date: t.task_date || '',
        task_start_time: t.task_start_time || '',
        task_end_time: t.task_end_time || '',
        task_remarks: t.task_remarks,
        task_order_id: t.task_order_id,
        estimated_hours: t.estimated_hours,
        spent_hours: t.spent_hours,
        status_label: t.status_label
      }
    ];
  }

  private getScheduleDateRange(schedules: TaskSchedule[], fallbackDate: string): { startDate: string; endDate: string } {
    const dates = schedules.map(s => s.task_date || '').filter(Boolean).sort();
    if (!dates.length) {
      return { startDate: fallbackDate || '', endDate: fallbackDate || '' };
    }
    return {
      startDate: dates[0] || '',
      endDate: dates[dates.length - 1] || ''
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
