const fs = require('fs-extra');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Directorio donde se guardarán los archivos
const UPLOAD_DIR = path.join(__dirname, '../uploads');
fs.ensureDirSync(UPLOAD_DIR);

// Mapa en memoria para rate limiting simple (puedes migrar a Redis para producción)
const downloadRateLimit = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 10; // 10 descargas por minuto

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: true, message: 'No se subió ningún archivo' });
    }
    // Opcional: guardar referencia en la base de datos
    await prisma.file.create({
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        userId: req.user.id
      }
    });
    res.json({ error: false, message: 'Archivo subido correctamente', file: req.file.filename });
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al subir archivo' });
  }
};

exports.getFile = async (req, res) => {
  try {
    const userId = req.user.id;
    const filename = req.params.filename;
    const filePath = path.join(UPLOAD_DIR, filename);

    // Rate limiting por usuario
    const now = Date.now();
    if (!downloadRateLimit[userId]) downloadRateLimit[userId] = [];
    downloadRateLimit[userId] = downloadRateLimit[userId].filter(ts => now - ts < RATE_LIMIT_WINDOW);
    if (downloadRateLimit[userId].length >= RATE_LIMIT_MAX) {
      return res.status(429).json({ error: true, message: 'Límite de descargas alcanzado. Intenta más tarde.' });
    }
    downloadRateLimit[userId].push(now);

    // Verificar existencia en base de datos y propiedad
    const fileRecord = await prisma.file.findUnique({ where: { filename } });
    if (!fileRecord) {
      return res.status(404).json({ error: true, message: 'Archivo no encontrado en la base de datos' });
    }
    if (fileRecord.userId !== userId) {
      return res.status(403).json({ error: true, message: 'No tienes permiso para acceder a este archivo' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: true, message: 'Archivo no encontrado en el servidor' });
    }

    // Log de acceso
    await prisma.fileAccessLog.create({
      data: {
        userId,
        fileId: fileRecord.id,
        accessedAt: new Date()
      }
    });

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: true, message: 'Error al obtener archivo' });
  }
}; 