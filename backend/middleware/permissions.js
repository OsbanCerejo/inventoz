const PermissionService = require("../Services/PermissionService");

const checkPermission = (resource, action) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const allowed = await PermissionService.hasResourceAction(user, resource, action);
      if (!allowed) {
        return res.status(403).json({
          error: `Access denied. ${user.role} role does not have ${action} permission for ${resource}`,
        });
      }

      next();
    } catch (error) {
      console.error("Permission check error:", error);
      res.status(500).json({ error: "Internal server error during permission check" });
    }
  };
};

const checkMenuAccess = (menuItem) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const allowed = await PermissionService.hasMenuAccess(user, menuItem);
      if (!allowed) {
        return res.status(403).json({
          error: `Access denied. ${user.role} role does not have access to ${menuItem}`,
        });
      }

      next();
    } catch (error) {
      console.error("Menu access check error:", error);
      res.status(500).json({ error: "Internal server error during menu access check" });
    }
  };
};

const getUserPermissions = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const resolved = await PermissionService.resolveForUser(user);
    const response = {
      role: user.role,
      permissions: resolved.permissions,
      menu: resolved.menu,
    };
    res.json(response);
  } catch (error) {
    console.error("Get user permissions error:", error);
    res.status(500).json({
      error: "Internal server error while getting permissions. Please try again.",
    });
  }
};

module.exports = {
  checkPermission,
  checkMenuAccess,
  getUserPermissions,
};

