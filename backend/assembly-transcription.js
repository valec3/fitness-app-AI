/**
 * Módulo de transcripción usando AssemblyAI
 * Procesa archivos de audio y los convierte a texto
 */

const fs = require("fs");
const path = require("path");
const { AssemblyAI } = require("assemblyai");

class AssemblyAITranscription {
  constructor() {
    this.client = new AssemblyAI({
      apiKey: "d021f22b69ab41e0a8526d029cb362a3",
    });
    this.isInitialized = false;
  }

  /**
   * Inicializa el módulo de transcripción
   */
  async initialize() {
    try {
      console.log("✅ Módulo de transcripción AssemblyAI inicializado");
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error("❌ Error inicializando transcripción:", error.message);
      return false;
    }
  }

  /**
   * Transcribe un archivo de audio a texto usando AssemblyAI
   */
  async transcribeAudio(audioPath) {
    try {
      if (!this.isInitialized) {
        throw new Error("Módulo de transcripción no inicializado");
      }

      console.log("🎤 Iniciando transcripción con AssemblyAI...");
      console.log("📁 Archivo de audio:", audioPath);

      // Verificar que el archivo existe
      if (!fs.existsSync(audioPath)) {
        throw new Error(`Archivo de audio no encontrado: ${audioPath}`);
      }

      // Parámetros para la transcripción
      const params = {
        audio: audioPath,
        speech_model: "universal",
        language_code: "es", // Español
      };

      console.log("🔄 Enviando archivo a AssemblyAI...");

      // Realizar la transcripción
      const transcript = await this.client.transcripts.transcribe(params);

      // Verificar si la transcripción fue exitosa
      if (transcript.status === "error") {
        throw new Error(`Error en AssemblyAI: ${transcript.error}`);
      }

      const transcriptionText = transcript.text || "";
      console.log("✅ Transcripción completada:", transcriptionText);

      return {
        success: true,
        text: transcriptionText,
        timestamp: new Date().toISOString(),
        confidence: transcript.confidence || 0,
      };
    } catch (error) {
      console.error("❌ Error en transcripción:", error.message);
      return {
        success: false,
        error: error.message,
        text: "",
      };
    }
  }
}

module.exports = AssemblyAITranscription;
