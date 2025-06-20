const jwt = require('jsonwebtoken');
<<<<<<< HEAD
const User = require('../models/User');

// Middleware para verificar token JWT
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token de acceso requerido'
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Buscar usuario
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Verificar si el usuario está activo
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta desactivada'
      });
    }
    
    // Verificar si el usuario está bloqueado
    if (user.isBlocked) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta bloqueada',
        reason: user.blockedReason
      });
    }
    
    // Verificar si la cuenta está bloqueada por intentos de login
    if (user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta temporalmente bloqueada por múltiples intentos de login'
      });
    }
    
    // Verificar si el token fue emitido antes del cambio de contraseña
    if (user.passwordChangedAt) {
      const changedTimestamp = parseInt(user.passwordChangedAt.getTime() / 1000, 10);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          success: false,
          message: 'Token expirado - contraseña cambiada recientemente'
        });
      }
    }
    
    // Agregar usuario a la request
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado'
      });
    }
    
    console.error('Error en autenticación:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para verificar roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado - permisos insuficientes'
      });
    }
    
    next();
  };
};

// Middleware para verificar si el usuario es propietario del recurso
const requireOwnership = (resourceField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida'
      });
    }
    
    const resourceUserId = req.params[resourceField] || req.body[resourceField];
    
    if (!resourceUserId) {
      return res.status(400).json({
        success: false,
        message: 'ID de usuario requerido'
      });
    }
    
    if (resourceUserId !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado - solo puedes acceder a tus propios recursos'
      });
    }
    
    next();
  };
};

// Middleware para autenticación opcional (para endpoints públicos)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId).select('-password');
      
      if (user && user.isActive && !user.isBlocked() && !user.isLocked()) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Si hay error en el token, continuar sin usuario autenticado
    next();
  }
};

// Middleware para verificar token de refresh
const authenticateRefreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token requerido'
      });
    }
    
    // Verificar refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
    // Buscar usuario
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive || user.isBlocked() || user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no válido'
      });
    }
    
    req.user = user;
    next();
    
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token inválido'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expirado'
      });
    }
    
    console.error('Error en refresh token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Middleware para WebSocket authentication
const authenticateWebSocket = async (token) => {
  try {
    if (!token) {
      throw new Error('Token requerido');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user || !user.isActive || user.isBlocked() || user.isLocked()) {
      throw new Error('Usuario no válido');
    }
    
    return user;
  } catch (error) {
    throw new Error('Autenticación fallida');
  }
};

module.exports = {
  authenticateToken,
  requireRole,
  requireOwnership,
  optionalAuth,
  authenticateRefreshToken,
  authenticateWebSocket
};
=======

module.exports = function (req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1] || req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: true, message: 'Token no proporcionado' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: true, message: 'Token inválido o expirado' });
  }
}; 
>>>>>>> 3118c8e062634783de3a00b3ee21d4dce7d4e75f
