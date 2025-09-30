# Guía de instalación y configuración

## Requisitos del sistema

### Requisitos mínimos

- **Sistema operativo**: Windows 10+, macOS 10.14+, o Linux (Ubuntu 18.04+)
- **Node.js**: Versión 16.0 o superior
- **RAM**: 4GB mínimo (8GB recomendado)
- **Espacio en disco**: 2GB libres
- **Micrófono**: Requerido para grabación de audio
- **Conexión a internet**: Para usar Gemini AI

### Dependencias principales

- Electron ^26.0.0
- Node.js Express server
- Vosk speech recognition
- Google Generative AI (Gemini)
- SQLite3 database

## Instalación paso a paso

### 1. Preparación del entorno

```bash
# Verificar versión de Node.js
node --version  # Debe ser 16+

# Verificar npm
npm --version
```

### 2. Clonar o descargar el proyecto

```bash
# Si usas Git
git clone <repository-url>
cd my-electron-app

# O descargar y extraer el ZIP
```

### 3. Instalar dependencias

```bash
# Instalar todas las dependencias automáticamente
npm run install:all

# O manualmente:
npm install
cd frontend && npm install
cd ../backend && npm install
```

### 4. Configurar Gemini API

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una cuenta o inicia sesión
3. Genera una nueva API key
4. Copia el archivo de configuración:

```bash
cd backend
cp .env.example .env
```

5. Edita `.env` con tu editor favorito:

```env
GEMINI_API_KEY=tu_api_key_real_aqui
PORT=3001
DB_PATH=./data/nutrition.db
```

### 5. Verificar el modelo Vosk

El modelo de Vosk debe estar en `backend/model/`. La estructura debe ser:

```
backend/model/
├── README
├── am/
├── conf/
├── graph/
└── ivector/
```

Si no tienes el modelo, puedes descargarlo desde [Vosk Models](https://alphacephei.com/vosk/models).

## Primer uso

### 1. Ejecutar la aplicación

```bash
# Modo desarrollo (recomendado para pruebas)
npm run dev

# O modo producción
npm start
```

### 2. Verificar funcionamiento

1. **Backend**: Ve a http://localhost:3001/api/health en tu navegador

   - Debe mostrar: `{ "status": "OK", "vosk_model": "loaded", "gemini_api": "configured" }`

2. **Frontend**: La aplicación Electron debe abrir automáticamente
   - El estado debe mostrar "Conectado" en verde

### 3. Permisos de micrófono

La primera vez que uses la grabación:

1. El navegador/SO pedirá permisos de micrófono
2. Concede los permisos
3. El botón "Iniciar Grabación" se habilitará

## Solución de problemas comunes

### ❌ Error: "Modelo Vosk no encontrado"

**Causa**: El modelo no está en la ubicación correcta
**Solución**:

```bash
# Verificar que existe el directorio
ls -la backend/model/

# Si no existe, descargar modelo para español
cd backend
wget https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip
unzip vosk-model-small-es-0.42.zip
mv vosk-model-small-es-0.42 model
```

### ❌ Error: "GEMINI_API_KEY not configured"

**Causa**: API key no configurada o incorrecta
**Solución**:

1. Verifica que el archivo `.env` existe en `backend/`
2. Confirma que la API key es válida
3. Reinicia el servidor backend

### ❌ Error: "Puerto 3001 en uso"

**Causa**: Otro proceso usa el puerto
**Solución**:

```bash
# Cambiar puerto en .env
echo "PORT=3002" >> backend/.env

# O matar el proceso que usa el puerto
sudo lsof -i :3001
sudo kill -9 <PID>
```

### ❌ Error: "Cannot access microphone"

**Causa**: Permisos de micrófono denegados
**Solución**:

- **Windows**: Configuración > Privacidad > Micrófono
- **macOS**: Preferencias del Sistema > Seguridad > Micrófono
- **Linux**: Verificar PulseAudio/ALSA

### ❌ Error: "sqlite3 no compatible"

**Causa**: Módulo nativo no compilado correctamente
**Solución**:

```bash
cd backend
npm rebuild sqlite3
# O reinstalar
npm uninstall sqlite3
npm install sqlite3
```

## Actualización

### Actualizar dependencias

```bash
# Actualizar todas las dependencias
npm run install:all

# O actualizar manualmente
npm update
cd frontend && npm update
cd ../backend && npm update
```

### Migración de datos

Si actualizas desde una versión anterior:

1. Haz backup de `backend/data/nutrition.db`
2. Ejecuta cualquier script de migración incluido
3. Verifica que los datos siguen disponibles

## Configuración avanzada

### Variables de entorno completas

```env
# API Configuration
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-pro

# Server Configuration
PORT=3001
HOST=localhost
NODE_ENV=production

# Database Configuration
DB_PATH=./data/nutrition.db
DB_BACKUP_INTERVAL=3600000

# Audio Configuration
MAX_AUDIO_SIZE=10485760
SUPPORTED_AUDIO_FORMATS=audio/wav,audio/webm,audio/mp3

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/app.log
```

### Configuración de desarrollo

Para desarrolladores:

```bash
# Modo desarrollo con recarga automática
cd backend
npm install -g nodemon
npm run dev

# En otra terminal
cd frontend
npm start
```

## Distribución

### Crear ejecutables

```bash
# Para todas las plataformas
npm run build

# Solo para tu plataforma actual
cd frontend
npm run pack
```

Los ejecutables se crearán en `frontend/dist/`.

## Respaldo y recuperación

### Hacer respaldo

```bash
# Respaldar base de datos
cp backend/data/nutrition.db backup_$(date +%Y%m%d).db

# Respaldar configuración
cp backend/.env backup_.env
```

### Restaurar respaldo

```bash
# Restaurar base de datos
cp backup_YYYYMMDD.db backend/data/nutrition.db

# Restaurar configuración
cp backup_.env backend/.env
```

## Contacto y soporte

Si sigues teniendo problemas después de seguir esta guía:

1. Revisa los logs en `backend/logs/app.log`
2. Abre un issue en GitHub con:
   - Tu sistema operativo
   - Versión de Node.js
   - Logs de error completos
   - Pasos para reproducir el problema

¡La aplicación debería estar funcionando correctamente ahora! 🎉
