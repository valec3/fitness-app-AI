# Seguimiento Nutricional y Ejercicios con IA

Aplicación de escritorio multiplataforma construida con Electron que utiliza reconocimiento de voz (Vosk) y procesamiento con IA (Gemini) para el seguimiento automático de alimentos y ejercicios.

## 🚀 Características

- **Grabación de audio** con visualizador en tiempo real
- **Transcripción automática en tiempo real** usando Web Speech API del navegador
- **Procesamiento con IA** mediante Google Gemini API
- **Almacenamiento local** en base de datos SQLite
- **Interfaz moderna** y responsiva
- **Exportación de datos** en formato JSON
- **Multiplataforma** (Windows, macOS, Linux)

## 📋 Requisitos

- Node.js 16+
- NPM o Yarn
- Google Gemini API Key
- Micrófono para grabación de audio

## 🛠️ Instalación

### 1. Clonar y configurar el proyecto

```bash
# Instalar todas las dependencias
npm run install:all
```

### 2. Configurar variables de entorno

```bash
# Copiar el archivo de ejemplo
cd backend
cp .env.example .env
```

Edita el archivo `.env` y agrega tu API key de Gemini:

```env
GEMINI_API_KEY=tu_api_key_aqui
PORT=3001
```

**Obtén tu API key de Gemini:**

1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Crea una nueva API key
3. Cópiala al archivo `.env`

## 🚀 Uso

### Desarrollo

```bash
# Ejecutar ambos (frontend y backend) simultáneamente
npm run dev

# O ejecutar por separado:
npm run start:backend
npm run start:frontend
```

### Producción

```bash
# Iniciar la aplicación completa
npm start

# Construir para distribución
npm run build
```

## 📱 Cómo usar la aplicación

### 1. Grabación de Audio

- Haz clic en "Iniciar Grabación"
- Habla sobre los alimentos que comiste o ejercicios que realizaste
- **La transcripción aparece en tiempo real** mientras hablas
- Haz clic en "Detener" cuando termines

### 2. Confirmar Transcripción

- Revisa la transcripción automática generada
- Puedes editarla si es necesario
- Haz clic en "Confirmar Transcripción" para continuar

### 3. Procesamiento con IA

- Haz clic en "Procesar con IA" para extraer información nutricional
- La IA identificará automáticamente:
  - Alimentos con calorías e información nutricional
  - Ejercicios con duración e intensidad

### 4. Visualización de resultados

- **Nutrición**: Ve los alimentos detectados con información calórica
- **Ejercicios**: Ve los ejercicios con calorías quemadas
- **Historial**: Accede a registros anteriores

## 🏗️ Arquitectura del proyecto

```
my-electron-app/
├── package.json              # Configuración principal
├── frontend/                 # Aplicación Electron
│   ├── main.js              # Proceso principal de Electron
│   ├── preload.js           # Script de preload seguro
│   ├── package.json         # Dependencias del frontend
│   └── renderer/            # Interfaz de usuario
│       ├── index.html       # HTML principal
│       ├── styles.css       # Estilos CSS
│       └── app.js           # Lógica del frontend
├── backend/                 # Servidor Node.js
│   ├── server.js           # Servidor Express principal
│   ├── database.js         # Manejo de SQLite
│   ├── package.json        # Dependencias del backend
│   ├── .env.example        # Variables de entorno de ejemplo
│   └── model/              # Modelo Vosk para español
└── README.md               # Esta documentación
```

## 🔧 APIs del Backend

### Endpoints disponibles

#### `POST /api/transcribe`

Recibe transcripción del frontend

- **Body**: `{ text: string }`
- **Response**: `{ success: boolean, transcription: string }`

#### `POST /api/upload-audio`

Recibe archivos de audio (para futuras implementaciones)

- **Body**: FormData con archivo de audio
- **Response**: `{ success: boolean, message: string }`

#### `POST /api/process-text`

Procesa texto con Gemini AI

- **Body**: `{ text: string }`
- **Response**: `{ success: boolean, data: NutritionData }`

#### `GET /api/entries`

Obtiene historial de entradas

- **Response**: `{ success: boolean, entries: Entry[] }`

#### `GET /api/entries/:id`

Obtiene entrada específica

- **Response**: `{ success: boolean, entry: Entry }`

#### `GET /api/health`

Verifica estado del servidor

- **Response**: `{ status: string, transcription_method: string, gemini_api: string }`

## 📊 Estructura de datos JSON

### Ejemplo de respuesta de Gemini:

```json
{
  "foods": [
    {
      "name": "Manzana",
      "quantity": "1 unidad",
      "calories": 95,
      "nutrition": {
        "protein": "0.5g",
        "carbs": "25g",
        "fat": "0.3g",
        "fiber": "4g"
      }
    }
  ],
  "exercises": [
    {
      "type": "Correr",
      "duration": "30 minutos",
      "intensity": "media",
      "calories_burned": 300
    }
  ],
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🗄️ Base de datos

La aplicación utiliza SQLite con las siguientes tablas:

- **entries**: Registros principales con timestamp
- **foods**: Alimentos con información nutricional
- **exercises**: Ejercicios con duración e intensidad

## 🎨 Características de la UI

- **Diseño moderno** con gradientes y efectos de cristal
- **Visualizador de audio** en tiempo real durante la grabación
- **Sistema de pestañas** para organizar la información
- **Notificaciones toast** para feedback del usuario
- **Diseño responsivo** que se adapta a diferentes tamaños de pantalla
- **Tema oscuro/claro** automático según las preferencias del sistema

## 🔍 Solución de problemas

### El backend no se conecta

- Verifica que el puerto 3001 esté disponible
- Revisa los logs en la consola de Electron

### Error de transcripción

- Asegúrate de que tu navegador soporte Web Speech API (Chrome/Edge recomendados)
- Verifica que tengas permisos de micrófono
- Comprueba tu conexión a internet

### Error de procesamiento IA

- Verifica que tu API key de Gemini sea válida
- Revisa tu conexión a internet

### Audio no se graba

- Confirma permisos de micrófono en tu navegador/SO
- Verifica que tu micrófono funcione correctamente
- Usa Chrome o Edge para mejor compatibilidad

## 🚦 Estados de la aplicación

### Indicadores visuales:

- **Verde**: Conectado y funcionando
- **Rojo**: Desconectado o error
- **Azul**: Procesando
- **Naranja**: Advertencia

## 📈 Próximas características

- [ ] Soporte para múltiples idiomas
- [ ] Integración con APIs de nutrición (FatSecret, Edamam)
- [ ] Gráficos y estadísticas
- [ ] Sincronización en la nube
- [ ] Recordatorios y notificaciones
- [ ] Exportación a PDF

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/nueva-caracteristica`)
3. Commit tus cambios (`git commit -am 'Agregar nueva característica'`)
4. Push a la rama (`git push origin feature/nueva-caracteristica`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la licencia MIT. Ve el archivo `LICENSE` para más detalles.

## 🆘 Soporte

Si tienes problemas o preguntas:

1. Revisa la sección de solución de problemas
2. Abre un issue en GitHub
3. Contacta al equipo de desarrollo

---

**¡Disfruta usando la aplicación de seguimiento nutricional con IA!** 🎉
