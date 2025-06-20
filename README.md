# Drilunia Backend

Backend completo para la aplicación Drilunia - Chat seguro, llamadas de voz/video, y gestión de archivos.

## 🚀 Características

- **Chat en tiempo real** con WebSocket
- **Llamadas de voz y video** con WebRTC
- **Almacenamiento de archivos** con MinIO
- **Notificaciones push** (FCM y APNs)
- **Autenticación JWT** con refresh tokens
- **Base de datos MongoDB** con Redis para cache
- **Monitoreo** con Prometheus y Grafana
- **Proxy reverso** con Nginx y SSL
- **Servidor STUN/TURN** para WebRTC

## 🏗️ Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx Proxy   │    │   Drilunia      │    │   Coturn        │
│   (SSL/TLS)     │◄──►│   Backend       │◄──►│   (WebRTC)      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │    │   MongoDB       │    │   MinIO         │
│   (Métricas)    │    │   (Base datos)  │    │   (Archivos)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Grafana       │    │   Redis         │    │   Email         │
│   (Dashboard)   │    │   (Cache)       │    │   (SMTP)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Requisitos

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM mínimo
- 10GB espacio en disco
- Puerto 80, 443, 3000, 9000, 9001, 9090, 3001 disponibles

## 🛠️ Instalación

### 1. Clonar repositorio

```bash
git clone https://github.com/quebola10/Server-Drilunia-.git
cd Server-Drilunia-Complete
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 3. Desplegar con Docker Compose

```bash
# Despliegue básico
./scripts/deploy.sh

# Con SSL y backup
./scripts/deploy.sh --ssl --backup

# Con limpieza de Docker
./scripts/deploy.sh --clean
```

### 4. Verificar instalación

```bash
# Verificar servicios
docker-compose ps

# Ver logs
docker-compose logs -f

# Health check
curl http://localhost:3000/health
```

## 🔧 Configuración

### Variables de Entorno Principales

```env
# Servidor
NODE_ENV=production
PORT=3000

# Base de datos
MONGO_URI=mongodb://admin:password@mongo:27017/drilunia
REDIS_URL=redis://:password@redis:6379

# JWT
JWT_SECRET=tu_jwt_secret_super_seguro
JWT_REFRESH_SECRET=tu_refresh_secret_super_seguro

# MinIO
MINIO_ACCESS_KEY=drilunia
MINIO_SECRET_KEY=tu_minio_secret

# Email
SMTP_HOST=tu_smtp_host
SMTP_USER=tu_email
SMTP_PASS=tu_password
```

### Configuración SSL

Para producción, reemplaza los certificados autofirmados:

```bash
# Colocar certificados en ssl/
cp tu_certificado.crt ssl/drilunia.crt
cp tu_clave_privada.key ssl/drilunia.key
```

## 📡 API Endpoints

### Autenticación

```
POST   /api/auth/register          # Registrar usuario
POST   /api/auth/login             # Login
POST   /api/auth/verify-email      # Verificar email
POST   /api/auth/refresh-token     # Renovar token
POST   /api/auth/logout            # Logout
GET    /api/auth/profile           # Obtener perfil
```

### Usuarios

```
GET    /api/users                  # Listar usuarios
GET    /api/users/:id              # Obtener usuario
PUT    /api/users/:id              # Actualizar usuario
DELETE /api/users/:id              # Eliminar usuario
POST   /api/users/avatar           # Subir avatar
```

### Chat

```
GET    /api/chat/conversations     # Listar conversaciones
GET    /api/chat/messages/:userId  # Obtener mensajes
POST   /api/chat/messages          # Enviar mensaje
PUT    /api/chat/messages/:id      # Editar mensaje
DELETE /api/chat/messages/:id      # Eliminar mensaje
```

### Archivos

```
POST   /api/files/upload           # Subir archivo
GET    /api/files/:id              # Descargar archivo
DELETE /api/files/:id              # Eliminar archivo
```

### Llamadas

```
POST   /api/calls/start            # Iniciar llamada
POST   /api/calls/accept           # Aceptar llamada
POST   /api/calls/reject           # Rechazar llamada
POST   /api/calls/end              # Terminar llamada
GET    /api/calls/history          # Historial de llamadas
```

### WebRTC

```
GET    /api/ice                    # Obtener servidores ICE
WS     /ws                         # WebSocket para señalización
```

## 🔌 WebSocket Events

### Chat

```javascript
// Enviar mensaje
{
  type: 'chat',
  receiver: 'userId',
  content: 'Hola mundo',
  type: 'text'
}

// Recibir mensaje
{
  type: 'chat',
  sender: 'userId',
  content: 'Hola mundo',
  timestamp: '2024-01-01T00:00:00Z'
}
```

### WebRTC

```javascript
// Offer
{
  type: 'webrtc_offer',
  receiver: 'userId',
  offer: { sdp: '...' }
}

// Answer
{
  type: 'webrtc_answer',
  receiver: 'userId',
  answer: { sdp: '...' }
}

// ICE Candidate
{
  type: 'ice_candidate',
  receiver: 'userId',
  candidate: { candidate: '...' }
}
```

## 📊 Monitoreo

### Prometheus

- URL: http://localhost:9090
- Métricas del backend, MongoDB, Redis, MinIO

### Grafana

- URL: http://localhost:3001
- Usuario: admin
- Contraseña: drilunia123

### Health Checks

```bash
# Backend
curl http://localhost:3000/health

# MongoDB
docker-compose exec mongo mongosh --eval "db.adminCommand('ping')"

# Redis
docker-compose exec redis redis-cli -a drilunia123 ping

# MinIO
curl http://localhost:9000/minio/health/live
```

## 🔒 Seguridad

- **JWT Tokens** con expiración
- **Rate Limiting** por IP
- **CORS** configurado
- **Helmet** para headers de seguridad
- **Validación** de entrada con express-validator
- **Encriptación** de contraseñas con bcrypt
- **HTTPS** con certificados SSL

## 📝 Logs

Los logs se almacenan en:

```
logs/
├── error.log      # Errores
├── combined.log   # Todos los logs
└── access.log     # Logs de acceso (Nginx)
```

Ver logs en tiempo real:

```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f backend
docker-compose logs -f nginx
```

## 🚀 Despliegue en Producción

### 1. Configurar dominio

```bash
# Editar nginx.conf
sed -i 's/drilunia.com/tu-dominio.com/g' config/nginx.conf
```

### 2. Configurar SSL

```bash
# Usar Let's Encrypt
certbot certonly --standalone -d tu-dominio.com
cp /etc/letsencrypt/live/tu-dominio.com/fullchain.pem ssl/drilunia.crt
cp /etc/letsencrypt/live/tu-dominio.com/privkey.pem ssl/drilunia.key
```

### 3. Configurar firewall

```bash
# Abrir puertos necesarios
ufw allow 80
ufw allow 443
ufw allow 3000
ufw allow 3478/udp  # Coturn
```

### 4. Desplegar

```bash
NODE_ENV=production ./scripts/deploy.sh --ssl
```

## 🔧 Mantenimiento

### Backup

```bash
# Backup manual
./scripts/backup.sh

# Backup automático (cron)
0 2 * * * /path/to/Server-Drilunia-Complete/scripts/backup.sh
```

### Actualización

```bash
# Actualizar código
git pull origin main

# Reconstruir y reiniciar
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Limpieza

```bash
# Limpiar logs antiguos
find logs/ -name "*.log" -mtime +30 -delete

# Limpiar Docker
docker system prune -f
```

## 🐛 Troubleshooting

### Servicios no inician

```bash
# Verificar logs
docker-compose logs

# Verificar puertos
netstat -tulpn | grep :3000

# Verificar recursos
docker stats
```

### Problemas de conectividad

```bash
# Verificar red Docker
docker network ls
docker network inspect drilunia-network

# Verificar DNS
docker-compose exec backend nslookup mongo
```

### Problemas de base de datos

```bash
# Conectar a MongoDB
docker-compose exec mongo mongosh -u admin -p drilunia123

# Verificar conexión
docker-compose exec backend node -e "
const mongoose = require('mongoose');
mongoose.connect('mongodb://admin:drilunia123@mongo:27017/drilunia')
  .then(() => console.log('Conectado'))
  .catch(err => console.error(err));
"
```

## 📞 Soporte

- **Issues**: [GitHub Issues](https://github.com/quebola10/Server-Drilunia-/issues)
- **Documentación**: [Wiki](https://github.com/quebola10/Server-Drilunia-/wiki)
- **Email**: admin@drilunia.com

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ver [LICENSE](LICENSE) para más detalles.

## 🤝 Contribuir

1. Fork el proyecto
2. Crear una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abrir un Pull Request

---

**Drilunia** - Chat seguro y privado para todos 🚀 