#!/bin/bash

# Drilunia Backend - Script de Despliegue Automatizado
# Este script configura todo el entorno de producción

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue de Drilunia Backend..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar si estamos como root
if [ "$EUID" -ne 0 ]; then
    print_error "Este script debe ejecutarse como root"
    exit 1
fi

# Actualizar sistema
print_status "Actualizando sistema..."
apt-get update -y
apt-get upgrade -y

# Instalar Node.js 20.x
print_status "Instalando Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verificar instalación de Node.js
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
print_success "Node.js $NODE_VERSION instalado"
print_success "npm $NPM_VERSION instalado"

# Instalar PM2 globalmente
print_status "Instalando PM2..."
npm install -g pm2

# Instalar MongoDB
print_status "Instalando MongoDB..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt-get update
apt-get install -y mongodb-org

# Iniciar y habilitar MongoDB
print_status "Configurando MongoDB..."
systemctl start mongod
systemctl enable mongod

# Instalar Docker y Docker Compose
print_status "Instalando Docker..."
apt-get install -y docker.io docker-compose
systemctl start docker
systemctl enable docker

# Instalar Nginx
print_status "Instalando Nginx..."
apt-get install -y nginx

# Configurar firewall
print_status "Configurando firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw --force enable

# Navegar al directorio del proyecto
cd /root/Server-Drilunia-

# Instalar dependencias del proyecto
print_status "Instalando dependencias del proyecto..."
npm install

# Crear archivo .env si no existe
if [ ! -f .env ]; then
    print_status "Creando archivo .env..."
    cat > .env << EOF
# Server Configuration
PORT=3000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/drilunia

# JWT
JWT_SECRET=drilunia-super-secret-key-2024-production
JWT_EXPIRES_IN=7d

# Email (configurar después)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=admin@drilunia.com
EMAIL_PASS=your-app-password

# File Storage (configurar después)
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=drilunia-access-key
MINIO_SECRET_KEY=drilunia-secret-key-2024
MINIO_BUCKET=drilunia-files

# Push Notifications (configurar después)
FCM_SERVER_KEY=your-fcm-server-key
APN_KEY_ID=your-apn-key-id
APN_TEAM_ID=your-apn-team-id
APN_BUNDLE_ID=com.drilunia.app

# ICE Servers
ICE_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302

# Redis (opcional)
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/drilunia/app.log
EOF
    print_success "Archivo .env creado"
fi

# Crear directorios necesarios
print_status "Creando directorios necesarios..."
mkdir -p /var/log/drilunia
mkdir -p /app/uploads
mkdir -p /app/temp

# Configurar Nginx
print_status "Configurando Nginx..."
cat > /etc/nginx/sites-available/drilunia << EOF
server {
    listen 80;
    server_name _;

    # Logs
    access_log /var/log/nginx/drilunia_access.log;
    error_log /var/log/nginx/drilunia_error.log;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

    # API routes
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # WebSocket
    location /socket.io/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    # Static files
    location /uploads/ {
        alias /app/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Default location
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Habilitar sitio y deshabilitar default
ln -sf /etc/nginx/sites-available/drilunia /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Verificar configuración de Nginx
nginx -t

# Reiniciar Nginx
systemctl restart nginx
systemctl enable nginx

# Inicializar base de datos
print_status "Inicializando base de datos..."
node scripts/init.js

# Iniciar aplicación con PM2
print_status "Iniciando aplicación con PM2..."
pm2 start server.js --name "drilunia-backend"
pm2 startup
pm2 save

# Configurar logs
print_status "Configurando logs..."
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Crear script de monitoreo
cat > /usr/local/bin/drilunia-status << EOF
#!/bin/bash
echo "=== Drilunia Backend Status ==="
echo "PM2 Status:"
pm2 status
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager -l
echo ""
echo "MongoDB Status:"
systemctl status mongod --no-pager -l
echo ""
echo "Application Logs (last 20 lines):"
pm2 logs drilunia-backend --lines 20
EOF

chmod +x /usr/local/bin/drilunia-status

# Crear script de reinicio
cat > /usr/local/bin/drilunia-restart << EOF
#!/bin/bash
echo "Reiniciando Drilunia Backend..."
pm2 restart drilunia-backend
systemctl restart nginx
echo "Reinicio completado"
EOF

chmod +x /usr/local/bin/drilunia-restart

# Configurar monitoreo del sistema
print_status "Configurando monitoreo del sistema..."

# Instalar htop para monitoreo
apt-get install -y htop

# Crear script de monitoreo del sistema
cat > /usr/local/bin/system-monitor << EOF
#!/bin/bash
echo "=== System Monitor ==="
echo "CPU Usage:"
top -bn1 | grep "Cpu(s)" | awk '{print \$2}' | cut -d'%' -f1
echo ""
echo "Memory Usage:"
free -h
echo ""
echo "Disk Usage:"
df -h
echo ""
echo "Active Connections:"
netstat -an | grep :3000 | wc -l
EOF

chmod +x /usr/local/bin/system-monitor

# Configurar backup automático
print_status "Configurando backup automático..."
mkdir -p /backup/drilunia

cat > /etc/cron.daily/drilunia-backup << EOF
#!/bin/bash
DATE=\$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/drilunia"
mkdir -p \$BACKUP_DIR

# Backup de MongoDB
mongodump --db drilunia --out \$BACKUP_DIR/mongodb_\$DATE

# Backup de archivos
tar -czf \$BACKUP_DIR/uploads_\$DATE.tar.gz /app/uploads

# Limpiar backups antiguos (mantener últimos 7 días)
find \$BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find \$BACKUP_DIR -name "mongodb_*" -mtime +7 -exec rm -rf {} \;
EOF

chmod +x /etc/cron.daily/drilunia-backup

# Verificar que todo funciona
print_status "Verificando instalación..."

# Esperar un momento para que la aplicación inicie
sleep 5

# Verificar que la aplicación responde
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_success "✅ Aplicación respondiendo correctamente"
else
    print_warning "⚠️  La aplicación no responde inmediatamente, puede tardar unos segundos"
fi

# Verificar servicios
if systemctl is-active --quiet nginx; then
    print_success "✅ Nginx funcionando"
else
    print_error "❌ Nginx no está funcionando"
fi

if systemctl is-active --quiet mongod; then
    print_success "✅ MongoDB funcionando"
else
    print_error "❌ MongoDB no está funcionando"
fi

# Mostrar información final
echo ""
echo "🎉 ¡Despliegue completado exitosamente!"
echo ""
echo "📋 Información del servidor:"
echo "   - IP del servidor: $(curl -s ifconfig.me)"
echo "   - Puerto de la aplicación: 3000"
echo "   - Puerto HTTP: 80"
echo ""
echo "🔧 Comandos útiles:"
echo "   - Ver estado: drilunia-status"
echo "   - Reiniciar: drilunia-restart"
echo "   - Monitoreo del sistema: system-monitor"
echo "   - Logs en tiempo real: pm2 logs drilunia-backend"
echo ""
echo "🌐 URLs de acceso:"
echo "   - API: http://$(curl -s ifconfig.me)/api"
echo "   - Health check: http://$(curl -s ifconfig.me)/health"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Configura SSL/HTTPS con Let's Encrypt"
echo "   2. Actualiza las variables de entorno en .env"
echo "   3. Configura las notificaciones push"
echo "   4. Configura el almacenamiento de archivos"
echo ""
print_success "🚀 Drilunia Backend está listo para usar!"
