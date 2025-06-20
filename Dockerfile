# Drilunia Backend Dockerfile
# Optimizado para producción

FROM node:18-alpine

# Metadatos
LABEL maintainer="Drilunia Team <admin@drilunia.com>"
LABEL description="Drilunia Backend - Chat, llamadas, archivos y notificaciones"
LABEL version="1.0.0"

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Instalar dependencias del sistema
RUN apk add --no-cache \
    curl \
    dumb-init \
    ffmpeg \
    && rm -rf /var/cache/apk/*

# Crear directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias con optimizaciones para producción
RUN npm ci --only=production --no-audit --no-fund && \
    npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R nodejs:nodejs /app

# Configurar límites de sistema
RUN echo "nodejs soft nofile 65536" >> /etc/security/limits.conf && \
    echo "nodejs hard nofile 65536" >> /etc/security/limits.conf

# Configurar variables de entorno para Node.js
ENV NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size"

# Exponer puerto
EXPOSE 3000

# Cambiar a usuario no-root
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Usar dumb-init para manejo correcto de señales
ENTRYPOINT ["dumb-init", "--"]

# Comando de inicio
CMD ["node", "server.js"] 