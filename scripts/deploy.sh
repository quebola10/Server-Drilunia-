#!/bin/bash

# Drilunia Backend - Script de Despliegue
# Despliega la aplicación completa con Docker Compose

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Verificar si Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        error "Docker no está instalado. Por favor instala Docker primero."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose no está instalado. Por favor instala Docker Compose primero."
        exit 1
    fi
    
    log "Docker y Docker Compose verificados"
}

# Verificar archivo .env
check_env() {
    if [ ! -f .env ]; then
        warn "Archivo .env no encontrado. Creando desde .env.example..."
        if [ -f .env.example ]; then
            cp .env.example .env
            warn "Por favor edita el archivo .env con tus configuraciones antes de continuar."
            exit 1
        else
            error "Archivo .env.example no encontrado."
            exit 1
        fi
    fi
    
    log "Archivo .env verificado"
}

# Crear directorios necesarios
create_directories() {
    log "Creando directorios necesarios..."
    
    mkdir -p logs
    mkdir -p uploads
    mkdir -p ssl
    mkdir -p config/grafana
    
    log "Directorios creados"
}

# Configurar SSL (opcional)
setup_ssl() {
    if [ "$1" = "--ssl" ]; then
        log "Configurando SSL..."
        
        if [ ! -f ssl/drilunia.crt ] || [ ! -f ssl/drilunia.key ]; then
            warn "Certificados SSL no encontrados. Generando certificados autofirmados..."
            
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout ssl/drilunia.key \
                -out ssl/drilunia.crt \
                -subj "/C=ES/ST=Madrid/L=Madrid/O=Drilunia/OU=IT/CN=drilunia.com"
            
            log "Certificados SSL generados"
        else
            log "Certificados SSL encontrados"
        fi
    fi
}

# Backup de datos existentes
backup_data() {
    if [ "$1" = "--backup" ]; then
        log "Creando backup de datos existentes..."
        
        if [ -d "data" ]; then
            tar -czf "backup_$(date +%Y%m%d_%H%M%S).tar.gz" data/
            log "Backup creado: backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        fi
    fi
}

# Detener servicios existentes
stop_services() {
    log "Deteniendo servicios existentes..."
    
    docker-compose down --remove-orphans || true
    
    log "Servicios detenidos"
}

# Limpiar recursos Docker
cleanup_docker() {
    if [ "$1" = "--clean" ]; then
        log "Limpiando recursos Docker no utilizados..."
        
        docker system prune -f
        docker volume prune -f
        
        log "Limpieza completada"
    fi
}

# Construir y levantar servicios
start_services() {
    log "Construyendo y levantando servicios..."
    
    # Construir imágenes
    docker-compose build --no-cache
    
    # Levantar servicios
    docker-compose up -d
    
    log "Servicios iniciados"
}

# Verificar salud de los servicios
check_health() {
    log "Verificando salud de los servicios..."
    
    # Esperar a que los servicios estén listos
    sleep 30
    
    # Verificar backend
    if curl -f http://localhost:3000/health > /dev/null 2>&1; then
        log "✅ Backend saludable"
    else
        error "❌ Backend no responde"
        return 1
    fi
    
    # Verificar MongoDB
    if docker-compose exec -T mongo mongosh --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
        log "✅ MongoDB saludable"
    else
        error "❌ MongoDB no responde"
        return 1
    fi
    
    # Verificar Redis
    if docker-compose exec -T redis redis-cli -a drilunia123 ping > /dev/null 2>&1; then
        log "✅ Redis saludable"
    else
        error "❌ Redis no responde"
        return 1
    fi
    
    # Verificar MinIO
    if curl -f http://localhost:9000/minio/health/live > /dev/null 2>&1; then
        log "✅ MinIO saludable"
    else
        error "❌ MinIO no responde"
        return 1
    fi
    
    log "Todos los servicios están saludables"
}

# Ejecutar migraciones
run_migrations() {
    log "Ejecutando migraciones de base de datos..."
    
    docker-compose exec -T backend node scripts/migrate.js
    
    log "Migraciones completadas"
}

# Mostrar información de despliegue
show_info() {
    log "=== Despliegue Completado ==="
    echo ""
    echo "🌐 URLs de acceso:"
    echo "  - Backend API: http://localhost:3000"
    echo "  - MinIO Console: http://localhost:9001"
    echo "  - Prometheus: http://localhost:9090"
    echo "  - Grafana: http://localhost:3001"
    echo ""
    echo "🔑 Credenciales por defecto:"
    echo "  - MinIO: drilunia / drilunia123"
    echo "  - Grafana: admin / drilunia123"
    echo "  - MongoDB: admin / drilunia123"
    echo ""
    echo "📊 Monitoreo:"
    echo "  - Health Check: http://localhost:3000/health"
    echo "  - Métricas: http://localhost:3000/api/metrics"
    echo ""
    echo "📝 Logs:"
    echo "  - Ver logs: docker-compose logs -f"
    echo "  - Logs específicos: docker-compose logs -f backend"
    echo ""
    echo "🛠️  Comandos útiles:"
    echo "  - Detener: docker-compose down"
    echo "  - Reiniciar: docker-compose restart"
    echo "  - Actualizar: ./scripts/deploy.sh --update"
    echo ""
}

# Función principal
main() {
    log "🚀 Iniciando despliegue de Drilunia Backend..."
    
    # Verificaciones
    check_docker
    check_env
    
    # Preparación
    create_directories
    setup_ssl "$1"
    backup_data "$1"
    stop_services
    cleanup_docker "$1"
    
    # Despliegue
    start_services
    
    # Verificación
    if check_health; then
        run_migrations
        show_info
        log "✅ Despliegue completado exitosamente!"
    else
        error "❌ Despliegue falló. Revisa los logs: docker-compose logs"
        exit 1
    fi
}

# Manejo de argumentos
case "$1" in
    --help)
        echo "Uso: $0 [opciones]"
        echo ""
        echo "Opciones:"
        echo "  --ssl      Configurar SSL con certificados autofirmados"
        echo "  --backup   Crear backup antes del despliegue"
        echo "  --clean    Limpiar recursos Docker no utilizados"
        echo "  --help     Mostrar esta ayuda"
        echo ""
        echo "Ejemplos:"
        echo "  $0                    # Despliegue básico"
        echo "  $0 --ssl --backup     # Con SSL y backup"
        echo "  $0 --clean            # Con limpieza"
        ;;
    *)
        main "$1"
        ;;
esac
