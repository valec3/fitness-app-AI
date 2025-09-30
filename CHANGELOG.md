# Changelog

## [1.0.0] - 2024-01-15

### Agregado

- ✅ Grabación de audio con visualizador en tiempo real
- ✅ Transcripción automática usando Vosk (modelo español)
- ✅ Procesamiento con Google Gemini AI para extracción de datos nutricionales
- ✅ Base de datos SQLite para almacenamiento local
- ✅ Interfaz de usuario moderna y responsiva
- ✅ Sistema de pestañas para organizar información
- ✅ Exportación de datos a JSON
- ✅ Historial de registros completo
- ✅ Notificaciones toast para feedback
- ✅ Validación de permisos de micrófono
- ✅ Health check del backend automático
- ✅ Edición de transcripciones manuales

### Características técnicas

- ✅ Arquitectura modular con separación frontend/backend
- ✅ Comunicación segura mediante contextBridge
- ✅ Manejo de errores robusto
- ✅ Logging detallado para debugging
- ✅ APIs RESTful bien documentadas
- ✅ Almacenamiento estructurado en SQLite

### APIs implementadas

- ✅ `POST /api/transcribe` - Transcripción de audio
- ✅ `POST /api/process-text` - Procesamiento con IA
- ✅ `GET /api/entries` - Obtener historial
- ✅ `GET /api/entries/:id` - Obtener entrada específica
- ✅ `GET /api/health` - Estado del servidor

### Próximas versiones

- [ ] Soporte para múltiples idiomas
- [ ] Integración con APIs de nutrición externas
- [ ] Gráficos y estadísticas
- [ ] Sincronización en la nube
- [ ] Modo offline mejorado
