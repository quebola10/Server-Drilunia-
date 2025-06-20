const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // Emisor y receptor
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Contenido del mensaje
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'audio', 'file', 'location', 'sticker'],
    default: 'text'
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  
  // Archivos adjuntos
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    thumbnail: String,
    duration: Number, // Para audio/video
    width: Number,    // Para imágenes/video
    height: Number    // Para imágenes/video
  }],
  
  // Estado del mensaje
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  
  // Timestamps
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  readAt: {
    type: Date,
    default: null
  },
  
  // Metadatos
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  
  // Respuesta a otro mensaje
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  
  // Reacciones
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    emoji: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Encripción (si se implementa)
  encrypted: {
    type: Boolean,
    default: false
  },
  
  // ID único del mensaje para sincronización
  messageId: {
    type: String,
    unique: true,
    required: true
  }
}, {
  timestamps: true
});

// Índices para optimizar consultas
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ receiver: 1, sender: 1 });
messageSchema.index({ sentAt: -1 });
messageSchema.index({ messageId: 1 });
messageSchema.index({ 'reactions.user': 1 });

// Middleware pre-save para generar messageId único
messageSchema.pre('save', function(next) {
  if (!this.messageId) {
    this.messageId = `${this.sender}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

// Método para marcar como entregado
messageSchema.methods.markAsDelivered = function() {
  if (this.status === 'sent') {
    this.status = 'delivered';
    this.deliveredAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para marcar como leído
messageSchema.methods.markAsRead = function() {
  if (this.status !== 'read') {
    this.status = 'read';
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Método para agregar reacción
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remover reacción anterior del mismo usuario
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  
  // Agregar nueva reacción
  this.reactions.push({
    user: userId,
    emoji,
    createdAt: new Date()
  });
  
  return this.save();
};

// Método para remover reacción
messageSchema.methods.removeReaction = function(userId) {
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());
  return this.save();
};

// Método para editar mensaje
messageSchema.methods.edit = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Método para eliminar mensaje (soft delete)
messageSchema.methods.delete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Método para obtener datos del mensaje para el cliente
messageSchema.methods.toClientJSON = function() {
  return {
    id: this._id,
    messageId: this.messageId,
    sender: this.sender,
    receiver: this.receiver,
    type: this.type,
    content: this.content,
    attachments: this.attachments,
    status: this.status,
    sentAt: this.sentAt,
    deliveredAt: this.deliveredAt,
    readAt: this.readAt,
    isEdited: this.isEdited,
    editedAt: this.editedAt,
    isDeleted: this.isDeleted,
    replyTo: this.replyTo,
    reactions: this.reactions,
    encrypted: this.encrypted
  };
};

// Método estático para obtener conversación entre dos usuarios
messageSchema.statics.getConversation = function(user1Id, user2Id, limit = 50, before = null) {
  const query = {
    $or: [
      { sender: user1Id, receiver: user2Id },
      { sender: user2Id, receiver: user1Id }
    ],
    isDeleted: false
  };
  
  if (before) {
    query.sentAt = { $lt: new Date(before) };
  }
  
  return this.find(query)
    .sort({ sentAt: -1 })
    .limit(limit)
    .populate('sender', 'username displayName avatar')
    .populate('receiver', 'username displayName avatar')
    .populate('replyTo', 'content type')
    .populate('reactions.user', 'username displayName avatar');
};

// Método estático para obtener mensajes no leídos
messageSchema.statics.getUnreadMessages = function(userId) {
  return this.find({
    receiver: userId,
    status: { $ne: 'read' },
    isDeleted: false
  })
  .populate('sender', 'username displayName avatar')
  .sort({ sentAt: 1 });
};

module.exports = mongoose.model('Message', messageSchema);
