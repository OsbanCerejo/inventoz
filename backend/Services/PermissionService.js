const { Op } = require("sequelize");
const { Permission, UserPermission } = require("../models");

const CACHE_TTL_MS = Number(process.env.PERMISSION_CACHE_TTL_MS || 60000);
const cache = new Map();

const cacheKey = (userId, role) => `${userId}:${role}`;

const getCached = (key) => {
  const row = cache.get(key);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    cache.delete(key);
    return null;
  }
  return row.value;
};

const setCached = (key, value) => {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
};

const buildPermissionShape = (permissions) => {
  const resources = {};
  const menu = [];
  permissions.forEach((perm) => {
    if (perm.scopeType === "resource_action" && perm.resource && perm.action) {
      if (!resources[perm.resource]) resources[perm.resource] = [];
      if (!resources[perm.resource].includes(perm.action)) {
        resources[perm.resource].push(perm.action);
      }
    }
    if (perm.scopeType === "menu" && perm.menuKey) {
      if (!menu.includes(perm.menuKey)) menu.push(perm.menuKey);
    }
  });
  return { resources, menu };
};

class PermissionService {
  static clearUserCache(userId) {
    const prefix = `${userId}:`;
    Array.from(cache.keys()).forEach((key) => {
      if (key.startsWith(prefix)) cache.delete(key);
    });
  }

  static async getCatalog() {
    return Permission.findAll({
      order: [
        ["scopeType", "ASC"],
        ["resource", "ASC"],
        ["action", "ASC"],
        ["menuKey", "ASC"],
      ],
    });
  }

  static async resolveForUser(user) {
    const key = cacheKey(user.id, user.role);
    const cached = getCached(key);
    if (cached) return cached;

    const allPermissions = await this.getCatalog();

    if (user.role === "admin") {
      const shaped = buildPermissionShape(allPermissions);
      const result = {
        role: user.role,
        permissions: shaped.resources,
        menu: shaped.menu,
        allowedKeys: new Set(allPermissions.map((p) => p.key)),
      };
      setCached(key, result);
      return result;
    }

    const userPermissions = await UserPermission.findAll({
      where: { userId: user.id, allowed: true },
      include: [
        {
          model: Permission,
          as: "permission",
          required: true,
        },
      ],
    });

    const allowedPermissions = userPermissions
      .map((row) => row.permission)
      .filter(Boolean);
    const shaped = buildPermissionShape(allowedPermissions);
    const result = {
      role: user.role,
      permissions: shaped.resources,
      menu: shaped.menu,
      allowedKeys: new Set(allowedPermissions.map((p) => p.key)),
    };
    setCached(key, result);
    return result;
  }

  static async hasResourceAction(user, resource, action) {
    if (user.role === "admin") return true;
    const resolved = await this.resolveForUser(user);
    return resolved.allowedKeys.has(`${resource}.${action}`);
  }

  static async hasMenuAccess(user, menuItem) {
    if (user.role === "admin") return true;
    const resolved = await this.resolveForUser(user);
    return resolved.allowedKeys.has(`menu.${menuItem}`);
  }

  static async getUserPermissionMatrix(userId) {
    const [catalog, userRows] = await Promise.all([
      this.getCatalog(),
      UserPermission.findAll({
        where: { userId },
        attributes: ["permissionId", "allowed"],
      }),
    ]);
    const userMap = new Map(userRows.map((row) => [row.permissionId, !!row.allowed]));
    return catalog.map((perm) => ({
      id: perm.id,
      key: perm.key,
      scopeType: perm.scopeType,
      resource: perm.resource,
      action: perm.action,
      menuKey: perm.menuKey,
      label: perm.label,
      allowed: userMap.get(perm.id) || false,
    }));
  }

  static async saveUserPermissionMatrix(userId, items = []) {
    const now = new Date();

    // Delete all existing rows for this user — we'll re-insert only the allowed ones.
    // Storing allowed=false rows is wasteful; a missing row is treated as false by resolveForUser.
    await UserPermission.destroy({ where: { userId } });

    const toInsert = items
      .filter((item) => {
        const id = Number(item.permissionId);
        return Number.isInteger(id) && id > 0 && !!item.allowed;
      })
      .map((item) => ({
        userId,
        permissionId: Number(item.permissionId),
        allowed: true,
        createdAt: now,
        updatedAt: now,
      }));

    if (toInsert.length > 0) {
      await UserPermission.bulkCreate(toInsert);
    }

    this.clearUserCache(userId);
  }
}

module.exports = PermissionService;

