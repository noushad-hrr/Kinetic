// ─── Session / Auth ────────────────────────────────────────────────────────────
export interface SessionUser {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  role_id: string;
  role_name?: string;
  is_super_admin?: boolean | string;
}

// ─── RBAC ──────────────────────────────────────────────────────────────────────
export interface Role {
  role_id: string;
  role_name: string;
  role_description: string;
  is_active: boolean | string;
  created_by: string;
  created_on: string;
}

export interface Permission {
  permission_id: string;
  permission_name: string;
  permission_code: string;
  permission_description: string;
}

export interface AdminUser {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  role_id: string;
  is_active: boolean | string;
  created_on: string;
  last_login_on: string;
}

// ─── Projects ──────────────────────────────────────────────────────────────────


export interface Project {
  project_id: string;
  project_name: string;
  project_description: string;
  project_status_id_fk: string;
  project_status?: string;
  project_start_date: string;
  project_end_date: string;
  // New: list of artifacts (data source references)
  artifacts?: ProjectArtifact[];
  created_by: string;
  created_on: string;
  last_modified_by?: string;
  last_modified_on?: string;
  task_total?: number;
  task_done?: number;
}


// ─── Project Artifacts ───────────────────────────────────────────────────────
export interface ProjectArtifact {
  // Primary key id (optional, assigned by backend)
  tasks_manager_project_artifacts_id?: number;
  // Foreign key to project id
  tasks_manager_project_artifacts_id_fk?: string;
  artifact_title: string;
  artifact_value: string;
  artifact_type: string;
  description?: string;
  is_sensitive?: boolean;
  created_by?: string;
  created_on?: string;
}

export interface TaskArtifact {
  task_artifact_id?: string;
  task_id_fk?: string;
  artifact_title: string;
  artifact_value: string;
  artifact_type: string;
  description?: string;
  is_sensitive?: boolean;
  created_by?: string;
  created_on?: string;
}

/** One row in tasks_manager_tasks_periodicty (multiple per task) */
export interface TaskSchedule {
  task_periodicity_id?: string;
  task_id_fk?: string;
  task_remarks?: string;
  task_status_id: string;
  task_date: string;
  task_start_time: string;
  task_end_time: string;
  task_order_id?: number;
  estimated_hours?: number;
  spent_hours?: number;
  created_by?: string;
  created_on?: string;
  last_modified_by?: string;
  last_modified_on?: string;
  status_label?: string;
}

export interface UserProjectMapping {
  mapping_id: string;
  user_id_fk: string;
  project_id_fk: string;
  project_category: 'TASKS' | 'BUDGET';
  is_active: boolean | string;
}

// ─── Masters ───────────────────────────────────────────────────────────────────
export interface Masters {
  roles: Role[];
  users: { user_id: string; display_name: string; username: string; email: string }[];
  statuses: { status_id: string; status_name: string; status_label: string; sort_order: number }[];
  priorities: { priority_id: string; priority_name: string; priority_label: string; color_code: string }[];
  task_types: { type_id: string; type_name: string; type_label: string; icon_name: string }[];
}

// ─── Tasks ───────────────────────────────────────────────────────────────────
export interface Task {
  task_id: string;
  project_id_fk: string;
  task_title: string;
  task_description?: string;
  task_remarks?: string;
  task_status_id: string;
  task_assignees?: string; // Pipe separated user IDs
  task_date: string;
  task_start_time: string;
  task_end_time: string;
  task_order_id: number;
  type_id: string;
  priority_id: string;
  estimated_hours?: number;
  spent_hours?: number;
  created_by: string;
  created_on: string;
  artifacts?: TaskArtifact[];
  /** Primary key of merged primary schedule row (when present) */
  task_periodicity_id?: string;
  /** All periodicity / schedule rows for this task */
  schedules?: TaskSchedule[];
  last_modified_by?: string;
  last_modified_on?: string;

  // Enriched fields from backend
  project_name?: string;
  status_label?: string;
  priority_label?: string;
  type_label?: string;
  assignee_names?: string;

  // UI helper fields (mappings for older logic)
  status?: string;
  priority?: string;
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}
