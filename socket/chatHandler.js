const Message = require('../models/Message');
const User = require('../models/User');
const logger = require('../utils/logger');

class ChatHandler {
  constructor(wss) {
    this.wss = wss;
    this.connections = new Map(); // userId -> WebSocket
    this.userPresence = new Map(); // userId -> { online: boolean, lastSeen: Date }
  }
  
  // Manejar nueva conexión
  handleConnection(ws, req) {
    try {
      const token = req.url.split('token=')[1];
      if (!token) {
        ws.close(1008, 'Token requerido');
        return;
      }
      
      // TODO: Verificar JWT token
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // const userId = decoded.userId;
      
      // Por ahora, usar un userId temporal para testing
      const userId = 'temp_user_id';
      
      // Almacenar conexión
      this.connections.set(userId, ws);
      this.userPresence.set(userId, {
        online: true,
        lastSeen: new Date()
      });
      
      // Configurar eventos del WebSocket
      ws.userId = userId;
      ws.isAlive = true;
      
      ws.on('message', (message) => {
        this.handleMessage(ws, message);
      });
      
      ws.on('close', () => {
        this.handleDisconnection(ws);
      });
      
      ws.on('error', (error) => {
        this.handleError(ws, error);
      });
      
      // Ping para mantener conexión activa
      ws.on('pong', () => {
        ws.isAlive = true;
      });
      
      // Enviar confirmación de conexión
      this.sendToUser(userId, {
        type: 'connection_established',
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Notificar a otros usuarios que este usuario está online
      this.broadcastPresence(userId, true);
      
      logger.info(`Usuario ${userId} conectado al chat`);
      
    } catch (error) {
      logger.error('Error en conexión WebSocket:', error);
      ws.close(1011, 'Error interno del servidor');
    }
  }
  
  // Manejar mensaje recibido
  async handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      const { type, receiver, content, messageType = 'text', replyTo, attachments } = data;
      
      switch (type) {
        case 'chat':
          await this.handleChatMessage(ws, data);
          break;
          
        case 'typing':
          this.handleTyping(ws, data);
          break;
          
        case 'read_receipt':
          await this.handleReadReceipt(ws, data);
          break;
          
        case 'presence':
          this.handlePresenceUpdate(ws, data);
          break;
          
        case 'ping':
          this.sendToUser(ws.userId, { type: 'pong', timestamp: new Date().toISOString() });
          break;
          
        default:
          logger.warn(`Tipo de mensaje desconocido: ${type}`);
      }
      
    } catch (error) {
      logger.error('Error procesando mensaje WebSocket:', error);
      this.sendToUser(ws.userId, {
        type: 'error',
        message: 'Error procesando mensaje',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Manejar mensaje de chat
  async handleChatMessage(ws, data) {
    try {
      const { receiver, content, messageType = 'text', replyTo, attachments } = data;
      const sender = ws.userId;
      
      // Verificar que el receptor existe
      const receiverUser = await User.findById(receiver);
      if (!receiverUser) {
        this.sendToUser(sender, {
          type: 'error',
          message: 'Usuario receptor no encontrado',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Verificar que el receptor no está bloqueado
      if (receiverUser.isBlocked) {
        this.sendToUser(sender, {
          type: 'error',
          message: 'No puedes enviar mensajes a este usuario',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      // Crear mensaje en la base de datos
      const message = new Message({
        sender,
        receiver,
        content,
        type: messageType,
        replyTo,
        attachments
      });
      
      await message.save();
      
      // Poblar datos del emisor
      await message.populate('sender', 'username displayName avatar');
      await message.populate('receiver', 'username displayName avatar');
      
      const messageData = {
        type: 'chat',
        message: message.toClientJSON(),
        timestamp: new Date().toISOString()
      };
      
      // Enviar mensaje al emisor (confirmación)
      this.sendToUser(sender, messageData);
      
      // Enviar mensaje al receptor
      this.sendToUser(receiver, messageData);
      
      // TODO: Enviar notificación push al receptor si no está online
      
      logger.info(`Mensaje enviado de ${sender} a ${receiver}`);
      
    } catch (error) {
      logger.error('Error manejando mensaje de chat:', error);
      this.sendToUser(ws.userId, {
        type: 'error',
        message: 'Error enviando mensaje',
        timestamp: new Date().toISOString()
      });
    }
  }
  
  // Manejar indicador de escritura
  handleTyping(ws, data) {
    const { receiver, isTyping } = data;
    const sender = ws.userId;
    
    this.sendToUser(receiver, {
      type: 'typing',
      sender,
      isTyping,
      timestamp: new Date().toISOString()
    });
  }
  
  // Manejar confirmación de lectura
  async handleReadReceipt(ws, data) {
    try {
      const { sender, messageIds } = data;
      const receiver = ws.userId;
      
      // Marcar mensajes como leídos
      const result = await Message.updateMany(
        {
          _id: { $in: messageIds },
          sender,
          receiver,
          status: { $ne: 'read' }
        },
        {
          status: 'read',
          readAt: new Date()
        }
      );
      
      // Enviar confirmación al emisor
      this.sendToUser(sender, {
        type: 'read_receipt',
        receiver,
        messageIds,
        readAt: new Date().toISOString()
      });
      
      logger.info(`Mensajes marcados como leídos: ${result.modifiedCount}`);
      
    } catch (error) {
      logger.error('Error manejando confirmación de lectura:', error);
    }
  }
  
  // Manejar actualización de presencia
  handlePresenceUpdate(ws, data) {
    const { isOnline } = data;
    const userId = ws.userId;
    
    this.userPresence.set(userId, {
      online: isOnline,
      lastSeen: new Date()
    });
    
    // Broadcast presencia a otros usuarios
    this.broadcastPresence(userId, isOnline);
  }
  
  // Manejar desconexión
  handleDisconnection(ws) {
    const userId = ws.userId;
    
    if (userId) {
      // Remover conexión
      this.connections.delete(userId);
      
      // Actualizar presencia
      this.userPresence.set(userId, {
        online: false,
        lastSeen: new Date()
      });
      
      // Notificar a otros usuarios
      this.broadcastPresence(userId, false);
      
      // Actualizar último acceso en base de datos
      User.findByIdAndUpdate(userId, {
        'stats.lastSeen': new Date()
      }).catch(err => {
        logger.error('Error actualizando último acceso:', err);
      });
      
      logger.info(`Usuario ${userId} desconectado del chat`);
    }
  }
  
  // Manejar error
  handleError(ws, error) {
    logger.error('Error en WebSocket:', error);
    
    if (ws.userId) {
      this.connections.delete(ws.userId);
      this.userPresence.set(ws.userId, {
        online: false,
        lastSeen: new Date()
      });
    }
  }
  
  // Enviar mensaje a un usuario específico
  sendToUser(userId, data) {
    const ws = this.connections.get(userId);
    if (ws && ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(JSON.stringify(data));
      } catch (error) {
        logger.error(`Error enviando mensaje a ${userId}:`, error);
        this.connections.delete(userId);
      }
    }
  }
  
  // Broadcast mensaje a todos los usuarios conectados
  broadcast(data, excludeUserId = null) {
    this.connections.forEach((ws, userId) => {
      if (userId !== excludeUserId && ws.readyState === 1) {
        try {
          ws.send(JSON.stringify(data));
        } catch (error) {
          logger.error(`Error en broadcast a ${userId}:`, error);
          this.connections.delete(userId);
        }
      }
    });
  }
  
  // Broadcast presencia de usuario
  broadcastPresence(userId, isOnline) {
    const presenceData = {
      type: 'presence',
      userId,
      isOnline,
      timestamp: new Date().toISOString()
    };
    
    this.broadcast(presenceData, userId);
  }
  
  // Obtener usuarios online
  getOnlineUsers() {
    const onlineUsers = [];
    this.userPresence.forEach((presence, userId) => {
      if (presence.online) {
        onlineUsers.push(userId);
      }
    });
    return onlineUsers;
  }
  
  // Verificar conexiones activas (heartbeat)
  heartbeat() {
    this.connections.forEach((ws, userId) => {
      if (ws.isAlive === false) {
        logger.info(`Terminando conexión inactiva: ${userId}`);
        this.connections.delete(userId);
        this.userPresence.set(userId, {
          online: false,
          lastSeen: new Date()
        });
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }
  
  // Iniciar heartbeat
  startHeartbeat() {
    setInterval(() => {
      this.heartbeat();
    }, 30000); // Cada 30 segundos
  }
}

module.exports = ChatHandler;
