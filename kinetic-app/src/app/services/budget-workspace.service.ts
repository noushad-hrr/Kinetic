import { Injectable, computed, signal } from '@angular/core';

export interface BmProjectRow {
  id: string;
  name: string;
  budget: number;
  status: string;
}

export interface BmBudgetLine {
  id: string;
  projectId: string;
  category: string;
  allocated: number;
  spent: number;
  status: string;
}

const DOTS = ['bg-blue-400', 'bg-purple-400', 'bg-amber-400', 'bg-green-400', 'bg-teal-400', 'bg-red-400', 'bg-slate-400', 'bg-indigo-400'];

function nextLineId(existing: string[]): string {
  const nums = existing.map(id => {
    const m = id.match(/^BL-(\d+)$/);
    return m ? parseInt(m[1]!, 10) : 0;
  });
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `BL-${String(n).padStart(4, '0')}`;
}

function nextProjectId(existing: string[]): string {
  const nums = existing.map(id => {
    const m = id.match(/^KP-(\d+)$/);
    return m ? parseInt(m[1]!, 10) : 0;
  });
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `KP-${String(n).padStart(4, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class BudgetWorkspaceService {
  readonly projects = signal<BmProjectRow[]>([
    { id: 'KP-0001', name: 'Web Revamp',       budget: 50000, status: 'Active'    },
    { id: 'KP-0002', name: 'Mobile App',        budget: 80000, status: 'Active'    },
    { id: 'KP-0003', name: 'Backend Services',  budget: 30000, status: 'Active'    },
    { id: 'KP-0004', name: 'Content Strategy',  budget: 15000, status: 'Active'    },
    { id: 'KP-0005', name: 'Infrastructure',    budget: 40000, status: 'On Hold'   },
    { id: 'KP-0006', name: 'Customer Portal',   budget: 60000, status: 'Active'    },
    { id: 'KP-0008', name: 'Legacy Migration',  budget: 25000, status: 'Completed' },
  ]);

  readonly lines = signal<BmBudgetLine[]>([
    { id: 'BL-0001', projectId: 'KP-0001', category: 'Engineering', allocated: 28000, spent: 18200, status: 'On Track' },
    { id: 'BL-0002', projectId: 'KP-0001', category: 'Design',      allocated: 12000, spent: 9300,  status: 'On Track' },
    { id: 'BL-0003', projectId: 'KP-0001', category: 'Marketing',   allocated: 10000, spent: 5000,  status: 'On Track' },
    { id: 'BL-0004', projectId: 'KP-0002', category: 'Engineering', allocated: 45000, spent: 26000, status: 'On Track' },
    { id: 'BL-0005', projectId: 'KP-0002', category: 'QA',          allocated: 20000, spent: 12200, status: 'Warning'  },
    { id: 'BL-0006', projectId: 'KP-0002', category: 'Design',      allocated: 15000, spent: 7000,  status: 'On Track' },
    { id: 'BL-0007', projectId: 'KP-0003', category: 'Engineering', allocated: 22000, spent: 6200,  status: 'On Track' },
    { id: 'BL-0008', projectId: 'KP-0003', category: 'Infrastructure', allocated: 8000, spent: 2500, status: 'On Track' },
    { id: 'BL-0009', projectId: 'KP-0004', category: 'Content',     allocated: 9000,  spent: 7200,  status: 'On Track' },
    { id: 'BL-0010', projectId: 'KP-0004', category: 'Marketing',   allocated: 6000,  spent: 4900,  status: 'On Track' },
    { id: 'BL-0011', projectId: 'KP-0005', category: 'Infrastructure', allocated: 25000, spent: 12000, status: 'On Track' },
    { id: 'BL-0012', projectId: 'KP-0005', category: 'Operations',  allocated: 15000, spent: 6500,  status: 'On Track' },
    { id: 'BL-0013', projectId: 'KP-0006', category: 'Engineering', allocated: 40000, spent: 6200,  status: 'On Track' },
    { id: 'BL-0014', projectId: 'KP-0006', category: 'Design',      allocated: 20000, spent: 3600,  status: 'On Track' },
    { id: 'BL-0015', projectId: 'KP-0008', category: 'Engineering', allocated: 18000, spent: 17800, status: 'Over'     },
    { id: 'BL-0016', projectId: 'KP-0008', category: 'Migration',   allocated: 7000,  spent: 7000,  status: 'Over'     },
  ]);

  /** Aggregate spent per project from lines (for table remaining column). */
  readonly spentByProject = computed(() => {
    const map = new Map<string, number>();
    for (const l of this.lines()) {
      map.set(l.projectId, (map.get(l.projectId) ?? 0) + l.spent);
    }
    return map;
  });

  projectWithDerived(p: BmProjectRow): BmProjectRow & { spent: number; remaining: number } {
    const spent = this.spentByProject().get(p.id) ?? 0;
    return { ...p, spent, remaining: p.budget - spent };
  }

  linesForProject(projectId: string | null): BmBudgetLine[] {
    if (!projectId) return this.lines();
    return this.lines().filter(l => l.projectId === projectId);
  }

  dotForCategory(category: string): string {
    let h = 0;
    for (let i = 0; i < category.length; i++) h = (h + category.charCodeAt(i) * (i + 1)) % DOTS.length;
    return DOTS[h] ?? 'bg-slate-400';
  }

  addProject(data: Omit<BmProjectRow, 'id'>): BmProjectRow {
    const id = nextProjectId(this.projects().map(p => p.id));
    const row: BmProjectRow = { id, ...data };
    this.projects.update(list => [...list, row]);
    return row;
  }

  updateProject(id: string, patch: Partial<Omit<BmProjectRow, 'id'>>): void {
    this.projects.update(list => list.map(p => (p.id === id ? { ...p, ...patch } : p)));
  }

  deleteProject(id: string): void {
    this.projects.update(list => list.filter(p => p.id !== id));
    this.lines.update(list => list.filter(l => l.projectId !== id));
  }

  addLine(row: Omit<BmBudgetLine, 'id'>): BmBudgetLine {
    const id = nextLineId(this.lines().map(l => l.id));
    const line: BmBudgetLine = { id, ...row };
    this.lines.update(list => [...list, line]);
    return line;
  }

  updateLine(id: string, patch: Partial<Omit<BmBudgetLine, 'id'>>): void {
    this.lines.update(list => list.map(l => (l.id === id ? { ...l, ...patch } : l)));
  }

  deleteLine(id: string): void {
    this.lines.update(list => list.filter(l => l.id !== id));
  }

  totalsForLines(rows: BmBudgetLine[]): { allocated: number; spent: number } {
    return rows.reduce(
      (a, r) => ({ allocated: a.allocated + r.allocated, spent: a.spent + r.spent }),
      { allocated: 0, spent: 0 }
    );
  }
}
