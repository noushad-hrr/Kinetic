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
  created_by: string;
  created_on: string;
  last_modified_by?: string;
  last_modified_on?: string;
  task_total?: number;
  task_done?: number;
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
  statuses?: { status_id: string; status_name: string; status_label: string; sort_order: number }[];
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}
