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

  // Subir archivo de audio al backend
  uploadAudio: async (audioBlob) => {
    try {
      const formData = new FormData();

      console.log("🎤 Iniciando upload de audio");
      console.log("📊 Blob info:", {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      // Crear un File object desde el Blob para mejor compatibilidad
      const audioFile = new File([audioBlob], "recording.webm", {
        type: audioBlob.type || "audio/webm",
        lastModified: Date.now(),
      });

      formData.append("audio", audioFile);

      console.log("📤 Enviando archivo de audio:", {
        name: audioFile.name,
        size: audioFile.size,
        type: audioFile.type,
      });

      console.log("📋 FormData creado, enviando request...");

      const response = await fetch("http://localhost:3001/api/upload-audio", {
        method: "POST",
        body: formData,
      });

      console.log("📡 Response recibido:", {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const result = await response.json();
      console.log("📡 Response data:", result);
      return result;
    } catch (error) {
      console.error("❌ Error en uploadAudio:", error);
      return { success: false, error: error.message };
    }
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
