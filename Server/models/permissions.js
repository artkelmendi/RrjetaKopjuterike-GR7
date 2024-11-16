// Define permission levels
const PermissionLevel = {
  NONE: 0,
  VIEW: 1,
  EDIT: 2,
  EXECUTE: 4,
  DELETE: 8,
  ADMIN: 15, // All permissions (1+2+4+8)
};

// Define user roles
const UserRole = {
  GUEST: "guest",
  USER: "user",
  MODERATOR: "moderator",
  ADMIN: "admin",
};

// Default permissions for each role
const RolePermissions = {
  [UserRole.GUEST]: PermissionLevel.VIEW,
  [UserRole.USER]: PermissionLevel.VIEW | PermissionLevel.EDIT,
  [UserRole.MODERATOR]:
    PermissionLevel.VIEW | PermissionLevel.EDIT | PermissionLevel.EXECUTE,
  [UserRole.ADMIN]: PermissionLevel.ADMIN,
};

module.exports = {
  PermissionLevel,
  UserRole,
  RolePermissions,
};
