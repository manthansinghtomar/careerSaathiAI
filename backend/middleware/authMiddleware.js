const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: 'Not authorized, no token provided',
        });
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return res.status(500).json({
          success: false,
          status: 500,
          message: 'Server configuration error: JWT_SECRET is not defined',
        });
      }

      let decoded;
      try {
        decoded = jwt.verify(token, secret);
      } catch (jwtErr) {
        if (jwtErr.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            status: 401,
            message: 'Token has expired. Please log in again',
          });
        }
        return res.status(401).json({
          success: false,
          status: 401,
          message: 'Not authorized, invalid token',
        });
      }

      if (!decoded || !decoded.id) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: 'Not authorized, invalid token payload',
        });
      }

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: 'Not authorized, user not found',
        });
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          status: 401,
          message: 'Not authorized, account is deactivated',
        });
      }

      req.user = user;
      next();
    } catch (error) {
      next(error);
    }
  } else {
    return res.status(401).json({
      success: false,
      status: 401,
      message: 'Not authorized, no token provided',
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        status: 401,
        message: 'Not authorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        status: 403,
        message: `Access forbidden: Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};
