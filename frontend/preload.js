const { contextBridge, ipcRenderer } = require("electron");

/**
 * Preload script para exponer APIs seguras al renderer
 * Este archivo actúa como puente entre el proceso principal y el renderer
 */

// Exponer APIs al contexto del renderer de forma segura
contextBridge.exposeInMainWorld("electronAPI", {
  // API para obtener el estado del backend
  getBackendStatus: () => ipcRenderer.invoke("get-backend-status"),

  // API para logging desde el renderer
  log: (message) => console.log(`[Renderer]: ${message}`),

  // API para obtener información del sistema
  platform: process.platform,

  // API para notificaciones (opcional)
  showNotification: (title, body) => {
    new Notification(title, { body });
  },
});

/**
 * API para comunicación HTTP con el backend
 * Estas funciones se pueden usar directamente en el renderer
 */
contextBridge.exposeInMainWorld("backendAPI", {
  baseURL: "http://localhost:3001",

  // Enviar transcripción al backend
  sendTranscription: async (transcription) => {
    const response = await fetch("http://localhost:3001/api/transcribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ transcription }),
    });

    return await response.json();
  },

  // Subir archivo de audio (para futuras implementaciones)
  uploadAudio: async (audioBlob) => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    const response = await fetch("http://localhost:3001/api/upload-audio", {
      method: "POST",
      body: formData,
    });

    return await response.json();
  },

  // Procesar texto con Gemini
  processText: async (text) => {
    const response = await fetch("http://localhost:3001/api/process-text", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    return await response.json();
  },

  // Obtener historial de entradas
  getEntries: async () => {
    const response = await fetch("http://localhost:3001/api/entries");
    return await response.json();
  },

  // Obtener entrada específica
  getEntry: async (id) => {
    const response = await fetch(`http://localhost:3001/api/entries/${id}`);
    return await response.json();
  },

  // Verificar estado del backend
  checkHealth: async () => {
    try {
      const response = await fetch("http://localhost:3001/api/health");
      return await response.json();
    } catch (error) {
      return { status: "error", message: error.message };
    }
  },
});

// Logging para debugging
console.log("✅ Preload script cargado correctamente");
