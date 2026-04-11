/**
 * KINETIC - Google Apps Script API Layer
 * Deploy as Web App: Execute as Me, Anyone can access
 */

// ─── CORS & RESPONSE HELPERS ─────────────────────────────────────────────────

function setCorsHeaders(output) {
  return output
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
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

    var body = {};
    if (params.data) {
      try {
        body = JSON.parse(params.data);
      } catch(ex1) {
        try {
          body = JSON.parse(decodeURIComponent(params.data));
        } catch(ex2) {}
      }
    }

    if (action === 'loginWithRBAC') {
      if (params.username) body.username = params.username;
      if (params.password) body.password = params.password;
    }

    return route(action, params, body);
  } catch (err) {
    return error('Server error: ' + err.message, 500);
  }
}

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
    case 'loginWithRBAC':           return handleLoginWithRBAC(body);

    // RBAC - Roles
    case 'getRoles':                 return handleGetRoles();
    case 'createRole':               return handleCreateRole(body);
    case 'updateRole':               return handleUpdateRole(params.role_id, body);
    case 'deleteRole':               return handleDeleteRole(params.role_id);

    // RBAC - Permissions
    case 'getPermissions':           return handleGetPermissions();
    case 'getRolePermissions':       return handleGetRolePermissions(params.role_id);
    case 'updateRolePermissions':    return handleUpdateRolePermissions(params.role_id, body.permissions);

    // RBAC - Users
    case 'getUsers':                 return handleGetUsers();
    case 'createUser':               return handleCreateUser(body);
    case 'updateUser':               return handleUpdateUser(body);
    case 'deleteUser':               return handleDeleteUser(params.user_id);

    // Masters
    case 'getMasters':               return handleGetMasters();

    default:
      return error('Unknown action: ' + action, 404);
  }
}

// ─── SPREADSHEET ACCESS ───────────────────────────────────────────────────────

var SPREADSHEET_ID = '1YZrz688VpAqKKH6uZxs96DRLBZYMCBodMN8DeCzrD5g';

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID !== 'YOUR_SPREADSHEET_ID_HERE') {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet(name) {
  var ss = getSpreadsheet();
  if (!ss) throw new Error('Cannot access spreadsheet. Set SPREADSHEET_ID in Code.gs');
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Sheet tab not found: "' + name + '"');
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

function now() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

// ─── AUTH ─────────────────────────────────────────────────────────────────────

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

  var roles = sheetToObjects('roles');
  var role = roles.find(function(r) { return r.role_id === user.role_id; });

  updateRowById('users', 'user_id', user.user_id, { last_login_on: now() });

  var sessionUser = {
    user_id: user.user_id,
    username: user.username,
    display_name: user.display_name,
    email: user.email,
    role_id: user.role_id,
    role_name: role ? role.role_name : ''
  };

  var permissions = getRolePermissionsData(user.role_id);
  var permissionCodes = permissions.map(function(p) { return p.permission_code; }).filter(Boolean);

  return success({
    user: sessionUser,
    permissions: permissionCodes
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

// Check if user has a specific permission
function userHasPermission(userId, permissionCode) {
  var users = sheetToObjects('users');
  var user = users.find(function(u) { return u.user_id === userId; });
  if (!user) return false;
  var perms = getRolePermissionsData(user.role_id);
  return perms.some(function(p) { return p.permission_code === permissionCode; });
}

// ─── RBAC: ROLES MANAGEMENT ──────────────────────────────────────────────────

function handleGetRoles() {
  var roles = sheetToObjects('roles').filter(function(r) {
    return String(r.is_deleted).toUpperCase() !== 'TRUE';
  });
  return success(roles);
}

function handleCreateRole(body) {
  if (!body.role_name) return error('role_name is required', 400);

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

  var updated = updateRowById('roles', 'role_id', roleId, {
    is_deleted: true,
    is_active: false
  });
  if (!updated) return error('Role not found', 404);
  return success({ message: 'Role deleted' });
}

// ─── RBAC: PERMISSIONS ───────────────────────────────────────────────────────

function handleGetPermissions() {
  return success(sheetToObjects('permissions'));
}

function handleGetRolePermissions(roleId) {
  if (!roleId) return error('role_id required', 400);

  var mapping = sheetToObjects('role_permission_mapping');
  var perms = sheetToObjects('permissions');

  var rolePerms = mapping.filter(function(m) { return m.role_id_fk === roleId; });

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

  var permIdMap = {};
  allPerms.forEach(function(p) {
    permIdMap[p.permission_code] = p.permission_id;
  });

  // Delete existing mappings for this role (bottom-to-top)
  var rowsToDelete = [];
  for (var i = mappingData.length - 1; i >= 1; i--) {
    if (String(mappingData[i][1]) === String(roleId)) {
      rowsToDelete.push(i + 1);
    }
  }
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

// ─── RBAC: USER MANAGEMENT ───────────────────────────────────────────────────

function handleGetUsers() {
  var users = sheetToObjects('users').filter(function(u) {
    return String(u.is_active).toUpperCase() === 'TRUE';
  });

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
  var updated = updateRowById('users', 'user_id', userId, { is_active: false });
  if (!updated) return error('User not found', 404);
  return success({ message: 'User deleted' });
}

// ─── MASTERS ─────────────────────────────────────────────────────────────────

function handleGetMasters() {
  var roles = sheetToObjects('roles').filter(function(r) {
    return String(r.is_deleted).toUpperCase() !== 'TRUE';
  });

  var users = sheetToObjects('users').filter(function(u) {
    return String(u.is_active).toUpperCase() === 'TRUE';
  }).map(function(u) {
    return { user_id: u.user_id, display_name: u.display_name, username: u.username, email: u.email };
  });

  return success({ roles: roles, users: users });
}
