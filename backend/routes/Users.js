const express = require('express');
const router = express.Router();
const { User, UserSession, Logs } = require('../models');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permissions');
const PermissionService = require('../Services/PermissionService');
const { ValidationError, Op } = require('sequelize');
const ACTIVE_SESSION_WINDOW_MINUTES = Number(process.env.ACTIVE_SESSION_WINDOW_MINUTES || 30);

const mapSessionPayload = (session) => ({
  id: session.id,
  sessionId: session.sessionId,
  userId: session.userId,
  ipAddress: session.ipAddress,
  userAgent: session.userAgent,
  deviceName: session.deviceName,
  geoCountry: session.geoCountry,
  geoRegion: session.geoRegion,
  geoCity: session.geoCity,
  geoLat: session.geoLat,
  geoLng: session.geoLng,
  geoSource: session.geoSource,
  loginAt: session.loginAt,
  lastSeenAt: session.lastSeenAt,
  logoutAt: session.logoutAt,
  isActive: session.isActive,
  user: session.user
    ? {
        id: session.user.id,
        name: session.user.name,
        username: session.user.username,
        email: session.user.email,
        role: session.user.role,
        isActive: session.user.isActive,
      }
    : null,
});

// Get all users (users permission required)
router.get('/', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'username', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve users. Please try again.' 
    });
  }
});

router.get('/permissions/catalog', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const catalog = await PermissionService.getCatalog();
    res.json(catalog);
  } catch (error) {
    console.error('Get permissions catalog error:', error);
    res.status(500).json({
      error: 'Failed to retrieve permissions catalog. Please try again.',
    });
  }
});

router.get('/:id/permissions', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const targetUser = await User.findByPk(userId, {
      attributes: ['id', 'name', 'username', 'email', 'role', 'isActive'],
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const matrix = await PermissionService.getUserPermissionMatrix(userId);
    res.json({
      user: targetUser,
      isAdmin: targetUser.role === 'admin',
      permissions: matrix,
    });
  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user permissions. Please try again.',
    });
  }
});

router.put('/:id/permissions', auth, checkPermission('users', 'edit'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const targetUser = await User.findByPk(userId, {
      attributes: ['id', 'name', 'username', 'role'],
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.role === 'admin') {
      return res.status(400).json({ error: 'Admin permissions cannot be edited.' });
    }

    const { permissions = [] } = req.body || {};
    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'permissions must be an array' });
    }

    await PermissionService.saveUserPermissionMatrix(userId, permissions);
    const updatedMatrix = await PermissionService.getUserPermissionMatrix(userId);

    await Logs.create({
      timestamp: new Date().toISOString(),
      type: 'User Permission',
      action: 'update',
      entityType: 'user_permission',
      entityId: String(userId),
      userId: req.user?.id?.toString(),
      metaData: {
        targetUser: {
          id: targetUser.id,
          username: targetUser.username,
          role: targetUser.role,
        },
        changedCount: permissions.length,
      },
    }).catch(() => {});

    res.json({
      message: 'User permissions updated successfully',
      user: targetUser,
      permissions: updatedMatrix,
    });
  } catch (error) {
    console.error('Update user permissions error:', error);
    res.status(500).json({
      error: 'Failed to update user permissions. Please try again.',
    });
  }
});

// Get active login sessions (users permission required)
router.get('/sessions/active', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const activeThreshold = new Date(Date.now() - ACTIVE_SESSION_WINDOW_MINUTES * 60 * 1000);
    const sessions = await UserSession.findAll({
      where: {
        isActive: true,
        logoutAt: { [Op.is]: null },
        lastSeenAt: { [Op.gte]: activeThreshold },
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'username', 'email', 'role', 'isActive'],
        },
      ],
      order: [['lastSeenAt', 'DESC']],
      limit: 200,
    });

    res.json(sessions.map(mapSessionPayload));
  } catch (error) {
    console.error('Get active sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve active sessions. Please try again.',
    });
  }
});

router.get('/sessions/inactive', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const activeThreshold = new Date(Date.now() - ACTIVE_SESSION_WINDOW_MINUTES * 60 * 1000);
    const sessions = await UserSession.findAll({
      where: {
        [Op.or]: [
          { isActive: false },
          { logoutAt: { [Op.not]: null } },
          { lastSeenAt: { [Op.lt]: activeThreshold } },
        ],
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'username', 'email', 'role', 'isActive'],
        },
      ],
      order: [['lastSeenAt', 'DESC']],
      limit: 200,
    });

    res.json(sessions.map(mapSessionPayload));
  } catch (error) {
    console.error('Get inactive sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve inactive sessions. Please try again.',
    });
  }
});

// Get recent login sessions for a specific user (users permission required)
router.get('/sessions/user/:id', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const sessions = await UserSession.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit: 100,
    });

    res.json(sessions);
  } catch (error) {
    console.error('Get user sessions error:', error);
    res.status(500).json({
      error: 'Failed to retrieve user sessions. Please try again.',
    });
  }
});

// Get user by ID (users permission required)
router.get('/:id', auth, checkPermission('users', 'view'), async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'name', 'username', 'email', 'role', 'isActive', 'createdAt', 'updatedAt']
    });

    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user. Please try again.' 
    });
  }
});

// Create new user (users permission required)
router.post('/', auth, checkPermission('users', 'create'), async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
      });
    }

    // Validate role
    const validRoles = ['admin', 'listing', 'packing', 'warehouse_l1', 'warehouse_l2', 'accounts'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ 
      where: { 
        [Op.or]: [{ email }, { username }] 
      } 
    });

    if (existingUser) {
      return res.status(400).json({ 
        error: 'A user with this email or username already exists' 
      });
    }

    const user = await User.create({
      name,
      username,
      email,
      password,
      role: role || 'listing',
      isActive: true
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Invalid input data' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to create user. Please try again.' 
    });
  }
});

// Update user (users permission required)
router.put('/:id', auth, checkPermission('users', 'edit'), async (req, res) => {
  try {
    const { name, username, email, password, role, isActive } = req.body;
    const userId = req.params.id;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    // Validate role if provided
    const validRoles = ['admin', 'listing', 'packing', 'warehouse_l1', 'warehouse_l2', 'accounts'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({ 
        error: 'Invalid role. Must be one of: ' + validRoles.join(', ') 
      });
    }

    // Check if email or username already exists (excluding current user)
    if (email || username) {
      const existingUser = await User.findOne({ 
        where: { 
          [Op.or]: [
            email ? { email } : null,
            username ? { username } : null
          ].filter(Boolean),
          id: { [Op.ne]: userId }
        } 
      });

      if (existingUser) {
        return res.status(400).json({ 
          error: 'A user with this email or username already exists' 
        });
      }
    }

    // Update user
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) updateData.password = password;
    if (role) updateData.role = role;
    if (typeof isActive === 'boolean') updateData.isActive = isActive;

    await user.update(updateData);

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Update user error:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Invalid input data' 
      });
    }

    res.status(500).json({ 
      error: 'Failed to update user. Please try again.' 
    });
  }
});

// Delete user (users permission required)
router.delete('/:id', auth, checkPermission('users', 'delete'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deleting themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ 
        error: 'Cannot delete your own account' 
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    await user.destroy();

    res.json({ 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      error: 'Failed to delete user. Please try again.' 
    });
  }
});

// Toggle user active status (users permission required)
router.patch('/:id/toggle-status', auth, checkPermission('users', 'edit'), async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent admin from deactivating themselves
    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ 
        error: 'Cannot deactivate your own account' 
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ 
        error: 'User not found' 
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role,
      isActive: user.isActive
    });
  } catch (error) {
    console.error('Toggle user status error:', error);
    res.status(500).json({ 
      error: 'Failed to toggle user status. Please try again.' 
    });
  }
});

module.exports = router; 
