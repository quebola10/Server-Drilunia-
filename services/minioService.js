const Minio = require('minio');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Configurar cliente MinIO
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: parseInt(process.env.MINIO_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'drilunia',
  secretKey: process.env.MINIO_SECRET_KEY || 'drilunia123'
});

const BUCKET_NAME = process.env.MINIO_BUCKET || 'drilunia-media';

// Inicializar MinIO
const initializeMinIO = async () => {
  try {
    // Verificar si el bucket existe
    const bucketExists = await minioClient.bucketExists(BUCKET_NAME);
    
    if (!bucketExists) {
      // Crear bucket
      await minioClient.makeBucket(BUCKET_NAME, 'us-east-1');
      
      // Configurar política de bucket para acceso público a archivos específicos
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${BUCKET_NAME}/*`]
          }
        ]
      };
      
      await minioClient.setBucketPolicy(BUCKET_NAME, JSON.stringify(policy));
      
      logger.info(`Bucket ${BUCKET_NAME} creado exitosamente`);
    } else {
      logger.info(`Bucket ${BUCKET_NAME} ya existe`);
    }
    
    return true;
  } catch (error) {
    logger.error('Error inicializando MinIO:', error);
    throw error;
  }
};

// Subir archivo
const uploadFile = async (file, folder = 'uploads') => {
  try {
    const fileExtension = path.extname(file.originalname);
    const fileName = `${folder}/${uuidv4()}${fileExtension}`;
    const filePath = file.path;
    
    // Subir archivo a MinIO
    await minioClient.fPutObject(
      BUCKET_NAME,
      fileName,
      filePath,
      {
        'Content-Type': file.mimetype,
        'Content-Length': file.size
      }
    );
    
    // Limpiar archivo temporal
    fs.unlinkSync(filePath);
    
    // Generar URL de acceso
    const fileUrl = await minioClient.presignedGetObject(BUCKET_NAME, fileName, 24 * 60 * 60); // 24 horas
    
    const fileData = {
      id: uuidv4(),
      filename: fileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: fileUrl,
      bucket: BUCKET_NAME,
      uploadedAt: new Date()
    };
    
    logger.info(`Archivo subido: ${fileName} (${file.size} bytes)`);
    
    return fileData;
  } catch (error) {
    logger.error('Error subiendo archivo:', error);
    throw error;
  }
};

// Descargar archivo
const downloadFile = async (fileName) => {
  try {
    // Verificar si el archivo existe
    const stat = await minioClient.statObject(BUCKET_NAME, fileName);
    
    // Generar URL de descarga temporal
    const downloadUrl = await minioClient.presignedGetObject(
      BUCKET_NAME,
      fileName,
      60 * 60 // 1 hora
    );
    
    return {
      url: downloadUrl,
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag
    };
  } catch (error) {
    logger.error('Error descargando archivo:', error);
    throw error;
  }
};

// Eliminar archivo
const deleteFile = async (fileName) => {
  try {
    await minioClient.removeObject(BUCKET_NAME, fileName);
    logger.info(`Archivo eliminado: ${fileName}`);
    return true;
  } catch (error) {
    logger.error('Error eliminando archivo:', error);
    throw error;
  }
};

// Obtener información del archivo
const getFileInfo = async (fileName) => {
  try {
    const stat = await minioClient.statObject(BUCKET_NAME, fileName);
    
    return {
      fileName,
      size: stat.size,
      lastModified: stat.lastModified,
      etag: stat.etag,
      contentType: stat.metaData['content-type'] || 'application/octet-stream'
    };
  } catch (error) {
    logger.error('Error obteniendo información del archivo:', error);
    throw error;
  }
};

// Generar URL temporal para archivo
const generatePresignedUrl = async (fileName, expiresIn = 3600) => {
  try {
    const url = await minioClient.presignedGetObject(
      BUCKET_NAME,
      fileName,
      expiresIn
    );
    
    return url;
  } catch (error) {
    logger.error('Error generando URL temporal:', error);
    throw error;
  }
};

// Subir imagen con thumbnail
const uploadImage = async (file, folder = 'images') => {
  try {
    const sharp = require('sharp');
    
    // Procesar imagen original
    const originalBuffer = await sharp(file.path)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    // Crear thumbnail
    const thumbnailBuffer = await sharp(file.path)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    const fileId = uuidv4();
    const originalFileName = `${folder}/original/${fileId}${path.extname(file.originalname)}`;
    const thumbnailFileName = `${folder}/thumbnails/${fileId}_thumb.jpg`;
    
    // Subir imagen original
    await minioClient.putObject(
      BUCKET_NAME,
      originalFileName,
      originalBuffer,
      originalBuffer.length,
      { 'Content-Type': 'image/jpeg' }
    );
    
    // Subir thumbnail
    await minioClient.putObject(
      BUCKET_NAME,
      thumbnailFileName,
      thumbnailBuffer,
      thumbnailBuffer.length,
      { 'Content-Type': 'image/jpeg' }
    );
    
    // Limpiar archivo temporal
    fs.unlinkSync(file.path);
    
    // Generar URLs
    const originalUrl = await minioClient.presignedGetObject(BUCKET_NAME, originalFileName, 24 * 60 * 60);
    const thumbnailUrl = await minioClient.presignedGetObject(BUCKET_NAME, thumbnailFileName, 24 * 60 * 60);
    
    const imageData = {
      id: fileId,
      originalName: file.originalname,
      originalUrl,
      thumbnailUrl,
      size: originalBuffer.length,
      thumbnailSize: thumbnailBuffer.length,
      uploadedAt: new Date()
    };
    
    logger.info(`Imagen subida: ${fileId} (${originalBuffer.length} bytes)`);
    
    return imageData;
  } catch (error) {
    logger.error('Error subiendo imagen:', error);
    throw error;
  }
};

// Subir video con procesamiento
const uploadVideo = async (file, folder = 'videos') => {
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const fileId = uuidv4();
    const originalFileName = `${folder}/${fileId}${path.extname(file.originalname)}`;
    
    // Subir video original
    await minioClient.fPutObject(
      BUCKET_NAME,
      originalFileName,
      file.path,
      {
        'Content-Type': file.mimetype,
        'Content-Length': file.size
      }
    );
    
    // Obtener información del video
    const videoInfo = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(file.path, (err, metadata) => {
        if (err) reject(err);
        else resolve(metadata);
      });
    });
    
    const duration = videoInfo.format.duration;
    const { width, height } = videoInfo.streams[0];
    
    // Limpiar archivo temporal
    fs.unlinkSync(file.path);
    
    // Generar URL
    const videoUrl = await minioClient.presignedGetObject(BUCKET_NAME, originalFileName, 24 * 60 * 60);
    
    const videoData = {
      id: fileId,
      originalName: file.originalname,
      url: videoUrl,
      size: file.size,
      duration: Math.round(duration),
      width,
      height,
      uploadedAt: new Date()
    };
    
    logger.info(`Video subido: ${fileId} (${file.size} bytes, ${duration}s)`);
    
    return videoData;
  } catch (error) {
    logger.error('Error subiendo video:', error);
    throw error;
  }
};

// Obtener estadísticas del bucket
const getBucketStats = async () => {
  try {
    const objects = [];
    const stream = minioClient.listObjects(BUCKET_NAME, '', true);
    
    return new Promise((resolve, reject) => {
      stream.on('data', (obj) => {
        objects.push(obj);
      });
      
      stream.on('error', reject);
      
      stream.on('end', () => {
        const totalSize = objects.reduce((sum, obj) => sum + obj.size, 0);
        const totalFiles = objects.length;
        
        resolve({
          totalFiles,
          totalSize,
          averageSize: totalFiles > 0 ? totalSize / totalFiles : 0
        });
      });
    });
  } catch (error) {
    logger.error('Error obteniendo estadísticas del bucket:', error);
    throw error;
  }
};

module.exports = {
  initializeMinIO,
  uploadFile,
  downloadFile,
  deleteFile,
  getFileInfo,
  generatePresignedUrl,
  uploadImage,
  uploadVideo,
  getBucketStats
};
