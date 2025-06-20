const Message = require('../models/Message');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

// Obtener conversaciones del usuario
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Obtener todas las conversaciones donde el usuario participa
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: userId },
            { receiver: userId }
          ],
          isDeleted: false
        }
      },
      {
        $sort: { sentAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', userId] },
                    { $ne: ['$status', 'read'] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          _id: 0,
          userId: '$user._id',
          username: '$user.username',
          displayName: '$user.displayName',
          avatar: '$user.avatar',
          isOnline: '$user.isOnline',
          lastSeen: '$user.stats.lastSeen',
          lastMessage: {
            id: '$lastMessage._id',
            content: '$lastMessage.content',
            type: '$lastMessage.type',
            sentAt: '$lastMessage.sentAt',
            status: '$lastMessage.status'
          },
          unreadCount: 1
        }
      },
      {
        $sort: { 'lastMessage.sentAt': -1 }
      }
    ]);
    
    res.json({
      success: true,
      data: {
        conversations
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo conversaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener mensajes de una conversación
const getMessages = async (req, res) => {
  try {
    const { userId: otherUserId } = req.params;
    const { limit = 50, before } = req.query;
    const currentUserId = req.user._id;
    
    // Verificar que el otro usuario existe
    const otherUser = await User.findById(otherUserId);
    if (!otherUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }
    
    // Obtener mensajes
    const messages = await Message.getConversation(
      currentUserId,
      otherUserId,
      parseInt(limit),
      before
    );
    
    // Marcar mensajes como leídos
    const unreadMessages = messages.filter(msg => 
      msg.receiver.toString() === currentUserId.toString() && 
      msg.status !== 'read'
    );
    
    if (unreadMessages.length > 0) {
      await Promise.all(
        unreadMessages.map(msg => msg.markAsRead())
      );
    }
    
    res.json({
      success: true,
      data: {
        messages: messages.reverse(), // Ordenar cronológicamente
        user: {
          id: otherUser._id,
          username: otherUser.username,
          displayName: otherUser.displayName,
          avatar: otherUser.avatar,
          isOnline: otherUser.isOnline,
          lastSeen: otherUser.stats.lastSeen
        }
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo mensajes:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Enviar mensaje
const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Datos de entrada inválidos',
        errors: errors.array()
      });
    }
    
    const { receiver, content, type = 'text', replyTo, attachments = [] } = req.body;
    const sender = req.user._id;
    
    // Verificar que el receptor existe
    const receiverUser = await User.findById(receiver);
    if (!receiverUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario receptor no encontrado'
      });
    }
    
    // Verificar que el receptor no está bloqueado
    if (receiverUser.isBlocked) {
      return res.status(400).json({
        success: false,
        message: 'No puedes enviar mensajes a este usuario'
      });
    }
    
    // Verificar mensaje de respuesta
    if (replyTo) {
      const replyMessage = await Message.findById(replyTo);
      if (!replyMessage) {
        return res.status(404).json({
          success: false,
          message: 'Mensaje de respuesta no encontrado'
        });
      }
    }
    
    // Crear mensaje
    const message = new Message({
      sender,
      receiver,
      content,
      type,
      replyTo,
      attachments
    });
    
    await message.save();
    
    // Poblar datos del emisor para la respuesta
    await message.populate('sender', 'username displayName avatar');
    await message.populate('receiver', 'username displayName avatar');
    
    // TODO: Enviar notificación push al receptor
    // TODO: Enviar mensaje por WebSocket
    
    res.status(201).json({
      success: true,
      message: 'Mensaje enviado',
      data: {
        message: message.toClientJSON()
      }
    });
    
  } catch (error) {
    logger.error('Error enviando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Editar mensaje
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }
    
    // Verificar que el usuario es el propietario del mensaje
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No puedes editar este mensaje'
      });
    }
    
    // Verificar que el mensaje no es muy antiguo (ej: 1 hora)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (message.sentAt < oneHourAgo) {
      return res.status(400).json({
        success: false,
        message: 'No puedes editar mensajes antiguos'
      });
    }
    
    // Editar mensaje
    await message.edit(content);
    
    // Poblar datos para la respuesta
    await message.populate('sender', 'username displayName avatar');
    await message.populate('receiver', 'username displayName avatar');
    
    res.json({
      success: true,
      message: 'Mensaje editado',
      data: {
        message: message.toClientJSON()
      }
    });
    
  } catch (error) {
    logger.error('Error editando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Eliminar mensaje
const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    const message = await Message.findById(id);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Mensaje no encontrado'
      });
    }
    
    // Verificar que el usuario es el propietario del mensaje
    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'No puedes eliminar este mensaje'
      });
    }
    
    // Eliminar mensaje (soft delete)
    await message.delete();
    
    res.json({
      success: true,
      message: 'Mensaje eliminado'
    });
    
  } catch (error) {
    logger.error('Error eliminando mensaje:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Marcar mensajes como leídos
const markAsRead = async (req, res) => {
  try {
    const { userId: senderId } = req.params;
    const receiverId = req.user._id;
    
    // Marcar todos los mensajes no leídos como leídos
    const result = await Message.updateMany(
      {
        sender: senderId,
        receiver: receiverId,
        status: { $ne: 'read' },
        isDeleted: false
      },
      {
        status: 'read',
        readAt: new Date()
      }
    );
    
    res.json({
      success: true,
      message: 'Mensajes marcados como leídos',
      data: {
        updatedCount: result.modifiedCount
      }
    });
    
  } catch (error) {
    logger.error('Error marcando mensajes como leídos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

// Obtener mensajes no leídos
const getUnreadMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const unreadMessages = await Message.getUnreadMessages(userId);
    
    res.json({
      success: true,
      data: {
        messages: unreadMessages,
        count: unreadMessages.length
      }
    });
    
  } catch (error) {
    logger.error('Error obteniendo mensajes no leídos:', error);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
};

module.exports = {
  getConversations,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  markAsRead,
  getUnreadMessages
};
