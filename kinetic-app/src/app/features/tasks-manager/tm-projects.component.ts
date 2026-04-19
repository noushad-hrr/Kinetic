import { Component, computed, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators, FormArray } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { Project, ProjectArtifact } from '../../models';
import { MastersService } from '../../services/masters.service';
import { ToastService } from '../../services/toast.service';
import { DrawerPanelComponent } from '../../shared/components/ui/drawer-panel.component';
import { ConfirmDialogComponent } from '../../shared/components/ui/confirm-dialog.component';

@Component({
  selector: 'app-tm-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DrawerPanelComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 max-w-7xl mx-auto space-y-4">

      <!-- FIRST LINE: summary stats -->
      <div class="flex flex-wrap items-center gap-2">
        @for (s of summaryStats(); track s.label) {
          <div class="flex items-center gap-1.5 bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
            <span class="font-bold text-slate-900 tabular-nums">{{ s.value }}</span>
            <span class="text-[11px] text-slate-500">{{ s.label }}</span>
          </div>
        }
      </div>

      <!-- SECOND LINE: Filters & Actions -->
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex-1 min-w-[200px] max-w-xs">
          <span class="absolute left-2.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-slate-400">search</span>
          <input [ngModel]="search()" (ngModelChange)="setSearch($event)" type="text" placeholder="Search projects…"
                 class="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
        </div>
        <select [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)"
                class="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
          <option value="">All statuses</option>
          @for (st of masters.statuses(); track st.status_id) {
            <option [value]="st.status_label || st.status_name">{{ st.status_label || st.status_name }}</option>
          }
        </select>
        
        <div class="flex items-center gap-1">
          <input type="date" [ngModel]="startDateFilter()" (ngModelChange)="setStartDateFilter($event)"
                 class="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" title="Start date">
          <span class="text-xs text-slate-400">to</span>
          <input type="date" [ngModel]="endDateFilter()" (ngModelChange)="setEndDateFilter($event)"
                 class="text-xs border border-slate-200 rounded-lg px-2 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary" title="End date">
        </div>

        @if (search() || statusFilter() || startDateFilter() || endDateFilter()) {
          <button type="button" (click)="clearFilters()" class="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 flex items-center gap-1 transition-colors border border-transparent hover:border-slate-200 rounded focus:outline-none">
            <span class="material-symbols-outlined text-[14px]">clear_all</span>
            Clear
          </button>
        }

        <div class="flex-1"></div>
        
        <button type="button" (click)="fetchProjects()" class="flex items-center text-slate-400 hover:text-primary transition-colors focus:outline-none px-1" title="Refresh projects">
          <span class="material-symbols-outlined text-[18px]" [class.animate-spin]="loading()">refresh</span>
        </button>

        <!-- Info button before New project -->
        <button type="button" (click)="showIntro.set(!showIntro())" class="flex items-center text-slate-400 hover:text-primary transition-colors focus:outline-none px-1" title="Toggle info">
          <span class="material-symbols-outlined text-[18px]">info</span>
        </button>
        
        <button type="button"
                class="inline-flex items-center gap-1.5 bg-primary text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-primary/90 shadow-sm"
                (click)="openProjectModal(null)">
          <span class="material-symbols-outlined text-[16px]">add</span>
          New project
        </button>
      </div>

      <!-- Info helper block underneath the actions -->
      <div *ngIf="showIntro()" class="flex justify-end animate-fade-in -mt-2">
        <div class="bg-blue-50/80 border border-blue-100 rounded px-3 py-2">
          <p class="text-xs text-blue-600">
            Progress and task counts stay in sync when you add or complete tasks. Open <span class="font-medium text-blue-700">Tasks</span> for the selected project.
          </p>
        </div>
      </div>

      <div class="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
        <table class="w-full text-xs">
          <thead>
            <tr class="bg-slate-50/90 border-b border-slate-100">
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Project</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Tasks</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Progress</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Start</th>
              <th class="text-left px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Due</th>
              <th class="text-right px-3 py-2.5 text-2xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="7" class="px-3 py-12 text-center text-slate-400 text-xs">Loading projects...</td></tr>
            } @else {
              @for (p of paginatedProjects(); track p.project_id) {
                <tr class="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                  <td class="px-3 py-2.5">
                    <p class="font-semibold text-slate-800">{{ p.project_name }}</p>
                    <p class="text-2xs text-slate-400 font-mono">{{ p.project_id }}</p>
                  </td>
                  <td class="px-3 py-2.5">
                    <span class="px-2 py-0.5 rounded-md text-2xs font-semibold" [class]="statusClass(p.project_status)">{{ p.project_status }}</span>
                  </td>
                  <td class="px-3 py-2.5 hidden sm:table-cell tabular-nums text-slate-700 font-medium">{{ p.task_done || 0 }}/{{ p.task_total || 0 }}</td>
                  <td class="px-3 py-2.5 hidden md:table-cell">
                    <div class="flex items-center gap-2">
                      <div class="h-1.5 w-20 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-primary rounded-full transition-all" [style.width.%]="progressPct(p)"></div>
                      </div>
                      <span class="text-2xs text-slate-500 tabular-nums">{{ progressPct(p) }}%</span>
                    </div>
                  </td>
                  <td class="px-3 py-2.5 text-slate-500 hidden lg:table-cell">{{ p.project_start_date || '—' }}</td>
                  <td class="px-3 py-2.5 text-slate-500 hidden lg:table-cell">{{ p.project_end_date || '—' }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <div class="flex items-center justify-end gap-0.5 flex-wrap">
                      <a [routerLink]="['/tasks-manager/tasks']" [queryParams]="{ project: p.project_id, view: 'day' }"
                         class="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-2xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 transition-colors">
                        <span class="material-symbols-outlined text-[14px]">check_circle</span>
                        Tasks
                      </a>
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100" title="View Details"
                              (click)="viewProject(p)">
                        <span class="material-symbols-outlined text-[16px]">visibility</span>
                      </button>
                      <button type="button" class="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-100" title="Edit"
                              (click)="openProjectModal(p)">
                        <span class="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      <button type="button" class="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50" title="Delete"
                              (click)="deleteTarget.set(p)">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="px-3 py-12 text-center text-slate-400 text-xs">No projects match your filters.</td></tr>
              }
            }
          </tbody>
        </table>
        
        <!-- Pagination controls -->
        @if (filteredProjects().length > 0) {
          <div class="flex items-center justify-between px-3 py-2 border-t border-slate-100 bg-slate-50/50">
            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1.5">
                <span class="text-2xs text-slate-400">Show</span>
                <select [ngModel]="pageSize()" (ngModelChange)="setPageSize($event)"
                        class="text-xs border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/25 focus:border-primary">
                  <option [value]="3">3</option>
                  <option [value]="5">5</option>
                  <option [value]="10">10</option>
                  <option [value]="25">25</option>
                  <option [value]="50">50</option>
                  <option [value]="100">100</option>
                </select>
              </div>
              <p class="text-2xs text-slate-400">
                Showing {{ startIndex() + 1 }} to {{ endIndex() }} of {{ filteredProjects().length }} entries
              </p>
            </div>
            <div class="flex items-center gap-1">
              <button (click)="prevPage()" [disabled]="currentPage() === 1" 
                      class="px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors focus:outline-none">
                Prev
              </button>
              
              @for (p of pages(); track $index) {
                @if (p === '...') {
                  <span class="px-1 text-xs text-slate-400">...</span>
                } @else {
                  <button (click)="setPage(p)" 
                          [class.bg-primary]="p === currentPage()" 
                          [class.text-white]="p === currentPage()"
                          [class.border-primary]="p === currentPage()"
                          [class.bg-white]="p !== currentPage()"
                          [class.text-slate-600]="p !== currentPage()"
                          [class.border-slate-200]="p !== currentPage()"
                          class="min-w-[28px] px-2 py-1 border rounded text-xs hover:bg-slate-50 transition-colors focus:outline-none">
                    {{ p }}
                  </button>
                }
              }

              <button (click)="nextPage()" [disabled]="currentPage() === totalPages() || totalPages() === 0" 
                      class="px-2 py-1 border border-slate-200 rounded text-xs bg-white text-slate-600 disabled:opacity-50 hover:bg-slate-50 transition-colors focus:outline-none">
                Next
              </button>
            </div>
          </div>
        }
      </div>
    </div>

    <app-drawer-panel
      [open]="projectModalOpen()"
      [title]="editingProject() ? 'Edit project' : 'New project'"
      subtitle="Dates are for planning; task completion drives the progress bar."
      size="md"
      (closed)="closeProjectModal()"
      (backdropClose)="closeProjectModal()">
      @if (projectForm) {
         <form [formGroup]="projectForm" class="space-y-3">
           <div>
             <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Name <span class="text-red-500">*</span></label>
             <input formControlName="project_name" type="text" placeholder="e.g. Mobile App"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
             @if (projectForm.get('project_name')?.invalid && projectForm.get('project_name')?.touched) {
               <p class="text-red-600 text-2xs mt-1">Name is required</p>
             }
           </div>
           <div>
             <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</label>
             <textarea formControlName="project_description" placeholder="Project details..." rows="3"
                    class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary"></textarea>
           </div>
           <div>
             <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status <span class="text-red-500">*</span></label>
             <select formControlName="project_status_id_fk"
                     class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
               @for (st of masters.statuses(); track st.status_id) {
                 <option [value]="st.status_id">{{ st.status_label || st.status_name }}</option>
               }
             </select>
           </div>
           <div class="grid grid-cols-2 gap-3">
             <div>
               <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Start <span class="text-red-500">*</span></label>
               <input formControlName="project_start_date" type="date"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
               @if (projectForm.get('project_start_date')?.invalid && projectForm.get('project_start_date')?.touched) {
                 <p class="text-red-600 text-2xs mt-1">Start date is required</p>
               }
             </div>
             <div>
               <label class="block text-2xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Due <span class="text-red-500">*</span></label>
               <input formControlName="project_end_date" type="date"
                      class="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary">
               @if (projectForm.get('project_end_date')?.invalid && projectForm.get('project_end_date')?.touched) {
                 <p class="text-red-600 text-2xs mt-1">Due date is required</p>
               }
             </div>
           </div>
            <div class="pt-4 border-t border-slate-100">
              <div class="flex items-center justify-between mb-3">
                <label class="block text-2xs font-bold text-slate-500 uppercase tracking-wider">Data Sources / References</label>
                <button type="button" (click)="addArtifact()" 
                        class="inline-flex items-center gap-1 text-2xs font-semibold text-primary bg-primary/10 hover:bg-primary/15 px-2 py-1 rounded transition-colors">
                  <span class="material-symbols-outlined text-[14px]">add</span>
                  Add reference
                </button>
              </div>
              
              <div formArrayName="artifacts" class="space-y-3">
                <div *ngFor="let artifact of artifactsArray.controls; let i = index" [formGroupName]="i" 
                     class="group relative bg-slate-50/50 border border-slate-100 rounded-xl p-3 hover:bg-slate-50 hover:border-slate-200 transition-all">
                  
                  <button type="button" (click)="removeArtifact(i)" 
                          class="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 rounded-md transition-colors" title="Remove">
                    <span class="material-symbols-outlined text-[16px]">close</span>
                  </button>

                  <div class="grid grid-cols-12 gap-3">
                    <div class="col-span-12 sm:col-span-5">
                      <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Title <span class="text-red-500">*</span></label>
                      <input formControlName="artifact_title" placeholder="e.g. Design Specs"
                             class="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-white">
                    </div>
                    <div class="col-span-12 sm:col-span-7 pr-6">
                      <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Value / URL <span class="text-red-500">*</span></label>
                      <input formControlName="artifact_value" placeholder="https://..."
                             class="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-white font-mono">
                    </div>
                    
                    <div class="col-span-12 sm:col-span-4">
                      <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Type <span class="text-red-500">*</span></label>
                      <select formControlName="artifact_type"
                              class="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-white">
                        <option value="url">Link / URL</option>
                        <option value="text">Text / Snippet</option>
                        <option value="credential">Credential</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    <div class="col-span-12 sm:col-span-8 flex items-end">
                      <label class="flex items-center gap-2 cursor-pointer select-none py-1.5">
                        <input type="checkbox" formControlName="is_sensitive" class="w-3.5 h-3.5 rounded text-primary focus:ring-primary/25">
                        <span class="text-2xs font-medium text-slate-600">Mark as sensitive (hidden by default)</span>
                      </label>
                    </div>

                    <div class="col-span-12">
                      <label class="block text-[10px] font-semibold text-slate-400 uppercase mb-1">Short Description</label>
                      <input formControlName="description" placeholder="Optional notes about this source..."
                             class="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary bg-white">
                    </div>
                  </div>
                </div>
                
                @if (artifactsArray.length === 0) {
                  <div class="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                    <p class="text-xs text-slate-400">No data sources added yet.</p>
                  </div>
                }
              </div>
            </div>
         </form>
      }
      <ng-container drawerFooter>
        <button type="button" class="px-3 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg bg-white hover:bg-slate-50"
                (click)="closeProjectModal()">Cancel</button>
        <button type="button" class="px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2"
                [disabled]="saving()"
                (click)="saveProject()">
          @if (saving()) {
             <span class="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
          }
          {{ editingProject() ? 'Save changes' : 'Create project' }}
        </button>
      </ng-container>
    </app-drawer-panel>

    <app-confirm-dialog
      [open]="!!deleteTarget()"
      title="Delete project?"
      [message]="deleteTarget() ? 'Remove “' + deleteTarget()!.project_name + '” and all of its tasks? This cannot be undone.' : ''"
      confirmLabel="Delete"
      [pending]="saving()"
      (confirm)="confirmDeleteProject()"
      (cancel)="deleteTarget.set(null)" />

    <!-- View Project Drawer -->
    <app-drawer-panel
      [open]="!!viewingProject()"
      title="Project Details"
      [subtitle]="viewingProject()?.project_name || ''"
      size="md"
      (closed)="viewingProject.set(null)"
      (backdropClose)="viewingProject.set(null)">
      @if (viewingProject(); as p) {
        <div class="space-y-6">
          <div class="grid grid-cols-2 gap-4">
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Status</label>
              <span class="px-2 py-0.5 rounded-md text-xs font-semibold" [class]="statusClass(p.project_status)">{{ p.project_status }}</span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Project ID</label>
              <span class="text-xs font-mono text-slate-600">{{ p.project_id }}</span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Date</label>
              <span class="text-xs text-slate-700 font-medium">{{ p.project_start_date || 'N/A' }}</span>
            </div>
            <div class="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Due Date</label>
              <span class="text-xs text-slate-700 font-medium">{{ p.project_end_date || 'N/A' }}</span>
            </div>
          </div>

          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase mb-1">Description</label>
            <div class="bg-white border border-slate-100 rounded-xl p-3 text-sm text-slate-600 leading-relaxed min-h-[80px]">
              {{ p.project_description || 'No description provided.' }}
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="block text-[10px] font-bold text-slate-400 uppercase">Data Sources & References</label>
              <span class="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-bold">{{ p.artifacts?.length || 0 }}</span>
            </div>
            
            <div class="space-y-3">
              @for (a of p.artifacts; track $index) {
                <div class="group relative bg-white border border-slate-100 rounded-xl p-4 hover:border-primary/30 transition-all shadow-sm">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[18px] text-primary/60">
                        {{ a.artifact_type === 'url' ? 'link' : a.artifact_type === 'credential' ? 'key' : 'description' }}
                      </span>
                      <h4 class="text-sm font-bold text-slate-800">{{ a.artifact_title }}</h4>
                    </div>
                    @if (a.is_sensitive) {
                      <span class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase">
                        <span class="material-symbols-outlined text-[12px]">lock</span>
                        Sensitive
                      </span>
                    }
                  </div>
                  
                  <div class="bg-slate-50 rounded-lg p-2.5 mb-2 font-mono text-xs break-all border border-slate-100">
                    @if (a.is_sensitive) {
                      <div class="flex items-center justify-between">
                        <span class="text-slate-400 italic">Content hidden for security</span>
                        <button (click)="copyToClipboard(a.artifact_value)" class="text-primary hover:underline font-bold">Copy</button>
                      </div>
                    } @else {
                      <a *ngIf="a.artifact_type === 'url'" [href]="a.artifact_value" target="_blank" class="text-primary hover:underline">{{ a.artifact_value }}</a>
                      <span *ngIf="a.artifact_type !== 'url'">{{ a.artifact_value }}</span>
                    }
                  </div>
                  
                  @if (a.description) {
                    <p class="text-[11px] text-slate-500 italic">{{ a.description }}</p>
                  }
                </div>
              } @empty {
                <div class="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl">
                  <p class="text-xs text-slate-400">No data sources configured for this project.</p>
                </div>
              }
            </div>
          </div>
        </div>
      }
      <ng-container drawerFooter>
        <button type="button" class="w-full px-3 py-2 text-xs font-bold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                (click)="viewingProject.set(null)">Close View</button>
      </ng-container>
    </app-drawer-panel>
  `
})
export class TmProjectsComponent implements OnInit {
  projects = signal<Project[]>([]);
  loading = signal(false);
  saving = signal(false);

  showIntro = signal(false);

  search = signal('');
  statusFilter = signal('');
  startDateFilter = signal('');
  endDateFilter = signal('');

  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);

  projectModalOpen = signal(false);
  editingProject = signal<Project | null>(null);
  viewingProject = signal<Project | null>(null);
  deleteTarget = signal<Project | null>(null);

  projectForm = this.fb.group({
    project_name: ['', Validators.required],
    project_description: [''],
    project_status_id_fk: ['', Validators.required],
    project_start_date: ['', Validators.required],
    project_end_date: ['', Validators.required],
    artifacts: this.fb.array([])
  });

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private api: ApiService,
    private auth: AuthService,
    public masters: MastersService,
    private toast: ToastService
  ) { }

  ngOnInit() {
    this.masters.load();
    this.fetchProjects();
  }

  fetchProjects() {
    const userId = this.auth.currentUser()?.user_id;
    if (!userId) return;

    this.loading.set(true);
    this.api.getProjects(userId, 'TASKS').subscribe({
      next: (data) => {
        console.log('Projects loaded with artifacts:', data);
        this.projects.set(data);
        this.loading.set(false);
        this.currentPage.set(1); // Reset to first page
      },
      error: (err) => {
        console.error('Failed to load projects', err);
        this.toast.error('Failed to load projects. Please try again.');
        this.loading.set(false);
      }
    });
  }

  summaryStats = computed(() => {
    const list = this.projects();
    const totalTasks = list.reduce((sum, p) => sum + (p.task_total || 0), 0);

    const stats = [
      { value: list.length, label: 'Projects' }
    ];

    stats.push({ value: totalTasks, label: 'Tasks' });

    for (const st of this.masters.statuses()) {
      stats.push({
        value: list.filter(p => p.project_status === (st.status_label || st.status_name)).length,
        label: st.status_label || st.status_name
      });
    }


    return stats;
  });

  filteredProjects = computed(() => {
    const s = this.search().toLowerCase();
    const filter = this.statusFilter();
    const start = this.startDateFilter();
    const end = this.endDateFilter();

    return this.projects().filter(p => {
      const matchSearch = !s || p.project_name.toLowerCase().includes(s) || p.project_id.toLowerCase().includes(s);
      const matchStatus = !filter || p.project_status === filter;
      const matchStart = !start || (p.project_start_date && p.project_start_date >= start);
      const matchEnd = !end || (p.project_end_date && p.project_end_date <= end);

      return matchSearch && matchStatus && matchStart && matchEnd;
    });
  });

  paginatedProjects = computed(() => {
    const filtered = this.filteredProjects();
    const start = (this.currentPage() - 1) * this.pageSize();
    return filtered.slice(start, start + this.pageSize());
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredProjects().length / this.pageSize());
  });

  startIndex = computed(() => {
    if (this.filteredProjects().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize();
  });

  endIndex = computed(() => {
    return Math.min(this.currentPage() * this.pageSize(), this.filteredProjects().length);
  });

  setSearch(val: string) {
    this.search.set(val);
    this.currentPage.set(1);
  }

  setStatusFilter(val: string) {
    this.statusFilter.set(val);
    this.currentPage.set(1);
  }

  setStartDateFilter(val: string) {
    this.startDateFilter.set(val);
    this.currentPage.set(1);
  }

  setEndDateFilter(val: string) {
    this.endDateFilter.set(val);
    this.currentPage.set(1);
  }

  clearFilters() {
    this.search.set('');
    this.statusFilter.set('');
    this.startDateFilter.set('');
    this.endDateFilter.set('');
    this.currentPage.set(1);
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  prevPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  setPage(p: number | string) {
    if (typeof p === 'number') {
      this.currentPage.set(p);
    }
  }

  setPageSize(size: number | string) {
    this.pageSize.set(Number(size));
    this.currentPage.set(1);
  }

  pages = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const p: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) p.push(i);
    } else {
      p.push(1);
      if (current > 3) p.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) p.push(i);
      if (current < total - 2) p.push('...');
      p.push(total);
    }
    return p;
  });

  progressPct(p: Project): number {
    if (!p.task_total) return 0;
    return Math.min(100, Math.round((p.task_done! / p.task_total) * 100));
  }

  statusClass(s?: string): string {
    const status = (s || '').toLowerCase();
    if (status === 'active' || status === 'in progress') return 'bg-emerald-100 text-emerald-800';
    if (status === 'triage' || status === 'open') return 'bg-slate-100 text-slate-700';
    if (status === 'on hold') return 'bg-amber-100 text-amber-800';
    if (status === 'completed') return 'bg-stone-200 text-stone-800';
    return 'bg-slate-100 text-slate-600';
  }

  viewProject(p: Project) {
    this.viewingProject.set(p);
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    this.toast.success('Copied to clipboard');
  }

  openProjectModal(row: Project | null) {
    this.editingProject.set(row);
    
    // 1. Reset form first (this clears everything)
    if (row) {
      this.projectForm.reset({
        project_name: row.project_name,
        project_description: row.project_description || '',
        project_status_id_fk: row.project_status_id_fk,
        project_start_date: row.project_start_date,
        project_end_date: row.project_end_date
      });
    } else {
      const firstStatus = this.masters.statuses().length > 0 ? this.masters.statuses()[0].status_id : '';
      this.projectForm.reset({
        project_name: '',
        project_description: '',
        project_status_id_fk: firstStatus,
        project_start_date: '',
        project_end_date: ''
      });
    }

    // 2. Clear and repopulate artifacts AFTER reset
    const artifactsArray = this.projectForm.get('artifacts') as FormArray;
    artifactsArray.clear();
    if (row && row.artifacts) {
      row.artifacts.forEach(a => {
        artifactsArray.push(this.fb.group({
          artifact_title: [a.artifact_title, Validators.required],
          artifact_value: [a.artifact_value, Validators.required],
          artifact_type: [a.artifact_type || 'url', Validators.required],
          description: [a.description || ''],
          is_sensitive: [a.is_sensitive === true || (a.is_sensitive as any) === 'true' || (a.is_sensitive as any) === 'TRUE']
        }));
      });
    }
    
    this.projectModalOpen.set(true);
  }

  // Helper getter for artifacts FormArray
  get artifactsArray(): FormArray {
    return this.projectForm.get('artifacts') as FormArray;
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

  closeProjectModal() {
    this.projectModalOpen.set(false);
    this.editingProject.set(null);
  }

  saveProject() {
    this.projectForm.markAllAsTouched();
    if (this.projectForm.invalid) {
      this.toast.warning('Please fill in all required fields.');
      return;
    }

    const v = this.projectForm.getRawValue();
    const cur = this.editingProject();
    const userId = this.auth.currentUser()?.user_id;
    if (!userId) return;

    this.saving.set(true);

    // Prepare artifacts payload (filter out empty entries)
    const artifactsPayload: ProjectArtifact[] = (v.artifacts || []).filter((a: any) => a.artifact_title && a.artifact_value) as ProjectArtifact[];

    if (cur) {
      const patch = {
        project_id: cur.project_id,
        project_name: v.project_name!,
        project_description: v.project_description || '',
        project_status_id_fk: v.project_status_id_fk!,
        project_start_date: v.project_start_date || '',
        project_end_date: v.project_end_date || '',
        last_modified_by: userId,
        artifacts: artifactsPayload
      };

      this.api.updateProject(patch).subscribe({
        next: () => {
          this.fetchProjects();
          this.closeProjectModal();
          this.saving.set(false);
          this.toast.success('Project updated successfully.');
        },
        error: (err) => {
          console.error('Update failed', err);
          this.toast.error(err.error?.message || err.message || 'Failed to update project.');
          this.saving.set(false);
        }
      });
    } else {
      const newProj = {
        project_name: v.project_name!,
        project_description: v.project_description || '',
        project_status_id_fk: v.project_status_id_fk!,
        project_start_date: v.project_start_date || '',
        project_end_date: v.project_end_date || '',
        created_by: userId,
        artifacts: artifactsPayload
      };

      this.api.createProject(newProj).subscribe({
        next: (p) => {
          this.fetchProjects();
          this.closeProjectModal();
          this.saving.set(false);
          this.toast.success('Project created successfully.');
        },
        error: (err) => {
          console.error('Create failed', err);
          this.toast.error(err.error?.message || err.message || 'Failed to create project.');
          this.saving.set(false);
        }
      });
    }
  }

  confirmDeleteProject() {
    const t = this.deleteTarget();
    const userId = this.auth.currentUser()?.user_id;
    if (t && userId) {
      this.saving.set(true);
      this.api.deleteProject(t.project_id, userId).subscribe({
        next: () => {
          this.fetchProjects();
          this.deleteTarget.set(null);
          this.saving.set(false);
          this.toast.success('Project deleted successfully.');
        },
        error: (err) => {
          console.error('Delete failed', err);
          this.toast.error(err.error?.message || err.message || 'Failed to delete project.');
          this.saving.set(false);
        }
      });
    } else {
      this.deleteTarget.set(null);
    }
  }
}
