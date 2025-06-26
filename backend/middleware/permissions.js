const fs = require('fs');
const path = require('path');

// Function to load role permissions configuration
const loadRolePermissions = () => {
  try {
    const permissionsPath = path.join(__dirname, '../config/role-permissions.json');
    return JSON.parse(fs.readFileSync(permissionsPath, 'utf8'));
  } catch (error) {
    console.error('Error loading role permissions:', error);
    return {};
  }
};

/**
 * Middleware to check if user has permission for a specific resource and action
 * @param {string} resource - The resource to check permissions for (e.g., 'orders', 'products')
 * @param {string} action - The action to check (e.g., 'view', 'create', 'edit', 'delete')
 */
const checkPermission = (resource, action) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Reload permissions on each request to get latest changes
      const rolePermissions = loadRolePermissions();
      
      const userRole = user.role;
      const roleConfig = rolePermissions[userRole];

      if (!roleConfig) {
        return res.status(403).json({ error: 'Invalid user role' });
      }

      const resourcePermissions = roleConfig[resource];
      
      if (!resourcePermissions) {
        return res.status(403).json({ 
          error: `Access denied. ${userRole} role does not have access to ${resource}` 
        });
      }

      if (!resourcePermissions.includes(action)) {
        return res.status(403).json({ 
          error: `Access denied. ${userRole} role does not have ${action} permission for ${resource}` 
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ error: 'Internal server error during permission check' });
    }
  };
};

/**
 * Middleware to check if user has access to a specific menu item
 * @param {string} menuItem - The menu item to check access for
 */
const checkMenuAccess = (menuItem) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Reload permissions on each request to get latest changes
      const rolePermissions = loadRolePermissions();
      
      const userRole = user.role;
      const roleConfig = rolePermissions[userRole];

      if (!roleConfig) {
        return res.status(403).json({ error: 'Invalid user role' });
      }

      const menuAccess = roleConfig.menu || [];
      
      if (!menuAccess.includes(menuItem)) {
        return res.status(403).json({ 
          error: `Access denied. ${userRole} role does not have access to ${menuItem}` 
        });
      }

      next();
    } catch (error) {
      console.error('Menu access check error:', error);
      res.status(500).json({ error: 'Internal server error during menu access check' });
    }
  };
};

/**
 * Get user permissions for frontend
 * This function returns the complete permission structure from role-permissions.json
 */
const getUserPermissions = (req, res) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Reload permissions on each request to get latest changes
    const rolePermissions = loadRolePermissions();
    
    const userRole = user.role;
    const roleConfig = rolePermissions[userRole];

    if (!roleConfig) {
      console.error(`Role configuration not found for role: ${userRole}`);
      return res.status(403).json({ 
        error: `Invalid user role: ${userRole}. Please contact administrator.` 
      });
    }

    // Return the complete role configuration including all permissions and menu items
    // This ensures the frontend gets the exact same structure as defined in role-permissions.json
    const response = {
      role: userRole,
      permissions: roleConfig,
      menu: roleConfig.menu || []
    };

    console.log(`Permissions returned for role ${userRole}:`, response);
    res.json(response);
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ 
      error: 'Internal server error while getting permissions. Please try again.' 
    });
  }
};

module.exports = {
  checkPermission,
  checkMenuAccess,
  getUserPermissions,
  loadRolePermissions
}; 