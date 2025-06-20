#!/usr/bin/env node

/**
 * Drilunia Backend - Script de Inicialización
 * Configura la base de datos, índices y datos iniciales
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Importar modelos
const User = require('../models/User');
const Message = require('../models/Message');

// Configuración
const MONGO_URI = process.env.MONGO_URI || 'mongodb://admin:drilunia123@mongo:27017/drilunia?authSource=admin';

console.log('🚀 Iniciando configuración de Drilunia Backend...');

async function initializeDatabase() {
  try {
    // Conectar a MongoDB
    console.log('📡 Conectando a MongoDB...');
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB conectado');

    // Crear índices
    console.log('📊 Creando índices...');
    await createIndexes();
    console.log('✅ Índices creados');

    // Crear usuario administrador
    console.log('👤 Creando usuario administrador...');
    await createAdminUser();
    console.log('✅ Usuario administrador creado');

    // Crear datos de ejemplo (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      console.log('🧪 Creando datos de ejemplo...');
      await createSampleData();
      console.log('✅ Datos de ejemplo creados');
    }

    console.log('🎉 Inicialización completada exitosamente!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error en inicialización:', error);
    process.exit(1);
  }
}

async function createIndexes() {
  // Índices para User
  await User.collection.createIndex({ email: 1 }, { unique: true });
  await User.collection.createIndex({ username: 1 }, { unique: true });
  await User.collection.createIndex({ 'stats.lastSeen': -1 });
  await User.collection.createIndex({ isActive: 1, isBlocked: 1 });
  await User.collection.createIndex({ 'pushTokens.token': 1 });

  // Índices para Message
  await Message.collection.createIndex({ sender: 1, receiver: 1 });
  await Message.collection.createIndex({ receiver: 1, sender: 1 });
  await Message.collection.createIndex({ sentAt: -1 });
  await Message.collection.createIndex({ messageId: 1 }, { unique: true });
  await Message.collection.createIndex({ 'reactions.user': 1 });
  await Message.collection.createIndex({ status: 1 });
  await Message.collection.createIndex({ isDeleted: 1 });
}

async function createAdminUser() {
  try {
    // Verificar si ya existe un admin
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('ℹ️  Usuario administrador ya existe');
      return;
    }

    // Crear hash de contraseña
    const hashedPassword = await bcrypt.hash('admin123', 12);

    // Crear usuario administrador
    const adminUser = new User({
      email: 'admin@drilunia.com',
      password: hashedPassword,
      username: 'admin',
      displayName: 'Administrador',
      role: 'admin',
      emailVerified: true,
      isActive: true,
      settings: {
        notifications: {
          push: true,
          email: true,
          chat: true,
          calls: true
        },
        privacy: {
          showOnline: true,
          showLastSeen: true,
          allowCalls: true
        },
        theme: 'auto'
      }
    });

    await adminUser.save();
    console.log('✅ Usuario administrador creado:');
    console.log('   Email: admin@drilunia.com');
    console.log('   Contraseña: admin123');
    console.log('   Username: admin');

  } catch (error) {
    if (error.code === 11000) {
      console.log('ℹ️  Usuario administrador ya existe');
    } else {
      throw error;
    }
  }
}

async function createSampleData() {
  try {
    // Crear usuarios de ejemplo
    const sampleUsers = [
      {
        email: 'usuario1@drilunia.com',
        password: 'password123',
        username: 'usuario1',
        displayName: 'Usuario Ejemplo 1',
        role: 'user',
        emailVerified: true,
        isActive: true
      },
      {
        email: 'usuario2@drilunia.com',
        password: 'password123',
        username: 'usuario2',
        displayName: 'Usuario Ejemplo 2',
        role: 'user',
        emailVerified: true,
        isActive: true
      },
      {
        email: 'moderador@drilunia.com',
        password: 'password123',
        username: 'moderador',
        displayName: 'Moderador',
        role: 'moderator',
        emailVerified: true,
        isActive: true
      }
    ];

    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        const user = new User({
          ...userData,
          password: hashedPassword
        });
        await user.save();
        console.log(`✅ Usuario creado: ${userData.username}`);
      }
    }

    // Crear algunos mensajes de ejemplo
    const users = await User.find({ role: 'user' }).limit(2);
    if (users.length >= 2) {
      const sampleMessages = [
        {
          sender: users[0]._id,
          receiver: users[1]._id,
          content: '¡Hola! ¿Cómo estás?',
          type: 'text'
        },
        {
          sender: users[1]._id,
          receiver: users[0]._id,
          content: '¡Hola! Muy bien, gracias. ¿Y tú?',
          type: 'text'
        },
        {
          sender: users[0]._id,
          receiver: users[1]._id,
          content: 'Perfecto, ¿quieres que hagamos una llamada?',
          type: 'text'
        }
      ];

      for (const messageData of sampleMessages) {
        const message = new Message(messageData);
        await message.save();
      }
      console.log('✅ Mensajes de ejemplo creados');
    }

  } catch (error) {
    console.error('Error creando datos de ejemplo:', error);
  }
}

// Ejecutar inicialización
initializeDatabase(); 