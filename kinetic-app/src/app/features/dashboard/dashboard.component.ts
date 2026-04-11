import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <!-- Stat cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        @for (s of stats; track s.label) {
          <div class="bg-white rounded-lg border border-slate-100 px-4 py-3 flex items-center gap-3">
            <div class="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0" [class]="s.iconBg">
              <span class="material-symbols-outlined text-base" [class]="s.iconColor" style="font-variation-settings:'FILL' 1;">{{ s.icon }}</span>
            </div>
            <div>
              <p class="text-xl font-bold text-slate-900 leading-none">{{ s.value }}</p>
              <p class="text-[11px] text-slate-400 mt-0.5">{{ s.label }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Main grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-3">

        <!-- Recent Tasks (2/3 width) -->
        <div class="lg:col-span-2 bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span class="text-xs font-semibold text-slate-700">Recent Tasks</span>
            <span class="text-[10px] text-slate-400">Last 7 days</span>
          </div>
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50/60 border-b border-slate-100">
                <th class="text-left px-4 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Task</th>
                <th class="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Project</th>
                <th class="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th class="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Priority</th>
                <th class="text-left px-3 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Due</th>
              </tr>
            </thead>
            <tbody>
              @for (t of recentTasks; track t.id) {
                <tr class="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td class="px-4 py-2">
                    <p class="font-medium text-slate-800 truncate max-w-[200px]">{{ t.title }}</p>
                    <p class="text-[10px] text-slate-400">{{ t.id }}</p>
                  </td>
                  <td class="px-3 py-2 text-slate-500 hidden sm:table-cell">{{ t.project }}</td>
                  <td class="px-3 py-2">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" [class]="statusClass(t.status)">{{ t.status }}</span>
                  </td>
                  <td class="px-3 py-2 hidden md:table-cell">
                    <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold" [class]="priorityClass(t.priority)">{{ t.priority }}</span>
                  </td>
                  <td class="px-3 py-2 text-slate-400 hidden lg:table-cell">{{ t.due }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Project summary (1/3 width) -->
        <div class="bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div class="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
            <span class="text-xs font-semibold text-slate-700">Projects</span>
            <span class="text-[10px] text-primary font-medium cursor-pointer">View all</span>
          </div>
          <div class="divide-y divide-slate-50">
            @for (p of projects; track p.name) {
              <div class="px-4 py-2.5">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-xs font-medium text-slate-800 truncate max-w-[130px]">{{ p.name }}</span>
                  <span class="text-[10px] text-slate-400">{{ p.done }}/{{ p.total }}</span>
                </div>
                <div class="h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div class="h-full bg-primary rounded-full" [style.width.%]="(p.done/p.total)*100"></div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <!-- Bottom row: Overdue + Upcoming -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">

        <!-- Overdue -->
        <div class="bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
            <span class="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></span>
            <span class="text-xs font-semibold text-slate-700">Overdue</span>
            <span class="ml-auto text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">3</span>
          </div>
          <div class="divide-y divide-slate-50">
            @for (t of overdueTasks; track t.id) {
              <div class="px-4 py-2 flex items-center justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-800">{{ t.title }}</p>
                  <p class="text-[10px] text-slate-400">{{ t.project }}</p>
                </div>
                <span class="text-[10px] text-red-500 font-medium">{{ t.due }}</span>
              </div>
            }
          </div>
        </div>

        <!-- Due this week -->
        <div class="bg-white rounded-lg border border-slate-100 overflow-hidden">
          <div class="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
            <span class="text-xs font-semibold text-slate-700">Due This Week</span>
            <span class="ml-auto text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">5</span>
          </div>
          <div class="divide-y divide-slate-50">
            @for (t of upcomingTasks; track t.id) {
              <div class="px-4 py-2 flex items-center justify-between">
                <div>
                  <p class="text-xs font-medium text-slate-800">{{ t.title }}</p>
                  <p class="text-[10px] text-slate-400">{{ t.project }}</p>
                </div>
                <span class="text-[10px] text-amber-600 font-medium">{{ t.due }}</span>
              </div>
            }
          </div>
        </div>
      </div>

    </div>
  `
})
export class DashboardComponent {
  stats = [
    { label: 'Projects',    value: 12, icon: 'folder_open',    iconBg: 'bg-blue-50',   iconColor: 'text-blue-500'  },
    { label: 'Open Tasks',  value: 34, icon: 'circle',         iconBg: 'bg-slate-100', iconColor: 'text-slate-500' },
    { label: 'In Progress', value: 8,  icon: 'autorenew',      iconBg: 'bg-amber-50',  iconColor: 'text-amber-500' },
    { label: 'Overdue',     value: 3,  icon: 'warning',        iconBg: 'bg-red-50',    iconColor: 'text-red-500'   },
  ];

  recentTasks = [
    { id: 'KT-0031', title: 'Homepage redesign',        project: 'Web Revamp',      status: 'In Progress', priority: 'High',   due: 'Apr 15' },
    { id: 'KT-0032', title: 'API endpoint integration', project: 'Backend',         status: 'Open',        priority: 'Medium', due: 'Apr 18' },
    { id: 'KT-0028', title: 'Database migration',       project: 'Infrastructure',  status: 'Overdue',     priority: 'High',   due: 'Apr 10' },
    { id: 'KT-0033', title: 'Copy review — landing pg', project: 'Content',         status: 'Open',        priority: 'Low',    due: 'Apr 22' },
    { id: 'KT-0030', title: 'Bug fix #231',             project: 'Mobile App',      status: 'In Progress', priority: 'High',   due: 'Apr 14' },
  ];

  projects = [
    { name: 'Web Revamp',      done: 12, total: 18 },
    { name: 'Mobile App',      done: 7,  total: 15 },
    { name: 'Backend',         done: 3,  total: 10 },
    { name: 'Content',         done: 9,  total: 12 },
    { name: 'Infrastructure',  done: 2,  total: 8  },
  ];

  overdueTasks = [
    { id: 'KT-0028', title: 'Database migration',  project: 'Infrastructure', due: '2 days ago' },
    { id: 'KT-0019', title: 'QA report submission', project: 'Mobile App',    due: '4 days ago' },
    { id: 'KT-0022', title: 'Design handoff',       project: 'Web Revamp',    due: '5 days ago' },
  ];

  upcomingTasks = [
    { id: 'KT-0030', title: 'Bug fix #231',             project: 'Mobile App',  due: 'Apr 14' },
    { id: 'KT-0031', title: 'Homepage redesign',        project: 'Web Revamp',  due: 'Apr 15' },
    { id: 'KT-0035', title: 'Sprint retrospective',     project: 'Backend',     due: 'Apr 16' },
    { id: 'KT-0036', title: 'Release notes draft',      project: 'Content',     due: 'Apr 17' },
    { id: 'KT-0032', title: 'API endpoint integration', project: 'Backend',     due: 'Apr 18' },
  ];

  statusClass(s: string): string {
    return { 'In Progress': 'bg-amber-100 text-amber-700', 'Open': 'bg-blue-100 text-blue-700',
             'Overdue': 'bg-red-100 text-red-700', 'Completed': 'bg-green-100 text-green-700' }[s] ?? 'bg-slate-100 text-slate-600';
  }

  priorityClass(p: string): string {
    return { 'High': 'bg-red-100 text-red-600', 'Medium': 'bg-amber-100 text-amber-600',
             'Low': 'bg-slate-100 text-slate-500' }[p] ?? 'bg-slate-100 text-slate-500';
  }
}
