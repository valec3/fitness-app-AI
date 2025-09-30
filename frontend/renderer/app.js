/**
 * Aplicación principal del frontend
 * Maneja la grabación de audio, transcripción y procesamiento con IA
 */

class NutritionTracker {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.recordingTime = 0;
    this.recordingInterval = null;
    this.audioContext = null;
    this.analyser = null;
    this.currentAudioBlob = null;
    this.currentTranscription = "";
    this.currentProcessedData = null;

    // Web Speech API
    this.recognition = null;
    this.isListening = false;
    this.hasRecognitionError = false;
    this.retryCount = 0;
    this.maxRetries = 3;

    this.initializeApp();
  }

  /**
   * Inicializa la aplicación
   */
  async initializeApp() {
    try {
      await this.checkBackendStatus();
      this.setupEventListeners();
      this.setupTabs();
      this.loadHistory();

      // Verificar soporte de MediaRecorder y Web Speech API
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.showToast("Tu navegador no soporta grabación de audio", "error");
        return;
      }

      // Verificar soporte de Web Speech API
      this.initializeSpeechRecognition();

      // Solicitar permisos de micrófono
      await this.requestMicrophonePermissions();

      // Inicializar modo de texto por defecto (ya que la voz no funciona bien en Electron)
      this.initializeDefaultInputMode();

      this.showToast("Aplicación inicializada correctamente", "success");
    } catch (error) {
      console.error("Error inicializando la aplicación:", error);
      this.showToast("Error inicializando la aplicación", "error");
    }
  }

  /**
   * Inicializa el reconocimiento de voz
   */
  initializeSpeechRecognition() {
    // Verificar soporte del navegador
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Web Speech API no soportada");
      this.showToast(
        "Web Speech API no disponible. Use Chrome o Edge.",
        "warning"
      );
      return;
    }

    this.recognition = new SpeechRecognition();

    // Configuración mejorada para evitar errores de red
    this.recognition.continuous = false; // Cambiar a false para evitar errores
    this.recognition.interimResults = true;
    this.recognition.lang = "es-ES"; // Volver a español
    this.recognition.maxAlternatives = 1;

    // Configuraciones adicionales para mejorar estabilidad
    if (this.recognition.serviceURI) {
      this.recognition.serviceURI = null; // Usar servicio por defecto
    }

    this.recognition.onstart = () => {
      console.log("🎤 Reconocimiento de voz iniciado");
      this.isListening = true;
      this.showToast("Reconocimiento de voz activo", "success");
    };

    this.recognition.onresult = (event) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Mostrar transcripción en tiempo real
      const transcriptionElement = document.getElementById("transcriptionText");
      transcriptionElement.value =
        this.currentTranscription + finalTranscript + interimTranscript;

      // Guardar solo el texto final
      if (finalTranscript) {
        this.currentTranscription += finalTranscript;
      }
    };

    this.recognition.onerror = (event) => {
      console.error("Error en reconocimiento de voz:", event.error);

      // Manejo simple de errores
      switch (event.error) {
        case "network":
          this.showToast("Sin conexión. Intenta de nuevo.", "error");
          break;
        case "no-speech":
          this.showToast("No se detectó voz. Habla más fuerte.", "warning");
          return; // No detener por este error
        case "audio-capture":
        case "not-allowed":
          this.showToast("Error de micrófono. Verifica permisos.", "error");
          break;
        case "language-not-supported":
          this.showToast("Cambiando configuración de idioma...", "info");
          this.recognition.lang = "es";
          return;
        default:
          this.showToast(`Error: ${event.error}`, "warning");
      }

      // Detener grabación en caso de error crítico
      this.stopRecording();
    };

    this.recognition.onend = () => {
      console.log("🛑 Reconocimiento de voz finalizado");
      this.isListening = false;

      // No reiniciar automáticamente para evitar errores
      // El usuario puede volver a iniciar manualmente si es necesario
    };
  }

  /**
   * Solicita permisos del micrófono
   */
  async requestMicrophonePermissions() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // Detener inmediatamente

      // Habilitar botón de grabación
      document.getElementById("recordBtn").disabled = false;

      this.showToast("Permisos de micrófono concedidos", "success");
    } catch (error) {
      console.error("Error obteniendo permisos:", error);
      this.showToast(
        "Se requieren permisos de micrófono para usar la aplicación",
        "error"
      );
    }
  }

  /**
   * Verifica el estado del backend
   */
  async checkBackendStatus() {
    try {
      const status = await window.backendAPI.checkHealth();
      const statusElement = document.getElementById("backendStatus");

      if (status.status === "OK") {
        statusElement.className = "status online";
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Conectado';
      } else {
        statusElement.className = "status offline";
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Desconectado';
      }
    } catch (error) {
      console.error("Error verificando backend:", error);
      const statusElement = document.getElementById("backendStatus");
      statusElement.className = "status offline";
      statusElement.innerHTML = '<i class="fas fa-circle"></i> Error';
    }
  }

  /**
   * Configura los event listeners
   */
  setupEventListeners() {
    // Botones de grabación
    document
      .getElementById("recordBtn")
      .addEventListener("click", () => this.startRecording());
    document
      .getElementById("stopBtn")
      .addEventListener("click", () => this.stopRecording());
    document
      .getElementById("playBtn")
      .addEventListener("click", () => this.playRecording());

    // Botones de procesamiento
    document
      .getElementById("transcribeBtn")
      .addEventListener("click", () => this.transcribeAudio());
    document
      .getElementById("processBtn")
      .addEventListener("click", () => this.processWithAI());

    // Botones de transcripción
    document
      .getElementById("editTranscription")
      .addEventListener("click", () => this.editTranscription());
    document
      .getElementById("saveTranscription")
      .addEventListener("click", () => this.saveTranscription());

    // Botones de historial
    document
      .getElementById("refreshHistory")
      .addEventListener("click", () => this.loadHistory());
    document
      .getElementById("exportData")
      .addEventListener("click", () => this.exportData());

    // Selector de idioma
    document
      .getElementById("languageSelect")
      .addEventListener("change", (e) => this.changeLanguage(e.target.value));

    // Botones del modo de texto manual
    document
      .getElementById("useTextBtn")
      .addEventListener("click", () => this.processManualText());

    // Radio buttons para cambiar modo de entrada
    document
      .getElementById("voiceMode")
      .addEventListener("change", () => this.switchInputMode("voice"));
    document
      .getElementById("textMode")
      .addEventListener("change", () => this.switchInputMode("text"));

    // Verificar backend cada 30 segundos
    setInterval(() => this.checkBackendStatus(), 30000);
  }

  /**
   * Configura las pestañas
   */
  setupTabs() {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    tabButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const tabName = button.getAttribute("data-tab");

        // Remover clase active de todos los botones y contenidos
        tabButtons.forEach((btn) => btn.classList.remove("active"));
        tabContents.forEach((content) => content.classList.remove("active"));

        // Agregar clase active al botón y contenido seleccionado
        button.classList.add("active");
        document.getElementById(tabName + "Tab").classList.add("active");
      });
    });
  }

  /**
   * Inicia la grabación de audio y reconocimiento de voz
   */
  async startRecording() {
    try {
      // Verificar conexión a internet
      if (!navigator.onLine) {
        this.showToast(
          "Sin conexión a internet. El reconocimiento de voz requiere conexión.",
          "error"
        );
        return;
      }

      // Verificar que el reconocimiento de voz esté disponible
      if (!this.recognition) {
        this.showToast("Reconocimiento de voz no disponible", "error");
        return;
      }

      // Reiniciar contadores de error
      this.hasRecognitionError = false;
      this.retryCount = 0;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Inicializar MediaRecorder para grabar audio (opcional)
      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.currentAudioBlob = new Blob(this.audioChunks, {
          type: "audio/wav",
        });
        this.updateAudioPreview();
        stream.getTracks().forEach((track) => track.stop());
      };

      // Configurar visualizador de audio
      this.setupAudioVisualizer(stream);

      // Iniciar grabación y reconocimiento
      this.mediaRecorder.start(100);
      this.recognition.start();

      // Limpiar transcripción anterior
      this.currentTranscription = "";
      document.getElementById("transcriptionText").value = "";

      this.isRecording = true;
      this.startRecordingTimer();
      this.updateRecordingUI();
    } catch (error) {
      console.error("Error iniciando grabación:", error);
      this.showToast("Error iniciando grabación: " + error.message, "error");
    }
  }

  /**
   * Detiene la grabación de audio y reconocimiento de voz
   */
  stopRecording() {
    // Detener reconocimiento de voz
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }

    // Detener grabación de audio
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      this.isRecording = false;
      this.stopRecordingTimer();
      this.updateRecordingUI();

      if (this.audioContext) {
        this.audioContext.close();
      }

      // Habilitar botón de procesamiento si hay transcripción
      if (this.currentTranscription.trim()) {
        document.getElementById("processBtn").disabled = false;
        this.showToast("Transcripción completada", "success");

        // Cambiar a la pestaña de transcripción
        this.switchToTab("transcription");
      }
    }

    // Resetear variables de error
    this.hasRecognitionError = false;
    this.retryCount = 0;
  }

  /**
   * Reinicia el reconocimiento de voz después de un error
   */
  restartSpeechRecognition() {
    if (!this.recognition || !this.isRecording) {
      return;
    }

    if (this.retryCount >= this.maxRetries) {
      this.showToast(
        "Demasiados errores de reconocimiento. Deteniendo grabación.",
        "error"
      );
      this.stopRecording();
      return;
    }

    this.retryCount++;
    console.log(
      `🔄 Intento de reconocimiento ${this.retryCount}/${this.maxRetries}`
    );

    try {
      if (this.isListening) {
        this.recognition.stop();
      }

      setTimeout(() => {
        if (this.isRecording && this.recognition) {
          this.recognition.start();
        }
      }, 1000);
    } catch (error) {
      console.error("Error reiniciando reconocimiento:", error);
      this.showToast("Error reiniciando reconocimiento", "error");
      this.stopRecording();
    }
  }

  /**
   * Reproduce la grabación actual
   */
  playRecording() {
    if (this.currentAudioBlob) {
      const audioUrl = URL.createObjectURL(this.currentAudioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  }

  /**
   * Configura el visualizador de audio
   */
  setupAudioVisualizer(stream) {
    const canvas = document.getElementById("audioCanvas");
    const canvasContext = canvas.getContext("2d");

    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(stream);

    source.connect(this.analyser);
    this.analyser.fftSize = 256;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isRecording) return;

      requestAnimationFrame(draw);

      this.analyser.getByteFrequencyData(dataArray);

      canvasContext.fillStyle = "#f7fafc";
      canvasContext.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = (dataArray[i] / 255) * canvas.height;

        const gradient = canvasContext.createLinearGradient(
          0,
          canvas.height - barHeight,
          0,
          canvas.height
        );
        gradient.addColorStop(0, "#667eea");
        gradient.addColorStop(1, "#764ba2");

        canvasContext.fillStyle = gradient;
        canvasContext.fillRect(
          x,
          canvas.height - barHeight,
          barWidth,
          barHeight
        );

        x += barWidth + 1;
      }
    };

    draw();
  }

  /**
   * Inicia el timer de grabación
   */
  startRecordingTimer() {
    this.recordingTime = 0;
    this.recordingInterval = setInterval(() => {
      this.recordingTime++;
      this.updateRecordingTimeDisplay();
    }, 1000);
  }

  /**
   * Detiene el timer de grabación
   */
  stopRecordingTimer() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
  }

  /**
   * Actualiza la visualización del tiempo de grabación
   */
  updateRecordingTimeDisplay() {
    const minutes = Math.floor(this.recordingTime / 60);
    const seconds = this.recordingTime % 60;
    const timeString = `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
    document.getElementById("recordingTime").textContent = timeString;
  }

  /**
   * Actualiza la UI durante la grabación
   */
  updateRecordingUI() {
    const recordBtn = document.getElementById("recordBtn");
    const stopBtn = document.getElementById("stopBtn");
    const playBtn = document.getElementById("playBtn");
    const transcribeBtn = document.getElementById("transcribeBtn");
    const statusElement = document.getElementById("recordingStatus");

    if (this.isRecording) {
      recordBtn.disabled = true;
      recordBtn.classList.add("recording");
      recordBtn.innerHTML =
        '<i class="fas fa-microphone"></i><span>Grabando y escuchando...</span>';

      stopBtn.disabled = false;
      playBtn.disabled = true;
      transcribeBtn.disabled = true;

      statusElement.textContent = "Grabando y transcribiendo en tiempo real...";
    } else {
      recordBtn.disabled = false;
      recordBtn.classList.remove("recording");
      recordBtn.innerHTML =
        '<i class="fas fa-microphone"></i><span>Iniciar Grabación</span>';

      stopBtn.disabled = true;

      if (this.currentAudioBlob || this.currentTranscription.trim()) {
        playBtn.disabled = false;
        transcribeBtn.disabled = false;
        statusElement.textContent = "Grabación y transcripción completadas";
      } else {
        playBtn.disabled = true;
        transcribeBtn.disabled = true;
        statusElement.textContent = "Listo para grabar";
      }
    }
  }

  /**
   * Actualiza la previsualización del audio
   */
  updateAudioPreview() {
    if (this.currentAudioBlob) {
      const audioPreview = document.getElementById("audioPreview");
      const audioUrl = URL.createObjectURL(this.currentAudioBlob);
      audioPreview.src = audioUrl;
      audioPreview.style.display = "block";
    }
  }

  /**
   * Procesa la transcripción actual (sin necesidad de transcribir)
   */
  async transcribeAudio() {
    const text = this.currentTranscription.trim();

    if (!text) {
      this.showToast(
        "No hay transcripción disponible. Inicia una grabación primero.",
        "warning"
      );
      return;
    }

    this.showProcessingStatus("Enviando transcripción...");

    try {
      const result = await window.backendAPI.sendTranscription(text);

      if (result.success) {
        document.getElementById("transcriptionText").value =
          result.transcription;
        document.getElementById("processBtn").disabled = false;

        this.showToast("Transcripción procesada correctamente", "success");
      } else {
        throw new Error(result.error || "Error enviando transcripción");
      }
    } catch (error) {
      console.error("Error enviando transcripción:", error);
      this.showToast("Error enviando transcripción: " + error.message, "error");
    } finally {
      this.hideProcessingStatus();
    }
  }

  /**
   * Procesa el texto con IA (Gemini)
   */
  async processWithAI() {
    const text = document.getElementById("transcriptionText").value.trim();

    if (!text) {
      this.showToast("No hay texto para procesar", "warning");
      return;
    }

    this.showProcessingStatus("Procesando con IA...");

    try {
      const result = await window.backendAPI.processText(text);

      if (result.success) {
        this.currentProcessedData = result.data;
        this.displayNutritionData(result.data.foods);
        this.displayExerciseData(result.data.exercises);

        this.showToast("Datos procesados correctamente", "success");
        await this.loadHistory(); // Recargar historial
      } else {
        throw new Error(result.error || "Error procesando con IA");
      }
    } catch (error) {
      console.error("Error procesando con IA:", error);
      this.showToast("Error procesando texto: " + error.message, "error");
    } finally {
      this.hideProcessingStatus();
    }
  }

  /**
   * Cambia el modo de entrada entre voz y texto
   */
  switchInputMode(mode) {
    const voiceControls = document.getElementById("voiceControls");
    const textControls = document.getElementById("textControls");

    if (mode === "text") {
      voiceControls.style.display = "none";
      textControls.style.display = "block";
      this.showToast(
        "Modo texto activado. Usa entrada manual como alternativa a la voz.",
        "info"
      );
    } else {
      voiceControls.style.display = "block";
      textControls.style.display = "none";
      this.showToast(
        "Modo voz activado. Nota: puede requerir conexión a internet.",
        "info"
      );
    }
  }

  /**
   * Inicializa el modo de entrada por defecto
   */
  initializeDefaultInputMode() {
    // Seleccionar modo texto por defecto (mejor para aplicaciones Electron)
    const textModeRadio = document.getElementById("textMode");
    if (textModeRadio) {
      textModeRadio.checked = true;
      this.switchInputMode("text");
    }
  }

  /**
   * Procesa el texto ingresado manualmente
   */
  async processManualText() {
    const manualText = document.getElementById("manualTextInput").value.trim();

    if (!manualText) {
      this.showToast("Por favor, escribe algo en el campo de texto", "warning");
      return;
    }

    try {
      // Copiar el texto al área de transcripción
      document.getElementById("transcriptionText").value = manualText;
      this.currentTranscription = manualText;

      // Mostrar el texto en la interfaz
      this.showToast("Texto capturado correctamente", "success");

      // Procesar automáticamente con IA
      await this.processWithAI();
    } catch (error) {
      console.error("Error procesando texto manual:", error);
      this.showToast("Error procesando el texto: " + error.message, "error");
    }
  }

  /**
   * Muestra los datos nutricionales
   */
  displayNutritionData(foods) {
    const foodsList = document.getElementById("foodsList");
    const totalCaloriesElement = document.getElementById("totalCalories");

    if (!foods || foods.length === 0) {
      foodsList.innerHTML =
        '<p class="empty-state">No se encontraron alimentos en el texto</p>';
      totalCaloriesElement.textContent = "0";
      return;
    }

    let totalCalories = 0;
    let html = "";

    foods.forEach((food) => {
      totalCalories += food.calories || 0;

      html += `
                <div class="food-item">
                    <h4>${food.name}</h4>
                    <div class="food-details">
                        <span><strong>Cantidad:</strong> ${
                          food.quantity || "N/A"
                        }</span>
                        <span><strong>Calorías:</strong> ${
                          food.calories || "N/A"
                        }</span>
                    </div>
                    <div class="nutrition-info">
                        <span>Proteína: ${
                          food.nutrition?.protein || "N/A"
                        }</span>
                        <span>Carbohidratos: ${
                          food.nutrition?.carbs || "N/A"
                        }</span>
                        <span>Grasas: ${food.nutrition?.fat || "N/A"}</span>
                        <span>Fibra: ${food.nutrition?.fiber || "N/A"}</span>
                    </div>
                </div>
            `;
    });

    foodsList.innerHTML = html;
    totalCaloriesElement.textContent = totalCalories.toString();

    // Cambiar a la pestaña de nutrición
    this.switchToTab("nutrition");
  }

  /**
   * Muestra los datos de ejercicios
   */
  displayExerciseData(exercises) {
    const exercisesList = document.getElementById("exercisesList");
    const burnedCaloriesElement = document.getElementById("burnedCalories");

    if (!exercises || exercises.length === 0) {
      exercisesList.innerHTML =
        '<p class="empty-state">No se encontraron ejercicios en el texto</p>';
      burnedCaloriesElement.textContent = "0";
      return;
    }

    let totalBurnedCalories = 0;
    let html = "";

    exercises.forEach((exercise) => {
      totalBurnedCalories += exercise.calories_burned || 0;

      html += `
                <div class="exercise-item">
                    <h4>${exercise.type}</h4>
                    <div class="exercise-details">
                        <span><strong>Duración:</strong> ${
                          exercise.duration || "N/A"
                        }</span>
                        <span><strong>Intensidad:</strong> ${
                          exercise.intensity || "N/A"
                        }</span>
                        <span><strong>Calorías quemadas:</strong> ${
                          exercise.calories_burned || "N/A"
                        }</span>
                    </div>
                </div>
            `;
    });

    exercisesList.innerHTML = html;
    burnedCaloriesElement.textContent = totalBurnedCalories.toString();
  }

  /**
   * Carga el historial de entradas
   */
  async loadHistory() {
    try {
      // Mostrar indicador de carga
      const historyList = document.getElementById("historyList");
      historyList.innerHTML =
        '<p class="loading-state">🔄 Cargando historial...</p>';

      const result = await window.backendAPI.getEntries();

      if (result.success) {
        this.displayHistory(result.entries);
        console.log(`📊 Historial cargado: ${result.entries.length} entradas`);
      } else {
        throw new Error(result.error || "Error cargando historial");
      }
    } catch (error) {
      console.error("Error cargando historial:", error);
      this.showToast("Error cargando historial", "error");

      // Mostrar estado de error
      const historyList = document.getElementById("historyList");
      historyList.innerHTML =
        '<p class="empty-state">❌ Error cargando historial. Intenta de nuevo.</p>';
    }
  }

  /**
   * Muestra el historial
   */
  displayHistory(entries) {
    const historyList = document.getElementById("historyList");

    if (!entries || entries.length === 0) {
      historyList.innerHTML =
        '<p class="empty-state">No hay registros en el historial</p>';
      return;
    }

    let html = "";
    entries.forEach((entry) => {
      const date = new Date(entry.created_at).toLocaleString("es-ES");
      const foodsCount = entry.foods ? entry.foods.length : 0;
      const exercisesCount = entry.exercises ? entry.exercises.length : 0;

      // Calcular calorías totales de alimentos
      const totalCalories = entry.foods
        ? entry.foods.reduce((sum, food) => sum + (food.calories || 0), 0)
        : 0;

      // Calcular calorías quemadas en ejercicios
      const burnedCalories = entry.exercises
        ? entry.exercises.reduce(
            (sum, exercise) => sum + (exercise.calories_burned || 0),
            0
          )
        : 0;

      // Generar preview de alimentos
      const foodsPreview =
        entry.foods && entry.foods.length > 0
          ? entry.foods
              .slice(0, 2)
              .map((food) => food.name)
              .join(", ") + (entry.foods.length > 2 ? "..." : "")
          : "Sin alimentos";

      // Generar preview de ejercicios
      const exercisesPreview =
        entry.exercises && entry.exercises.length > 0
          ? entry.exercises
              .slice(0, 2)
              .map((exercise) => exercise.type)
              .join(", ") + (entry.exercises.length > 2 ? "..." : "")
          : "Sin ejercicios";

      html += `
        <div class="history-item" onclick="app.viewHistoryItem(${entry.id})">
          <div class="history-item-header">
            <span class="history-item-date">${date}</span>
            <div class="history-item-stats">
              <span class="calories-consumed">📍 ${totalCalories} kcal</span>
              <span class="calories-burned">🔥 ${burnedCalories} kcal</span>
            </div>
          </div>
          <div class="history-item-content">
            <div class="history-item-summary">
              <div class="foods-summary">
                <strong>🍽️ Alimentos (${foodsCount}):</strong> ${foodsPreview}
              </div>
              <div class="exercises-summary">
                <strong>🏃‍♂️ Ejercicios (${exercisesCount}):</strong> ${exercisesPreview}
              </div>
            </div>
            ${
              entry.raw_text
                ? `<div class="raw-text-preview">"${entry.raw_text.substring(
                    0,
                    100
                  )}${entry.raw_text.length > 100 ? "..." : ""}"</div>`
                : ""
            }
          </div>
          <div class="history-item-footer">
            <small>Click para ver detalles completos</small>
          </div>
        </div>
      `;
    });

    historyList.innerHTML = html;
  }

  /**
   * Ve un elemento del historial
   */
  async viewHistoryItem(entryId) {
    try {
      const result = await window.backendAPI.getEntry(entryId);

      if (result.success) {
        const entry = result.entry;
        const date = new Date(entry.created_at).toLocaleString("es-ES");

        // Mostrar los datos en las pestañas correspondientes
        if (entry.raw_text) {
          document.getElementById("transcriptionText").value = entry.raw_text;
          this.currentTranscription = entry.raw_text;
        }

        // Mostrar datos procesados
        this.displayNutritionData(entry.foods);
        this.displayExerciseData(entry.exercises);

        // Cambiar a la pestaña de resultados para mostrar los datos
        const resultsTab = document.querySelector('[data-tab="results"]');
        const historyTab = document.querySelector('[data-tab="history"]');

        if (resultsTab && historyTab) {
          // Activar pestaña de resultados
          document
            .querySelectorAll(".tab-btn")
            .forEach((btn) => btn.classList.remove("active"));
          document
            .querySelectorAll(".tab-content")
            .forEach((content) => content.classList.remove("active"));

          resultsTab.classList.add("active");
          document.getElementById("resultsTab").classList.add("active");
        }

        this.showToast(`Registro del ${date} cargado correctamente`, "success");
      } else {
        throw new Error(result.error || "Error cargando registro");
      }
    } catch (error) {
      console.error("Error cargando registro:", error);
      this.showToast("Error cargando registro", "error");
    }
  }

  /**
   * Edita la transcripción
   */
  editTranscription() {
    const textarea = document.getElementById("transcriptionText");
    const editBtn = document.getElementById("editTranscription");
    const saveBtn = document.getElementById("saveTranscription");

    textarea.readOnly = false;
    textarea.focus();
    editBtn.style.display = "none";
    saveBtn.style.display = "inline-flex";
  }

  /**
   * Guarda la transcripción editada
   */
  saveTranscription() {
    const textarea = document.getElementById("transcriptionText");
    const editBtn = document.getElementById("editTranscription");
    const saveBtn = document.getElementById("saveTranscription");

    this.currentTranscription = textarea.value;
    textarea.readOnly = true;
    editBtn.style.display = "inline-flex";
    saveBtn.style.display = "none";

    this.showToast("Transcripción guardada", "success");
  }

  /**
   * Exporta los datos
   */
  async exportData() {
    try {
      const result = await window.backendAPI.getEntries();

      if (result.success) {
        const dataStr = JSON.stringify(result.entries, null, 2);
        const dataBlob = new Blob([dataStr], { type: "application/json" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(dataBlob);
        link.download = `nutrition_data_${
          new Date().toISOString().split("T")[0]
        }.json`;
        link.click();

        this.showToast("Datos exportados correctamente", "success");
      } else {
        throw new Error(result.error || "Error exportando datos");
      }
    } catch (error) {
      console.error("Error exportando datos:", error);
      this.showToast("Error exportando datos", "error");
    }
  }

  /**
   * Cambia a una pestaña específica
   */
  switchToTab(tabName) {
    const tabButton = document.querySelector(`[data-tab="${tabName}"]`);
    if (tabButton) {
      tabButton.click();
    }
  }

  /**
   * Muestra el estado de procesamiento
   */
  showProcessingStatus(message) {
    const spinner = document.getElementById("processingSpinner");
    const text = document.getElementById("processingText");

    text.textContent = message;
    spinner.style.display = "flex";
  }

  /**
   * Oculta el estado de procesamiento
   */
  hideProcessingStatus() {
    const spinner = document.getElementById("processingSpinner");
    spinner.style.display = "none";
  }

  /**
   * Cambia el idioma del reconocimiento de voz
   */
  changeLanguage(language) {
    if (this.recognition) {
      this.recognition.lang = language;
      console.log(`🌐 Idioma cambiado a: ${language}`);
      this.showToast(`Idioma cambiado a: ${language}`, "info");

      // Si está grabando, reiniciar con el nuevo idioma
      if (this.isRecording) {
        this.stopRecording();
        setTimeout(() => {
          this.startRecording();
        }, 1000);
      }
    }
  }

  /**
   * Muestra una notificación toast
   */
  showToast(message, type = "info") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Remover el toast después de 5 segundos
    setTimeout(() => {
      toast.remove();
    }, 5000);
  }
}

// Inicializar la aplicación cuando el DOM esté listo
document.addEventListener("DOMContentLoaded", () => {
  window.app = new NutritionTracker();
});

// Manejar errores globales
window.addEventListener("error", (event) => {
  console.error("Error global:", event.error);
  if (window.app) {
    window.app.showToast("Error inesperado en la aplicación", "error");
  }
});

// Manejar errores de promesas no capturadas
window.addEventListener("unhandledrejection", (event) => {
  console.error("Promise rechazada:", event.reason);
  if (window.app) {
    window.app.showToast("Error de conexión", "error");
  }
});

// Manejar cambios de conectividad
window.addEventListener("online", () => {
  console.log("🌐 Conexión a internet restaurada");
  if (window.app) {
    window.app.showToast("Conexión a internet restaurada", "success");
  }
});

window.addEventListener("offline", () => {
  console.log("🚫 Sin conexión a internet");
  if (window.app) {
    window.app.showToast(
      "Sin conexión a internet. Algunas funciones pueden no funcionar.",
      "warning"
    );
    // Detener grabación si está activa
    if (window.app.isRecording) {
      window.app.stopRecording();
    }
  }
});
