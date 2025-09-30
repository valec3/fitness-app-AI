/**
 * Ejemplo de uso de la API de Gemini
 * Este archivo muestra cómo se integra y usa Gemini AI en el proyecto
 */

const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicialización de Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

/**
 * Ejemplo completo de procesamiento de texto con Gemini
 */
async function ejemploProcesamientoGemini() {
  // Texto de ejemplo que podría venir de una transcripción
  const textoEjemplo = `
        Hoy desayuné dos huevos revueltos con una tostada integral y un vaso de jugo de naranja.
        Después fui al gimnasio donde hice 30 minutos de cinta caminadora a intensidad media
        y 15 minutos de levantamiento de pesas. Por la tarde comí una ensalada de pollo
        con verduras mixtas y un yogurt griego.
    `;

  // Prompt específico para extraer información nutricional
  const prompt = `
Analiza el siguiente texto y extrae información sobre alimentos consumidos y ejercicios realizados.
Devuelve SOLO un JSON válido con la siguiente estructura exacta:

{
  "foods": [
    {
      "name": "nombre del alimento",
      "quantity": "cantidad consumida",
      "calories": número_de_calorías_estimadas,
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

Texto a analizar: "${textoEjemplo}"

Reglas importantes:
- Si no se mencionan alimentos específicos, devuelve un array vacío para "foods"
- Si no se mencionan ejercicios específicos, devuelve un array vacío para "exercises"
- Estima las calorías basándote en porciones estándar
- Usa valores nutricionales aproximados pero realistas
- Para ejercicios, estima calorías quemadas según duración e intensidad
- Mantén el formato JSON exacto sin texto adicional
`;

  try {
    console.log("🤖 Enviando prompt a Gemini...");

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let geminiText = response.text();

    console.log("📝 Respuesta cruda de Gemini:");
    console.log(geminiText);

    // Limpiar la respuesta para obtener solo el JSON
    geminiText = geminiText
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    // Intentar parsear el JSON
    let processedData;
    try {
      processedData = JSON.parse(geminiText);
      console.log("✅ JSON parseado correctamente:");
      console.log(JSON.stringify(processedData, null, 2));
    } catch (parseError) {
      console.error("❌ Error parseando JSON:", parseError);
      console.log("Respuesta que causó el error:", geminiText);

      // Crear estructura por defecto en caso de error
      processedData = {
        foods: [],
        exercises: [],
        timestamp: new Date().toISOString(),
        raw_text: textoEjemplo,
        gemini_response: geminiText,
        error: "Error parseando respuesta de Gemini",
      };
    }

    return processedData;
  } catch (error) {
    console.error("❌ Error llamando a Gemini:", error);
    throw error;
  }
}

/**
 * Ejemplo de respuesta esperada de Gemini
 */
const ejemploRespuestaEsperada = {
  foods: [
    {
      name: "Huevos revueltos",
      quantity: "2 unidades",
      calories: 140,
      nutrition: {
        protein: "12g",
        carbs: "1g",
        fat: "10g",
        fiber: "0g",
      },
    },
    {
      name: "Tostada integral",
      quantity: "1 rebanada",
      calories: 80,
      nutrition: {
        protein: "3g",
        carbs: "15g",
        fat: "1g",
        fiber: "3g",
      },
    },
    {
      name: "Jugo de naranja",
      quantity: "1 vaso (250ml)",
      calories: 110,
      nutrition: {
        protein: "2g",
        carbs: "26g",
        fat: "0g",
        fiber: "0g",
      },
    },
    {
      name: "Ensalada de pollo",
      quantity: "1 porción",
      calories: 350,
      nutrition: {
        protein: "35g",
        carbs: "8g",
        fat: "18g",
        fiber: "4g",
      },
    },
    {
      name: "Yogurt griego",
      quantity: "1 unidad (150g)",
      calories: 100,
      nutrition: {
        protein: "15g",
        carbs: "6g",
        fat: "0g",
        fiber: "0g",
      },
    },
  ],
  exercises: [
    {
      type: "Cinta caminadora",
      duration: "30 minutos",
      intensity: "media",
      calories_burned: 200,
    },
    {
      type: "Levantamiento de pesas",
      duration: "15 minutos",
      intensity: "alta",
      calories_burned: 120,
    },
  ],
  timestamp: "2024-01-15T10:30:00.000Z",
};

/**
 * Función para validar la respuesta de Gemini
 */
function validarRespuestaGemini(data) {
  const errores = [];

  // Validar estructura básica
  if (!data || typeof data !== "object") {
    errores.push("La respuesta no es un objeto válido");
    return errores;
  }

  // Validar arrays requeridos
  if (!Array.isArray(data.foods)) {
    errores.push('El campo "foods" debe ser un array');
  }

  if (!Array.isArray(data.exercises)) {
    errores.push('El campo "exercises" debe ser un array');
  }

  // Validar timestamp
  if (!data.timestamp || !Date.parse(data.timestamp)) {
    errores.push('El campo "timestamp" debe ser una fecha válida');
  }

  // Validar estructura de alimentos
  data.foods?.forEach((food, index) => {
    if (!food.name) {
      errores.push(`Alimento ${index}: falta el nombre`);
    }
    if (typeof food.calories !== "number") {
      errores.push(`Alimento ${index}: las calorías deben ser un número`);
    }
    if (!food.nutrition || typeof food.nutrition !== "object") {
      errores.push(`Alimento ${index}: falta información nutricional`);
    }
  });

  // Validar estructura de ejercicios
  data.exercises?.forEach((exercise, index) => {
    if (!exercise.type) {
      errores.push(`Ejercicio ${index}: falta el tipo`);
    }
    if (typeof exercise.calories_burned !== "number") {
      errores.push(
        `Ejercicio ${index}: las calorías quemadas deben ser un número`
      );
    }
  });

  return errores;
}

/**
 * Configuración avanzada de Gemini
 */
const configuracionAvanzadaGemini = {
  model: "gemini-pro",
  generationConfig: {
    temperature: 0.1, // Respuestas más consistentes
    topK: 1, // Usar solo la mejor opción
    topP: 0.8, // Control de creatividad
    maxOutputTokens: 2048, // Límite de tokens de salida
  },
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
  ],
};

/**
 * Tips para optimizar prompts con Gemini
 */
const tipsOptimizacionPrompts = `
TIPS PARA MEJORES RESULTADOS CON GEMINI:

1. SÉ ESPECÍFICO:
   - Define exactamente el formato JSON que quieres
   - Incluye ejemplos de valores esperados
   - Especifica unidades de medida

2. USA ESTRUCTURA CLARA:
   - Divide el prompt en secciones
   - Usa bullet points para reglas
   - Incluye ejemplos negativos (qué NO hacer)

3. CONTROLA LA SALIDA:
   - Pide "SOLO JSON sin texto adicional"
   - Especifica cómo manejar casos edge
   - Define valores por defecto para campos opcionales

4. VALIDACIÓN:
   - Siempre valida la respuesta JSON
   - Ten un fallback para errores de parsing
   - Loggea respuestas problemáticas para debugging

5. LÍMITES Y RESTRICCIONES:
   - Define límites máximos (ej: máximo 10 alimentos)
   - Especifica rangos de valores aceptables
   - Incluye validaciones de tipo de datos

6. CONTEXTO CULTURAL:
   - Adapta nombres de alimentos a la región
   - Usa unidades de medida locales
   - Considera diferencias culturales en porciones
`;

// Ejemplo de uso
if (require.main === module) {
  ejemploProcesamientoGemini()
    .then((result) => {
      console.log("\n🎉 Ejemplo completado exitosamente");
      console.log("Resultado final:", JSON.stringify(result, null, 2));

      const errores = validarRespuestaGemini(result);
      if (errores.length > 0) {
        console.log("\n⚠️ Errores de validación:", errores);
      } else {
        console.log("\n✅ Respuesta válida");
      }
    })
    .catch((error) => {
      console.error("\n❌ Error en el ejemplo:", error);
    });
}

module.exports = {
  ejemploProcesamientoGemini,
  ejemploRespuestaEsperada,
  validarRespuestaGemini,
  configuracionAvanzadaGemini,
  tipsOptimizacionPrompts,
};
