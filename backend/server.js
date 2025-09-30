const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

// Configuración del servidor Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configuración de multer para manejar archivos de audio
const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    // Aceptar archivos de audio
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de audio"), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB límite
  },
});

// Configuración de Gemini AI para versión gratuita
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Lista de modelos para probar (en orden de preferencia)
const AVAILABLE_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "models/gemini-2.0-flash",
  "models/gemini-2.5-flash",
  "models/gemini-1.5-flash",
];

let currentModel = null;

// Función para obtener un modelo que funcione
async function getWorkingModel() {
  if (currentModel) {
    return currentModel;
  }

  for (const modelName of AVAILABLE_MODELS) {
    try {
      console.log(`🔍 Probando modelo: ${modelName}`);
      const testModel = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      });

      // Hacer una prueba simple para verificar que el modelo funciona
      const testResult = await testModel.generateContent("Hola");
      await testResult.response.text();

      console.log(`✅ Modelo funcionando: ${modelName}`);
      currentModel = testModel;
      return testModel;
    } catch (error) {
      console.log(`❌ Modelo ${modelName} no disponible: ${error.message}`);
      continue;
    }
  }

  throw new Error("Ningún modelo de Gemini está disponible con tu API key");
}

// Intentar configurar el modelo por defecto
let model;
try {
  model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });
} catch (error) {
  console.log(
    "⚠️  Modelo por defecto no disponible, se usará detección automática"
  );
}

// Base de datos SQLite
const Database = require("./database");
const db = new Database();

/**
 * Endpoint para recibir transcripción desde el frontend
 * Nota: La transcripción se realiza en el frontend usando Web Speech API
 */
app.post("/api/transcribe", (req, res) => {
  try {
    const { transcription } = req.body;

    if (!transcription) {
      return res.status(400).json({ error: "Transcripción requerida" });
    }

    console.log("📝 Transcripción recibida:", transcription);

    res.json({
      success: true,
      transcription: transcription,
      timestamp: new Date().toISOString(),
      method: "web_speech_api",
    });
  } catch (error) {
    console.error("❌ Error procesando transcripción:", error);
    res.status(500).json({
      success: false,
      error: "Error procesando transcripción: " + error.message,
    });
  }
});

/**
 * Endpoint alternativo para subir audio (para futuras implementaciones)
 * Por ahora solo confirma la recepción del archivo
 */
app.post("/api/upload-audio", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No se recibió archivo de audio" });
    }

    const audioPath = req.file.path;
    console.log("🎤 Archivo de audio recibido:", audioPath);

    // Por ahora solo confirmamos la recepción
    // En el futuro se podría integrar con servicios de transcripción cloud

    // Limpiar archivo temporal
    fs.unlinkSync(audioPath);

    res.json({
      success: true,
      message:
        "Audio recibido correctamente. Use Web Speech API para transcripción.",
      filename: req.file.originalname,
      size: req.file.size,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Error procesando audio:", error);
    res.status(500).json({
      success: false,
      error: "Error procesando audio: " + error.message,
    });
  }
});

/**
 * Endpoint para procesar texto con Gemini AI
 */
app.post("/api/process-text", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Texto requerido" });
    }

    console.log("🤖 Procesando texto con Gemini 2.0 Flash:", text);

    // Prompt específico para extraer información nutricional y de ejercicios
    const prompt = `
Analiza el siguiente texto y extrae información sobre alimentos consumidos y ejercicios realizados.
Devuelve SOLO un JSON válido con la siguiente estructura:

{
  "foods": [
    {
      "name": "nombre del alimento",
      "quantity": "cantidad consumida",
      "calories": número_de_calorías,
      "nutrition": {
        "protein": "gramos de proteína",
        "carbs": "gramos de carbohidratos", 
        "fat": "gramos de grasa",
        "fiber": "gramos de fibra"
      }
    }
  ],
  "exercises": [
    {
      "type": "tipo de ejercicio",
      "duration": "duración en minutos",
      "intensity": "baja/media/alta",
      "calories_burned": número_estimado_de_calorías_quemadas
    }
  ],
  "timestamp": "${new Date().toISOString()}"
}

Texto a analizar: "${text}"

Si no se mencionan alimentos o ejercicios específicos, devuelve arrays vacíos para esas secciones.
`;

    // Implementar retry logic para la versión gratuita
    let result;
    let retryCount = 0;
    const maxRetries = 3;
    let workingModel = model;

    while (retryCount <= maxRetries) {
      try {
        // Si no tenemos un modelo funcionando, intentar encontrar uno
        if (!workingModel) {
          workingModel = await getWorkingModel();
        }

        result = await workingModel.generateContent(prompt);
        break; // Si es exitoso, salir del loop
      } catch (error) {
        retryCount++;
        console.log(
          `🔄 Intento ${retryCount}/${maxRetries + 1} - Error Gemini:`,
          error.message
        );

        if (
          error.message.includes("404") ||
          error.message.includes("not found")
        ) {
          // Modelo no encontrado, intentar con detección automática
          console.log(
            "🔄 Modelo no encontrado, intentando detección automática..."
          );
          workingModel = null; // Resetear para forzar nueva detección
          continue;
        } else if (
          error.message.includes("429") ||
          error.message.includes("quota") ||
          error.message.includes("RATE_LIMIT_EXCEEDED")
        ) {
          // Rate limit alcanzado, esperar antes de reintentar
          const waitTime = Math.pow(2, retryCount) * 1000; // Backoff exponencial
          console.log(
            `⏳ Esperando ${waitTime / 1000}s antes de reintentar...`
          );
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        } else if (
          error.message.includes("API_KEY") ||
          error.message.includes("Invalid API key")
        ) {
          console.error(
            "❌ Error de API Key. Verifica tu GEMINI_API_KEY en el archivo .env"
          );
          throw new Error("Configuración de API Key incorrecta");
        } else if (retryCount > maxRetries) {
          throw error; // Si no es rate limit o ya agotamos reintentos
        }
      }
    }

    const response = await result.response;
    let geminiText = response.text();

    // Limpiar la respuesta para obtener solo el JSON
    geminiText = geminiText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let processedData;
    try {
      processedData = JSON.parse(geminiText);
    } catch (parseError) {
      console.error("❌ Error parseando JSON de Gemini:", parseError);
      // Crear estructura por defecto si hay error de parsing
      processedData = {
        foods: [],
        exercises: [],
        timestamp: new Date().toISOString(),
        raw_text: text,
        gemini_response: geminiText,
      };
    }

    // Guardar en base de datos
    try {
      console.log("🔍 Verificando estado de base de datos...");
      console.log("🔍 db.isConnected():", db.isConnected());

      if (!db.isConnected()) {
        console.warn("⚠️ Base de datos no conectada, intentando reconectar...");
        await db.initialize();
      }

      const savedId = await db.saveEntry(processedData);
      processedData.id = savedId;
      console.log("💾 Datos procesados y guardados:", processedData);
    } catch (dbError) {
      console.error("❌ Error guardando en base de datos:", dbError);
      // Continuar sin guardar si hay error de BD
      processedData.id = Date.now(); // ID temporal
    }

    res.json({
      success: true,
      data: processedData,
    });
  } catch (error) {
    console.error("❌ Error procesando con Gemini:", error);
    res.status(500).json({
      success: false,
      error: "Error procesando texto: " + error.message,
    });
  }
});

/**
 * Endpoint para obtener historial de entradas
 */
app.get("/api/entries", async (req, res) => {
  try {
    const entries = await db.getAllEntries();
    res.json({
      success: true,
      entries: entries,
    });
  } catch (error) {
    console.error("❌ Error obteniendo entradas:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo datos: " + error.message,
    });
  }
});

/**
 * Endpoint para obtener una entrada específica
 */
app.get("/api/entries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const entry = await db.getEntry(id);

    if (!entry) {
      return res.status(404).json({ error: "Entrada no encontrada" });
    }

    res.json({
      success: true,
      entry: entry,
    });
  } catch (error) {
    console.error("❌ Error obteniendo entrada:", error);
    res.status(500).json({
      success: false,
      error: "Error obteniendo entrada: " + error.message,
    });
  }
});

/**
 * Endpoint para limpiar todas las tablas (solo para debugging)
 */
app.post("/api/clear-database", async (req, res) => {
  try {
    await db.clearAllTables();
    res.json({
      success: true,
      message: "Base de datos limpiada correctamente",
    });
  } catch (error) {
    console.error("❌ Error limpiando base de datos:", error);
    res.status(500).json({
      success: false,
      error: "Error limpiando base de datos: " + error.message,
    });
  }
});

/**
 * Endpoint de health check
 */
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    transcription_method: "web_speech_api",
    gemini_api: process.env.GEMINI_API_KEY ? "configured" : "not_configured",
    timestamp: new Date().toISOString(),
  });
});

// Manejo de errores de multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Archivo demasiado grande" });
    }
  }
  res.status(500).json({ error: error.message });
});

// Inicializar servidor
async function startServer() {
  try {
    // Crear directorio de uploads si no existe
    if (!fs.existsSync("uploads")) {
      fs.mkdirSync("uploads");
    }

    // Inicializar base de datos
    await db.initialize();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(
        `🚀 Servidor backend ejecutándose en http://localhost:${PORT}`
      );
      console.log(
        `📊 Health check disponible en http://localhost:${PORT}/api/health`
      );
      console.log(`🎤 Usando Web Speech API para transcripción`);
    });
  } catch (error) {
    console.error("❌ Error iniciando servidor:", error);
    process.exit(1);
  }
}

// Manejar cierre graceful
process.on("SIGINT", async () => {
  console.log("🛑 Cerrando servidor...");
  await db.close();
  process.exit(0);
});

// Iniciar la aplicación
startServer();
