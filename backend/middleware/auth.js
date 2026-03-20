const { User } = require('../models');
const { verifyAccessToken } = require('../utils/authTokens');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error();
    }

    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user || !user.isActive || Number(user.tokenVersion || 0) !== Number(decoded.tokenVersion || 0)) {
      throw new Error();
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

const adminAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Please authenticate.' });
    }

    const decoded = verifyAccessToken(token);
    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Please authenticate.' });
    }
    const user = await User.findOne({ where: { id: decoded.id } });

    if (!user || !user.isActive || Number(user.tokenVersion || 0) !== Number(decoded.tokenVersion || 0)) {
      return res.status(401).json({ error: 'Please authenticate.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }

    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

module.exports = { auth, adminAuth }; 
