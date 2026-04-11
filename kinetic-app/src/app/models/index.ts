// ─── Session / Auth ────────────────────────────────────────────────────────────
export interface SessionUser {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  role_id: string;
  role_name?: string;
}

// ─── RBAC ──────────────────────────────────────────────────────────────────────
export interface Role {
  role_id: string;
  role_name: string;
  role_description: string;
  is_active: boolean | string;
  is_deleted: boolean | string;
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

// ─── Masters ───────────────────────────────────────────────────────────────────
export interface Masters {
  roles: Role[];
  users: { user_id: string; display_name: string; username: string; email: string }[];
}

// ─── API Response ─────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: number;
}
