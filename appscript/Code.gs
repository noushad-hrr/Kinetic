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

    // NEW: RBAC - Roles Management
    case 'getRoles':                 return handleGetRoles();
    case 'createRole':               return handleCreateRole(body);
    case 'updateRole':               return handleUpdateRole(params.role_id, body);
    case 'deleteRole':               return handleDeleteRole(params.role_id);

    // NEW: RBAC - Permissions
    case 'getPermissions':           return handleGetPermissions();
    case 'getRolePermissions':       return handleGetRolePermissions(params.role_id);
    case 'updateRolePermissions':    return handleUpdateRolePermissions(params.role_id, body.permissions);

    // NEW: RBAC - User Management
    case 'getUsers':                 return handleGetUsers();
    case 'createUser':               return handleCreateUser(body);
    case 'updateUser':               return handleUpdateUser(body);
    case 'deleteUser':               return handleDeleteUser(params.user_id);

    // NEW: RBAC - User Project Assignment
    case 'getUserProjects':          return handleGetUserProjects(params.user_id);
    case 'assignUserToProject':      return handleAssignUserToProject(body);
    case 'removeUserFromProject':    return handleRemoveUserFromProject(params.mapping_id);

    // Masters
    case 'getMasters':               return handleGetMasters();

    // Dashboard
    case 'getDashboard':             return handleGetDashboard(params.user_id);

    // Projects
    case 'getProjects':              return handleGetProjects(params.user_id);
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
var SPREADSHEET_ID = '1YZrz688VpAqKKH6uZxs96DRLBZYMCBodMN8DeCzrD5g';

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
        obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
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
  var projects = sheetToObjects('projects');
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
  var tasks = sheetToObjects('tasks');
  if (!tasks.length) return 1;
  return tasks.reduce(function(m, t) {
    var n = parseInt(t.task_order_id, 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0) + 1;
}

// When a task's order_id changes, shift other tasks to fill/make room, maintaining no-gap sequence
function reorderTask(taskId, newOrder) {
  var sheet = getSheet('tasks');
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol = headers.indexOf('task_id');
  var orderCol = headers.indexOf('task_order_id');
  if (idCol === -1 || orderCol === -1) return;

  var oldOrder = null;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(taskId)) {
      oldOrder = parseInt(data[i][orderCol], 10);
      break;
    }
  }
  if (oldOrder === null || isNaN(oldOrder) || oldOrder === newOrder) return;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(taskId)) continue;
    var ord = parseInt(data[i][orderCol], 10);
    if (isNaN(ord)) continue;
    if (newOrder < oldOrder && ord >= newOrder && ord < oldOrder) {
      sheet.getRange(i + 1, orderCol + 1).setValue(ord + 1);
    } else if (newOrder > oldOrder && ord > oldOrder && ord <= newOrder) {
      sheet.getRange(i + 1, orderCol + 1).setValue(ord - 1);
    }
  }
}

// After a task is deleted, decrement all order_ids above it to close the gap
function compactTaskOrderAfterDelete(deletedOrder) {
  var sheet = getSheet('tasks');
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
  var sheet = getSheet('tasks');
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
  
  // Update last_login_on
  updateRowById('users', 'user_id', user.user_id, { last_login_on: now() });

  var sessionUser = {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    role_id: user.role_id,
    role_name: role ? role.role_name : ''
  };

  // Get permissions for this role
  var permissions = getRolePermissionsData(user.role_id);
  var permissionCodes = permissions.map(function(p) { return p.permission_code; }).filter(Boolean);

  // Get user's project assignments
  var projects = getUserProjectsData(user.user_id);

  return success({
    user: sessionUser,
    permissions: permissionCodes,
    projects: projects
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

// Helper: Get projects for a user
function getUserProjectsData(userId) {
  var mappings = sheetToObjects('user_project_mapping');
  return mappings.filter(function(m) {
    return String(m.user_id_fk) === String(userId) && String(m.is_active).toUpperCase() === 'TRUE';
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
  var roles = sheetToObjects('roles').filter(function(r) {
    return String(r.is_deleted).toUpperCase() !== 'TRUE';
  });
  return success(roles);
}

function handleCreateRole(body) {
  if (!body.role_name) {
    return error('role_name is required', 400);
  }

  var newRole = {
    role_id: generateId('R', 'roles', 'role_id'),
    role_name: body.role_name,
    role_description: body.role_description || '',
    is_active: body.is_active !== undefined ? body.is_active : true,
    is_deleted: false,
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

function handleDeleteRole(roleId) {
  if (!roleId) return error('role_id required', 400);
  
  // Soft delete: mark as deleted and inactive
  var updated = updateRowById('roles', 'role_id', roleId, { 
    is_deleted: true, 
    is_active: false 
  });
  if (!updated) return error('Role not found', 404);
  return success({ message: 'Role deleted' });
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
  var users = sheetToObjects('users').filter(function(u) {
    return String(u.is_active).toUpperCase() === 'TRUE';
  });
  
  // Don't return password_hash
  var result = users.map(function(u) {
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

function handleAssignUserToProject(body) {
  if (!body.user_id || !body.project_id) {
    return error('user_id and project_id are required', 400);
  }

  // Check if mapping already exists
  var mappings = sheetToObjects('user_project_mapping');
  var existing = mappings.find(function(m) {
    return m.user_id_fk === body.user_id && m.project_id_fk === body.project_id;
  });

  if (existing) {
    // Reactivate if exists
    updateRowById('user_project_mapping', 'mapping_id', existing.mapping_id, { is_active: true });
    return success({
      mapping_id: existing.mapping_id,
      user_id_fk: body.user_id,
      project_id_fk: body.project_id,
      is_active: true
    });
  }

  // Create new mapping
  var newMapping = {
    mapping_id: generateId('UP', 'user_project_mapping', 'mapping_id'),
    user_id_fk: body.user_id,
    project_id_fk: body.project_id,
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
  var roles = sheetToObjects('roles').filter(function(r) {
    return String(r.is_deleted).toUpperCase() !== 'TRUE';
  });
  var users = sheetToObjects('users').filter(function(u) {
    return String(u.is_active).toUpperCase() === 'TRUE';
  }).map(function(u) {
    return { user_id: u.user_id, display_name: u.display_name, username: u.username, email: u.email };
  });

  return success({ statuses: statuses, priorities: priorities, taskTypes: taskTypes, roles: roles, users: users });
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function handleGetDashboard(userId) {
  if (!userId) return error('user_id required', 400);

  // Get user's accessible projects
  var userProjects = getUserProjectsData(userId);
  var accessibleProjectIds = userProjects.map(function(p) { return p.project_id_fk; });

  // If user has VIEW_ALL_PROJECTS permission, get all projects
  var viewAll = canViewAllProjects(userId);

  var allProjects = sheetToObjects('projects');
  var projects = viewAll ? allProjects : allProjects.filter(function(p) {
    return accessibleProjectIds.indexOf(String(p.project_id)) !== -1;
  });

  var projectIds = projects.map(function(p) { return p.project_id; });

  var allTasks = sheetToObjects('tasks');
  var tasks = allTasks.filter(function(t) {
    return projectIds.indexOf(String(t.project_id_fk)) !== -1;
  });

  var today = now();

  var stats = {
    totalProjects: projects.length,
    openTasks: tasks.filter(function(t) { return t.task_status === 'open'; }).length,
    inProgressTasks: tasks.filter(function(t) { return t.task_status === 'in_progress'; }).length,
    overdueTasks: tasks.filter(function(t) {
      return t.task_end_date && String(t.task_end_date) < today
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
    return t.task_end_date && String(t.task_end_date) >= today && String(t.task_end_date) <= sevenDaysStr
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
    return t.task_end_date && String(t.task_end_date) === today
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

function handleGetProjects(userId) {
  if (!userId) return error('user_id required', 400);

  // Check if user can view all projects
  var viewAll = canViewAllProjects(userId);

  // Get user's accessible projects
  var userProjects = getUserProjectsData(userId);
  var accessibleProjectIds = userProjects.map(function(p) { return p.project_id_fk; });

  var allProjects = sheetToObjects('projects');
  var projects = viewAll ? allProjects : allProjects.filter(function(p) {
    return accessibleProjectIds.indexOf(String(p.project_id)) !== -1;
  });

  return success(projects);
}

function handleCreateProject(body) {
  if (!body.project_name || !body.project_description || !body.project_status) {
    return error('project_name, project_description, project_status are required', 400);
  }
  if (body.project_status !== 'triage' && !body.project_start_date) {
    return error('project_start_date is required when status is not triage', 400);
  }

  var newProject = {
    project_id: generateProjectId(),
    project_name: body.project_name,
    project_description: body.project_description,
    project_status: body.project_status,
    project_start_date: body.project_start_date || '',
    project_end_date: body.project_end_date || '',
    created_by: body.created_by,
    created_on: now(),
    last_modified_by: body.created_by,
    last_modified_on: now()
  };

  appendRow('projects', newProject);

  // Auto-grant project access to the creator via user_project_mapping
  if (body.created_by) {
    var mappingId = generateId('UP', 'user_project_mapping', 'mapping_id');
    appendRow('user_project_mapping', {
      mapping_id: mappingId,
      user_id_fk: body.created_by,
      project_id_fk: newProject.project_id,
      is_active: true
    });
    
  }

  return success(newProject);
}

function handleUpdateProject(body) {
  if (!body.project_id) return error('project_id required', 400);
  if (body.project_status && body.project_status !== 'triage' && !body.project_start_date) {
    return error('project_start_date is required when status is not triage', 400);
  }

  body.last_modified_on = now();
  var updated = updateRowById('projects', 'project_id', body.project_id, body);
  if (!updated) return error('Project not found', 404);
  return success({ message: 'Project updated' });
}

function handleDeleteProject(projectId, userId) {
  if (!projectId) return error('project_id required', 400);
  var deleted = deleteRowById('projects', 'project_id', projectId);
  if (!deleted) return error('Project not found', 404);

  // Cascade: delete all tasks, task artifacts, project artifacts, and mappings for this project
  var projectTasks = sheetToObjects('tasks').filter(function(t) { return String(t.project_id_fk) === String(projectId); });
  projectTasks.forEach(function(t) { deleteRowsWhere('task_artifacts', 'task_id_fk', t.task_id); });
  deleteRowsWhere('tasks', 'project_id_fk', projectId);
  deleteRowsWhere('project_artifacts', 'project_id_fk', projectId);
  deleteRowsWhere('user_project_mapping', 'project_id_fk', projectId);

  // Re-sequence task order IDs after bulk deletion
  recompactAllTaskOrderIds();

  return success({ message: 'Project and all associated data deleted' });
}

// ─── ARTIFACTS ───────────────────────────────────────────────────────────────

function handleGetArtifacts(projectId) {
  if (!projectId) return error('project_id required', 400);
  var artifacts = sheetToObjects('project_artifacts').filter(function(a) {
    return String(a.project_id_fk) === String(projectId);
  });
  return success(artifacts);
}

function handleCreateArtifact(body) {
  if (!body.project_id_fk || !body.artifact_title || !body.artifact_value || !body.artifact_type) {
    return error('project_id_fk, artifact_title, artifact_value, artifact_type are required', 400);
  }

  var newId = generateId('A', 'project_artifacts', 'project_artifact_id');
  var artifact = {
    project_artifact_id: newId,
    project_id_fk: body.project_id_fk,
    artifact_title: body.artifact_title,
    artifact_value: body.artifact_value,
    artifact_type: body.artifact_type,
    is_sensitive: body.is_sensitive || false,
    created_by: body.created_by,
    created_on: now()
  };

  appendRow('project_artifacts', artifact);
  return success(artifact);
}

function handleUpdateArtifact(body) {
  if (!body.project_artifact_id) return error('project_artifact_id required', 400);
  var updated = updateRowById('project_artifacts', 'project_artifact_id', body.project_artifact_id, body);
  if (!updated) return error('Artifact not found', 404);
  return success({ message: 'Artifact updated' });
}

function handleDeleteArtifact(artifactId) {
  if (!artifactId) return error('project_artifact_id required', 400);
  var deleted = deleteRowById('project_artifacts', 'project_artifact_id', artifactId);
  if (!deleted) return error('Artifact not found', 404);
  return success({ message: 'Artifact deleted' });
}

// ─── TASK ARTIFACTS ──────────────────────────────────────────────────────────

function handleGetTaskArtifacts(taskId) {
  if (!taskId) return error('task_id required', 400);
  var artifacts = sheetToObjects('task_artifacts').filter(function(a) {
    return String(a.task_id_fk) === String(taskId);
  });
  return success(artifacts);
}

function handleCreateTaskArtifact(body) {
  if (!body.task_id_fk || !body.artifact_title || !body.artifact_value || !body.artifact_type) {
    return error('task_id_fk, artifact_title, artifact_value, artifact_type are required', 400);
  }
  var newId = generateId('TA', 'task_artifacts', 'task_artifact_id');
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
  appendRow('task_artifacts', artifact);
  return success(artifact);
}

function handleUpdateTaskArtifact(body) {
  if (!body.task_artifact_id) return error('task_artifact_id required', 400);
  var updated = updateRowById('task_artifacts', 'task_artifact_id', body.task_artifact_id, body);
  if (!updated) return error('Artifact not found', 404);
  return success({ message: 'Artifact updated' });
}

function handleDeleteTaskArtifact(artifactId) {
  if (!artifactId) return error('task_artifact_id required', 400);
  var deleted = deleteRowById('task_artifacts', 'task_artifact_id', artifactId);
  if (!deleted) return error('Artifact not found', 404);
  return success({ message: 'Artifact deleted' });
}

// ─── TASKS ───────────────────────────────────────────────────────────────────

function handleGetTasks(userId, projectIdsParam) {
  if (!userId) return error('user_id required', 400);

  // Check if user can view all projects
  var viewAll = canViewAllProjects(userId);

  var userProjects = getUserProjectsData(userId);
  var accessibleIds = userProjects.map(function(p) { return p.project_id_fk; });

  var filterIds = viewAll ? null : accessibleIds;
  if (projectIdsParam) {
    var requestedIds = String(projectIdsParam).split(',').map(function(s) { return s.trim(); });
    filterIds = requestedIds.filter(function(id) { 
      return viewAll || accessibleIds.indexOf(id) !== -1; 
    });
  }

  var allTasks = sheetToObjects('tasks');
  var tasks = filterIds ? allTasks.filter(function(t) {
    return filterIds.indexOf(String(t.project_id_fk)) !== -1;
  }) : allTasks;

  return success(tasks);
}

function handleCreateTask(body) {
  if (!body.project_id_fk || !body.task_title || !body.task_status) {
    return error('project_id_fk, task_title, task_status are required', 400);
  }
  if (body.task_status !== 'triage') {
    if (!body.task_remarks) return error('task_remarks is required when status is not triage', 400);
    if (!body.task_assignees) return error('task_assignees is required when status is not triage', 400);
  }

  var newId = generateId('KT-', 'tasks', 'task_id');
  var task = {
    task_id: newId,
    project_id_fk: body.project_id_fk,
    task_title: body.task_title,
    task_remarks: body.task_remarks || '',
    task_status: body.task_status,
    task_assignees: Array.isArray(body.task_assignees) ? body.task_assignees.join('|') : (body.task_assignees || ''),
    task_start_date: body.task_start_date || '',
    task_end_date: body.task_end_date || '',
    task_start_time: body.task_start_time || '',
    task_end_time: body.task_end_time || '',
    task_order_id: getNextTaskOrderId(),
    type_id: body.type_id || '',
    priority_id: body.priority_id || '',
    estimated_hours: body.estimated_hours || '',
    spent_hours: body.spent_hours || '',
    created_by: body.created_by,
    created_on: now(),
    last_modified_by: body.created_by,
    last_modified_on: now()
  };

  // Auto-close check
  if (task.task_end_date && task.task_end_date < now() && task.task_status !== 'completed') {
    task.task_status = 'closed';
  }

  appendRow('tasks', task);
  return success(task);
}

function handleUpdateTask(body) {
  if (!body.task_id) return error('task_id required', 400);
  if (body.task_status && body.task_status !== 'triage') {
    if (body.hasOwnProperty('task_remarks') && !body.task_remarks) {
      return error('task_remarks is required when status is not triage', 400);
    }
    if (body.hasOwnProperty('task_assignees') && !body.task_assignees) {
      return error('task_assignees is required when status is not triage', 400);
    }
  }

  if (Array.isArray(body.task_assignees)) {
    body.task_assignees = body.task_assignees.join('|');
  }

  // Handle order_id change: reorder other tasks to maintain gap-free sequence
  if (body.task_order_id !== undefined && body.task_order_id !== null && body.task_order_id !== '') {
    var newOrder = parseInt(body.task_order_id, 10);
    if (!isNaN(newOrder) && newOrder >= 1) {
      reorderTask(body.task_id, newOrder);
    }
  }

  // Auto-close check
  if (body.task_end_date && body.task_end_date < now() && body.task_status !== 'completed') {
    body.task_status = 'closed';
  }

  body.last_modified_on = now();
  var updated = updateRowById('tasks', 'task_id', body.task_id, body);
  if (!updated) return error('Task not found', 404);
  return success({ message: 'Task updated' });
}

function handleDeleteTask(taskId) {
  if (!taskId) return error('task_id required', 400);

  // Capture order_id before deleting so we can compact the sequence
  var tasks = sheetToObjects('tasks');
  var task = tasks.find(function(t) { return String(t.task_id) === String(taskId); });
  var deletedOrder = task ? parseInt(task.task_order_id, 10) : NaN;

  var deleted = deleteRowById('tasks', 'task_id', taskId);
  if (!deleted) return error('Task not found', 404);

  // Cascade: delete task artifacts
  deleteRowsWhere('task_artifacts', 'task_id_fk', taskId);

  // Close the gap in the order sequence
  if (!isNaN(deletedOrder)) {
    compactTaskOrderAfterDelete(deletedOrder);
  }

  return success({ message: 'Task deleted' });
}

// ─── AUTO-CLOSE OVERDUE ───────────────────────────────────────────────────────

function handleAutoCloseOverdue() {
  var tasks = sheetToObjects('tasks');
  var today = now();
  var count = 0;

  tasks.forEach(function(t) {
    if (t.task_end_date && String(t.task_end_date) < today
        && t.task_status !== 'completed' && t.task_status !== 'closed') {
      updateRowById('tasks', 'task_id', t.task_id, {
        task_status: 'closed',
        last_modified_on: today
      });
      count++;
    }
  });

  return success({ message: count + ' tasks auto-closed' });
}
