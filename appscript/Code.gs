/**
 * KINETIC - Google Apps Script API Layer
 * Deploy as Web App: Execute as Me, Anyone can access
 * 
 * UPDATED: Added RBAC (Role-Based Access Control) functions
 * - New sheets: permissions, role_permission_mapping, user_project_mapping
 * - Renamed: user_project_permissions → user_project_mapping (simplified)
 */

// ─── CORS & RESPONSE HELPERS ─────────────────────────────────────────────────

function setCorsHeaders(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonResponse(data, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

function success(data) {
  return jsonResponse({ success: true, data: data });
}

function error(message, code) {
  return jsonResponse({ success: false, error: message, code: code || 400 });
}

// ─── ROUTER ──────────────────────────────────────────────────────────────────

function doGet(e) {
  try {
    var action = e.parameter.action;
    var params = e.parameter;

    // Build body: try JSON from 'data' param first, then fall back to raw params
    var body = {};
    if (params.data) {
      try {
        // Try plain parse first
        body = JSON.parse(params.data);
      } catch(ex1) {
        try {
          // Try after decoding once
          body = JSON.parse(decodeURIComponent(params.data));
        } catch(ex2) {
          // Fall through — body stays {}
        }
      }
    }

    // For login: also accept username/password as direct URL params (most reliable)
    if (action === 'login' || action === 'loginWithRBAC') {
      if (params.username) body.username = params.username;
      if (params.password) body.password = params.password;
    }

    return route(action, params, body);
  } catch (err) {
    return error('Server error: ' + err.message, 500);
  }
}

// Keep doPost as fallback
function doPost(e) {
  try {
    var action = e.parameter.action;
    var params = e.parameter;
    var body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch(ex) {}
    }
    if (params.data) {
      try { body = JSON.parse(params.data); } catch(ex) {}
    }
    return route(action, params, body);
  } catch (err) {
    return error('Server error: ' + err.message, 500);
  }
}

function route(action, params, body) {
  switch (action) {
    // Auth
    case 'login':                    return handleLogin(body);
    case 'loginWithRBAC':           return handleLoginWithRBAC(body);
    case 'getUserPermissions':       return handleGetUserPermissions(params.user_id);

    // RBAC - Roles Management
    case 'getRoles':                 return handleGetRoles();
    case 'createRole':               return handleCreateRole(body);
    case 'updateRole':               return handleUpdateRole(params.role_id, body);

    // NEW: RBAC - Permissions
    case 'getPermissions':           return handleGetPermissions();
    case 'getRolePermissions':       return handleGetRolePermissions(params.role_id);
    case 'updateRolePermissions':    return handleUpdateRolePermissions(params.role_id, body.permissions);

    // RBAC - User Management
    case 'getUsers':                 return handleGetUsers();
    case 'createUser':               return handleCreateUser(body);
    case 'updateUser':               return handleUpdateUser(body);
    case 'deleteUser':               return handleDeleteUser(params.user_id);

    // NEW: RBAC - User Project Assignment
    case 'getUserProjects':          return handleGetUserProjects(params.user_id);
    case 'getUserProjectMappings':   return handleGetUserProjectMappings(params.user_id);
    case 'getAllProjects':            return handleGetAllProjects();
    case 'assignUserToProject':      return handleAssignUserToProject(body);
    case 'removeUserFromProject':    return handleRemoveUserFromProject(params.mapping_id);

    // Masters
    case 'getMasters':               return handleGetMasters();

    // Dashboard
    case 'getDashboard':             return handleGetDashboard(params.user_id);

    // Projects
    case 'getProjects':              return handleGetProjects(params.user_id, params.category);
    case 'createProject':            return handleCreateProject(body);
    case 'updateProject':            return handleUpdateProject(body);
    case 'deleteProject':            return handleDeleteProject(params.project_id, params.user_id);

    // Project Artifacts
    case 'getArtifacts':             return handleGetArtifacts(params.project_id);
    case 'createArtifact':           return handleCreateArtifact(body);
    case 'updateArtifact':           return handleUpdateArtifact(body);
    case 'deleteArtifact':           return handleDeleteArtifact(params.artifact_id);

    // Task Artifacts
    case 'getTaskArtifacts':         return handleGetTaskArtifacts(params.task_id);
    case 'createTaskArtifact':       return handleCreateTaskArtifact(body);
    case 'updateTaskArtifact':       return handleUpdateTaskArtifact(body);
    case 'deleteTaskArtifact':       return handleDeleteTaskArtifact(params.task_artifact_id);

    // Task schedules (tasks_manager_tasks_periodicty — one task, many rows)
    case 'getTaskSchedules':         return handleGetTaskSchedules(params.task_id);
    case 'createTaskSchedule':       return handleCreateTaskSchedule(body);
    case 'updateTaskSchedule':       return handleUpdateTaskSchedule(body);
    case 'deleteTaskSchedule':       return handleDeleteTaskSchedule(params.task_periodicity_id);

    // Tasks
    case 'getTasks':                 return handleGetTasks(params.user_id, params.project_ids);
    case 'createTask':               return handleCreateTask(body);
    case 'updateTask':               return handleUpdateTask(body);
    case 'deleteTask':               return handleDeleteTask(params.task_id);

    // Utility
    case 'autoCloseOverdue':         return handleAutoCloseOverdue();

    default:
      return error('Unknown action: ' + action, 404);
  }
}

// ─── SPREADSHEET ACCESS ───────────────────────────────────────────────────────

// ⚠️ REPLACE THIS with your actual Google Sheets ID from the URL
// Dev Old
// var SPREADSHEET_ID = '1YZrz688VpAqKKH6uZxs96DRLBZYMCBodMN8DeCzrD5g';
// Dev New
var SPREADSHEET_ID = '1AN1tMQCLcOFwF64bNW5zFD5aYbg4M_A9rcGhVyBQaQk';

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  // Fallback: works if script is opened via Extensions > Apps Script inside the sheet
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSpreadsheet();
  if (!ss) throw new Error('Cannot access spreadsheet. Set SPREADSHEET_ID in Code.gs');
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tab not found: "' + name + '". Check your Kinetic DB sheet has this tab.');
  return sheet;
}

function sheetToObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var headers = data[0].map(function(h) { return String(h).trim(); });
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      var val = row[i];
      if (val instanceof Date) {
        var format = (h.indexOf('_time') !== -1) ? 'HH:mm' : 'yyyy-MM-dd';
        obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), format);
      } else {
        obj[h] = val === '' || val === null || val === undefined ? null : val;
      }
    });
    return obj;
  });
}

function appendRow(sheetName, rowObj) {
  var sheet = getSheet(sheetName);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = headers.map(function(h) { return rowObj[h] !== undefined ? rowObj[h] : ''; });
  sheet.appendRow(row);
}

function updateRowById(sheetName, idField, idValue, updateObj) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf(idField);
  if (idCol === -1) throw new Error('ID field not found: ' + idField);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(idValue)) {
      headers.forEach(function(h, j) {
        if (updateObj[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(updateObj[h]);
        }
      });
      return true;
    }
  }
  return false;
}

function deleteRowById(sheetName, idField, idValue) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf(idField);
  if (idCol === -1) throw new Error('ID field not found: ' + idField);

  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][idCol]) === String(idValue)) {
      sheet.deleteRow(i + 1);
      return true;
    }
  }
  return false;
}

// Collision-safe ID: scans existing IDs, takes max numeric suffix + 1
function generateId(prefix, sheetName, idField) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return prefix + '0001';
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf(idField);
  if (idCol === -1) return prefix + '0001';
  var max = 0;
  for (var i = 1; i < data.length; i++) {
    var val = String(data[i][idCol]);
    if (val.indexOf(prefix) === 0) {
      var num = parseInt(val.substring(prefix.length), 10);
      if (!isNaN(num)) max = Math.max(max, num);
    }
  }
  return prefix + String(max + 1).padStart(4, '0');
}

// Auto-generate project ID: KP-0001, KP-0002, etc. — no gaps, no duplicates
function generateProjectId() {
  var projects = sheetToObjects('tasks_manager_projects');
  var max = projects.reduce(function(m, p) {
    var match = String(p.project_id).match(/^KP-(\d+)$/);
    return match ? Math.max(m, parseInt(match[1], 10)) : m;
  }, 0);
  var next = max + 1;
  var existing = projects.map(function(p) { return String(p.project_id); });
  var candidate = 'KP-' + String(next).padStart(4, '0');
  while (existing.indexOf(candidate) !== -1) {
    next++;
    candidate = 'KP-' + String(next).padStart(4, '0');
  }
  return candidate;
}

// Returns next task_order_id (global across all projects, no gaps)
function getNextTaskOrderId() {
  var rows = sheetToObjects('tasks_manager_tasks_periodicty');
  if (!rows.length) return 1;
  return rows.reduce(function(m, r) {
    var n = parseInt(r.task_order_id, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0) + 1;
}

// Fill empty task_periodicity_id cells (add column to sheet if missing)
function ensureTaskPeriodicityIds() {
  var sheet = getSheet('tasks_manager_tasks_periodicty');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf('task_periodicity_id');
  if (idCol === -1) return;
  for (var i = 1; i < data.length; i++) {
    var v = data[i][idCol];
    if (v === '' || v === null || v === undefined) {
      var newId = generateId('TP-', 'tasks_manager_tasks_periodicty', 'task_periodicity_id');
      sheet.getRange(i + 1, idCol + 1).setValue(newId);
    }
  }
}

function periodicityPatchKeys() {
  return ['task_remarks', 'task_status_id', 'task_date', 'task_start_time', 'task_end_time', 'task_order_id', 'estimated_hours', 'spent_hours', 'last_modified_by', 'last_modified_on'];
}

function pickPeriodicityPatch(obj) {
  var keys = periodicityPatchKeys();
  var out = {};
  keys.forEach(function(k) {
    if (obj && obj[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

// Apply updateObj to every row where field === value
function updateAllRowsWhere(sheetName, field, value, updateObj) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return 0;
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf(field);
  if (idCol === -1) return 0;
  var count = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(value)) {
      headers.forEach(function(h, j) {
        if (updateObj[h] !== undefined) {
          sheet.getRange(i + 1, j + 1).setValue(updateObj[h]);
        }
      });
      count++;
    }
  }
  return count;
}

// Sync child rows: upsert by task_periodicity_id, delete rows for task not listed
function syncTaskPeriodicities(taskId, schedules, userId) {
  if (!schedules || !Array.isArray(schedules) || schedules.length === 0) {
    throw new Error('At least one schedule row is required');
  }
  var nowStr = now();
  var incomingIds = [];
  var uid = userId || '';

  schedules.forEach(function(s) {
    var patch = pickPeriodicityPatch(s);
    if (s.task_periodicity_id) {
      incomingIds.push(String(s.task_periodicity_id));
      patch.last_modified_by = uid;
      patch.last_modified_on = nowStr;
      updateRowById('tasks_manager_tasks_periodicty', 'task_periodicity_id', s.task_periodicity_id, patch);
    } else {
      var newId = generateId('TP-', 'tasks_manager_tasks_periodicty', 'task_periodicity_id');
      incomingIds.push(String(newId));
      var row = {
        task_periodicity_id: newId,
        task_id_fk: taskId,
        task_remarks: s.task_remarks != null ? s.task_remarks : '',
        task_status_id: s.task_status_id || '',
        task_date: s.task_date != null ? s.task_date : '',
        task_start_time: s.task_start_time != null ? s.task_start_time : '',
        task_end_time: s.task_end_time != null ? s.task_end_time : '',
        task_order_id: s.task_order_id != null && s.task_order_id !== '' ? s.task_order_id : getNextTaskOrderId(),
        estimated_hours: s.estimated_hours != null ? s.estimated_hours : 0,
        spent_hours: s.spent_hours != null ? s.spent_hours : 0,
        created_by: uid || (s.created_by || ''),
        created_on: s.created_on || nowStr,
        last_modified_by: uid,
        last_modified_on: nowStr
      };
      appendRow('tasks_manager_tasks_periodicty', row);
    }
  });

  var existing = sheetToObjects('tasks_manager_tasks_periodicty').filter(function(p) {
    return String(p.task_id_fk) === String(taskId);
  });
  existing.forEach(function(p) {
    var pid = String(p.task_periodicity_id || '');
    if (pid && incomingIds.indexOf(pid) === -1) {
      deleteRowById('tasks_manager_tasks_periodicty', 'task_periodicity_id', p.task_periodicity_id);
    }
  });
}

function enrichScheduleRow(per, statuses) {
  var s = statuses.find(function(item) { return String(item.status_id) === String(per.task_status_id); });
  return Object.assign({}, per, {
    task_date: per.task_date instanceof Date ? Utilities.formatDate(per.task_date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : per.task_date,
    task_start_time: per.task_start_time instanceof Date ? Utilities.formatDate(per.task_start_time, Session.getScriptTimeZone(), 'HH:mm') : per.task_start_time,
    task_end_time: per.task_end_time instanceof Date ? Utilities.formatDate(per.task_end_time, Session.getScriptTimeZone(), 'HH:mm') : per.task_end_time,
    status_label: s ? (s.status_label || s.status_name) : 'Unknown'
  });
}

function buildSchedulesForTask(taskId, allPeriodicities, statuses) {
  var rows = allPeriodicities.filter(function(p) { return String(p.task_id_fk) === String(taskId); });
  rows.sort(function(a, b) {
    var oa = parseInt(a.task_order_id, 10) || 0;
    var ob = parseInt(b.task_order_id, 10) || 0;
    if (oa !== ob) return oa - ob;
    return String(a.task_periodicity_id || '').localeCompare(String(b.task_periodicity_id || ''));
  });
  return rows.map(function(per) { return enrichScheduleRow(per, statuses); });
}

function handleGetTaskSchedules(taskId) {
  if (!taskId) return error('task_id required', 400);
  ensureTaskPeriodicityIds();
  var all = sheetToObjects('tasks_manager_tasks_periodicty');
  var statuses = sheetToObjects('status_master');
  return success(buildSchedulesForTask(taskId, all, statuses));
}

function handleCreateTaskSchedule(body) {
  if (!body.task_id_fk || !body.task_status_id) {
    return error('task_id_fk and task_status_id are required', 400);
  }
  ensureTaskPeriodicityIds();
  var newId = generateId('TP-', 'tasks_manager_tasks_periodicty', 'task_periodicity_id');
  var createdAt = now();
  var uid = body.created_by || '';
  var row = {
    task_periodicity_id: newId,
    task_id_fk: body.task_id_fk,
    task_remarks: body.task_remarks || '',
    task_status_id: body.task_status_id,
    task_date: body.task_date || '',
    task_start_time: body.task_start_time || '',
    task_end_time: body.task_end_time || '',
    task_order_id: body.task_order_id != null && body.task_order_id !== '' ? body.task_order_id : getNextTaskOrderId(),
    estimated_hours: body.estimated_hours != null ? body.estimated_hours : 0,
    spent_hours: body.spent_hours != null ? body.spent_hours : 0,
    created_by: uid,
    created_on: createdAt,
    last_modified_by: uid,
    last_modified_on: createdAt
  };
  appendRow('tasks_manager_tasks_periodicty', row);
  return success(row);
}

function handleUpdateTaskSchedule(body) {
  if (!body.task_periodicity_id) return error('task_periodicity_id required', 400);
  ensureTaskPeriodicityIds();
  body.last_modified_on = now();
  var updated = updateRowById('tasks_manager_tasks_periodicty', 'task_periodicity_id', body.task_periodicity_id, body);
  if (!updated) return error('Schedule row not found', 404);
  return success({ message: 'Schedule updated' });
}

function handleDeleteTaskSchedule(periodicityId) {
  if (!periodicityId) return error('task_periodicity_id required', 400);
  ensureTaskPeriodicityIds();
  var rows = sheetToObjects('tasks_manager_tasks_periodicty').filter(function(p) {
    return String(p.task_periodicity_id) === String(periodicityId);
  });
  if (!rows.length) return error('Schedule row not found', 404);
  var ord = parseInt(rows[0].task_order_id, 10);
  var deleted = deleteRowById('tasks_manager_tasks_periodicty', 'task_periodicity_id', periodicityId);
  if (!deleted) return error('Schedule row not found', 404);
  if (!isNaN(ord)) compactTaskOrderAfterDelete(ord);
  return success({ message: 'Schedule deleted' });
}

// When a task's order_id changes, shift other tasks to fill/make room, maintaining no-gap sequence
// (All periodicity rows for the same task share the same task_order_id.)
function reorderTask(taskId, newOrder) {
  var sheet = getSheet('tasks_manager_tasks_periodicty');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf('task_id_fk');
  var orderCol = headers.indexOf('task_order_id');
  if (idCol === -1 || orderCol === -1) return;

  var oldOrders = [];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(taskId)) {
      var o = parseInt(data[i][orderCol], 10);
      if (!isNaN(o)) oldOrders.push(o);
    }
  }
  if (!oldOrders.length) return;
  var oldOrder = Math.min.apply(null, oldOrders);
  if (isNaN(oldOrder) || oldOrder === newOrder) return;

  for (var j = 1; j < data.length; j++) {
    if (String(data[j][idCol]) === String(taskId)) continue;
    var ord = parseInt(data[j][orderCol], 10);
    if (isNaN(ord)) continue;
    if (newOrder < oldOrder && ord >= newOrder && ord < oldOrder) {
      sheet.getRange(j + 1, orderCol + 1).setValue(ord + 1);
    } else if (newOrder > oldOrder && ord > oldOrder && ord <= newOrder) {
      sheet.getRange(j + 1, orderCol + 1).setValue(ord - 1);
    }
  }

  for (var k = 1; k < data.length; k++) {
    if (String(data[k][idCol]) === String(taskId)) {
      sheet.getRange(k + 1, orderCol + 1).setValue(newOrder);
    }
  }
}

// After a task is deleted, decrement all order_ids above it to close the gap
function compactTaskOrderAfterDelete(deletedOrder) {
  var sheet = getSheet('tasks_manager_tasks_periodicty');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var orderCol = headers.indexOf('task_order_id');
  if (orderCol === -1) return;
  for (var i = 1; i < data.length; i++) {
    var ord = parseInt(data[i][orderCol], 10);
    if (!isNaN(ord) && ord > deletedOrder) {
      sheet.getRange(i + 1, orderCol + 1).setValue(ord - 1);
    }
  }
}

// Batch delete all rows where field === value (bottom-to-top for stable indices)
function deleteRowsWhere(sheetName, field, value) {
  var sheet = getSheet(sheetName);
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var col = headers.indexOf(field);
  if (col === -1) return 0;
  var count = 0;
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][col]) === String(value)) {
      sheet.deleteRow(i + 1);
      count++;
    }
  }
  return count;
}

// Re-number all task_order_ids 1, 2, 3... preserving existing relative order
function recompactAllTaskOrderIds() {
  var sheet = getSheet('tasks_manager_tasks_periodicty');
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var orderCol = headers.indexOf('task_order_id');
  if (orderCol === -1) return;
  var pairs = [];
  for (var i = 1; i < data.length; i++) {
    pairs.push({ row: i + 1, ord: parseInt(data[i][orderCol], 10) || 0 });
  }
  pairs.sort(function(a, b) { return a.ord - b.ord; });
  pairs.forEach(function(p, idx) {
    sheet.getRange(p.row, orderCol + 1).setValue(idx + 1);
  });
}

function now() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

// LEGACY: Keep for backward compatibility
function handleLogin(body) {
  if (!body || !body.username || !body.password) {
    return error('Username and password are required', 400);
  }

  var users = sheetToObjects('users');
  var user = users.find(function(u) {
    return String(u.username).toLowerCase() === String(body.username).toLowerCase()
      && String(u.password_hash) === String(body.password);
  });

  if (!user) return error('Invalid username or password', 401);
  if (String(user.is_active).toUpperCase() !== 'TRUE') {
    return error('Your account is inactive. Please contact admin.', 403);
  }

  // Update last_login_on
  updateRowById('users', 'user_id', user.user_id, { last_login_on: now() });

  var sessionUser = {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    role_id: user.role_id
  };

  return success({ user: sessionUser });
}

// NEW: RBAC Login - Returns user + permissions + projects
function handleLoginWithRBAC(body) {
  if (!body || !body.username || !body.password) {
    return error('Username and password are required', 400);
  }

  var users = sheetToObjects('users');
  var user = users.find(function(u) {
    return String(u.username).toLowerCase() === String(body.username).toLowerCase()
      && String(u.password_hash) === String(body.password);
  });

  if (!user) return error('Invalid username or password', 401);
  if (String(user.is_active).toUpperCase() !== 'TRUE') {
    return error('Your account is inactive. Please contact admin.', 403);
  }

  // Get role name
  var roles = sheetToObjects('roles');
  var role = roles.find(function(r) { return r.role_id === user.role_id; });

  if (!role || String(role.is_active).toUpperCase() !== 'TRUE') {
    return error('Your account role has been deactivated. Please contact admin.', 403);
  }

  // Update last_login_on
  updateRowById('users', 'user_id', user.user_id, { last_login_on: now() });

  var isSuperAdmin = String(user.is_super_admin).toUpperCase() === 'TRUE';

  var sessionUser = {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    role_id: user.role_id,
    role_name: role ? role.role_name : '',
    is_super_admin: isSuperAdmin
  };

  // Super admins get all permission codes; others get role-based codes
  var permissionCodes;
  if (isSuperAdmin) {
    var allPerms = sheetToObjects('permissions');
    permissionCodes = allPerms.map(function(p) { return p.permission_code; }).filter(Boolean);
  } else {
    var rolePerms = getRolePermissionsData(user.role_id);
    permissionCodes = rolePerms.map(function(p) { return p.permission_code; }).filter(Boolean);
  }

  // Get user's project IDs split by category
  var tasksProjectIds = getUserProjectsData(user.user_id, 'TASKS').map(function(p) { return p.project_id_fk; });
  var budgetProjectIds = getUserProjectsData(user.user_id, 'BUDGET').map(function(p) { return p.project_id_fk; });

  return success({
    user: sessionUser,
    permissions: permissionCodes,
    tasksProjectIds: tasksProjectIds,
    budgetProjectIds: budgetProjectIds
  });
}

// Helper: Get permissions for a role
function getRolePermissionsData(roleId) {
  var mapping = sheetToObjects('role_permission_mapping');
  var perms = sheetToObjects('permissions');
  
  var permIds = mapping
    .filter(function(m) { return m.role_id_fk === roleId; })
    .map(function(m) { return m.permission_id_fk; });
  
  return perms.filter(function(p) { return permIds.indexOf(p.permission_id) !== -1; });
}

// Helper: Get projects for a user (optionally filtered by category: 'TASKS' | 'BUDGET')
function getUserProjectsData(userId, category) {
  var mappings = sheetToObjects('user_project_mapping');
  return mappings.filter(function(m) {
    if (String(m.user_id_fk) !== String(userId)) return false;
    if (String(m.is_active).toUpperCase() !== 'TRUE') return false;
    if (category && m.project_category !== category) return false;
    return true;
  });
}

// Check if user has a specific permission
function userHasPermission(userId, permissionCode) {
  var users = sheetToObjects('users');
  var user = users.find(function(u) { return u.user_id === userId; });
  if (!user) return false;
  
  var perms = getRolePermissionsData(user.role_id);
  return perms.some(function(p) { return p.permission_code === permissionCode; });
}

// Check if user can view all projects
function canViewAllProjects(userId) {
  return userHasPermission(userId, 'VIEW_ALL_PROJECTS');
}

// Returns user project permissions derived from user_project_mapping
function handleGetUserPermissions(userId) {
  if (!userId) return error('user_id required', 400);
  var mappings = sheetToObjects('user_project_mapping');
  var userMappings = mappings.filter(function(m) {
    return String(m.user_id_fk) === String(userId) && String(m.is_active).toUpperCase() === 'TRUE';
  });
  // Derive can_read/can_create/can_update/can_delete from is_active for compatibility
  var perms = userMappings.map(function(m) {
    return {
      mapping_id: m.mapping_id,
      user_id_fk: m.user_id_fk,
      project_id_fk: m.project_id_fk,
      can_read: true,
      can_create: true,
      can_update: true,
      can_delete: true
    };
  });
  return success(perms);
}

// ─── RBAC: ROLES MANAGEMENT ─────────────────────────────────────────────────

function handleGetRoles() {
  return success(sheetToObjects('roles'));
}

function handleCreateRole(body) {
  if (!body.role_name) {
    return error('role_name is required', 400);
  }

  var newRole = {
    role_id: generateId('R', 'roles', 'role_id'),
    role_name: body.role_name,
    role_description: body.role_description || '',
    is_active: true,
    created_by: body.created_by,
    created_on: now()
  };

  appendRow('roles', newRole);
  return success(newRole);
}

function handleUpdateRole(roleId, body) {
  if (!roleId) return error('role_id required', 400);
  
  var updateObj = {};
  if (body.role_name !== undefined) updateObj.role_name = body.role_name;
  if (body.role_description !== undefined) updateObj.role_description = body.role_description;
  if (body.is_active !== undefined) updateObj.is_active = body.is_active;
  
  var updated = updateRowById('roles', 'role_id', roleId, updateObj);
  if (!updated) return error('Role not found', 404);
  return success({ message: 'Role updated' });
}

// ─── RBAC: PERMISSIONS ───────────────────────────────────────────────────────

function handleGetPermissions() {
  var perms = sheetToObjects('permissions');
  return success(perms);
}

function handleGetRolePermissions(roleId) {
  if (!roleId) return error('role_id required', 400);
  
  var mapping = sheetToObjects('role_permission_mapping');
  var perms = sheetToObjects('permissions');
  
  var rolePerms = mapping.filter(function(m) { return m.role_id_fk === roleId; });
  
  // Enrich with permission details
  var result = rolePerms.map(function(m) {
    var perm = perms.find(function(p) { return p.permission_id === m.permission_id_fk; });
    return {
      mapping_id: m.mapping_id,
      role_id_fk: m.role_id_fk,
      permission_id_fk: m.permission_id_fk,
      permission_code: perm ? perm.permission_code : null
    };
  });
  
  return success(result);
}

function handleUpdateRolePermissions(roleId, permissions) {
  if (!roleId) return error('role_id required', 400);
  if (!permissions || !Array.isArray(permissions)) {
    return error('permissions array is required', 400);
  }
  
  var allPerms = sheetToObjects('permissions');
  var mappingSheet = getSheet('role_permission_mapping');
  var mappingData = mappingSheet.getDataRange().getValues();
  var headers = mappingData[0].map(function(h) { return String(h).trim(); });
  
  // Get permission ID mapping
  var permIdMap = {};
  allPerms.forEach(function(p) {
    permIdMap[p.permission_code] = p.permission_id;
  });
  
  // Find and delete existing mappings for this role
  var rowsToDelete = [];
  for (var i = mappingData.length - 1; i >= 1; i--) {
    if (String(mappingData[i][1]) === String(roleId)) { // role_id_fk is column 2
      rowsToDelete.push(i + 1);
    }
  }
  
  // Delete from bottom to top to avoid index shifting
  rowsToDelete.forEach(function(rowIdx) {
    mappingSheet.deleteRow(rowIdx);
  });
  
  // Add new mappings
  permissions.forEach(function(permCode) {
    var permId = permIdMap[permCode];
    if (permId) {
      var newId = generateId('M', 'role_permission_mapping', 'mapping_id');
      appendRow('role_permission_mapping', {
        mapping_id: newId,
        role_id_fk: roleId,
        permission_id_fk: permId
      });
    }
  });
  
  return success({ message: 'Role permissions updated' });
}

// ─── RBAC: USER MANAGEMENT ────────────────────────────────────────────────────

function handleGetUsers() {
  // Don't return password_hash
  var result = sheetToObjects('users').map(function(u) {
    return {
      user_id: u.user_id,
      username: u.username,
      display_name: u.display_name,
      email: u.email,
      role_id: u.role_id,
      is_active: u.is_active,
      created_on: u.created_on,
      last_login_on: u.last_login_on
    };
  });
  
  return success(result);
}

function handleCreateUser(body) {
  if (!body.username || !body.password || !body.display_name || !body.email || !body.role_id) {
    return error('username, password, display_name, email, and role_id are required', 400);
  }

  // Check if username exists
  var existing = sheetToObjects('users').find(function(u) {
    return u.username === body.username;
  });
  if (existing) return error('Username already exists', 409);

  var newUser = {
    user_id: generateId('U', 'users', 'user_id'),
    username: body.username,
    password_hash: body.password,
    display_name: body.display_name,
    email: body.email,
    role_id: body.role_id,
    is_active: body.is_active !== undefined ? body.is_active : true,
    created_on: now(),
    last_login_on: ''
  };

  appendRow('users', newUser);
  
  // Return without password
  return success({
    user_id: newUser.user_id,
    username: newUser.username,
    display_name: newUser.display_name,
    email: newUser.email,
    role_id: newUser.role_id,
    is_active: newUser.is_active,
    created_on: newUser.created_on
  });
}

function handleUpdateUser(body) {
  if (!body.user_id) return error('user_id required', 400);
  
  var updateObj = {};
  if (body.username !== undefined) updateObj.username = body.username;
  if (body.display_name !== undefined) updateObj.display_name = body.display_name;
  if (body.email !== undefined) updateObj.email = body.email;
  if (body.role_id !== undefined) updateObj.role_id = body.role_id;
  if (body.is_active !== undefined) updateObj.is_active = body.is_active;
  if (body.password !== undefined) updateObj.password_hash = body.password;
  
  var updated = updateRowById('users', 'user_id', body.user_id, updateObj);
  if (!updated) return error('User not found', 404);
  return success({ message: 'User updated' });
}

function handleDeleteUser(userId) {
  if (!userId) return error('user_id required', 400);
  
  // Soft delete: mark as inactive
  var updated = updateRowById('users', 'user_id', userId, { is_active: false });
  if (!updated) return error('User not found', 404);
  return success({ message: 'User deleted' });
}

// ─── RBAC: USER PROJECT ASSIGNMENT ───────────────────────────────────────────

function handleGetUserProjects(userId) {
  if (!userId) return error('user_id required', 400);

  var mappings = sheetToObjects('user_project_mapping').filter(function(m) {
    return String(m.user_id_fk) === String(userId) && String(m.is_active).toUpperCase() === 'TRUE';
  });

  return success(mappings);
}

// Admin: all mappings for a user regardless of is_active
function handleGetUserProjectMappings(userId) {
  if (!userId) return error('user_id required', 400);
  var mappings = sheetToObjects('user_project_mapping').filter(function(m) {
    return String(m.user_id_fk) === String(userId);
  });
  return success(mappings);
}

// Admin: all projects without any user filter
function handleGetAllProjects() {
  return success(sheetToObjects('tasks_manager_projects'));
}

function handleAssignUserToProject(body) {
  if (!body.user_id || !body.project_id || !body.project_category) {
    return error('user_id, project_id, and project_category are required', 400);
  }

  // Uniqueness: (user_id, project_id, project_category)
  var mappings = sheetToObjects('user_project_mapping');
  var existing = mappings.find(function(m) {
    return String(m.user_id_fk) === String(body.user_id)
      && String(m.project_id_fk) === String(body.project_id)
      && String(m.project_category) === String(body.project_category);
  });

  if (existing) {
    // Reactivate if exists
    updateRowById('user_project_mapping', 'mapping_id', existing.mapping_id, { is_active: true });
    return success({
      mapping_id: existing.mapping_id,
      user_id_fk: body.user_id,
      project_id_fk: body.project_id,
      project_category: body.project_category,
      is_active: true
    });
  }

  // Create new mapping
  var newMapping = {
    mapping_id: generateId('UP', 'user_project_mapping', 'mapping_id'),
    user_id_fk: body.user_id,
    project_id_fk: body.project_id,
    project_category: body.project_category,
    is_active: true
  };

  appendRow('user_project_mapping', newMapping);
  return success(newMapping);
}

function handleRemoveUserFromProject(mappingId) {
  if (!mappingId) return error('mapping_id required', 400);
  
  // Soft delete: mark as inactive
  var updated = updateRowById('user_project_mapping', 'mapping_id', mappingId, { is_active: false });
  if (!updated) return error('Mapping not found', 404);
  return success({ message: 'User removed from project' });
}

// ─── MASTERS ─────────────────────────────────────────────────────────────────

function handleGetMasters() {
  var statuses = sheetToObjects('status_master');
  var priorities = sheetToObjects('priority_master');
  var taskTypes = sheetToObjects('task_type_master');
  var roles = sheetToObjects('roles');
  var users = sheetToObjects('users').map(function(u) {
    return { user_id: u.user_id, display_name: u.display_name, username: u.username, email: u.email };
  });

  return success({ statuses: statuses, priorities: priorities, task_types: taskTypes, roles: roles, users: users });
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function handleGetDashboard(userId) {
  if (!userId) return error('user_id required', 400);

  // Get user's accessible TASKS projects for dashboard
  var userProjects = getUserProjectsData(userId, 'TASKS');
  var accessibleProjectIds = userProjects.map(function(p) { return p.project_id_fk; });

  // If user has VIEW_ALL_PROJECTS permission, get all projects
  var viewAll = canViewAllProjects(userId);

  var allProjects = sheetToObjects('tasks_manager_projects');
  var projects = viewAll ? allProjects : allProjects.filter(function(p) {
    return accessibleProjectIds.indexOf(String(p.project_id)) !== -1;
  });

  var projectIds = projects.map(function(p) { return p.project_id; });

  var allTasks = sheetToObjects('tasks_manager_tasks');
  var tasks = allTasks.filter(function(t) {
    return projectIds.indexOf(String(t.project_id_fk)) !== -1;
  });

  var today = now();

  var stats = {
    totalProjects: projects.length,
    openTasks: tasks.filter(function(t) { return t.task_status === 'open'; }).length,
    inProgressTasks: tasks.filter(function(t) { return t.task_status === 'in_progress'; }).length,
    overdueTasks: tasks.filter(function(t) {
      return t.task_date && String(t.task_date) < today
        && t.task_status !== 'completed' && t.task_status !== 'closed';
    }).length,
    completedTasks: tasks.filter(function(t) { return t.task_status === 'completed'; }).length
  };

  // Recent tasks (last 5 modified)
  var recentTasks = tasks.slice().sort(function(a, b) {
    var da = String(b.last_modified_on || b.created_on);
    var db = String(a.last_modified_on || a.created_on);
    return da > db ? 1 : da < db ? -1 : 0;
  }).slice(0, 5);

  // Upcoming tasks (due in next 7 days, not completed)
  var sevenDaysLater = new Date();
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);
  var sevenDaysStr = Utilities.formatDate(sevenDaysLater, Session.getScriptTimeZone(), 'yyyy-MM-dd');

  var upcomingTasks = tasks.filter(function(t) {
    return t.task_date && String(t.task_date) >= today && String(t.task_date) <= sevenDaysStr
      && t.task_status !== 'completed' && t.task_status !== 'closed';
  }).slice(0, 5);

  // Project-wise task counts
  var projectStats = projects.map(function(p) {
    var pTasks = tasks.filter(function(t) { return String(t.project_id_fk) === String(p.project_id); });
    return {
      project_id: p.project_id,
      project_name: p.project_name,
      total: pTasks.length,
      completed: pTasks.filter(function(t) { return t.task_status === 'completed'; }).length,
      open: pTasks.filter(function(t) { return t.task_status === 'open'; }).length,
      in_progress: pTasks.filter(function(t) { return t.task_status === 'in_progress'; }).length
    };
  });

  // Today's tasks: due today, not completed or closed
  var todaysTasks = tasks.filter(function(t) {
    return t.task_date && String(t.task_date) === today
      && t.task_status !== 'completed' && t.task_status !== 'closed';
  });

  // Status groups: group all tasks by status, enriched with label from status_master
  var allStatuses = sheetToObjects('status_master');
  var statusGroups = allStatuses
    .sort(function(a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
    .map(function(s) {
      return {
        status: s.status_name,
        label: s.status_label,
        tasks: tasks.filter(function(t) { return t.task_status === s.status_name; })
      };
    });

  return success({ stats: stats, recentTasks: recentTasks, upcomingTasks: upcomingTasks, projectStats: projectStats, todaysTasks: todaysTasks, statusGroups: statusGroups });
}

// ─── PROJECTS ────────────────────────────────────────────────────────────────

function handleGetProjects(userId, category) {
  if (!userId) return error('user_id required', 400);

  // category defaults to TASKS if not specified
  var cat = category || 'TASKS';

  // Check if user can view all projects
  var viewAll = canViewAllProjects(userId);

  // Get user's accessible projects for this category
  var userProjects = getUserProjectsData(userId, cat);
  var accessibleProjectIds = userProjects.map(function(p) { return p.project_id_fk; });

  var allProjects = sheetToObjects('tasks_manager_projects');
  var projects = viewAll ? allProjects : allProjects.filter(function(p) {
    return accessibleProjectIds.indexOf(String(p.project_id)) !== -1;
  });

  // Enrich with task counts, status details, and artifacts
  var allTasks = sheetToObjects('tasks_manager_tasks');
  var statuses = sheetToObjects('status_master');
  
  // Robust lookup for artifacts sheet
  var artifactSheetName = 'tasks_manager_project_artifacts';
  try { getSheet(artifactSheetName); } catch(e) { artifactSheetName = 'project_artifacts'; }
  
  var allArtifacts = [];
  try { 
    allArtifacts = sheetToObjects(artifactSheetName); 
  } catch(e) { 
    Logger.log('Artifacts sheet not found: ' + e.message);
  }

  var result = projects.map(function(p) {
    var pTasks = allTasks.filter(function(t) { return String(t.project_id_fk) === String(p.project_id); });
    
    // Filter artifacts by foreign key (try both new and old property names)
    var pArtifacts = allArtifacts.filter(function(a) { 
      var fk = a.tasks_manager_project_artifacts_id_fk || a.project_id_fk;
      return String(fk) === String(p.project_id); 
    });
    
    var statusObj = statuses.find(function(s) { return String(s.status_id) === String(p.project_status_id_fk); });
    
    return Object.assign({}, p, {
      project_status: statusObj ? (statusObj.status_label || statusObj.status_name) : 'Unknown',
      task_total: pTasks.length,
      task_done: pTasks.filter(function(t) { return t.task_status === 'completed'; }).length,
      artifacts: pArtifacts
    });
  });

  Logger.log('Enriched ' + result.length + ' projects with artifacts from ' + artifactSheetName);
  return success(result);
}

function handleCreateProject(body) {
  if (!body.project_name || !body.project_status_id_fk || !body.project_start_date || !body.project_end_date) {
    return error('project_name, project_status_id_fk, project_start_date, and project_end_date are required', 400);
  }

  var newProject = {
    project_id: generateProjectId(),
    project_name: body.project_name,
    project_description: body.project_description,
    project_status_id_fk: body.project_status_id_fk,
    project_start_date: body.project_start_date || '',
    project_end_date: body.project_end_date || '',
    created_by: body.created_by,
    created_on: now(),
    last_modified_by: body.created_by,
    last_modified_on: now()
  };

  appendRow('tasks_manager_projects', newProject);

  // Save nested artifacts if provided
  if (body.artifacts) {
    saveProjectArtifacts(newProject.project_id, body.artifacts, body.created_by);
  }

  // Auto-grant project access to the creator for both categories
  if (body.created_by) {
    ['TASKS', 'BUDGET'].forEach(function(cat) {
      appendRow('user_project_mapping', {
        mapping_id: generateId('UP', 'user_project_mapping', 'mapping_id'),
        user_id_fk: body.created_by,
        project_id_fk: newProject.project_id,
        project_category: cat,
        is_active: true
      });
    });
  }

  return success(newProject);
}

function handleUpdateProject(body) {
  if (!body.project_id) return error('project_id required', 400);
  if (!body.project_name || !body.project_status_id_fk || !body.project_start_date || !body.project_end_date) {
    return error('project_name, project_status_id_fk, project_start_date, and project_end_date are required', 400);
  }

  body.last_modified_on = now();
  var updated = updateRowById('tasks_manager_projects', 'project_id', body.project_id, body);
  if (!updated) return error('Project not found', 404);

  // Sync nested artifacts if provided
  if (body.artifacts) {
    saveProjectArtifacts(body.project_id, body.artifacts, body.last_modified_by);
  }

  return success({ message: 'Project updated' });
}

// Helper: Sync project artifacts (delete and re-insert)
function saveProjectArtifacts(projectId, artifacts, userId) {
  deleteRowsWhere('tasks_manager_project_artifacts', 'tasks_manager_project_artifacts_id_fk', projectId);
  // Also try deleting by legacy name just in case
  deleteRowsWhere('tasks_manager_project_artifacts', 'project_id_fk', projectId);
  
  if (artifacts && Array.isArray(artifacts)) {
    artifacts.forEach(function(a) {
      var newId = generateId('PA', 'tasks_manager_project_artifacts', 'tasks_manager_project_artifacts_id');
      var artifact = {
        // Current names
        tasks_manager_project_artifacts_id: newId,
        tasks_manager_project_artifacts_id_fk: projectId,
        // Legacy names (for backward compatibility if sheet headers weren't updated)
        project_artifact_id: newId,
        project_id_fk: projectId,
        
        artifact_title: a.artifact_title,
        artifact_value: a.artifact_value,
        artifact_type: a.artifact_type,
        description: a.description || '',
        is_sensitive: a.is_sensitive === true || a.is_sensitive === 'true',
        created_by: userId || a.created_by || '',
        created_on: now()
      };
      appendRow('tasks_manager_project_artifacts', artifact);
    });
  }
}

function handleDeleteProject(projectId, userId) {
  if (!projectId) return error('project_id required', 400);
  var deleted = deleteRowById('tasks_manager_projects', 'project_id', projectId);
  if (!deleted) return error('Project not found', 404);

  // Cascade: delete all tasks, periodicity rows, task artifacts, project artifacts, and mappings
  var projectTasks = sheetToObjects('tasks_manager_tasks').filter(function(t) { return String(t.project_id_fk) === String(projectId); });
  projectTasks.forEach(function(t) {
    deleteRowsWhere('tasks_manager_tasks_periodicty', 'task_id_fk', t.task_id);
    deleteRowsWhere('tasks_manager_task_artifacts', 'task_id_fk', t.task_id);
  });
  deleteRowsWhere('tasks_manager_tasks', 'project_id_fk', projectId);
  deleteRowsWhere('tasks_manager_project_artifacts', 'tasks_manager_project_artifacts_id_fk', projectId);
  deleteRowsWhere('user_project_mapping', 'project_id_fk', projectId);

  // Re-sequence task order IDs after bulk deletion
  recompactAllTaskOrderIds();

  return success({ message: 'Project and all associated data deleted' });
}

// ─── ARTIFACTS ───────────────────────────────────────────────────────────────

function handleGetArtifacts(projectId) {
  if (!projectId) return error('project_id required', 400);
  var artifacts = sheetToObjects('tasks_manager_project_artifacts').filter(function(a) {
    return String(a.tasks_manager_project_artifacts_id_fk) === String(projectId);
  });
  return success(artifacts);
}

function handleCreateArtifact(body) {
  if (!body.tasks_manager_project_artifacts_id_fk || !body.artifact_title || !body.artifact_value || !body.artifact_type) {
    return error('tasks_manager_project_artifacts_id_fk, artifact_title, artifact_value, artifact_type are required', 400);
  }

  var newId = generateId('PA', 'tasks_manager_project_artifacts', 'tasks_manager_project_artifacts_id');
  var artifact = {
    tasks_manager_project_artifacts_id: newId,
    tasks_manager_project_artifacts_id_fk: body.tasks_manager_project_artifacts_id_fk,
    artifact_title: body.artifact_title,
    artifact_value: body.artifact_value,
    artifact_type: body.artifact_type,
    description: body.description || '',
    is_sensitive: body.is_sensitive === true || body.is_sensitive === 'true',
    created_by: body.created_by,
    created_on: now()
  };

  appendRow('tasks_manager_project_artifacts', artifact);
  return success(artifact);
}

function handleUpdateArtifact(body) {
  if (!body.tasks_manager_project_artifacts_id) return error('tasks_manager_project_artifacts_id required', 400);
  var updated = updateRowById('tasks_manager_project_artifacts', 'tasks_manager_project_artifacts_id', body.tasks_manager_project_artifacts_id, body);
  if (!updated) return error('Artifact not found', 404);
  return success({ message: 'Artifact updated' });
}

function handleDeleteArtifact(artifactId) {
  if (!artifactId) return error('tasks_manager_project_artifacts_id required', 400);
  var deleted = deleteRowById('tasks_manager_project_artifacts', 'tasks_manager_project_artifacts_id', artifactId);
  if (!deleted) return error('Artifact not found', 404);
  return success({ message: 'Artifact deleted' });
}

// ─── TASK ARTIFACTS ──────────────────────────────────────────────────────────

function handleGetTaskArtifacts(taskId) {
  if (!taskId) return error('task_id required', 400);
  var artifacts = sheetToObjects('tasks_manager_task_artifacts').filter(function(a) {
    return String(a.task_id_fk) === String(taskId);
  });
  return success(artifacts);
}

function handleCreateTaskArtifact(body) {
  if (!body.task_id_fk || !body.artifact_title || !body.artifact_value || !body.artifact_type) {
    return error('task_id_fk, artifact_title, artifact_value, artifact_type are required', 400);
  }
  var newId = generateId('TA', 'tasks_manager_task_artifacts', 'task_artifact_id');
  var artifact = {
    task_artifact_id: newId,
    task_id_fk: body.task_id_fk,
    artifact_title: body.artifact_title,
    artifact_value: body.artifact_value,
    artifact_type: body.artifact_type,
    is_sensitive: body.is_sensitive || false,
    created_by: body.created_by,
    created_on: now()
  };
  appendRow('tasks_manager_task_artifacts', artifact);
  return success(artifact);
}

function handleUpdateTaskArtifact(body) {
  if (!body.task_artifact_id) return error('task_artifact_id required', 400);
  var updated = updateRowById('tasks_manager_task_artifacts', 'task_artifact_id', body.task_artifact_id, body);
  if (!updated) return error('Artifact not found', 404);
  return success({ message: 'Artifact updated' });
}

function handleDeleteTaskArtifact(artifactId) {
  if (!artifactId) return error('task_artifact_id required', 400);
  var deleted = deleteRowById('tasks_manager_task_artifacts', 'task_artifact_id', artifactId);
  if (!deleted) return error('Artifact not found', 404);
  return success({ message: 'Artifact deleted' });
}

// Helper: Sync task artifacts (delete and re-insert)
function saveTaskArtifacts(taskId, artifacts, userId) {
  deleteRowsWhere('tasks_manager_task_artifacts', 'task_id_fk', taskId);
  
  if (artifacts && Array.isArray(artifacts)) {
    artifacts.forEach(function(a) {
      var newId = generateId('TA', 'tasks_manager_task_artifacts', 'task_artifact_id');
      var artifact = {
        task_artifact_id: newId,
        task_id_fk: taskId,
        artifact_title: a.artifact_title,
        artifact_value: a.artifact_value,
        artifact_type: a.artifact_type,
        description: a.description || '',
        is_sensitive: a.is_sensitive === true || a.is_sensitive === 'true',
        created_by: userId || a.created_by || '',
        created_on: now()
      };
      appendRow('tasks_manager_task_artifacts', artifact);
    });
  }
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

/** One merged API object: main task + this schedule row as top-level date/status + full schedules[]. */
function buildGetTasksRowPayload(t, per, schedules, projects, statuses, priorities, types, users, allArtifacts) {
  var proj = projects.find(function(item) { return String(item.project_id) === String(t.project_id_fk); });
  var s = statuses.find(function(item) { return String(item.status_id) === String(per.task_status_id); });
  var pr = priorities.find(function(item) { return String(item.priority_id) === String(t.priority_id); });
  var ty = types.find(function(item) { return String(item.type_id) === String(t.type_id); });

  var assigneeIds = String(t.task_assignees || '').split('|').filter(Boolean);
  var assigneeNames = assigneeIds.map(function(uid) {
    var u = users.find(function(user) { return String(user.user_id) === uid; });
    return u ? (u.display_name || u.username) : uid;
  }).join(', ');

  return Object.assign({}, t, per, {
    task_id: t.task_id,
    task_date: per.task_date instanceof Date ? Utilities.formatDate(per.task_date, Session.getScriptTimeZone(), 'yyyy-MM-dd') : per.task_date,
    task_start_time: per.task_start_time instanceof Date ? Utilities.formatDate(per.task_start_time, Session.getScriptTimeZone(), 'HH:mm') : per.task_start_time,
    task_end_time: per.task_end_time instanceof Date ? Utilities.formatDate(per.task_end_time, Session.getScriptTimeZone(), 'HH:mm') : per.task_end_time,
    task_periodicity_id: per.task_periodicity_id || '',
    project_name: proj ? proj.project_name : 'Unknown',
    status_label: s ? (s.status_label || s.status_name) : 'Unknown',
    priority_label: pr ? (pr.priority_label || pr.priority_name) : 'Medium',
    type_label: ty ? (ty.type_label || ty.type_name) : 'Task',
    assignee_names: assigneeNames,
    status: s ? (s.status_label || s.status_name) : 'Unknown',
    priority: pr ? (pr.priority_label || pr.priority_name) : 'Medium',
    schedules: schedules,
    artifacts: allArtifacts.filter(function(a) { return String(a.task_id_fk) === String(t.task_id); })
  });
}

function handleGetTasks(userId, projectId) {
  if (!userId) return error('user_id required', 400);

  ensureTaskPeriodicityIds();

  var viewAll = canViewAllProjects(userId);
  var userProjects = getUserProjectsData(userId, 'TASKS');
  var accessibleIds = userProjects.map(function(p) { return p.project_id_fk; });

  var allTasks = sheetToObjects('tasks_manager_tasks');
  var tasks = allTasks;

  // Filter by project if requested
  if (projectId) {
    tasks = tasks.filter(function(t) { return String(t.project_id_fk) === String(projectId); });
  }

  // Filter by permissions if not admin/view-all
  if (!viewAll) {
    tasks = tasks.filter(function(t) {
      return accessibleIds.indexOf(String(t.project_id_fk)) !== -1;
    });
  }

  var allPeriodicities = sheetToObjects('tasks_manager_tasks_periodicty');
  var projects = sheetToObjects('tasks_manager_projects');
  var statuses = sheetToObjects('status_master');
  var priorities = sheetToObjects('priority_master');
  var types = sheetToObjects('task_type_master');
  var users = sheetToObjects('users');
  var allArtifacts = sheetToObjects('tasks_manager_task_artifacts');

  var result = [];
  tasks.forEach(function(t) {
    var schedules = buildSchedulesForTask(t.task_id, allPeriodicities, statuses);
    if (!schedules.length) {
      result.push(buildGetTasksRowPayload(t, {}, schedules, projects, statuses, priorities, types, users, allArtifacts));
      return;
    }
    schedules.forEach(function(per) {
      result.push(buildGetTasksRowPayload(t, per, schedules, projects, statuses, priorities, types, users, allArtifacts));
    });
  });

  return success(result);
}

function handleCreateTask(body) {
  ensureTaskPeriodicityIds();

  var schedulesIn = body.schedules;
  var hasSchedules = schedulesIn && Array.isArray(schedulesIn) && schedulesIn.length > 0;

  if (!body.project_id_fk || !body.task_title) {
    return error('project_id_fk and task_title are required', 400);
  }
  if (!hasSchedules && !body.task_status_id) {
    return error('task_status_id or schedules[] is required', 400);
  }

  var taskId = generateId('KT-', 'tasks_manager_tasks', 'task_id');
  var createdAt = now();
  var uid = body.created_by || '';

  // Main table: static definition fields
  var mainRow = {
    task_id: taskId,
    project_id_fk: body.project_id_fk,
    task_title: body.task_title,
    task_description: body.task_description || '',
    task_assignees: Array.isArray(body.task_assignees) ? body.task_assignees.join('|') : (body.task_assignees || ''),
    type_id: body.type_id || 'T001',
    priority_id: body.priority_id || 'P003'
  };

  appendRow('tasks_manager_tasks', mainRow);

  if (hasSchedules) {
    schedulesIn.forEach(function(s) {
      var newPid = generateId('TP-', 'tasks_manager_tasks_periodicty', 'task_periodicity_id');
      var periodicityRow = {
        task_periodicity_id: newPid,
        task_id_fk: taskId,
        task_remarks: s.task_remarks != null ? s.task_remarks : '',
        task_status_id: s.task_status_id || body.task_status_id || '',
        task_date: s.task_date != null ? s.task_date : '',
        task_start_time: s.task_start_time != null ? s.task_start_time : '',
        task_end_time: s.task_end_time != null ? s.task_end_time : '',
        task_order_id: s.task_order_id != null && s.task_order_id !== '' ? s.task_order_id : getNextTaskOrderId(),
        estimated_hours: s.estimated_hours != null ? s.estimated_hours : 0,
        spent_hours: s.spent_hours != null ? s.spent_hours : 0,
        created_by: uid,
        created_on: createdAt,
        last_modified_by: uid,
        last_modified_on: createdAt
      };
      appendRow('tasks_manager_tasks_periodicty', periodicityRow);
    });
  } else {
    var newPid = generateId('TP-', 'tasks_manager_tasks_periodicty', 'task_periodicity_id');
    var periodicityRow = {
      task_periodicity_id: newPid,
      task_id_fk: taskId,
      task_remarks: body.task_remarks || '',
      task_status_id: body.task_status_id,
      task_date: body.task_date || '',
      task_start_time: body.task_start_time || '',
      task_end_time: body.task_end_time || '',
      task_order_id: body.task_order_id || getNextTaskOrderId(),
      estimated_hours: body.estimated_hours || 0,
      spent_hours: body.spent_hours || 0,
      created_by: uid,
      created_on: createdAt,
      last_modified_by: uid,
      last_modified_on: createdAt
    };
    appendRow('tasks_manager_tasks_periodicty', periodicityRow);
  }

  if (body.artifacts) {
    saveTaskArtifacts(taskId, body.artifacts, body.created_by);
  }

  var statuses = sheetToObjects('status_master');
  var allP = sheetToObjects('tasks_manager_tasks_periodicty');
  var schedulesOut = buildSchedulesForTask(taskId, allP, statuses);
  var primary = schedulesOut[0] || {};

  return success(Object.assign({}, mainRow, primary, { schedules: schedulesOut }));
}

function handleUpdateTask(body) {
  if (!body.task_id) return error('task_id required', 400);

  ensureTaskPeriodicityIds();

  body.last_modified_on = now();
  var uid = body.last_modified_by || '';

  var updated = updateRowById('tasks_manager_tasks', 'task_id', body.task_id, body);
  if (!updated) return error('Task not found', 404);

  if (body.schedules !== undefined) {
    if (!body.schedules || !Array.isArray(body.schedules) || !body.schedules.length) {
      return error('schedules must be a non-empty array', 400);
    }
    try {
      syncTaskPeriodicities(body.task_id, body.schedules, uid);
    } catch (e) {
      return error(e.message || 'Failed to sync schedules', 500);
    }
  } else if (body.task_periodicity_id) {
    var singlePatch = pickPeriodicityPatch(body);
    if (Object.keys(singlePatch).length > 0) {
      singlePatch.last_modified_by = uid;
      singlePatch.last_modified_on = body.last_modified_on;
      updateRowById('tasks_manager_tasks_periodicty', 'task_periodicity_id', body.task_periodicity_id, singlePatch);
    }
  } else {
    var patch = pickPeriodicityPatch(body);
    if (Object.keys(patch).length > 0) {
      patch.last_modified_by = uid;
      patch.last_modified_on = body.last_modified_on;
      updateAllRowsWhere('tasks_manager_tasks_periodicty', 'task_id_fk', body.task_id, patch);
    }
  }

  if (body.artifacts) {
    saveTaskArtifacts(body.task_id, body.artifacts, body.last_modified_by);
  }

  return success({ message: 'Task updated' });
}

function handleDeleteTask(taskId) {
  if (!taskId) return error('task_id required', 400);

  var periodicities = sheetToObjects('tasks_manager_tasks_periodicty').filter(function(p) {
    return String(p.task_id_fk) === String(taskId);
  });
  var ords = periodicities.map(function(p) { return parseInt(p.task_order_id, 10); }).filter(function(n) { return !isNaN(n); });
  var deletedOrder = ords.length ? Math.min.apply(null, ords) : NaN;

  var deleted = deleteRowById('tasks_manager_tasks', 'task_id', taskId);
  if (!deleted) return error('Task not found', 404);

  deleteRowsWhere('tasks_manager_tasks_periodicty', 'task_id_fk', taskId);
  deleteRowsWhere('tasks_manager_task_artifacts', 'task_id_fk', taskId);

  if (!isNaN(deletedOrder)) {
    compactTaskOrderAfterDelete(deletedOrder);
  }

  return success({ message: 'Task deleted' });
}

// ─── AUTO-CLOSE OVERDUE ───────────────────────────────────────────────────────

function handleAutoCloseOverdue() {
  var tasks = sheetToObjects('tasks_manager_tasks');
  var today = now();
  var count = 0;

  tasks.forEach(function(t) {
    if (t.task_date && String(t.task_date) < today
        && t.task_status !== 'completed' && t.task_status !== 'closed') {
      updateRowById('tasks_manager_tasks', 'task_id', t.task_id, {
        task_status: 'closed',
        last_modified_on: today
      });
      count++;
    }
  });

  return success({ message: count + ' tasks auto-closed' });
}
