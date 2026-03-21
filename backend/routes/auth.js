const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { auth, adminAuth } = require('../middleware/auth');
const { getUserPermissions } = require('../middleware/permissions');
const UserSessionService = require('../Services/UserSessionService');
const { ValidationError, Op } = require('sequelize');
const {
  createAccessToken,
  createRefreshToken,
  verifyRefreshToken,
  parseCookies,
  refreshCookieName,
  refreshCookieOptions,
} = require('../utils/authTokens');

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const loginAttempts = new Map();

const getLoginKey = (req, email = '') =>
  `${(req.ip || '').toLowerCase()}::${String(email || '').trim().toLowerCase()}`;

const isRateLimited = (key) => {
  const record = loginAttempts.get(key);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    loginAttempts.delete(key);
    return false;
  }
  return record.count >= MAX_LOGIN_ATTEMPTS;
};

const registerFailedAttempt = (key) => {
  const now = Date.now();
  const record = loginAttempts.get(key);
  if (!record || now > record.expiresAt) {
    loginAttempts.set(key, { count: 1, expiresAt: now + LOGIN_WINDOW_MS });
    return;
  }
  record.count += 1;
  loginAttempts.set(key, record);
};

const clearFailedAttempts = (key) => {
  loginAttempts.delete(key);
};

const clearRefreshCookie = (res) => {
  const opts = refreshCookieOptions();
  res.clearCookie(refreshCookieName, {
    httpOnly: opts.httpOnly,
    secure: opts.secure,
    sameSite: opts.sameSite,
    path: opts.path,
  });
};

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const rateKey = getLoginKey(req, email);
    if (isRateLimited(rateKey)) {
      return res.status(429).json({
        error: 'Too many failed login attempts. Please wait and try again.',
      });
    }

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      registerFailedAttempt(rateKey);
      return res.status(401).json({ 
        error: 'No account found with this email' 
      });
    }
    if (!user.isActive) {
      registerFailedAttempt(rateKey);
      return res.status(403).json({
        error: 'This account is inactive. Contact an administrator.',
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      registerFailedAttempt(rateKey);
      return res.status(401).json({ 
        error: 'Invalid password' 
      });
    }
    clearFailedAttempts(rateKey);

    const sessionId = await UserSessionService.createSession(req, user.id);
    const token = createAccessToken(user, sessionId);
    const refreshToken = createRefreshToken(user, sessionId);

    res.cookie(refreshCookieName, refreshToken, refreshCookieOptions());

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({ 
        error: 'Invalid input data' 
      });
    }

    res.status(500).json({ 
      error: 'An unexpected error occurred during login. Please try again.' 
    });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies[refreshCookieName];
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing.' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    const user = await User.findOne({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }
    if (Number(user.tokenVersion || 0) !== Number(decoded.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Refresh token expired.' });
    }

    const sessionId = decoded.sessionId || (await UserSessionService.createSession(req, user.id));
    const newAccessToken = createAccessToken(user, sessionId);
    const rotatedRefreshToken = createRefreshToken(user, sessionId);
    res.cookie(refreshCookieName, rotatedRefreshToken, refreshCookieOptions());

    await UserSessionService.touchSession(sessionId);

    res.json({
      token: newAccessToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(401).json({ error: 'Invalid refresh token.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const refreshToken = cookies[refreshCookieName];
    if (refreshToken) {
      const decoded = verifyRefreshToken(refreshToken);
      if (decoded?.sessionId) {
        await UserSessionService.closeSession(decoded.sessionId);
      }
    }
  } catch (error) {
    // Ignore invalid/expired refresh cookie during logout.
  }
  clearRefreshCookie(res);
  return res.json({ success: true });
});

router.post('/logout-all', auth, async (req, res) => {
  try {
    await User.update(
      { tokenVersion: Number(req.user.tokenVersion || 0) + 1 },
      { where: { id: req.user.id } }
    );
    await UserSessionService.closeAllSessionsForUser(req.user.id);
    clearRefreshCookie(res);
    return res.json({ success: true });
  } catch (error) {
    console.error('Logout-all error:', error);
    return res.status(500).json({ error: 'Failed to log out all sessions.' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      id: req.user.id,
      name: req.user.name,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve user information' 
    });
  }
});

// Get user permissions
router.get('/permissions', auth, getUserPermissions);

// Create user (admin only)
router.post('/users', adminAuth, async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ 
        error: 'Username, email, and password are required' 
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
      role: role || 'user'
    });

    res.status(201).json({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      role: user.role
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

module.exports = router; 
