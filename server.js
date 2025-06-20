<<<<<<< HEAD
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Configuración
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middlewares de seguridad
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ['https://drilunia.com', 'https://app.drilunia.com'],
  credentials: true
}));

app.use(compression());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite por IP
  message: 'Demasiadas peticiones desde esta IP'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Conexión MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://mongo:27017/drilunia', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB conectado'))
.catch(err => console.error('❌ Error MongoDB:', err));

// WebSocket para chat y señalización WebRTC
wss.on('connection', (ws, req) => {
  console.log('🔌 Nueva conexión WebSocket');
  
  // Autenticación WebSocket
  const token = req.url.split('token=')[1];
  if (!token) {
    ws.close(1008, 'Token requerido');
    return;
  }
  
  // TODO: Verificar JWT token
  // const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // ws.userId = decoded.userId;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Mensaje WebSocket:', data.type);
      
      // Manejar diferentes tipos de mensajes
      switch (data.type) {
        case 'chat':
          // TODO: Procesar mensaje de chat
          break;
        case 'webrtc_offer':
          // TODO: Señalización WebRTC - offer
          break;
        case 'webrtc_answer':
          // TODO: Señalización WebRTC - answer
          break;
        case 'ice_candidate':
          // TODO: Señalización WebRTC - ICE candidate
          break;
        case 'call_request':
          // TODO: Solicitud de llamada
          break;
        case 'call_accept':
          // TODO: Aceptar llamada
          break;
        case 'call_reject':
          // TODO: Rechazar llamada
          break;
        case 'call_end':
          // TODO: Terminar llamada
          break;
        default:
          console.log('❓ Tipo de mensaje desconocido:', data.type);
      }
    } catch (error) {
      console.error('❌ Error procesando mensaje WebSocket:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 Conexión WebSocket cerrada');
    // TODO: Limpiar estado del usuario
  });
  
  ws.on('error', (error) => {
    console.error('❌ Error WebSocket:', error);
  });
});

// Rutas API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/files', require('./routes/files'));
app.use('/api/calls', require('./routes/calls'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'drilunia-backend',
    version: '1.0.0',
    environment: NODE_ENV
  });
});

// Endpoint ICE servers para WebRTC
app.get('/api/ice', (req, res) => {
  res.json({
    iceServers: [
      {
        urls: process.env.STUN_URLS || 'stun:coturn:3478'
      },
      {
        urls: process.env.TURN_URLS || 'turn:coturn:3478',
        username: process.env.TURN_USER || 'drilunia',
        credential: process.env.TURN_PASS || 'drilunia123'
      }
    ]
  });
});

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({
    error: 'Algo salió mal',
    message: NODE_ENV === 'development' ? err.message : 'Error interno del servidor'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`🚀 Servidor Drilunia iniciado en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${NODE_ENV}`);
  console.log(`🔌 WebSocket disponible en ws://localhost:${PORT}`);
  console.log(`📡 API disponible en http://localhost:${PORT}/api`);
  console.log(`💚 Health check en http://localhost:${PORT}/health`);
});

// Manejo graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    mongoose.connection.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT recibido, cerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor cerrado');
    mongoose.connection.close();
    process.exit(0);
  });
=======
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { Server } = require('socket.io');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middlewares de seguridad y utilidades
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(compression());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000 // Limite de peticiones por IP
}));

// Rutas
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/notification', require('./routes/notification.routes'));
app.use('/api/ice', require('./routes/ice.routes'));
app.use('/api/file', require('./routes/file.routes'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Error interno del servidor'
  });
});

// Socket.io
require('./socket')(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
>>>>>>> 3118c8e062634783de3a00b3ee21d4dce7d4e75f
}); 