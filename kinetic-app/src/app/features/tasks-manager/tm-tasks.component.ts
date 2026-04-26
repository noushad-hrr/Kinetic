import { Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormArray, FormGroup, AbstractControl, ValidationErrors } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TaskWorkspaceService, TmTaskRow } from '../../services/task-workspace.service';
import { TaskSchedule } from '../../models';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';
import { MastersService } from '../../services/masters.service';
import { ToastService } from '../../services/toast.service';

function dateTimeRangeValidator(group: AbstractControl): ValidationErrors | null {
  const startTime = group.get('task_start_time')?.value;
  const endTime   = group.get('task_end_time')?.value;
  if (startTime && endTime && startTime >= endTime) return { timeRangeInvalid: true };
  return null;
}

function atLeastOneScheduleValidator(control: AbstractControl): ValidationErrors | null {
  const arr = control.get('schedules') as FormArray | null;
  if (!arr || arr.length < 1) return { schedulesRequired: true };
  return null;
}

/** Full day: midnight → end of day (24h timeline) */
const DAY_START_MINS = 0;
const DAY_END_MINS = 24 * 60;
const DAY_RANGE_MINS = DAY_END_MINS - DAY_START_MINS;

export interface DayChartBlock {
  task: TmTaskRow;
  trackId: string;
  topPct: number;
  heightPct: number;
  leftPct: number;
  widthPct: number;
}

@Component({
  selector: 'app-tm-tasks',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DrawerPanelComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4" (click)="openDropdown.set(null)">

      <!-- FIRST LINE: summary stats -->
      <div class="flex flex-wrap items-center gap-2">
        @for (s of summaryStats(); track s.label) {
          <div class="flex items-center gap-1.5 bg-white dark:bg-[#252526] border border-slate-100 dark:border-[#3c3c3c] rounded-lg px-3 py-1.5 shadow-sm">
            <span class="font-bold text-slate-900 dark:text-neutral-100 tabular-nums">{{ s.value }}</span>
            <span class="text-[11px] text-slate-500 dark:text-neutral-500">{{ s.label }}</span>
          </div>
        }
      </div>

      <!-- SECOND LINE: Filters & Actions -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
          <input [ngModel]="searchFilter()" (ngModelChange)="searchFilter.set($event)" type="text" placeholder="Search tasks…"
                 class="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg bg-white dark:bg-[#252526] focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
        </div>

        <!-- Multi-select Projects -->
        <div class="relative">
          <button type="button" (click)="toggleDropdown($event, 'projects')"
                  class="flex items-center gap-2 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 bg-white dark:bg-[#252526] text-slate-700 dark:text-neutral-200 hover:bg-slate-50 transition-colors">
            Projects @if(selectedProjects().length > 0) { <span class="bg-primary text-white text-[9px] px-1 rounded-full">{{selectedProjects().length}}</span> }
            <span class="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
          <div *ngIf="openDropdown() === 'projects'" class="absolute left-0 top-full mt-1 w-48 bg-white dark:bg-[#252526] border border-slate-200 dark:border-[#3c3c3c] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
            <div class="max-h-60 overflow-y-auto px-2">
              @for (p of ws.projects(); track p.id) {
                <label class="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded cursor-pointer transition-colors">
                  <input type="checkbox" [checked]="selectedProjects().includes(p.id)" (change)="toggleProject(p.id)"
                         class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20">
                  <span class="text-xs truncate">{{ p.name }}</span>
                </label>
              }
            </div>
          </div>
        </div>

        @if (viewMode() === 'list') {
          <!-- Multi-select Status -->
          <div class="relative">
            <button type="button" (click)="toggleDropdown($event, 'status')"
                    class="flex items-center gap-2 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 bg-white dark:bg-[#252526] text-slate-700 dark:text-neutral-200 hover:bg-slate-50 transition-colors">
              Status @if(selectedStatuses().length > 0) { <span class="bg-primary text-white text-[9px] px-1 rounded-full">{{selectedStatuses().length}}</span> }
              <span class="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
            <div *ngIf="openDropdown() === 'status'" class="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-[#252526] border border-slate-200 dark:border-[#3c3c3c] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              @for (st of masters.statuses(); track st.status_id) {
                <label class="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded cursor-pointer transition-colors">
                  <input type="checkbox" [checked]="selectedStatuses().includes(st.status_label || st.status_name)" (change)="toggleStatus(st.status_label || st.status_name)"
                         class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20">
                  <span class="text-xs">{{ st.status_label || st.status_name }}</span>
                </label>
              }
            </div>
          </div>

          <!-- Multi-select Priority -->
          <div class="relative">
            <button type="button" (click)="toggleDropdown($event, 'priority')"
                    class="flex items-center gap-2 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-3 py-2 bg-white dark:bg-[#252526] text-slate-700 dark:text-neutral-200 hover:bg-slate-50 transition-colors">
              Priority @if(selectedPriorities().length > 0) { <span class="bg-primary text-white text-[9px] px-1 rounded-full">{{selectedPriorities().length}}</span> }
              <span class="material-symbols-outlined text-[16px]">expand_more</span>
            </button>
            <div *ngIf="openDropdown() === 'priority'" class="absolute left-0 top-full mt-1 w-40 bg-white dark:bg-[#252526] border border-slate-200 dark:border-[#3c3c3c] rounded-lg shadow-xl z-50 py-1 animate-fade-in">
              @for (pr of masters.priorities(); track pr.priority_id) {
                <label class="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-white/[0.05] rounded cursor-pointer transition-colors">
                  <input type="checkbox" [checked]="selectedPriorities().includes(pr.priority_label || pr.priority_name)" (change)="togglePriority(pr.priority_label || pr.priority_name)"
                         class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20">
                  <span class="text-xs">{{ pr.priority_label || pr.priority_name }}</span>
                </label>
              }
            </div>
          </div>

          <!-- Date Filters -->
          <div class="flex items-center gap-1.5">
            <input type="date" [ngModel]="startDateFilter()" (ngModelChange)="startDateFilter.set($event)"
                   class="text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-2 py-2 bg-white dark:bg-[#252526] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" title="Start date">
            <span class="text-[10px] text-slate-400">to</span>
            <input type="date" [ngModel]="endDateFilter()" (ngModelChange)="endDateFilter.set($event)"
                   class="text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-lg px-2 py-2 bg-white dark:bg-[#252526] text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" title="End date">
          </div>
        } @else {
          <div class="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] p-0.5 shadow-sm">
            <button type="button"
                    class="p-1.5 rounded-md text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-[#2a2d2e] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                    title="Previous day"
                    aria-label="Previous day"
                    (click)="shiftSelectedDay(-1)">
              <span class="material-symbols-outlined text-[20px] leading-none">chevron_left</span>
            </button>
            <label class="inline-flex items-center gap-1.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider px-1">
              <span class="hidden sm:inline">Day</span>
              <input type="date" [ngModel]="selectedDay()" (ngModelChange)="selectedDay.set($event)"
                     class="text-xs font-medium border border-slate-200 dark:border-[#3c3c3c] rounded-md px-2 py-1 bg-white dark:bg-[#1e1e1e] text-slate-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-primary/20">
            </label>
            <button type="button"
                    class="p-1.5 rounded-md text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-[#2a2d2e] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
                    title="Next day"
                    aria-label="Next day"
                    (click)="shiftSelectedDay(1)">
              <span class="material-symbols-outlined text-[20px] leading-none">chevron_right</span>
            </button>
          </div>
          <button type="button"
                  class="text-2xs font-bold uppercase tracking-wide px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#3c3c3c] text-slate-700 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors"
                  (click)="goToday()">Today</button>
        }

        @if (searchFilter() || selectedStatuses().length || selectedPriorities().length || selectedProjects().length || startDateFilter() || endDateFilter()) {
          <button type="button" (click)="clearFilters()" class="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 flex items-center gap-1 transition-colors border border-transparent hover:border-slate-200 rounded focus:outline-none">
            <span class="material-symbols-outlined text-[14px]">clear_all</span>
            Clear
          </button>
        }

        <div class="flex-1"></div>

        <button type="button" (click)="ws.loadAll()" class="flex items-center text-slate-400 hover:text-primary transition-colors focus:outline-none px-1" title="Refresh tasks">
          <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="ws.loading()">refresh</span>
        </button>

        <div class="inline-flex rounded-lg border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] p-0.5 shadow-sm">
          <button type="button"
                  class="px-3 py-1.5 rounded-md text-2xs font-bold uppercase tracking-wide transition-colors"
                  [class]="viewMode() === 'day' ? 'bg-primary text-white dark:bg-[#3e3e42] dark:text-neutral-100 shadow-sm' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-[#2a2d2e]'"
                  (click)="setView('day')">
            Day
          </button>
          <button type="button"
                  class="px-3 py-1.5 rounded-md text-2xs font-bold uppercase tracking-wide transition-colors"
                  [class]="viewMode() === 'list' ? 'bg-primary text-white dark:bg-[#3e3e42] dark:text-neutral-100 shadow-sm' : 'text-slate-600 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-[#2a2d2e]'"
                  (click)="setView('list')">
            List
          </button>
        </div>

        <button type="button"
                class="inline-flex items-center gap-1.5 bg-primary dark:bg-[#3e3e42] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 dark:hover:bg-[#4a4a4a] shadow-sm"
                (click)="openTaskModal(null)">
          <span class="material-symbols-outlined text-[16px]">add</span>
          New task
        </button>
      </div>

      @if (viewMode() === 'day') {
        <div class="rounded-xl border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] shadow-sm overflow-hidden flex flex-col min-h-[min(55vh,640px)] max-h-[min(92vh,1240px)]">
          <div class="px-3 py-2 border-b border-slate-100 dark:border-[#3c3c3c] flex items-center justify-between gap-2 bg-slate-50/80 dark:bg-[#1e1e1e]">
            <div class="flex items-center gap-1 min-w-0">
              <button type="button"
                      class="p-1 rounded-md text-slate-500 dark:text-neutral-400 hover:bg-slate-200/80 dark:hover:bg-[#2a2d2e] hover:text-slate-800 dark:hover:text-neutral-100 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/25"
                      title="Previous day"
                      aria-label="Previous day"
                      (click)="shiftSelectedDay(-1)">
                <span class="material-symbols-outlined text-[20px] leading-none">chevron_left</span>
              </button>
              <span class="material-symbols-outlined text-[18px] text-slate-500 dark:text-neutral-500 shrink-0">schedule</span>
              <span class="text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate min-w-0">{{ prettyDayLabel() }}</span>
              <button type="button"
                      class="p-1 rounded-md text-slate-500 dark:text-neutral-400 hover:bg-slate-200/80 dark:hover:bg-[#2a2d2e] hover:text-slate-800 dark:hover:text-neutral-100 transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/25"
                      title="Next day"
                      aria-label="Next day"
                      (click)="shiftSelectedDay(1)">
                <span class="material-symbols-outlined text-[20px] leading-none">chevron_right</span>
              </button>
            </div>
            <span class="text-2xs text-slate-400 dark:text-neutral-500 tabular-nums">
              {{ dayChartEntries().length }} blocks · {{ chartDoneCount() }} done
            </span>
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
              @for (b of layoutDayChart(); track b.trackId) {
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
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary dark:hover:text-neutral-200" title="View"
                              (click)="viewTask(b.task)">
                        <span class="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
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
        <div class="bg-white dark:bg-[#252526] rounded-xl border border-slate-100 dark:border-[#3c3c3c] shadow-sm overflow-hidden flex flex-col">
          <table class="w-full text-xs">
            <thead>
              <tr class="bg-slate-50/90 dark:bg-[#1e1e1e] border-b border-slate-100 dark:border-[#3c3c3c]">
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">Task</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden sm:table-cell">Project</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">Status</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden md:table-cell">Priority</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Type</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Date</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Time</th>
                <th class="text-center px-2 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell w-10" title="Include in timesheet">TS</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Hours (S/E)</th>
                <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider hidden lg:table-cell">Remarks</th>
                <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (t of paginatedTasks(); track t.id) {
                <tr class="border-b border-slate-50 dark:border-[#2d2d2d] hover:bg-slate-50/60 dark:hover:bg-[#2a2d2e]/60 transition-colors">
                  <td class="px-3 py-2.5">
                    <div class="flex items-center gap-2">
                      <p class="font-semibold text-slate-800 dark:text-neutral-100 truncate max-w-[150px]">{{ t.title }}</p>
                      @if (t.artifacts.length) {
                        <span class="material-symbols-outlined text-[14px] text-slate-400" title="Has attachments">attach_file</span>
                      }
                      @if (t.scheduleCount > 1) {
                        <span class="material-symbols-outlined text-[14px] text-slate-400" title="Multiple schedules">event_repeat</span>
                      }
                    </div>
                    <p class="text-2xs text-slate-400 font-mono">{{ t.taskId }}</p>
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
                  <td class="px-3 py-2.5 hidden lg:table-cell">
                    <span class="text-2xs text-slate-600 dark:text-neutral-400">{{ t.typeLabel }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-2xs text-slate-500 dark:text-neutral-400 hidden lg:table-cell">
                    <div>{{ t.taskDate | date:'MMM d, y' }}</div>
                    @if (t.scheduleCount > 1) {
                      <div class="text-[10px] text-slate-400 dark:text-neutral-500 mt-0.5">{{ formatTaskDateRange(t) }}</div>
                    }
                  </td>
                  <td class="px-3 py-2.5 text-2xs font-medium text-slate-700 dark:text-neutral-300 hidden lg:table-cell">{{ t.startTime }} - {{ t.endTime }}</td>
                  <td class="px-2 py-2.5 text-center hidden lg:table-cell" [title]="t.includeInTimesheet ? 'Included in timesheet' : 'Not in timesheet'">
                    @if (t.includeInTimesheet) {
                      <span class="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                    } @else {
                      <span class="material-symbols-outlined text-[16px] text-slate-300 dark:text-neutral-600">do_not_disturb_on</span>
                    }
                  </td>
                  <td class="px-3 py-2.5 text-2xs font-semibold text-slate-700 dark:text-neutral-300 hidden lg:table-cell">{{ t.spent_hours || 0 }} / {{ t.estimated_hours || 0 }}h</td>
                  <td class="px-3 py-2.5 text-2xs text-slate-600 dark:text-neutral-400 hidden lg:table-cell max-w-[140px]">
                    @if (remarksCellText(t)) {
                      <p class="line-clamp-2 break-words" [title]="remarksCellText(t)">{{ remarksCellText(t) }}</p>
                    } @else {
                      <span class="text-slate-400 dark:text-neutral-600">—</span>
                    }
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex justify-end gap-0.5">
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary dark:hover:text-neutral-200 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2a2d2e]" title="View"
                              (click)="viewTask(t)">
                        <span class="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
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
                <tr><td colspan="11" class="px-3 py-12 text-center text-slate-400 dark:text-neutral-500 text-xs">No tasks match your filters.</td></tr>
              }
            </tbody>
          </table>

          <!-- Pagination controls -->
          @if (filteredTasks().length > 0) {
            <div class="flex items-center justify-between px-3 py-2 border-t border-slate-100 dark:border-[#3c3c3c] bg-slate-50/50 dark:bg-[#1e1e1e]">
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-1.5">
                  <span class="text-2xs text-slate-400 dark:text-neutral-500">Show</span>
                  <select [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)"
                          class="text-xs border border-slate-200 dark:border-[#3c3c3c] rounded px-1.5 py-0.5 bg-white dark:bg-[#252526] text-slate-700 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-primary/25 focus:border-primary">
                    <option [value]="5">5</option>
                    <option [value]="10">10</option>
                    <option [value]="25">25</option>
                    <option [value]="50">50</option>
                    <option [value]="100">100</option>
                  </select>
                </div>
                <p class="text-2xs text-slate-400 dark:text-neutral-500">
                  Showing {{ startIndex() + 1 }} to {{ endIndex() }} of {{ filteredTasks().length }} entries
                </p>
              </div>
              <div class="flex items-center gap-1">
                <button (click)="prevPage()" [disabled]="currentPage() === 1" 
                        class="px-2 py-1 border border-slate-200 dark:border-[#3c3c3c] rounded text-xs bg-white dark:bg-[#252526] text-slate-600 dark:text-neutral-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors focus:outline-none">
                  Prev
                </button>
                
                @for (p of pages(); track $index) {
                  @if (p === '...') {
                    <span class="px-1 text-xs text-slate-400 dark:text-neutral-500">...</span>
                  } @else {
                    <button (click)="setPage(p)" 
                            [class.bg-primary]="p === currentPage()" 
                            [class.text-white]="p === currentPage()"
                            [class.border-primary]="p === currentPage()"
                            [class.bg-white]="p !== currentPage()"
                            [class.text-slate-600]="p !== currentPage()"
                            [class.border-slate-200]="p !== currentPage()"
                            class="min-w-[28px] px-2 py-1 border rounded text-xs hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors focus:outline-none dark:bg-[#252526] dark:text-neutral-300 dark:border-[#3c3c3c]">
                      {{ p }}
                    </button>
                  }
                }

                <button (click)="nextPage()" [disabled]="currentPage() === totalPages() || totalPages() === 0" 
                        class="px-2 py-1 border border-slate-200 dark:border-[#3c3c3c] rounded text-xs bg-white dark:bg-[#252526] text-slate-600 dark:text-neutral-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-[#2a2d2e] transition-colors focus:outline-none">
                  Next
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <app-drawer-panel
      [open]="taskModalOpen()"
      [title]="editingTask() ? 'Edit task' : 'New task'"
      subtitle="Schedules drive dates on the list and Day chart."
      size="lg"
      [compact]="true"
      (closed)="closeTaskModal()"
      (backdropClose)="closeTaskModal()">
      @if (taskForm) {
        <form [formGroup]="taskForm" class="space-y-2.5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            @if (editingTask(); as et) {
              @if (et.taskDate) {
                <div class="md:col-span-2 rounded-lg border border-primary/40 bg-primary/[0.07] dark:bg-primary/10 px-2.5 py-2 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                  <span class="text-[10px] font-bold text-primary uppercase tracking-wide shrink-0">This row</span>
                  <span class="text-xs font-semibold text-slate-900 dark:text-neutral-100">{{ et.taskDate | date:'EEE MMM d, y' }}</span>
                  <span class="text-[11px] text-slate-600 dark:text-neutral-400 tabular-nums">{{ et.startTime }}–{{ et.endTime }}</span>
                </div>
              }
            }
            <div class="md:col-span-2">
              <label class="block text-[10px] font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Title</label>
              <input formControlName="task_title" type="text" placeholder="What needs to be done?"
                     class="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary">
              @if (taskForm.get('task_title')?.invalid && taskForm.get('task_title')?.touched) {
                <p class="text-red-500 text-[10px] mt-0.5">Title is required</p>
              }
            </div>

            <div>
              <label class="block text-[10px] font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Project</label>
              <select formControlName="project_id_fk"
                      class="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary">
                <option value="">Select…</option>
                @for (p of activeProjects(); track p.id) {
                  <option [value]="p.id">{{ p.name }} — {{ p.status }}</option>
                }
              </select>
              @if (taskForm.get('project_id_fk')?.invalid && (taskForm.get('project_id_fk')?.touched || saveAttempted())) {
                <p class="text-red-500 text-[10px] mt-0.5">Required</p>
              }
            </div>

            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-[10px] font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Type</label>
                <select formControlName="type_id"
                        class="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary">
                  @for (t of masters.taskTypes(); track t.type_id) {
                    <option [value]="t.type_id">{{ t.type_label }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="block text-[10px] font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Priority</label>
                <select formControlName="priority_id"
                        class="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary">
                  @for (pr of masters.priorities(); track pr.priority_id) {
                    <option [value]="pr.priority_id">{{ pr.priority_label }}</option>
                  }
                </select>
              </div>
            </div>

            <div class="md:col-span-2">
              <label class="block text-[10px] font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Description</label>
              <textarea formControlName="task_description" rows="2" placeholder="Optional…"
                        class="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary leading-snug"></textarea>
            </div>

            <div class="md:col-span-2 space-y-2 pt-1.5 border-t border-slate-100 dark:border-[#3c3c3c]">
              <div class="flex items-center justify-between gap-2">
                <label class="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wide">Schedules</label>
                <button type="button" (click)="addSchedule()" class="text-[11px] text-primary font-semibold inline-flex items-center gap-0.5 hover:underline shrink-0">
                  <span class="material-symbols-outlined text-[14px]">add</span> Add
                </button>
              </div>
              @if (taskForm.errors?.['schedulesRequired'] && taskForm.touched) {
                <p class="text-red-500 text-[10px]">At least one schedule required.</p>
              }
              <div formArrayName="schedules" class="space-y-2">
                @for (sch of schedulesArray.controls; track sch) {
                  <div [formGroupName]="$index"
                       class="p-2 bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-[#3c3c3c] rounded-lg relative transition-shadow"
                       [class.ring-2]="sch.get('task_periodicity_id')?.value && sch.get('task_periodicity_id')?.value === highlightPeriodicityId()"
                       [class.ring-primary]="sch.get('task_periodicity_id')?.value && sch.get('task_periodicity_id')?.value === highlightPeriodicityId()"
                       [class.border-primary]="sch.get('task_periodicity_id')?.value && sch.get('task_periodicity_id')?.value === highlightPeriodicityId()">
                    @if (schedulesArray.length > 1) {
                      <button type="button" (click)="removeSchedule($index)" class="absolute top-1.5 right-1.5 w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center" title="Remove">
                        <span class="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    }
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1.5 pr-7">#{{ $index + 1 }}</p>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">Status</label>
                        <select formControlName="task_status_id"
                                class="w-full px-1.5 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30">
                          @for (s of masters.statuses(); track s.status_id) {
                            <option [value]="s.status_id">{{ s.status_label }}</option>
                          }
                        </select>
                      </div>
                      <div class="rounded-md p-1 -m-px transition-shadow"
                           [ngClass]="{ 'ring-2 ring-primary bg-primary/10 dark:bg-primary/15': scheduleFormHighlighted(sch) }">
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">Date</label>
                        <input formControlName="task_date" type="date"
                               class="w-full px-1 py-0.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30">
                        @if (sch.get('task_date')?.invalid && sch.get('task_date')?.touched) {
                          <p class="text-red-500 text-[9px] mt-0.5">Required</p>
                        }
                      </div>
                      <div class="rounded-md p-1 -m-px transition-shadow"
                           [ngClass]="{ 'ring-2 ring-primary bg-primary/10 dark:bg-primary/15': scheduleFormHighlighted(sch) }">
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">Start</label>
                        <input formControlName="task_start_time" type="time"
                               [class.border-red-400]="sch.errors?.['timeRangeInvalid'] && sch.touched"
                               class="w-full px-1 py-0.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30">
                      </div>
                      <div class="rounded-md p-1 -m-px transition-shadow"
                           [ngClass]="{ 'ring-2 ring-primary bg-primary/10 dark:bg-primary/15': scheduleFormHighlighted(sch) }">
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">End</label>
                        <input formControlName="task_end_time" type="time"
                               [class.border-red-400]="sch.errors?.['timeRangeInvalid'] && sch.touched"
                               class="w-full px-1 py-0.5 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30">
                        @if (sch.errors?.['timeRangeInvalid'] && sch.touched) {
                          <p class="text-red-500 text-[9px] mt-0.5">End after start</p>
                        }
                      </div>
                      <div class="col-span-2 md:col-span-2">
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">Est. h</label>
                        <input formControlName="estimated_hours" type="number" step="0.5"
                               class="w-full px-1.5 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30">
                      </div>
                      <div class="col-span-2 md:col-span-2">
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">Spent h</label>
                        <input formControlName="spent_hours" type="number" step="0.5"
                               class="w-full px-1.5 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30">
                      </div>
                      <div class="col-span-2 md:col-span-4">
                        <label class="block text-[10px] font-medium text-slate-500 dark:text-neutral-500 mb-0.5">Remarks</label>
                        <textarea formControlName="task_remarks" rows="2" placeholder="Per occurrence…"
                                  class="w-full px-2 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:outline-none focus:ring-1 focus:ring-primary/30 leading-snug"></textarea>
                        @if (sch.get('task_remarks')?.invalid && sch.get('task_remarks')?.touched) {
                          <p class="text-red-500 text-[9px] mt-0.5">Required</p>
                        }
                      </div>
                      <div class="col-span-2 md:col-span-4 flex items-center">
                        <label class="inline-flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-700 dark:text-neutral-300">
                          <input type="checkbox" formControlName="is_include_in_timesheet"
                                 class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/25 shrink-0">
                          <span>Include in timesheet</span>
                        </label>
                      </div>
                    </div>
                  </div>
                } @empty {
                  <p class="text-[10px] text-center text-slate-400 py-2 border border-dashed border-slate-200 dark:border-[#3c3c3c] rounded-md italic">No schedules — Add</p>
                }
              </div>
            </div>

            <div class="md:col-span-2">
              <label class="block text-[10px] font-semibold text-slate-500 dark:text-neutral-500 uppercase tracking-wide mb-0.5">Assignees</label>
              <div class="grid grid-cols-2 sm:grid-cols-4 gap-1 p-2 border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-slate-50 dark:bg-[#1e1e1e] max-h-[120px] overflow-y-auto">
                @for (u of masters.users(); track u.user_id) {
                  <label class="flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-white dark:hover:bg-[#2d2d2d] cursor-pointer">
                    <input type="checkbox"
                           [checked]="selectedAssigneeIds().includes(u.user_id)"
                           (change)="toggleAssignee(u.user_id)"
                           class="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/20 shrink-0">
                    <span class="text-[11px] text-slate-700 dark:text-slate-300 truncate">{{ u.display_name }}</span>
                  </label>
                }
              </div>
              @if (taskForm.touched && selectedAssigneeIds().length === 0) {
                <p class="text-[10px] text-red-500 mt-0.5">Select at least one assignee</p>
              }
            </div>

          </div>

          <!-- Task Artifacts (Add/Edit) -->
          <div class="space-y-2 pt-2 border-t border-slate-100 dark:border-[#3c3c3c]">
            <div class="flex items-center justify-between gap-2">
              <label class="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wide">References</label>
              <button type="button" (click)="addArtifact()" class="text-[11px] text-primary font-semibold inline-flex items-center gap-0.5 hover:underline">
                <span class="material-symbols-outlined text-[14px]">add</span> Add
              </button>
            </div>

            <div formArrayName="artifacts" class="space-y-2">
              @for (art of artifactsArray.controls; track art) {
                <div [formGroupName]="$index" class="p-2 bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-[#3c3c3c] rounded-lg relative pr-7">
                  <button type="button" (click)="removeArtifact($index)" class="absolute top-1.5 right-1.5 w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center">
                    <span class="material-symbols-outlined text-[16px]">close</span>
                  </button>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div>
                      <input formControlName="artifact_title" type="text" placeholder="Title"
                             class="w-full px-2 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] focus:ring-1 focus:ring-primary/30">
                      @if (art.get('artifact_title')?.invalid && art.get('artifact_title')?.touched) {
                        <p class="text-red-500 text-[9px] mt-0.5">Required</p>
                      }
                    </div>
                    <div>
                      <select formControlName="artifact_type" class="w-full px-2 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526]">
                        <option value="url">URL</option>
                        <option value="credential">Credential</option>
                        <option value="documentation">Docs</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div class="md:col-span-2">
                      <input formControlName="artifact_value" type="text" [placeholder]="art.get('artifact_type')?.value === 'url' ? 'https://…' : 'Value'"
                             class="w-full px-2 py-1 text-xs border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] font-mono">
                      @if (art.get('artifact_value')?.invalid && art.get('artifact_value')?.touched) {
                        <p class="text-red-500 text-[9px] mt-0.5">Required</p>
                      }
                    </div>
                    <div class="md:col-span-2">
                      <label class="inline-flex items-center gap-1.5 cursor-pointer">
                        <input formControlName="is_sensitive" type="checkbox" class="w-3 h-3 rounded border-slate-300 text-primary">
                        <span class="text-[10px] font-semibold text-slate-500 uppercase">Sensitive</span>
                      </label>
                    </div>
                  </div>
                </div>
              } @empty {
                <p class="text-[10px] text-center text-slate-400 py-2 border border-dashed border-slate-200 dark:border-[#3c3c3c] rounded-md italic">No references</p>
              }
            </div>
          </div>
        </form>
      }
      <div drawerFooter>
        <button type="button" class="px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-neutral-300 border border-slate-200 dark:border-[#3c3c3c] rounded-md bg-white dark:bg-[#252526] hover:bg-slate-50 dark:hover:bg-[#2a2d2e]"
                (click)="closeTaskModal()">Cancel</button>
        <button type="button" class="px-2.5 py-1.5 text-xs font-semibold bg-primary dark:bg-[#3e3e42] text-white rounded-md hover:bg-primary/90 dark:hover:bg-[#4a4a4a]"
                (click)="saveTask()">{{ editingTask() ? 'Save' : 'Create' }}</button>
      </div>
    </app-drawer-panel>

    <app-drawer-panel
      [open]="!!viewingTask()"
      [title]="'Task details'"
      subtitle="Read-only; Edit to change."
      size="lg"
      [compact]="true"
      (closed)="viewingTask.set(null)"
      (backdropClose)="viewingTask.set(null)">
      @if (viewingTask(); as t) {
        <div class="space-y-2.5">
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 dark:border-zinc-800 pb-2">
            <h3 class="text-sm font-bold text-slate-900 dark:text-neutral-100 leading-snug min-w-0 flex-1">{{ t.title }}</h3>
            <p class="text-[10px] text-slate-400 font-mono shrink-0">{{ t.taskId }}</p>
          </div>

          @if (t.taskDate) {
            <div class="rounded-lg border border-primary/40 bg-primary/[0.06] dark:bg-primary/10 px-2.5 py-2 space-y-1">
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span class="text-[10px] font-bold text-primary uppercase tracking-wide">This row</span>
                <span class="text-xs font-bold text-slate-900 dark:text-neutral-100">{{ t.taskDate | date:'EEE MMM d, y' }}</span>
                <span class="text-[11px] text-slate-600 dark:text-neutral-300 tabular-nums">{{ t.startTime }}–{{ t.endTime }}</span>
                <span class="px-1.5 py-0 rounded text-[10px] font-semibold" [class]="statusClass(t.status)">{{ t.status }}</span>
              </div>
              @if (remarksCellText(t)) {
                <p class="text-[11px] text-slate-600 dark:text-neutral-400 border-t border-primary/15 pt-1.5 mt-1 whitespace-pre-wrap leading-snug">{{ t.task_remarks }}</p>
              }
            </div>
          }

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-xs">
            <div>
              <p class="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Project</p>
              <p class="font-semibold text-slate-800 dark:text-neutral-200 truncate" [title]="ws.projectName(t.projectId)">{{ ws.projectName(t.projectId) }}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Type</p>
              <p class="font-semibold text-slate-800 dark:text-neutral-200">{{ t.typeLabel }}</p>
            </div>
            <div>
              <p class="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">Priority</p>
              <span class="inline-block px-1.5 py-0 rounded text-[10px] font-semibold mt-0.5" [class]="priorityClass(t.priority)">{{ t.priority }}</span>
            </div>
            @if (t.scheduleCount > 1 && (t.startDate || t.endDate)) {
              <div class="col-span-2 sm:col-span-4">
                <p class="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wide">All schedules (range)</p>
                <p class="font-medium text-slate-700 dark:text-neutral-300">{{ t.startDate | date:'MMM d, y' }} → {{ t.endDate | date:'MMM d, y' }}</p>
              </div>
            }
          </div>

          <div>
            <p class="text-[9px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wide mb-1">Schedules</p>
            <div class="rounded-lg border border-slate-200 dark:border-[#3c3c3c] overflow-hidden divide-y divide-slate-100 dark:divide-zinc-800 bg-slate-50/50 dark:bg-white/[0.02]">
              @for (sch of t.schedules; track sch.task_periodicity_id || $index) {
                <div class="grid grid-cols-12 gap-x-1.5 gap-y-1 px-2 py-1.5 text-[11px] sm:text-xs items-start"
                     [ngClass]="{ 'bg-primary/[0.07] dark:bg-primary/10': isHighlightedSchedule(t, sch) }">
                  <div class="col-span-12 sm:col-span-3 min-w-0">
                    <p class="font-mono text-[9px] text-slate-400 truncate">{{ sch.task_periodicity_id || '—' }}</p>
                    <span class="inline-block mt-0.5 px-1 py-0 rounded text-[10px] font-semibold" [class]="statusClass(sch.status_label || t.status)">{{ sch.status_label || t.status }}</span>
                  </div>
                  <div class="col-span-4 sm:col-span-2">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Date</p>
                    <p class="font-medium text-slate-800 dark:text-neutral-200"
                       [ngClass]="{ 'ring-1 ring-primary rounded px-0.5 -mx-0.5': isHighlightedSchedule(t, sch) }">{{ sch.task_date | date:'MMM d' }}</p>
                  </div>
                  <div class="col-span-4 sm:col-span-2 tabular-nums">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">Time</p>
                    <p class="font-medium text-slate-800 dark:text-neutral-200"
                       [ngClass]="{ 'ring-1 ring-primary rounded px-0.5 -mx-0.5': isHighlightedSchedule(t, sch) }">{{ sch.task_start_time }}–{{ sch.task_end_time }}</p>
                  </div>
                  <div class="col-span-4 sm:col-span-1">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">H</p>
                    <p class="font-medium text-slate-700 dark:text-neutral-300">{{ sch.spent_hours ?? 0 }}/{{ sch.estimated_hours ?? 0 }}</p>
                  </div>
                  <div class="col-span-4 sm:col-span-1 text-center sm:text-left">
                    <p class="text-[9px] font-bold text-slate-400 uppercase">TS</p>
                    @if (sch.is_include_in_timesheet !== false) {
                      <span class="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400 align-middle" title="In timesheet">check_circle</span>
                    } @else {
                      <span class="material-symbols-outlined text-[14px] text-slate-300 dark:text-neutral-600 align-middle" title="Not in timesheet">do_not_disturb_on</span>
                    }
                  </div>
                  <div class="col-span-12 sm:col-span-3 min-w-0">
                    @if (sch.task_remarks) {
                      <p class="text-[9px] font-bold text-slate-400 uppercase">Remarks</p>
                      <p class="text-slate-600 dark:text-neutral-400 line-clamp-3 leading-snug break-words">{{ sch.task_remarks }}</p>
                    }
                  </div>
                </div>
              } @empty {
                <p class="text-[11px] text-slate-500 px-2 py-2">No schedules.</p>
              }
            </div>
          </div>

          @if (t.description) {
            <div>
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Description</p>
              <div class="max-h-36 overflow-y-auto rounded-md border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#1a1a1a] px-2 py-1.5">
                <p class="text-[11px] text-slate-600 dark:text-neutral-300 whitespace-pre-wrap leading-snug break-words">{{ t.description }}</p>
              </div>
            </div>
          }

          <div>
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Assignees</p>
            @if (t.assigneeIds.length) {
              <div class="flex flex-wrap gap-1">
                @for (uid of t.assigneeIds; track uid) {
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] text-[11px]">
                    <span class="w-4 h-4 rounded-full bg-primary/15 text-[9px] font-bold text-primary flex items-center justify-center shrink-0">{{ assigneeInitials(uid) }}</span>
                    <span class="text-slate-700 dark:text-neutral-300 truncate max-w-[140px]">{{ assigneeName(uid) }}</span>
                  </span>
                }
              </div>
            } @else if ((t.assignee || '').trim()) {
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] text-[11px]">
                <span class="w-4 h-4 rounded-full bg-primary/15 text-[9px] font-bold text-primary flex items-center justify-center">{{ initials(t.assignee) }}</span>
                <span class="text-slate-700 dark:text-neutral-300">{{ t.assignee }}</span>
              </span>
            } @else {
              <span class="text-[11px] text-slate-500">—</span>
            }
          </div>

          @if (t.artifacts && t.artifacts.length) {
            <div class="pt-1.5 border-t border-slate-100 dark:border-zinc-800">
              <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">References</p>
              <div class="space-y-1.5">
                @for (a of t.artifacts; track $index) {
                  <div class="rounded-md border border-slate-200 dark:border-[#3c3c3c] bg-white dark:bg-[#252526] px-2 py-1.5 hover:border-primary/40 transition-colors">
                    <div class="flex items-start justify-between gap-2 mb-0.5">
                      <div class="flex items-center gap-1 min-w-0">
                        <span class="material-symbols-outlined text-[14px] text-primary/60 shrink-0">
                          {{ a.artifact_type === 'url' ? 'link' : a.artifact_type === 'credential' ? 'key' : 'description' }}
                        </span>
                        <span class="text-xs font-bold text-slate-800 dark:text-neutral-200 truncate">{{ a.artifact_title }}</span>
                      </div>
                      @if (a.is_sensitive === true || a.is_sensitive === 'true') {
                        <span class="material-symbols-outlined text-[12px] text-amber-600 dark:text-amber-400 shrink-0" title="Sensitive">lock</span>
                      }
                    </div>
                    <div class="rounded bg-slate-50 dark:bg-black/25 px-1.5 py-1 font-mono text-[10px] break-all border border-slate-100 dark:border-[#3c3c3c]">
                      @if (a.is_sensitive === true || a.is_sensitive === 'true') {
                        <div class="flex items-center justify-between gap-1">
                          <span class="text-slate-400 italic text-[10px]">Hidden</span>
                          <button type="button" (click)="copyToClipboard(a.artifact_value)" class="text-primary text-[10px] font-semibold hover:underline">Copy</button>
                        </div>
                      } @else {
                        <a *ngIf="a.artifact_type === 'url'" [href]="a.artifact_value" target="_blank" class="text-primary hover:underline">{{ a.artifact_value }}</a>
                        <span *ngIf="a.artifact_type !== 'url'" class="text-slate-700 dark:text-neutral-300">{{ a.artifact_value }}</span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <div class="pt-1.5 border-t border-slate-100 dark:border-zinc-800">
            <p class="text-[9px] font-bold text-slate-400 uppercase tracking-wide mb-1">Audit</p>
            <div class="grid grid-cols-2 gap-1.5">
              <div class="rounded-md border border-slate-200 dark:border-[#3c3c3c] bg-slate-50/80 dark:bg-white/[0.03] px-2 py-1">
                <p class="text-[9px] font-bold text-slate-400 uppercase">Created</p>
                <p class="text-[10px] text-slate-700 dark:text-neutral-300 font-medium leading-tight">{{ t.created_by || '—' }}</p>
                <p class="text-[10px] text-slate-500 dark:text-neutral-500">{{ t.created_on ? (t.created_on | date:'MMM d, yy HH:mm') : '—' }}</p>
              </div>
              <div class="rounded-md border border-slate-200 dark:border-[#3c3c3c] bg-slate-50/80 dark:bg-white/[0.03] px-2 py-1">
                <p class="text-[9px] font-bold text-slate-400 uppercase">Modified</p>
                <p class="text-[10px] text-slate-700 dark:text-neutral-300 font-medium leading-tight">{{ t.last_modified_by || '—' }}</p>
                <p class="text-[10px] text-slate-500 dark:text-neutral-500">{{ t.last_modified_on ? (t.last_modified_on | date:'MMM d, yy HH:mm') : '—' }}</p>
              </div>
            </div>
          </div>
        </div>
      }
      <div drawerFooter>
        <button type="button" class="w-full px-2.5 py-1.5 text-xs font-semibold bg-slate-100 dark:bg-[#3c3c3c] text-slate-700 dark:text-neutral-200 rounded-md hover:bg-slate-200 dark:hover:bg-[#4a4a4a] transition-colors"
                (click)="viewingTask.set(null)">Close</button>
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
  searchFilter = signal('');
  selectedStatuses = signal<string[]>([]);
  selectedPriorities = signal<string[]>([]);
  selectedProjects = signal<string[]>([]);
  openDropdown = signal<string | null>(null);
  startDateFilter = signal('');
  endDateFilter = signal('');
  pageSize = signal(10);
  currentPage = signal(1);
  
  activeTab = signal('All');
  urlProjectScope = signal('');
  viewMode = signal<'day' | 'list'>('day');
  selectedDay = signal(this.todayYmd());
  
  statusTabs = computed(() => {
    return ['All', ...this.masters.statuses().map(s => s.status_label || s.status_name)];
  });

  activeProjects = computed(() => {
    const statuses = this.masters.statuses();
    if (!statuses.length) return this.ws.projects();
    const maxOrder = Math.max(...statuses.map(s => s.sort_order || 0));
    const maxStatus = statuses.find(s => (s.sort_order || 0) === maxOrder);
    if (!maxStatus) return this.ws.projects();
    const maxLabel = maxStatus.status_label || maxStatus.status_name;
    return this.ws.projects().filter(p => p.status !== maxLabel);
  });

  summaryStats = computed(() => {
    const all = this.tasksInScope();
    const stats = [{ label: 'Total', value: all.length }];
    
    for (const st of this.masters.statuses()) {
      const label = st.status_label || st.status_name;
      stats.push({
        label,
        value: all.filter(t => t.status === label).length
      });
    }
    return stats;
  });

  filteredTasks = computed(() => {
    return this.tasksInScope().filter(t => {
      // Tab filter
      if (this.activeTab() !== 'All' && t.status !== this.activeTab()) return false;
      
      // Multi-select status
      if (this.selectedStatuses().length > 0 && !this.selectedStatuses().includes(t.status)) return false;
      
      // Multi-select priority
      if (this.selectedPriorities().length > 0 && !this.selectedPriorities().includes(t.priority)) return false;
      
      // Multi-select project (if not scoped from URL)
      if (this.selectedProjects().length > 0 && !this.selectedProjects().includes(t.projectId)) return false;

      // Date range (match if any schedule date falls in range)
      if (this.startDateFilter() || this.endDateFilter()) {
        const dates = (t.schedules?.length ? t.schedules.map(s => s.task_date).filter(Boolean) : [t.taskDate]).filter(Boolean) as string[];
        if (!dates.length) return false;
        const inRange = dates.some(d => {
          if (this.startDateFilter() && d < this.startDateFilter()) return false;
          if (this.endDateFilter() && d > this.endDateFilter()) return false;
          return true;
        });
        if (!inRange) return false;
      }

      // Search
      const s = this.searchFilter().toLowerCase();
      if (s && !t.title.toLowerCase().includes(s) && !t.taskId.toLowerCase().includes(s) && !t.id.toLowerCase().includes(s)) return false;
      return true;
    });
  });

  paginatedTasks = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredTasks().slice(start, start + this.pageSize());
  });

  totalPages = computed(() => Math.ceil(this.filteredTasks().length / this.pageSize()));
  startIndex = computed(() => (this.currentPage() - 1) * this.pageSize());
  endIndex = computed(() => Math.min(this.startIndex() + this.pageSize(), this.filteredTasks().length));

  pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const res: (number | string)[] = [1];
    if (current > 4) res.push('...');
    const start = Math.max(2, current - 2);
    const end = Math.min(total - 1, current + 2);
    for (let i = start; i <= end; i++) res.push(i);
    if (current < total - 3) res.push('...');
    res.push(total);
    return res;
  });

  /** One block per list row; each row is already scoped to one schedule's date/time from the API */
  readonly dayChartEntries = computed(() => {
    const day = this.selectedDay();
    const q = this.searchFilter().toLowerCase();
    this.ws.tasks();
    this.masters.statuses();
    const out: { display: TmTaskRow; trackId: string }[] = [];
    for (const t of this.tasksInScope()) {
      if ((t.dueDate || '') !== day) continue;
      if (q && !t.title.toLowerCase().includes(q) && !t.taskId.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) continue;
      out.push({ display: t, trackId: t.id });
    }
    return out;
  });

  /** 0–23 → full 24h; row height keeps chart scrollable inside the panel */
  readonly hourLabels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  readonly hourSlotPx = 42;

  taskModalOpen = signal(false);
  editingTask = signal<TmTaskRow | null>(null);
  viewingTask = signal<TmTaskRow | null>(null);
  deleteTarget = signal<TmTaskRow | null>(null);

  selectedAssigneeIds = signal<string[]>([]);
  saveAttempted = signal(false);
  /** Schedule row to ring-highlight when opening edit from a list row */
  highlightPeriodicityId = signal<string | null>(null);

  taskForm = this.fb.group({
    task_title: ['', Validators.required],
    project_id_fk: ['', Validators.required],
    priority_id: ['', Validators.required],
    type_id: ['T001', Validators.required],
    task_description: [''],
    schedules: this.fb.array([]),
    artifacts: this.fb.array([])
  }, { validators: atLeastOneScheduleValidator });

  private sub?: Subscription;

  constructor(
    public ws: TaskWorkspaceService,
    public masters: MastersService,
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit() {
    this.masters.reload();
    this.ws.loadAll();

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
      this.urlProjectScope.set(valid ? p : '');
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

  /** Move the day view by ±1 calendar day (local). */
  shiftSelectedDay(deltaDays: number): void {
    const raw = (this.selectedDay() || this.todayYmd()).trim();
    const parts = raw.split('-').map(Number);
    if (parts.length < 3 || parts.some(n => !Number.isFinite(n))) {
      this.selectedDay.set(this.todayYmd());
      return;
    }
    const [y, m, d] = parts;
    const dt = new Date(y!, m! - 1, d!);
    dt.setDate(dt.getDate() + deltaDays);
    const ny = dt.getFullYear();
    const nm = String(dt.getMonth() + 1).padStart(2, '0');
    const nd = String(dt.getDate()).padStart(2, '0');
    this.selectedDay.set(`${ny}-${nm}-${nd}`);
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

  formatTaskDateRange(task: TmTaskRow): string {
    if (!task.startDate && !task.endDate) return '';
    if (!task.startDate) return this.formatDateShort(task.endDate);
    if (!task.endDate) return this.formatDateShort(task.startDate);
    return `${this.formatDateShort(task.startDate)} - ${this.formatDateShort(task.endDate)}`;
  }

  remarksCellText(t: TmTaskRow): string {
    return (t.task_remarks || '').trim();
  }

  scheduleFormHighlighted(sch: AbstractControl): boolean {
    const hid = this.highlightPeriodicityId();
    if (!hid) return false;
    return sch.get('task_periodicity_id')?.value === hid;
  }

  isHighlightedSchedule(t: TmTaskRow, sch: TaskSchedule): boolean {
    return !!(t.periodicityId && sch.task_periodicity_id && sch.task_periodicity_id === t.periodicityId);
  }

  private formatDateShort(ymd: string): string {
    if (!ymd || ymd.length < 10) return '';
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  timelineCardBorder(priority: string): string {
    const map: Record<string, string> = {
      'Very High': 'border-l-4 border-l-rose-600 dark:border-l-rose-500',
      High: 'border-l-4 border-l-rose-400 dark:border-l-rose-400',
      Medium: 'border-l-4 border-l-amber-500 dark:border-l-amber-400',
      Low: 'border-l-4 border-l-emerald-500 dark:border-l-emerald-500',
    };
    return map[priority] ?? 'border-l-4 border-l-slate-300 dark:border-l-neutral-600';
  }

  scopedProject() {
    const id = this.urlProjectScope();
    if (!id) return null;
    return this.ws.projectById(id) ?? null;
  }

  tasksInScope(): TmTaskRow[] {
    const id = this.urlProjectScope();
    const all = this.ws.tasks();
    return id ? all.filter(t => t.projectId === id) : all;
  }

  clearFilters() {
    this.searchFilter.set('');
    this.selectedStatuses.set([]);
    this.selectedPriorities.set([]);
    this.selectedProjects.set([]);
    this.startDateFilter.set('');
    this.endDateFilter.set('');
    this.activeTab.set('All');
    this.router.navigate([], { relativeTo: this.route, queryParams: { project: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  toggleStatus(val: string) {
    const cur = this.selectedStatuses();
    this.selectedStatuses.set(cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]);
  }

  togglePriority(val: string) {
    const cur = this.selectedPriorities();
    this.selectedPriorities.set(cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]);
  }

  toggleProject(val: string) {
    const cur = this.selectedProjects();
    this.selectedProjects.set(cur.includes(val) ? cur.filter(x => x !== val) : [...cur, val]);
  }

  toggleDropdown(ev: MouseEvent, name: string) {
    ev.stopPropagation();
    this.openDropdown.set(this.openDropdown() === name ? null : name);
  }

  viewTask(t: TmTaskRow) {
    this.viewingTask.set(t);
  }

  get artifactsArray() {
    return this.taskForm.get('artifacts') as FormArray;
  }

  get schedulesArray() {
    return this.taskForm.get('schedules') as FormArray;
  }

  createScheduleGroup(s?: Partial<TaskSchedule>): FormGroup {
    const today = this.todayYmd();
    const firstStatus = this.masters.statuses()[0]?.status_id || '';
    return this.fb.group({
      task_periodicity_id: [s?.task_periodicity_id || ''],
      task_status_id: [s?.task_status_id || firstStatus, Validators.required],
      task_date: [s?.task_date || today, Validators.required],
      task_start_time: [s?.task_start_time || '00:00', Validators.required],
      task_end_time: [s?.task_end_time || '00:30', Validators.required],
      task_remarks: [s?.task_remarks || '', [Validators.required, Validators.pattern(/\S+/)]],
      estimated_hours: [s?.estimated_hours ?? 0, [Validators.required, Validators.min(0)]],
      spent_hours: [s?.spent_hours ?? 0, [Validators.required, Validators.min(0)]],
      is_include_in_timesheet: [this.scheduleIncludeTsDefault(s)],
    }, { validators: dateTimeRangeValidator });
  }

  private scheduleIncludeTsDefault(s?: Partial<TaskSchedule>): boolean {
    const v = s?.is_include_in_timesheet as unknown;
    if (v === false || v === 'false' || v === 'FALSE' || v === 0 || v === '0') return false;
    if (v === true || v === 'true' || v === 'TRUE' || v === 1 || v === '1') return true;
    return true;
  }

  addSchedule() {
    this.schedulesArray.push(this.createScheduleGroup());
  }

  removeSchedule(index: number) {
    if (this.schedulesArray.length <= 1) return;
    this.schedulesArray.removeAt(index);
  }

  addArtifact() {
    this.artifactsArray.push(this.fb.group({
      artifact_title: ['', Validators.required],
      artifact_value: ['', Validators.required],
      artifact_type: ['url', Validators.required],
      description: [''],
      is_sensitive: [false]
    }));
  }

  removeArtifact(index: number) {
    this.artifactsArray.removeAt(index);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    this.toast.success('Copied to clipboard');
  }

  setPageSize(size: any) {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  setPage(p: any) {
    if (typeof p === 'number') this.currentPage.set(p);
  }

  prevPage() {
    if (this.currentPage() > 1) this.currentPage.update(c => c - 1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) this.currentPage.update(c => c + 1);
  }

  chartDoneCount(): number {
    return this.dayChartEntries().filter(e => e.display.status === 'Completed').length;
  }

  layoutDayChart(): DayChartBlock[] {
    const entries = [...this.dayChartEntries()].sort(
      (a, b) => this.scheduleBounds(a.display).start - this.scheduleBounds(b.display).start
    );
    const laneEnds: number[] = [];
    type Placed = { task: TmTaskRow; trackId: string; lane: number; start: number; end: number };
    const placed: Placed[] = [];

    for (const { display: task, trackId } of entries) {
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
      placed.push({ task, trackId, lane, start, end });
    }

    const laneCount = Math.max(1, laneEnds.length);
    const pad = 0.35;
    const cell = 100 / laneCount;

    return placed.map(({ task, trackId, lane, start, end }) => {
      const topPct = ((start - DAY_START_MINS) / DAY_RANGE_MINS) * 100;
      let heightPct = ((end - start) / DAY_RANGE_MINS) * 100;
      heightPct = Math.max(heightPct, 2.8);
      const leftPct = lane * cell + pad;
      const widthPct = cell - 2 * pad;
      return { task, trackId, topPct, heightPct, leftPct, widthPct };
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

  toggleAssignee(userId: string) {
    const current = this.selectedAssigneeIds();
    if (current.includes(userId)) {
      this.selectedAssigneeIds.set(current.filter(id => id !== userId));
    } else {
      this.selectedAssigneeIds.set([...current, userId]);
    }
  }

  initials(name: string): string {
    if (!name) return '??';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  assigneeName(userId: string): string {
    const u = this.masters.users().find(x => x.user_id === userId);
    return u?.display_name || u?.username || userId;
  }

  assigneeInitials(userId: string): string {
    return this.initials(this.assigneeName(userId));
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
    return { 
      'Very High': 'bg-rose-100 text-rose-700 dark:bg-rose-900/35 dark:text-rose-200',
      High: 'bg-red-100 text-red-700 dark:bg-red-900/35 dark:text-red-200', 
      Medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/35 dark:text-amber-200',
      Low: 'bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-200' 
    }[p] ?? 'bg-slate-100 text-slate-500';
  }

  toggleDone(task: TmTaskRow, done: boolean): void {
    const targetLabel = done ? 'Completed' : 'Open';
    const status = this.masters.statuses().find(s => (s.status_label || s.status_name) === targetLabel);
    const sid = status?.status_id ?? (done ? 'S003' : 'S001');
    if (task.periodicityId) {
      this.ws.updateTask(task.taskId, { task_periodicity_id: task.periodicityId, task_status_id: sid });
    } else {
      this.ws.updateTask(task.taskId, { task_status_id: sid });
    }
  }

  openTaskModal(row: TmTaskRow | null) {
    this.saveAttempted.set(false);
    this.highlightPeriodicityId.set(row?.periodicityId ?? null);
    this.editingTask.set(row);
    const defaultProject = this.urlProjectScope() || this.ws.projects()[0]?.id || '';
    const today = this.todayYmd();

    this.schedulesArray.clear();
    this.artifactsArray.clear();

    if (row) {
      this.selectedAssigneeIds.set(row.assigneeIds || []);

      this.taskForm.reset({
        task_title: row.title,
        project_id_fk: row.projectId,
        priority_id: row.priorityId,
        type_id: row.typeId || 'T001',
        task_description: row.description || '',
      });

      const schList = row.schedules?.length ? row.schedules : [];
      if (schList.length) {
        schList.forEach(s => this.schedulesArray.push(this.createScheduleGroup(s)));
      } else {
        this.schedulesArray.push(this.createScheduleGroup({
          task_status_id: row.statusId,
          task_date: row.taskDate || today,
          task_start_time: row.startTime,
          task_end_time: row.endTime,
          task_remarks: row.task_remarks,
          estimated_hours: row.estimated_hours,
          spent_hours: row.spent_hours,
          is_include_in_timesheet: row.includeInTimesheet,
        }));
      }

      if (row.artifacts && row.artifacts.length) {
        row.artifacts.forEach((a: any) => {
          this.artifactsArray.push(this.fb.group({
            artifact_title: [a.artifact_title, Validators.required],
            artifact_value: [a.artifact_value, Validators.required],
            artifact_type: [a.artifact_type || 'url', Validators.required],
            description: [a.description || ''],
            is_sensitive: [a.is_sensitive === true || a.is_sensitive === 'true']
          }));
        });
      }
    } else {
      this.selectedAssigneeIds.set([]);
      const firstPriority = this.masters.priorities()[0]?.priority_id || '';
      this.taskForm.reset({
        task_title: '',
        project_id_fk: defaultProject,
        priority_id: firstPriority,
        type_id: 'T001',
        task_description: '',
      });
      this.addSchedule();
    }
    this.taskModalOpen.set(true);
  }

  closeTaskModal() {
    this.taskModalOpen.set(false);
    this.editingTask.set(null);
    this.saveAttempted.set(false);
    this.highlightPeriodicityId.set(null);
  }

  async saveTask() {
    this.saveAttempted.set(true);
    this.taskForm.markAllAsTouched();
    if (this.taskForm.invalid) {
      console.warn('Form Invalid:', this.getFormErrors());
      this.toast.error('Please fix the errors in the form');
      return;
    }
    
    if (this.selectedAssigneeIds().length === 0) {
      this.toast.error('Please select at least one assignee');
      return;
    }
    
    const v = this.taskForm.getRawValue();
    const cur = this.editingTask();

    const schedulesPayload = ((v.schedules as unknown[]) || []).map((raw: unknown) => {
      const s = raw as Record<string, unknown>;
      const o: Record<string, unknown> = {
        task_status_id: s['task_status_id'],
        task_date: s['task_date'],
        task_start_time: s['task_start_time'],
        task_end_time: s['task_end_time'],
        task_remarks: String(s['task_remarks'] || '').trim(),
        estimated_hours: Number(s['estimated_hours']) || 0,
        spent_hours: Number(s['spent_hours']) || 0,
        is_include_in_timesheet: !!s['is_include_in_timesheet'],
      };
      const pid = s['task_periodicity_id'];
      if (pid) o['task_periodicity_id'] = pid;
      return o;
    });

    try {
      const payload: Record<string, unknown> = {
        task_title: v.task_title,
        project_id_fk: v.project_id_fk,
        type_id: v.type_id,
        priority_id: v.priority_id,
        task_description: v.task_description,
        schedules: schedulesPayload,
        artifacts: v.artifacts,
        task_assignees: this.selectedAssigneeIds().join('|'),
      };

      if (cur) {
        await this.ws.updateTask(cur.taskId, payload);
        this.toast.success('Task updated');
      } else {
        await this.ws.addTask(payload);
        this.toast.success('Task created');
      }
      this.closeTaskModal();
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to save task');
    }
  }

  private getFormErrors() {
    const errors: any = {};
    Object.keys(this.taskForm.controls).forEach(key => {
      const controlErrors = this.taskForm.get(key)?.errors;
      if (controlErrors) errors[key] = controlErrors;
    });
    return errors;
  }

  async confirmDeleteTask() {
    const t = this.deleteTarget();
    if (!t) return;
    
    try {
      await this.ws.deleteTask(t.taskId);
      this.toast.success('Task deleted');
    } catch (err: any) {
      this.toast.error(err.message || 'Failed to delete task');
    } finally {
      this.deleteTarget.set(null);
    }
  }
}
