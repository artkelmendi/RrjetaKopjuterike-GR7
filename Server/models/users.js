const users = new Map();

class User {
  constructor(id, username, role = UserRole.GUEST) {
    this.id = id;
    this.username = username;
    this.role = role;
    this.customPermissions = new Map(); // File-specific permissions
  }

  hasPermission(permissionLevel, fileId = null) {
    // Check file-specific permissions first
    if (fileId && this.customPermissions.has(fileId)) {
      return (
        (this.customPermissions.get(fileId) & permissionLevel) ===
        permissionLevel
      );
    }
    // Fall back to role-based permissions
    return (RolePermissions[this.role] & permissionLevel) === permissionLevel;
  }

  setCustomPermission(fileId, permissionLevel) {
    this.customPermissions.set(fileId, permissionLevel);
  }
}

module.exports = { User, users };
