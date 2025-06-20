const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const emailService = require('../services/emailService');
const logger = require('../utils/logger');

// Generar tokens JWT
const generateTokens = (userId) => {
  const accessToken = jwt.sign(
    { userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  
  const refreshToken = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d' }
  );
  
  return { accessToken, refreshToken };
};

// Registrar nuevo usuario
const register = async (req, res) => {
  try {
    // Validar datos de entrada
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }
    
    const { email, password, username, displayName } = req.body;
    
    // Verificar si el email ya existe
    const existingEmail = await User.findOne({ email: email.toLowerCase() });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }
    
    // Verificar si el username ya existe
    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario ya está en uso'
      });
    }
    
    // Generar código de verificación
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    // Crear usuario
    const user = new User({
      email: email.toLowerCase(),
      password,
      username: username.toLowerCase(),
      displayName,
      verificationCode,
      verificationExpires
    });
    
    await user.save();
    
    // Enviar email de verificación
    try {
      await emailService.sendVerificationEmail(user.email, verificationCode);
    } catch (emailError) {
      logger.error('Error enviando email de verificación:', emailError);
      // No fallar el registro si el email falla
    }
    
    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // Actualizar último acceso
    await user.updateLastSeen();
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          emailVerified: user.emailVerified
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
    
  } catch (error) {
    logger.error('Error en registro:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Login de usuario
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }
    
    const { email, password } = req.body;
    
    // Buscar usuario
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    // Verificar si la cuenta está bloqueada
    if (user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Cuenta temporalmente bloqueada por múltiples intentos de login'
      });
    }
    
    // Verificar contraseña
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      // Incrementar intentos de login
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }
    
    // Resetear intentos de login
    await user.resetLoginAttempts();
    
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
    
    // Generar tokens
    const { accessToken, refreshToken } = generateTokens(user._id);
    
    // Actualizar último acceso
    await user.updateLastSeen();
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        user: {
          id: user._id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          avatar: user.avatar,
          emailVerified: user.emailVerified,
          settings: user.settings
        },
        tokens: {
          accessToken,
          refreshToken
        }
      }
    });
    
  } catch (error) {
    logger.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Verificar email
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email ya verificado'
      });
    }
    
    if (user.verificationCode !== code) {
      return res.status(400).json({
        success: false,
        message: 'Código de verificación inválido'
      });
    }
    
    if (user.verificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Código de verificación expirado'
      });
    }
    
    // Marcar email como verificado
    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationExpires = null;
    await user.save();
    
    res.json({
      success: true,
      message: 'Email verificado exitosamente'
    });
    
  } catch (error) {
    logger.error('Error en verificación de email:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Reenviar código de verificación
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email ya verificado'
      });
    }
    
    // Generar nuevo código
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos
    
    user.verificationCode = verificationCode;
    user.verificationExpires = verificationExpires;
    await user.save();
    
    // Enviar email
    await emailService.sendVerificationEmail(user.email, verificationCode);
    
    res.json({
      success: true,
      message: 'Código de verificación reenviado'
    });
    
  } catch (error) {
    logger.error('Error reenviando verificación:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Refresh token
const refreshToken = async (req, res) => {
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
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive || user.isBlocked() || user.isLocked()) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no válido'
      });
    }
    
    // Generar nuevos tokens
    const tokens = generateTokens(user._id);
    
    res.json({
      success: true,
      message: 'Tokens renovados',
      data: {
        tokens
      }
    });
    
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
    
    logger.error('Error en refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Logout
const logout = async (req, res) => {
  try {
    // En una implementación más avanzada, podrías invalidar el token
    // agregándolo a una blacklist en Redis
    
    res.json({
      success: true,
      message: 'Logout exitoso'
    });
    
  } catch (error) {
    logger.error('Error en logout:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener perfil del usuario autenticado
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      data: {
        user
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  register,
  login,
  verifyEmail,
  resendVerification,
  refreshToken,
  logout,
  getProfile
};
