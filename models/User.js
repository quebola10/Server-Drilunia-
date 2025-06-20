const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Información básica
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 30
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  avatar: {
    type: String,
    default: null
  },
  
  // Verificación
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationCode: {
    type: String,
    default: null
  },
  verificationExpires: {
    type: Date,
    default: null
  },
  
  // Estado y roles
  isActive: {
    type: Boolean,
    default: true
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user'
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  blockedReason: {
    type: String,
    default: null
  },
  
  // Configuración
  settings: {
    notifications: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
      calls: { type: Boolean, default: true }
    },
    privacy: {
      showOnline: { type: Boolean, default: true },
      showLastSeen: { type: Boolean, default: true },
      allowCalls: { type: Boolean, default: true }
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    }
  },
  
  // Tokens push
  pushTokens: [{
    token: String,
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      required: true
    },
    deviceId: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Estadísticas
  stats: {
    lastSeen: {
      type: Date,
      default: Date.now
    },
    totalMessages: {
      type: Number,
      default: 0
    },
    totalCalls: {
      type: Number,
      default: 0
    },
    totalCallDuration: {
      type: Number,
      default: 0
    }
  },
  
  // Seguridad
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  passwordChangedAt: {
    type: Date,
    default: Date.now
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });
userSchema.index({ 'stats.lastSeen': -1 });
userSchema.index({ isActive: 1, isBlocked: 1 });

// Middleware pre-save para hashear password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now() - 1000; // 1 segundo antes
    next();
  } catch (error) {
    next(error);
  }
});

// Método para comparar passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Método para verificar si la cuenta está bloqueada
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Método para incrementar intentos de login
userSchema.methods.incLoginAttempts = function() {
  // Si ya está bloqueado y el tiempo de bloqueo ha expirado
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Bloquear cuenta si excede 5 intentos
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 horas
  }
  
  return this.updateOne(updates);
};

// Método para resetear intentos de login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Método para actualizar último acceso
userSchema.methods.updateLastSeen = function() {
  return this.updateOne({
    'stats.lastSeen': new Date()
  });
};

// Método para agregar token push
userSchema.methods.addPushToken = function(token, platform, deviceId) {
  // Remover token anterior del mismo dispositivo
  this.pushTokens = this.pushTokens.filter(t => t.deviceId !== deviceId);
  
  // Agregar nuevo token
  this.pushTokens.push({
    token,
    platform,
    deviceId,
    createdAt: new Date()
  });
  
  return this.save();
};

// Método para remover token push
userSchema.methods.removePushToken = function(deviceId) {
  this.pushTokens = this.pushTokens.filter(t => t.deviceId !== deviceId);
  return this.save();
};

// Método para obtener datos públicos del usuario
userSchema.methods.toPublicJSON = function() {
  return {
    id: this._id,
    username: this.username,
    displayName: this.displayName,
    avatar: this.avatar,
    isOnline: this.isOnline,
    lastSeen: this.stats.lastSeen,
    settings: {
      privacy: this.settings.privacy
    }
  };
};

// Método para verificar si el usuario está online
userSchema.virtual('isOnline').get(function() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return this.stats.lastSeen > fiveMinutesAgo;
});

module.exports = mongoose.model('User', userSchema);
