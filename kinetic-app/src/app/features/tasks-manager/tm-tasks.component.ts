import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskWorkspaceService, TmTaskRow } from '../../services/task-workspace.service';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';

/** Full day: midnight → end of day (24h timeline) */
const DAY_START_MINS = 0;
const DAY_END_MINS = 24 * 60;
const DAY_RANGE_MINS = DAY_END_MINS - DAY_START_MINS;

export interface DayChartBlock {
  task: TmTaskRow;
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
}

@Component({
  selector: 'app-tm-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DrawerPanelComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <div class="k-page-intro py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div class="min-w-0">
          <h1 class="text-sm font-semibold text-slate-900 tracking-tight">Tasks</h1>
          <p class="text-xs text-slate-500 mt-0.5">
            <span class="font-medium text-slate-700">Day chart</span> shows the full 24-hour day; switch to list for dense tables. Scoped by project when you arrive from Projects.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select [ngModel]="projectScope()" (ngModelChange)="onProjectScope($event)"
                  class="text-xs font-medium border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 bg-white dark:bg-[#252526] text-slate-800 dark:text-neutral-200 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            <option value="">All projects</option>
            @for (p of ws.projects(); track p.id) {
              <option [value]="p.id">{{ p.name }} ({{ p.id }})</option>
            }
          </select>
          <a routerLink="/tasks-manager/projects"
             class="inline-flex items-center gap-1 text-xs font-semibold text-primary dark:text-neutral-300 px-2 py-2 rounded-lg hover:bg-primary/5 dark:hover:bg-white/[0.06]">
            <span class="material-symbols-outlined text-[16px]">folder_open</span>
            Projects
          </a>
        </div>
      </div>

      @if (scopedProject(); as sp) {
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/15 text-xs text-primary dark:bg-white/[0.06] dark:border-[#3c3c3c] dark:text-neutral-200">
          <span class="material-symbols-outlined text-[18px]">filter_alt</span>
          <span>Showing tasks for <strong class="font-semibold">{{ sp.name }}</strong>. Clear the project filter to see everything.</span>
        </div>
      }

      <div class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-lg border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] p-0.5 shadow-sm">
          <button type="button"
                  class="px-3 py-1.5 rounded-md text-2xs font-bold uppercase tracking-wide transition-colors"
                  [class]="viewMode() === 'day' ? 'bg-primary text-white dark:bg-[#3e3e42] dark:text-neutral-100 shadow-sm' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-[#2a2d2e]'"
                  (click)="setView('day')">
            <span class="material-symbols-outlined text-[14px] align-middle mr-1">calendar_view_day</span>
            Day chart
          </button>
          <button type="button"
                  class="px-3 py-1.5 rounded-md text-2xs font-bold uppercase tracking-wide transition-colors"
                  [class]="viewMode() === 'list' ? 'bg-primary text-white dark:bg-[#3e3e42] dark:text-neutral-100 shadow-sm' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-[#2a2d2e]'"
                  (click)="setView('list')">
            <span class="material-symbols-outlined text-[14px] align-middle mr-1">view_list</span>
            List
          </button>
        </div>
        @if (viewMode() === 'day') {
          <div class="relative">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input [(ngModel)]="search" type="text" placeholder="Filter day…"
                   class="pl-8 pr-3 py-1.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] w-36 sm:w-44 focus:outline-none focus:ring-2 focus:ring-primary/20">
          </div>
          <label class="inline-flex items-center gap-2 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">
            <span>Day</span>
            <input type="date" [ngModel]="selectedDay()" (ngModelChange)="selectedDay.set($event)"
                   class="text-xs font-medium border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-2 py-1.5 bg-white dark:bg-[#252526] text-slate-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20">
          </label>
          <button type="button"
                  class="text-2xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3c3c3c] text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors"
                  (click)="goToday()">Today</button>
          <span class="text-2xs text-slate-400 dark:text-neutral-500 tabular-nums">
            {{ chartFiltered().length }} blocks · {{ chartDoneCount() }} done
          </span>
        }
        <div class="flex-1"></div>
        @if (viewMode() === 'list') {
          <button type="button"
                  class="inline-flex items-center gap-1.5 bg-primary dark:bg-[#3e3e42] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 dark:hover:bg-[#4a4a4a] shadow-sm"
                  (click)="openTaskModal(null)">
            <span class="material-symbols-outlined text-[16px]">add</span>
            New task
          </button>
        }
      </div>

      @if (viewMode() === 'day') {
        <div class="rounded-xl border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] shadow-sm overflow-hidden flex flex-col min-h-[min(55vh,640px)] max-h-[min(92vh,1240px)]">
          <div class="px-3 py-2 border-b border-slate-100 dark:border-[#3c3c3c] flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-[#1e1e1e]">
            <div class="flex items-center gap-2 min-w-0">
              <span class="material-symbols-outlined text-[18px] text-slate-500 dark:text-neutral-500">schedule</span>
              <span class="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate">{{ prettyDayLabel() }}</span>
            </div>
            <button type="button"
                    class="inline-flex items-center gap-1 text-2xs font-bold uppercase tracking-wide text-primary dark:text-neutral-300 hover:underline"
                    (click)="openTaskModal(null)">
              <span class="material-symbols-outlined text-[14px]">add_task</span>
              Add task
            </button>
          </div>
          <div class="flex flex-1 min-h-0 overflow-auto">
            <div class="w-[3.25rem] sm:w-14 flex-shrink-0 border-r border-slate-100 dark:border-[#3c3c3c] bg-slate-50/50 dark:bg-[#1e1e1e] text-right pr-1.5 sm:pr-2 pt-0.5 select-none">
              @for (h of hourLabels; track h) {
                <div class="text-[9px] sm:text-[10px] font-medium text-slate-400 dark:text-neutral-500 leading-tight tabular-nums flex items-start justify-end pt-0.5"
                     [style.height.px]="hourSlotPx">{{ formatHour(h) }}</div>
              }
            </div>
            <div class="flex-1 relative min-w-0" [style.min-height.px]="hourLabels.length * hourSlotPx">
              @for (h of hourLabels; track h; let i = $index) {
                <div class="absolute left-0 right-0 border-t border-slate-100 dark:border-[#2d2d2d] pointer-events-none z-0"
                     [style.top.%]="hourTopPct(i)"></div>
              }
              <div class="absolute left-0 right-0 top-0 bottom-0 pointer-events-none z-0 opacity-40 dark:opacity-25">
                @for (h of hourLabels; track h; let i = $index) {
                  <div class="absolute left-0 right-0 border-t border-dashed border-slate-100/80 dark:border-[#333] pointer-events-none"
                       [style.top.%]="hourTopPct(i) + (100 / hourLabels.length / 2)"></div>
                }
              </div>
              @for (b of layoutDayChart(); track b.task.id) {
                <div class="absolute z-10 px-1 box-border transition-transform hover:z-20 hover:scale-[1.01]"
                     [style.top.%]="b.topPct"
                     [style.height.%]="b.heightPct"
                     [style.left.%]="b.leftPct"
                     [style.width.%]="b.widthPct">
                  <div class="h-full min-h-[36px] rounded-lg border shadow-sm flex overflow-hidden bg-white dark:bg-[#2d2d2d]"
                       [class.opacity-75]="b.task.status === 'Completed'"
                       [class]="timelineCardBorder(b.task.priority)">
                    <label class="flex items-start gap-2 p-2 min-w-0 flex-1 cursor-pointer group">
                      <input type="checkbox" class="mt-0.5 rounded border-slate-300 dark:border-[#555] text-primary dark:text-neutral-200 focus:ring-primary/30 shrink-0"
                             [checked]="b.task.status === 'Completed'"
                             (change)="toggleDone(b.task, $any($event.target).checked)"
                             (click)="$event.stopPropagation()">
                      <div class="min-w-0 flex-1">
                        <p class="text-[11px] font-semibold text-slate-900 dark:text-neutral-100 leading-snug line-clamp-2"
                           [class.line-through]="b.task.status === 'Completed'"
                           [class.text-slate-500]="b.task.status === 'Completed'">{{ b.task.title }}</p>
                        <p class="text-[10px] text-slate-500 dark:text-neutral-500 mt-0.5 tabular-nums">
                          {{ formatRange(b.task) }} · {{ ws.projectName(b.task.projectId) }}
                        </p>
                      </div>
                    </label>
                    <div class="flex flex-col border-l border-slate-100 dark:border-[#3c3c3c] bg-slate-50/50 dark:bg-[#252526] shrink-0">
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary dark:hover:text-neutral-200" title="Edit"
                              (click)="openTaskModal(b.task)">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                    </div>
                  </div>
                </div>
              }
              @if (layoutDayChart().length === 0) {
                <div class="absolute inset-0 flex flex-col items-center justify-center text-center p-6 z-[5]">
                  <span class="material-symbols-outlined text-[40px] text-slate-200 dark:text-neutral-600 mb-2">event_busy</span>
                  <p class="text-sm font-medium text-slate-600 dark:text-neutral-400">No tasks on this day</p>
                  <p class="text-2xs text-slate-400 dark:text-neutral-500 mt-1 max-w-xs">Pick another date, clear filters, or add a task with this schedule day.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }

      @if (viewMode() === 'list') {
        <div class="flex flex-wrap items-center gap-2">
          <div class="relative">
            <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
            <input [(ngModel)]="search" type="text" placeholder="Search tasks…"
                   class="pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] w-48 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
          </div>
          <select [(ngModel)]="statusFilter"
                  class="text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 bg-white dark:bg-[#252526] text-slate-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            <option value="">All status</option>
            <option>Open</option><option>In Progress</option><option>Completed</option><option>Overdue</option><option>Triage</option>
          </select>
          <select [(ngModel)]="priorityFilter"
                  class="text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 bg-white dark:bg-[#252526] text-slate-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            <option value="">All priority</option>
            <option>High</option><option>Medium</option><option>Low</option>
          </select>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          @for (tab of statusTabs; track tab) {
            <button type="button" class="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors"
                    [class]="activeTab() === tab ? 'bg-primary dark:bg-[#3e3e42] text-white shadow-sm' : 'bg-white dark:bg-[#252526] text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-[#3c3c3c] hover:border-primary/40 hover:text-primary dark:hover:border-neutral-500'"
                    (click)="activeTab.set(tab)">
              {{ tab }}
              <span class="ml-1 text-2xs opacity-80 tabular-nums">{{ countByStatus(tab) }}</span>
            </button>
          }
        </div>

        <div class="bg-white dark:bg-[#252526] rounded-xl border border-slate-100 dark:border-[#3c3c3c] shadow-sm overflow-hidden">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50/90 dark:bg-[#1e1e1e] border-b border-slate-100 dark:border-[#3c3c3c]">
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">Task</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Project</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">Status</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden md:table-cell">Priority</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Assignee</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Due</th>
                <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (t of filtered(); track t.id) {
                <tr class="border-b border-slate-50 dark:border-[#2d2d2d] hover:bg-slate-50/60 dark:hover:bg-[#2a2d2e]/60 transition-colors">
                  <td class="px-3 py-2.5">
                    <p class="font-semibold text-slate-800 dark:text-neutral-100 truncate max-w-[240px]">{{ t.title }}</p>
                    <p class="text-2xs text-slate-400 font-mono">{{ t.id }}</p>
                  </td>
                  <td class="px-3 py-2.5 text-slate-600 dark:text-neutral-400 hidden sm:table-cell">
                    <span class="truncate block max-w-[140px] font-medium">{{ ws.projectName(t.projectId) }}</span>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="px-2 py-0.5 rounded-md text-2xs font-semibold" [class]="statusClass(t.status)">{{ t.status }}</span>
                  </td>
                  <td class="px-3 py-2.5 hidden md:table-cell">
                    <span class="px-2 py-0.5 rounded-md text-2xs font-semibold" [class]="priorityClass(t.priority)">{{ t.priority }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-slate-600 dark:text-neutral-400 hidden lg:table-cell">
                    <div class="flex items-center gap-1.5">
                      <div class="w-5 h-5 rounded-full bg-primary/15 dark:bg-[#3c3c3c] flex items-center justify-center text-[9px] font-bold text-primary dark:text-neutral-200">
                        {{ initials(t.assignee) }}
                      </div>
                      <span class="truncate max-w-[100px]">{{ t.assignee }}</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 hidden lg:table-cell" [class]="t.status === 'Overdue' ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-slate-500 dark:text-neutral-500'">{{ t.due || '—' }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex justify-end gap-0.5">
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a2d2e]" title="Edit"
                              (click)="openTaskModal(t)">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30" title="Delete"
                              (click)="deleteTarget.set(t)">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="px-3 py-12 text-center text-slate-400 dark:text-neutral-500 text-xs">No tasks match your filters.</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-2xs text-slate-400 dark:text-neutral-500">Showing {{ filtered().length }} of {{ tasksInScope().length }} tasks in scope</p>
      }
    </div>

    <app-drawer-panel
      [open]="taskModalOpen()"
      [title]="editingTask() ? 'Edit task' : 'New task'"
      subtitle="Schedule day and time power the Day chart timeline."
      size="lg"
      (closed)="closeTaskModal()"
      (backdropClose)="closeTaskModal()">
      @if (taskForm) {
        <form [formGroup]="taskForm" class="space-y-3">
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Title</label>
            <input formControlName="title" type="text" placeholder="What needs to be done?"
                   class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            @if (taskForm.get('title')?.invalid && taskForm.get('title')?.touched) {
              <p class="text-red-600 text-2xs mt-1">Title is required</p>
            }
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Project</label>
            <select formControlName="projectId"
                    class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
              @for (p of ws.projects(); track p.id) {
                <option [value]="p.id">{{ p.name }} ({{ p.id }})</option>
              }
            </select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
              <select formControlName="status"
                      class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
                <option>Open</option>
                <option>In Progress</option>
                <option>Completed</option>
                <option>Overdue</option>
                <option>Triage</option>
              </select>
            </div>
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
              <select formControlName="priority"
                      class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Assignee</label>
              <input formControlName="assignee" type="text" placeholder="Name"
                     class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Due label</label>
              <input formControlName="due" type="text" placeholder="e.g. Apr 20 (optional)"
                     class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
          </div>
          <div>
            <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Schedule day (Day chart)</label>
            <input formControlName="dueDate" type="date"
                   class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Start time</label>
              <input formControlName="scheduleTime" type="time"
                     class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
            <div>
              <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Duration (minutes)</label>
              <input formControlName="scheduleDurationMins" type="number" min="15" step="15"
                     class="w-full px-3 py-2 text-sm border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
            </div>
          </div>
        </form>
      }
      <div drawerFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] hover:bg-slate-50 dark:hover:bg-[#2a2d2e]"
                (click)="closeTaskModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary dark:bg-[#3e3e42] text-white rounded-lg hover:bg-primary/90 dark:hover:bg-[#4a4a4a]"
                (click)="saveTask()">{{ editingTask() ? 'Save changes' : 'Create task' }}</button>
      </div>
    </app-drawer-panel>

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete task?"
      [message]="deleteTarget() ? 'Remove “' + deleteTarget()!.title + '” permanently?' : ''"
      confirmLabel="Delete"
      (confirm)="confirmDeleteTask()"
      (cancel)="deleteTarget.set(null)" />
  `
})
export class TmTasksComponent implements OnInit, OnDestroy {
  search = '';
  statusFilter = '';
  priorityFilter = '';
  activeTab = signal('All');
  projectScope = signal('');
  viewMode = signal<'day' | 'list'>('day');
  selectedDay = signal(this.todayYmd());
  statusTabs = ['All', 'Open', 'In Progress', 'Overdue', 'Completed', 'Triage'];

  /** 0–23 → full 24h; row height keeps chart scrollable inside the panel */
  readonly hourLabels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  readonly hourSlotPx = 42;

  taskModalOpen = signal(false);
  editingTask = signal<TmTaskRow | null>(null);
  deleteTarget = signal<TmTaskRow | null>(null);

  taskForm = this.fb.group({
    title: ['', Validators.required],
    projectId: ['', Validators.required],
    status: ['Open', Validators.required],
    priority: ['Medium', Validators.required],
    assignee: ['', Validators.required],
    due: [''],
    dueDate: ['', Validators.required],
    scheduleTime: ['10:00', Validators.required],
    scheduleDurationMins: [45, [Validators.required, Validators.min(15), Validators.max(12 * 60)]],
  });

  private sub?: Subscription;

  constructor(
    public ws: TaskWorkspaceService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    if (!this.route.snapshot.queryParamMap.has('view')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { view: 'day' },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
    this.sub = this.route.queryParamMap.subscribe(q => {
      const p = q.get('project') ?? '';
      const valid = p && this.ws.projects().some(x => x.id === p);
      this.projectScope.set(valid ? p : '');
      const v = q.get('view');
      this.viewMode.set(v === 'list' ? 'list' : 'day');
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  todayYmd(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  goToday(): void {
    this.selectedDay.set(this.todayYmd());
  }

  setView(mode: 'day' | 'list'): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { view: mode === 'day' ? 'day' : 'list' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  hourTopPct(index: number): number {
    return (index / this.hourLabels.length) * 100;
  }

  formatHour(h: number): string {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  }

  prettyDayLabel(): string {
    const ymd = this.selectedDay();
    if (!ymd || ymd.length < 10) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }

  minsToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  timeToMins(s: string): number {
    const parts = s.split(':');
    const h = parseInt(parts[0] || '0', 10) || 0;
    const m = parseInt(parts[1] || '0', 10) || 0;
    return h * 60 + m;
  }

  formatDueShort(ymd: string): string {
    if (!ymd || ymd.length < 10) return '';
    const [y, mo, d] = ymd.split('-').map(Number);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[mo - 1]} ${d}`;
  }

  scheduleBounds(task: TmTaskRow): { start: number; end: number } {
    const start = task.scheduleStartMins;
    const dur = task.scheduleDurationMins || 45;
    return { start, end: start + dur };
  }

  formatRange(task: TmTaskRow): string {
    const { start, end } = this.scheduleBounds(task);
    return `${this.minsToTime(start)} – ${this.minsToTime(end)}`;
  }

  timelineCardBorder(priority: string): string {
    const map: Record<string, string> = {
      High: 'border-l-4 border-l-rose-500 dark:border-l-rose-400',
      Medium: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
      Low: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-500',
    };
    return map[priority] ?? 'border-l-4 border-l-slate-300 dark:border-l-neutral-600';
  }

  scopedProject() {
    const id = this.projectScope();
    if (!id) return null;
    return this.ws.projectById(id) ?? null;
  }

  tasksInScope(): TmTaskRow[] {
    const id = this.projectScope();
    const all = this.ws.tasks();
    return id ? all.filter(t => t.projectId === id) : all;
  }

  /** List view filters */
  filtered(): TmTaskRow[] {
    return this.tasksInScope().filter(t => {
      if (this.activeTab() !== 'All' && t.status !== this.activeTab()) return false;
      if (this.statusFilter && t.status !== this.statusFilter) return false;
      if (this.priorityFilter && t.priority !== this.priorityFilter) return false;
      if (this.search && !t.title.toLowerCase().includes(this.search.toLowerCase()) && !t.id.toLowerCase().includes(this.search.toLowerCase())) return false;
      return true;
    });
  }

  /** Day chart: same day + scope + search only (status tabs apply) */
  chartFiltered(): TmTaskRow[] {
    const day = this.selectedDay();
    return this.tasksInScope().filter(t => {
      if (!t.dueDate || t.dueDate !== day) return false;
      if (this.search && !t.title.toLowerCase().includes(this.search.toLowerCase()) && !t.id.toLowerCase().includes(this.search.toLowerCase())) return false;
      return true;
    });
  }

  chartDoneCount(): number {
    return this.chartFiltered().filter(t => t.status === 'Completed').length;
  }

  layoutDayChart(): DayChartBlock[] {
    const tasks = [...this.chartFiltered()].sort((a, b) => this.scheduleBounds(a).start - this.scheduleBounds(b).start);
    const laneEnds: number[] = [];
    type Placed = { task: TmTaskRow; lane: number; start: number; end: number };
    const placed: Placed[] = [];

    for (const task of tasks) {
      const b = this.scheduleBounds(task);
      let start = Math.max(DAY_START_MINS, b.start);
      let end = Math.min(DAY_END_MINS, b.end);
      if (end <= start) end = Math.min(DAY_END_MINS, start + 30);

      let lane = -1;
      for (let i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i]! <= start) {
          lane = i;
          break;
        }
      }
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(end);
      } else {
        laneEnds[lane] = end;
      }
      placed.push({ task, lane, start, end });
    }

    const laneCount = Math.max(1, laneEnds.length);
    const pad = 0.35;
    const cell = 100 / laneCount;

    return placed.map(({ task, lane, start, end }) => {
      const topPct = ((start - DAY_START_MINS) / DAY_RANGE_MINS) * 100;
      let heightPct = ((end - start) / DAY_RANGE_MINS) * 100;
      heightPct = Math.max(heightPct, 2.8);
      const leftPct = lane * cell + pad;
      const widthPct = cell - 2 * pad;
      return { task, topPct, heightPct, leftPct, widthPct };
    });
  }

  countByStatus(tab: string): number {
    const base = this.tasksInScope();
    if (tab === 'All') return base.length;
    return base.filter(t => t.status === tab).length;
  }

  onProjectScope(value: string) {
    if (value) {
      this.router.navigate([], { relativeTo: this.route, queryParams: { project: value }, queryParamsHandling: 'merge', replaceUrl: true });
    } else {
      this.router.navigate([], { relativeTo: this.route, queryParams: { project: null }, queryParamsHandling: 'merge', replaceUrl: true });
    }
  }

  initials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  statusClass(s: string): string {
    const map: Record<string, string> = {
      'In Progress': 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
      Open: 'bg-slate-100 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200',
      Overdue: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
      Completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
      Triage: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300',
    };
    return map[s] ?? 'bg-slate-100 text-slate-500';
  }

  priorityClass(p: string): string {
    return { High: 'bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-200', Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200',
             Low: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-200' }[p] ?? 'bg-slate-100 text-slate-500';
  }

  toggleDone(task: TmTaskRow, done: boolean): void {
    this.ws.updateTask(task.id, { status: done ? 'Completed' : 'Open' });
  }

  openTaskModal(row: TmTaskRow | null) {
    this.editingTask.set(row);
    const defaultProject = this.projectScope() || this.ws.projects()[0]?.id || '';
    const today = this.todayYmd();
    if (row) {
      this.taskForm.reset({
        title: row.title,
        projectId: row.projectId,
        status: row.status,
        priority: row.priority,
        assignee: row.assignee,
        due: row.due,
        dueDate: row.dueDate || today,
        scheduleTime: this.minsToTime(row.scheduleStartMins),
        scheduleDurationMins: row.scheduleDurationMins,
      });
    } else {
      this.taskForm.reset({
        title: '',
        projectId: defaultProject,
        status: 'Open',
        priority: 'Medium',
        assignee: '',
        due: this.formatDueShort(today),
        dueDate: today,
        scheduleTime: '10:00',
        scheduleDurationMins: 45,
      });
    }
    this.taskModalOpen.set(true);
  }

  closeTaskModal() {
    this.taskModalOpen.set(false);
    this.editingTask.set(null);
  }

  saveTask() {
    this.taskForm.markAllAsTouched();
    if (this.taskForm.invalid) return;
    const v = this.taskForm.getRawValue();
    const cur = this.editingTask();
    const dueDate = v.dueDate || '';
    const due = v.due?.trim() || (dueDate ? this.formatDueShort(dueDate) : '');
    const scheduleStartMins = this.timeToMins(v.scheduleTime || '10:00');
    const scheduleDurationMins = Number(v.scheduleDurationMins) || 45;
    const payload = {
      title: v.title!,
      projectId: v.projectId!,
      status: v.status!,
      priority: v.priority!,
      assignee: v.assignee!,
      due,
      dueDate,
      scheduleStartMins,
      scheduleDurationMins,
    };
    if (cur) {
      this.ws.updateTask(cur.id, payload);
    } else {
      this.ws.addTask(payload);
    }
    this.closeTaskModal();
  }

  confirmDeleteTask() {
    const t = this.deleteTarget();
    if (t) this.ws.deleteTask(t.id);
    this.deleteTarget.set(null);
  }
}
