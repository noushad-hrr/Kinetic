import { Injectable, signal } from '@angular/core';

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
  priority: string;
  assignee: string;
  due: string;
  /** YYYY-MM-DD — Day chart shows the task on this calendar day */
  dueDate: string;
  /** Minutes from midnight (timeline start), e.g. 9:30 → 570 */
  scheduleStartMins: number;
  scheduleDurationMins: number;
}

function nextId(prefix: string, existing: string[]): string {
  const nums = existing
    .map(id => {
      const m = id.match(new RegExp(`^${prefix}-(\\d+)$`));
      return m ? parseInt(m[1]!, 10) : 0;
    });
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(n).padStart(4, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class TaskWorkspaceService {
  constructor() {
    queueMicrotask(() => {
      for (const p of this.projects()) {
        this.bumpProjectTotals(p.id);
      }
    });
  }

  readonly projects = signal<TmProjectRow[]>([
    { id: 'KP-0001', name: 'Test', status: 'Active', done: 12, total: 18, start: 'Mar 01', due: 'Apr 30' },
    { id: 'KP-0002', name: 'Mobile App', status: 'Active', done: 7, total: 15, start: 'Feb 15', due: 'May 15' },
    { id: 'KP-0003', name: 'Backend Services', status: 'Triage', done: 3, total: 10, start: 'Apr 01', due: '' },
    { id: 'KP-0004', name: 'Content Strategy', status: 'Active', done: 9, total: 12, start: 'Jan 10', due: 'Apr 25' },
    { id: 'KP-0005', name: 'Infrastructure', status: 'On Hold', done: 2, total: 8, start: 'Mar 20', due: '' },
    { id: 'KP-0006', name: 'Customer Portal', status: 'Active', done: 5, total: 20, start: 'Mar 15', due: 'Jun 01' },
    { id: 'KP-0007', name: 'Analytics Dashboard', status: 'Triage', done: 0, total: 6, start: 'Apr 10', due: '' },
    { id: 'KP-0008', name: 'Legacy Migration', status: 'Completed', done: 15, total: 15, start: 'Jan 01', due: 'Mar 31' },
  ]);

  readonly tasks = signal<TmTaskRow[]>([
    { id: 'KT-0031', projectId: 'KP-0001', title: 'Homepage redesign', status: 'In Progress', priority: 'High', assignee: 'Alex Sterling', due: 'Apr 15', dueDate: '2026-04-15', scheduleStartMins: 9 * 60 + 30, scheduleDurationMins: 90 },
    { id: 'KT-0032', projectId: 'KP-0003', title: 'API endpoint integration', status: 'Open', priority: 'Medium', assignee: 'Sarah Johnson', due: 'Apr 12', dueDate: '2026-04-12', scheduleStartMins: 11 * 60, scheduleDurationMins: 60 },
    { id: 'KT-0028', projectId: 'KP-0005', title: 'Database migration script', status: 'Overdue', priority: 'High', assignee: 'Liam Nguyen', due: 'Apr 10', dueDate: '2026-04-10', scheduleStartMins: 8 * 60 + 30, scheduleDurationMins: 45 },
    { id: 'KT-0033', projectId: 'KP-0004', title: 'Copy review — landing page', status: 'Open', priority: 'Low', assignee: 'Priya Kumar', due: 'Apr 22', dueDate: '2026-04-22', scheduleStartMins: 14 * 60, scheduleDurationMins: 40 },
    { id: 'KT-0030', projectId: 'KP-0002', title: 'Bug fix #231 crash on login', status: 'In Progress', priority: 'High', assignee: 'James Hart', due: 'Apr 14', dueDate: '2026-04-14', scheduleStartMins: 10 * 60, scheduleDurationMins: 75 },
    { id: 'KT-0034', projectId: 'KP-0001', title: 'Navigation bar responsive', status: 'Open', priority: 'Medium', assignee: 'Alex Sterling', due: 'Apr 12', dueDate: '2026-04-12', scheduleStartMins: 15 * 60 + 30, scheduleDurationMins: 50 },
    { id: 'KT-0035', projectId: 'KP-0003', title: 'Sprint retrospective notes', status: 'Completed', priority: 'Low', assignee: 'Sarah Johnson', due: 'Apr 12', dueDate: '2026-04-12', scheduleStartMins: 10 * 60, scheduleDurationMins: 40 },
    { id: 'KT-0036', projectId: 'KP-0004', title: 'Release notes draft', status: 'Open', priority: 'Medium', assignee: 'Priya Kumar', due: 'Apr 12', dueDate: '2026-04-12', scheduleStartMins: 12 * 60, scheduleDurationMins: 55 },
    { id: 'KT-0019', projectId: 'KP-0002', title: 'QA report submission', status: 'Overdue', priority: 'High', assignee: 'Liam Nguyen', due: 'Apr 08', dueDate: '2026-04-08', scheduleStartMins: 9 * 60, scheduleDurationMins: 50 },
    { id: 'KT-0022', projectId: 'KP-0001', title: 'Design handoff to dev', status: 'Overdue', priority: 'Medium', assignee: 'Alex Sterling', due: 'Apr 09', dueDate: '2026-04-09', scheduleStartMins: 13 * 60 + 15, scheduleDurationMins: 60 },
    { id: 'KT-0025', projectId: 'KP-0005', title: 'Setup CI/CD pipeline', status: 'Triage', priority: 'High', assignee: 'James Hart', due: '', dueDate: '2026-04-20', scheduleStartMins: 16 * 60, scheduleDurationMins: 45 },
    { id: 'KT-0027', projectId: 'KP-0002', title: 'User onboarding flow', status: 'Triage', priority: 'Medium', assignee: 'Priya Kumar', due: '', dueDate: '2026-04-25', scheduleStartMins: 11 * 60 + 45, scheduleDurationMins: 50 },
  ]);

  projectById(id: string): TmProjectRow | undefined {
    return this.projects().find(p => p.id === id);
  }

  projectName(id: string): string {
    return this.projectById(id)?.name ?? 'Unknown project';
  }

  addProject(row: Omit<TmProjectRow, 'id'>): TmProjectRow {
    const id = nextId('KP', this.projects().map(p => p.id));
    const p: TmProjectRow = { id, ...row };
    this.projects.update(list => [...list, p]);
    return p;
  }

  updateProject(id: string, patch: Partial<Omit<TmProjectRow, 'id'>>): void {
    this.projects.update(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }

  deleteProject(id: string): void {
    this.projects.update(list => list.filter(p => p.id !== id));
    this.tasks.update(list => list.filter(t => t.projectId !== id));
  }

  addTask(row: Omit<TmTaskRow, 'id'>): TmTaskRow {
    const id = nextId('KT', this.tasks().map(t => t.id));
    const t: TmTaskRow = {
      id,
      ...row,
      dueDate: row.dueDate || new Date().toISOString().slice(0, 10),
      scheduleStartMins: row.scheduleStartMins ?? 10 * 60,
      scheduleDurationMins: row.scheduleDurationMins ?? 45,
    };
    this.tasks.update(list => [...list, t]);
    this.bumpProjectTotals(row.projectId);
    return t;
  }

  updateTask(id: string, patch: Partial<Omit<TmTaskRow, 'id'>>): void {
    const prev = this.tasks().find(t => t.id === id);
    this.tasks.update(list => list.map(t => (t.id === id ? { ...t, ...patch } : t)));
    if (prev && patch.projectId !== undefined && patch.projectId !== prev.projectId) {
      this.bumpProjectTotals(prev.projectId);
      this.bumpProjectTotals(patch.projectId);
    } else if (prev && (patch.status !== undefined || patch.title !== undefined)) {
      this.bumpProjectTotals(prev.projectId);
    }
  }

  deleteTask(id: string): void {
    const prev = this.tasks().find(t => t.id === id);
    this.tasks.update(list => list.filter(t => t.id !== id));
    if (prev) this.bumpProjectTotals(prev.projectId);
  }

  /** Recompute done/total for a project from tasks (total = all tasks, done = completed). */
  private bumpProjectTotals(projectId: string): void {
    const ts = this.tasks().filter(t => t.projectId === projectId);
    const done = ts.filter(t => t.status === 'Completed').length;
    this.updateProject(projectId, { done, total: ts.length });
  }
}
