const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { auth, adminAuth } = require('../middleware/auth');
const { getUserPermissions } = require('../middleware/permissions');
const { ValidationError, Op } = require('sequelize');

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ 
        error: 'No account found with this email' 
      });
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: 'Invalid password' 
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id }, 
      process.env.JWT_SECRET || 'your-secret-key', // Fallback for development
      { expiresIn: '24h' }
    );

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