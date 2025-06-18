# Drilunia Backend

Backend profesional y robusto para la app Drilunia, compatible con Android, iOS y web, sin depender de servicios de terceros.

## Características
- Autenticación JWT
- Chat en tiempo real con Socket.io
- Prisma + PostgreSQL
- Envío de emails
- Notificaciones push
- Almacenamiento de archivos
- Seguridad avanzada
- Llamadas de voz y video WebRTC con TURN/STUN propio

## Instalación
```bash
npm install
```

## Variables de entorno
Crea un archivo `.env` basado en el ejemplo que se proveerá.

### Ejemplo de configuración TURN/STUN
```
STUN_URLS=stun:tu_dominio_o_ip:3478
TURN_URLS=turn:tu_dominio_o_ip:3478
TURN_USER=usuario_turn
TURN_PASS=contraseña_turn
```

## Migraciones Prisma
```bash
npx prisma migrate dev --name init
```

## Ejecución en desarrollo
```bash
npm start
```

## Estructura de carpetas
- controllers/
- middlewares/
- routes/
- socket/
- prisma/

## Configuración de coturn (TURN/STUN propio)

### Instalación en Ubuntu/Debian
```sh
sudo apt update
sudo apt install coturn
```

### Configuración básica `/etc/turnserver.conf`
```
listening-port=3478
fingerprint
lt-cred-mech
use-auth-secret
static-auth-secret=TU_SECRETO_LARGO
realm=drilunia.com
total-quota=100
bps-capacity=0
stale-nonce
no-loopback-peers
no-multicast-peers
```

### Crear usuario TURN
```sh
turnadmin -a -u usuario_turn -p contraseña_turn -r drilunia.com
```

### Iniciar el servicio
```sh
sudo systemctl enable coturn
sudo systemctl start coturn
```

## Consumo del endpoint ICE en apps móviles

1. Haz login y obtén el token JWT.
2. Haz una petición GET a `/api/ice` con el token en el header Authorization:
   - Ejemplo:
     ```
     GET /api/ice
     Authorization: Bearer TU_TOKEN_JWT
     ```
3. Recibirás un JSON con la lista de iceServers:
   ```json
   {
     "iceServers": [
       { "urls": "stun:tu_dominio_o_ip:3478" },
       { "urls": "turn:tu_dominio_o_ip:3478", "username": "usuario_turn", "credential": "contraseña_turn" }
     ]
   }
   ```
4. Usa ese array en la configuración de tu PeerConnection:
   - **iOS (Swift):**
     ```swift
     let config = RTCConfiguration()
     config.iceServers = [RTCIceServer(urlStrings: ["stun:..."]), ...]
     ```
   - **Android (Java/Kotlin):**
     ```java
     PeerConnection.IceServer.builder("stun:...").setUsername("usuario_turn").setPassword("contraseña_turn").createIceServer();
     ```

## Contacto
[drilunia.com](https://drilunia.com) 