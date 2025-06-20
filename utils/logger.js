const winston = require('winston');
const path = require('path');

// Configurar formatos
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let log = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      log += ` ${JSON.stringify(meta)}`;
    }
    return log;
  })
);

// Crear logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'drilunia-backend' },
  transports: [
    // Archivo de errores
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    
    // Archivo de logs combinados
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Agregar transporte de consola en desarrollo
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Función para log de requests HTTP
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (req.user) {
      logData.userId = req.user._id;
      logData.username = req.user.username;
    }
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  next();
};

// Función para log de errores
const logError = (error, req = null) => {
  const errorData = {
    message: error.message,
    stack: error.stack,
    name: error.name
  };
  
  if (req) {
    errorData.request = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (req.user) {
      errorData.userId = req.user._id;
      errorData.username = req.user.username;
    }
  }
  
  logger.error('Application Error', errorData);
};

// Función para log de WebSocket
const logWebSocket = (event, data) => {
  logger.info('WebSocket Event', {
    event,
    data: typeof data === 'object' ? JSON.stringify(data) : data
  });
};

// Función para log de base de datos
const logDatabase = (operation, collection, duration, success = true) => {
  const level = success ? 'info' : 'error';
  logger[level]('Database Operation', {
    operation,
    collection,
    duration: `${duration}ms`,
    success
  });
};

// Función para log de autenticación
const logAuth = (action, userId, username, success = true, details = {}) => {
  const level = success ? 'info' : 'warn';
  logger[level]('Authentication', {
    action,
    userId,
    username,
    success,
    details
  });
};

// Función para log de archivos
const logFile = (action, filename, size, userId = null) => {
  logger.info('File Operation', {
    action,
    filename,
    size: `${size} bytes`,
    userId
  });
};

// Función para log de llamadas
const logCall = (action, callId, participants, duration = null) => {
  logger.info('Call Operation', {
    action,
    callId,
    participants: participants.map(p => p.username),
    duration: duration ? `${duration}s` : null
  });
};

// Función para log de notificaciones
const logNotification = (type, userId, success = true, details = {}) => {
  const level = success ? 'info' : 'error';
  logger[level]('Notification', {
    type,
    userId,
    success,
    details
  });
};

// Función para log de métricas
const logMetrics = (metric, value, tags = {}) => {
  logger.info('Metric', {
    metric,
    value,
    tags
  });
};

// Función para log de seguridad
const logSecurity = (event, userId = null, ip = null, details = {}) => {
  logger.warn('Security Event', {
    event,
    userId,
    ip,
    details
  });
};

// Función para log de rendimiento
const logPerformance = (operation, duration, details = {}) => {
  const level = duration > 1000 ? 'warn' : 'info';
  logger[level]('Performance', {
    operation,
    duration: `${duration}ms`,
    details
  });
};

module.exports = {
  logger,
  logRequest,
  logError,
  logWebSocket,
  logDatabase,
  logAuth,
  logFile,
  logCall,
  logNotification,
  logMetrics,
  logSecurity,
  logPerformance
};
