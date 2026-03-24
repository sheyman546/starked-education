const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ error: 'Token is valid but user not found.' });
    }
    
    if (!user.isActive) {
      return res.status(401).json({ error: 'Account has been deactivated.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired.' });
    }
    
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Server error in authentication.' });
  }
};

// Optional auth - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (user && user.isActive) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Silently continue without auth
    next();
  }
};

// Role-based access control
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Authentication required.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions.' });
    }
    
    next();
  };
};

// Check if user owns the resource or is admin
const checkOwnership = (resourceField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Access denied. Authentication required.' });
    }
    
    // Admin can access everything
    if (req.user.role === 'admin') {
      return next();
    }
    
    // Check if user owns the resource
    const resource = req.body[resourceField] || req.params[resourceField] || req.query[resourceField];
    
    if (resource && resource.toString() !== req.user.id.toString()) {
      return res.status(403).json({ error: 'Access denied. You can only access your own resources.' });
    }
    
    next();
  };
};

// Check if user is instructor or admin
const instructorOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Access denied. Authentication required.' });
  }
  
  if (!['instructor', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Access denied. Instructor or admin access required.' });
  }
  
  next();
};

// Rate limiting for sensitive endpoints
const createRateLimit = (windowMs, max, message) => {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: { error: message || 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

// Specific rate limits
const loginRateLimit = createRateLimit(15 * 60 * 1000, 5, 'Too many login attempts. Please try again in 15 minutes.');
const registerRateLimit = createRateLimit(60 * 60 * 1000, 3, 'Too many registration attempts. Please try again in 1 hour.');
const uploadRateLimit = createRateLimit(60 * 60 * 1000, 10, 'Too many upload attempts. Please try again in 1 hour.');

module.exports = {
  auth,
  optionalAuth,
  authorize,
  checkOwnership,
  instructorOrAdmin,
  createRateLimit,
  loginRateLimit,
  registerRateLimit,
  uploadRateLimit
};
