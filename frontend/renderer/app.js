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
    this.selectedAudioDeviceId = null; // ID del dispositivo de audio seleccionado

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

      // Verificar soporte de grabación de audio
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.showToast("Tu navegador no soporta grabación de audio", "error");
        return;
      }

      // Solicitar permisos de micrófono
      await this.requestMicrophonePermissions();

      // Cargar dispositivos de audio disponibles
      await this.loadAudioDevices();

      // Inicializar modo de texto por defecto
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
      console.log("🎤 Solicitando permisos de micrófono...");

      // Verificar que navigator.mediaDevices está disponible
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("navigator.mediaDevices no está disponible");
      }

      // Listar dispositivos de entrada de audio disponibles
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(
          (device) => device.kind === "audioinput"
        );
        console.log(
          "🎧 Dispositivos de audio encontrados:",
          audioInputs.length
        );
        audioInputs.forEach((device, index) => {
          console.log(
            `  ${index + 1}. ${device.label || "Dispositivo sin nombre"} (${
              device.deviceId
            })`
          );
        });

        if (audioInputs.length === 0) {
          throw new Error("No se encontraron dispositivos de entrada de audio");
        }
      } catch (deviceError) {
        console.warn("⚠️ No se pudieron enumerar dispositivos:", deviceError);
      }

      // Intentar obtener acceso al micrófono
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("✅ Permisos de micrófono concedidos");
      console.log("🔊 Stream obtenido:", {
        active: stream.active,
        tracks: stream.getTracks().length,
      });

      // Verificar tracks de audio
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log("🎵 Track de audio:", {
          label: audioTracks[0].label,
          enabled: audioTracks[0].enabled,
          muted: audioTracks[0].muted,
          readyState: audioTracks[0].readyState,
        });
      }

      stream.getTracks().forEach((track) => track.stop()); // Detener inmediatamente

      // Habilitar botón de grabación
      document.getElementById("recordBtn").disabled = false;

      this.showToast("Permisos de micrófono concedidos", "success");
    } catch (error) {
      console.error("❌ Error obteniendo permisos:", error);
      console.error("Error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });

      let errorMessage =
        "Se requieren permisos de micrófono para usar la aplicación";

      if (error.name === "NotAllowedError") {
        errorMessage =
          "Permisos de micrófono denegados. Permite el acceso al micrófono en la configuración del navegador.";
      } else if (error.name === "NotFoundError") {
        errorMessage =
          "No se encontró micrófono. Verifica que tienes un micrófono conectado.";
      } else if (error.name === "NotSupportedError") {
        errorMessage = "Tu navegador no soporta grabación de audio.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage = "Las restricciones de audio no se pueden satisfacer.";
      }

      this.showToast(errorMessage, "error");
    }
  }

  /**
   * Carga la lista de dispositivos de audio disponibles
   */
  async loadAudioDevices() {
    try {
      console.log("🎧 Cargando dispositivos de audio...");

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput"
      );

      const selector = document.getElementById("audioDeviceSelect");
      selector.innerHTML = ""; // Limpiar opciones existentes

      if (audioInputs.length === 0) {
        selector.innerHTML =
          '<option value="">No se encontraron micrófonos</option>';
        this.showToast("No se encontraron dispositivos de audio", "warning");
        return;
      }

      // Agregar opción para dispositivo por defecto
      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.textContent = "Usar dispositivo por defecto";
      selector.appendChild(defaultOption);

      // Agregar cada dispositivo
      audioInputs.forEach((device, index) => {
        const option = document.createElement("option");
        option.value = device.deviceId;

        let label = device.label || `Micrófono ${index + 1}`;

        // Marcar dispositivos específicos
        if (label.includes("Realtek")) {
          label += " ⭐ (Recomendado)";
        } else if (label.includes("DroidCam")) {
          label += " (Cámara virtual)";
        } else if (label.includes("Default")) {
          label += " (Sistema)";
        }

        option.textContent = label;
        selector.appendChild(option);
      });

      // Auto-seleccionar Realtek si está disponible
      const realtekDevice = audioInputs.find(
        (device) =>
          device.label &&
          device.label.includes("Realtek") &&
          !device.label.includes("Communications")
      );

      if (realtekDevice) {
        selector.value = realtekDevice.deviceId;
        this.selectedAudioDeviceId = realtekDevice.deviceId;
        console.log(
          "✅ Auto-seleccionado micrófono Realtek:",
          realtekDevice.label
        );
        this.showToast(
          `Micrófono seleccionado: ${realtekDevice.label}`,
          "success"
        );
      } else {
        // Si no hay Realtek, usar el primer dispositivo que no sea DroidCam
        const preferredDevice = audioInputs.find(
          (device) => device.label && !device.label.includes("DroidCam")
        );

        if (preferredDevice) {
          selector.value = preferredDevice.deviceId;
          this.selectedAudioDeviceId = preferredDevice.deviceId;
          console.log(
            "✅ Auto-seleccionado micrófono preferido:",
            preferredDevice.label
          );
        }
      }

      console.log(`🎧 ${audioInputs.length} dispositivos de audio cargados`);
    } catch (error) {
      console.error("❌ Error cargando dispositivos de audio:", error);
      this.showToast("Error cargando dispositivos de audio", "error");
    }
  }

  /**
   * Selecciona un dispositivo de audio específico
   */
  selectAudioDevice(deviceId) {
    this.selectedAudioDeviceId = deviceId;

    if (deviceId) {
      // Buscar el nombre del dispositivo
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        const selectedDevice = devices.find(
          (device) => device.deviceId === deviceId
        );
        if (selectedDevice) {
          console.log(
            "🎯 Dispositivo de audio seleccionado:",
            selectedDevice.label
          );
          this.showToast(
            `Micrófono cambiado a: ${selectedDevice.label}`,
            "info"
          );
        }
      });
    } else {
      console.log("🎯 Usando dispositivo de audio por defecto");
      this.showToast("Usando micrófono por defecto del sistema", "info");
    }

    // Si está grabando, mostrar advertencia
    if (this.isRecording) {
      this.showToast(
        "⚠️ Detén la grabación actual para cambiar de micrófono",
        "warning"
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

    // Selectores de dispositivos de audio
    document
      .getElementById("audioDeviceSelect")
      .addEventListener("change", (e) =>
        this.selectAudioDevice(e.target.value)
      );
    document
      .getElementById("refreshDevicesBtn")
      .addEventListener("click", () => this.loadAudioDevices());

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
   * Cambia a una pestaña específica programáticamente
   */
  switchTab(tabName) {
    const tabButtons = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    // Remover clase active de todos los botones y contenidos
    tabButtons.forEach((btn) => btn.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Activar la pestaña específica
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    const targetContent = document.getElementById(tabName + "Tab");

    if (targetButton && targetContent) {
      targetButton.classList.add("active");
      targetContent.classList.add("active");
    }
  }

  /**
   * Inicia la grabación de audio con MediaRecorder
   */
  async startRecording() {
    try {
      console.log("🎤 Iniciando grabación de audio...");

      // Verificar que no esté ya grabando
      if (this.isRecording) {
        this.showToast("Ya se está grabando", "warning");
        return;
      }

      // Limpiar datos anteriores
      this.audioChunks = [];
      this.currentAudioBlob = null;
      this.currentTranscription = "";
      document.getElementById("transcriptionText").value = "";

      // Configurar constraints de audio optimizadas para transcripción
      const constraints = {
        audio: {
          sampleRate: 44100, // Buena calidad para transcripción
          channelCount: 1, // Mono suficiente para voz
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Usar dispositivo específico si está seleccionado
          ...(this.selectedAudioDeviceId && {
            deviceId: { exact: this.selectedAudioDeviceId },
          }),
        },
      };

      console.log("🎯 Solicitando acceso al micrófono...");
      console.log(
        "🎧 Dispositivo seleccionado:",
        this.selectedAudioDeviceId || "Por defecto"
      );
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log("✅ Stream de micrófono obtenido:", {
        active: stream.active,
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      // Verificar tracks de audio
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No se obtuvieron tracks de audio del stream");
      }

      console.log("🎵 Audio track activo:", {
        label: audioTracks[0].label,
        enabled: audioTracks[0].enabled,
        muted: audioTracks[0].muted,
        readyState: audioTracks[0].readyState,
      });

      // Verificar soporte de MediaRecorder
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        console.warn("⚠️ audio/webm no soportado, usando tipo por defecto");
      }

      // Configurar MediaRecorder con mejor configuración
      const options = {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
        audioBitsPerSecond: 128000, // 128 kbps para buena calidad
      };

      this.mediaRecorder = new MediaRecorder(stream, options);

      console.log("📊 MediaRecorder creado:", {
        mimeType: this.mediaRecorder.mimeType,
        state: this.mediaRecorder.state,
        audioBitsPerSecond: this.mediaRecorder.audioBitsPerSecond,
      });

      // Configurar eventos de MediaRecorder
      this.mediaRecorder.ondataavailable = (event) => {
        console.log("📊 Datos de audio disponibles:", event.data.size, "bytes");
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
          console.log(`📈 Total chunks: ${this.audioChunks.length}`);
        } else {
          console.warn("⚠️ Chunk de audio vacío recibido");
        }
      };

      this.mediaRecorder.onstop = () => {
        console.log("🛑 Grabación finalizada, procesando audio...");
        console.log(`📦 Chunks recolectados: ${this.audioChunks.length}`);

        if (this.audioChunks.length === 0) {
          console.error("❌ No se recolectaron chunks de audio");
          this.showToast("Error: No se grabó audio", "error");
          return;
        }

        // Crear blob del audio grabado
        this.currentAudioBlob = new Blob(this.audioChunks, {
          type: this.mediaRecorder.mimeType,
        });

        console.log(
          `✅ Audio procesado: ${this.currentAudioBlob.size} bytes, tipo: ${this.currentAudioBlob.type}`
        );

        if (this.currentAudioBlob.size === 0) {
          console.error("❌ El blob de audio está vacío");
          this.showToast("Error: El archivo de audio está vacío", "error");
          return;
        }

        // Actualizar UI y detener stream
        this.updateAudioPreview();
        stream.getTracks().forEach((track) => {
          track.stop();
          console.log("🔇 Track de audio detenido");
        });

        // Habilitar botón de transcripción
        this.enableTranscriptionButton();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error("❌ Error en MediaRecorder:", event.error);
        this.showToast("Error en grabación: " + event.error, "error");
        this.stopRecording();
      };

      this.mediaRecorder.onstart = () => {
        console.log("🎬 MediaRecorder iniciado correctamente");
      };

      // Configurar visualizador de audio
      this.setupAudioVisualizer(stream);

      // Iniciar grabación con intervalo de chunks
      this.mediaRecorder.start(1000); // Guardar chunks cada segundo

      this.isRecording = true;
      this.startRecordingTimer();
      this.updateRecordingUI();

      console.log("🎙️ Grabación iniciada correctamente");
      this.showToast("Grabación iniciada", "success");
    } catch (error) {
      console.error("❌ Error iniciando grabación:", error);
      this.isRecording = false;
      this.updateRecordingUI();

      if (error.name === "NotAllowedError") {
        this.showToast(
          "Permiso de micrófono denegado. Permite el acceso al micrófono.",
          "error"
        );
      } else if (error.name === "NotFoundError") {
        this.showToast(
          "No se encontró micrófono. Conecta un micrófono.",
          "error"
        );
      } else {
        this.showToast("Error iniciando grabación: " + error.message, "error");
      }
    }
  }

  /**
   * Detiene la grabación de audio
   */
  stopRecording() {
    try {
      console.log("🛑 Deteniendo grabación...");

      if (!this.isRecording) {
        this.showToast("No hay grabación en curso", "warning");
        return;
      }

      // Detener MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.mediaRecorder.stop();
        console.log("📱 MediaRecorder detenido");
      }

      // Actualizar estado
      this.isRecording = false;
      this.stopRecordingTimer();
      this.updateRecordingUI();

      // Ocultar visualizador de audio
      this.hideAudioVisualizer();

      console.log("✅ Grabación detenida correctamente");
      this.showToast("Grabación finalizada", "success");
    } catch (error) {
      console.error("❌ Error deteniendo grabación:", error);
      this.showToast("Error deteniendo grabación: " + error.message, "error");

      // Forzar reset del estado
      this.isRecording = false;
      this.updateRecordingUI();
    }
  }

  /**
   * Habilita el botón de transcripción después de grabar
   */
  enableTranscriptionButton() {
    const transcribeBtn = document.getElementById("transcribeBtn");
    if (transcribeBtn) {
      transcribeBtn.disabled = false;
      this.showToast("Audio listo para transcribir", "info");
    }
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
   * Configura el visualizador de audio y feedback en tiempo real
   */
  setupAudioVisualizer(stream) {
    const canvas = document.getElementById("audioCanvas");
    if (!canvas) {
      console.log(
        "🎨 Canvas audioCanvas no encontrado, saltando visualización"
      );
      return;
    }
    const canvasContext = canvas.getContext("2d");

    // Mostrar el visualizador
    const visualizerContainer = canvas.parentElement;
    if (visualizerContainer) {
      visualizerContainer.style.display = "block";
    }

    this.audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    const source = this.audioContext.createMediaStreamSource(stream);

    // Crear un GainNode para controlar el volumen del feedback
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0.1; // Volumen bajo para evitar feedback

    // Conectar el audio para feedback en tiempo real (opcional)
    // Nota: Comentado por defecto para evitar eco/feedback molesto
    // source.connect(gainNode);
    // gainNode.connect(this.audioContext.destination);

    source.connect(this.analyser);
    this.analyser.fftSize = 256;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!this.isRecording) return;

      requestAnimationFrame(draw);

      this.analyser.getByteFrequencyData(dataArray);

      // Calcular el nivel promedio de audio para mostrar un indicador
      let total = 0;
      for (let i = 0; i < bufferLength; i++) {
        total += dataArray[i];
      }
      const averageLevel = total / bufferLength;

      // Actualizar indicador de nivel de voz
      this.updateVoiceLevelIndicator(averageLevel);

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
   * Oculta el visualizador de audio
   */
  hideAudioVisualizer() {
    const canvas = document.getElementById("audioCanvas");
    if (canvas) {
      const visualizerContainer = canvas.parentElement;
      if (visualizerContainer) {
        visualizerContainer.style.display = "none";
      }
    }

    // Cerrar contexto de audio si existe
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
      this.analyser = null;
    }
  }

  /**
   * Actualiza el indicador visual del nivel de voz
   */
  updateVoiceLevelIndicator(level) {
    const indicator = document.getElementById("voiceLevelIndicator");
    if (!indicator) return;

    // Normalizar el nivel (0-100)
    const normalizedLevel = Math.min(100, (level / 128) * 100);

    // Actualizar la barra de progreso
    indicator.style.width = normalizedLevel + "%";

    // Cambiar color según el nivel
    if (normalizedLevel < 20) {
      indicator.style.backgroundColor = "#e53e3e"; // Rojo - muy bajo
    } else if (normalizedLevel < 40) {
      indicator.style.backgroundColor = "#dd6b20"; // Naranja - bajo
    } else if (normalizedLevel < 80) {
      indicator.style.backgroundColor = "#38a169"; // Verde - bueno
    } else {
      indicator.style.backgroundColor = "#3182ce"; // Azul - alto
    }

    // Mostrar nivel numérico
    const levelText = document.getElementById("voiceLevelText");
    if (levelText) {
      levelText.textContent = Math.round(normalizedLevel) + "%";
    }
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
    const voiceLevelContainer = document.getElementById("voiceLevelContainer");

    if (this.isRecording) {
      recordBtn.disabled = true;
      recordBtn.classList.add("recording");
      recordBtn.innerHTML =
        '<i class="fas fa-microphone"></i><span>Grabando y escuchando...</span>';

      stopBtn.disabled = false;
      playBtn.disabled = true;
      transcribeBtn.disabled = true;

      // Mostrar indicador de nivel de voz
      if (voiceLevelContainer) {
        voiceLevelContainer.style.display = "flex";
      }

      statusElement.textContent = "Grabando - habla claramente al micrófono...";
    } else {
      recordBtn.disabled = false;
      recordBtn.classList.remove("recording");
      recordBtn.innerHTML =
        '<i class="fas fa-microphone"></i><span>Iniciar Grabación</span>';

      stopBtn.disabled = true;

      // Ocultar indicador de nivel de voz
      if (voiceLevelContainer) {
        voiceLevelContainer.style.display = "none";
      }

      if (this.currentAudioBlob || this.currentTranscription.trim()) {
        playBtn.disabled = false;
        transcribeBtn.disabled = false;
        statusElement.textContent =
          "Grabación completada - ¡puedes reproducir o enviar!";
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
  /**
   * Envía el audio grabado al backend para transcripción con AssemblyAI
   */
  async transcribeAudio() {
    if (!this.currentAudioBlob) {
      this.showToast(
        "No hay audio disponible. Graba audio primero.",
        "warning"
      );
      return;
    }

    this.showProcessingStatus(
      "Subiendo audio y transcribiendo con AssemblyAI..."
    );

    try {
      console.log("📤 Enviando audio al backend para transcripción...");
      console.log(
        `📊 Tamaño: ${this.currentAudioBlob.size} bytes, Tipo: ${this.currentAudioBlob.type}`
      );

      // Enviar el blob directamente (el preload.js manejará la conversión a FormData)
      const result = await window.backendAPI.uploadAudio(this.currentAudioBlob);

      if (result.success) {
        console.log("✅ Audio procesado correctamente:", result);

        // Mostrar información del archivo procesado
        this.showToast(
          `Audio procesado: ${result.data.filename} (${Math.round(
            result.data.size / 1024
          )} KB)`,
          "success"
        );

        // MANEJAR LA TRANSCRIPCIÓN
        if (result.transcription && result.transcription.length > 0) {
          console.log("✅ Transcripción recibida:", result.transcription);

          // Mostrar la transcripción en el textarea
          const transcriptionTextArea =
            document.getElementById("transcriptionText");
          transcriptionTextArea.value = result.transcription;
          this.currentTranscription = result.transcription;

          // Cambiar a la pestaña de transcripción para mostrar el resultado
          this.switchTab("transcription");

          // Habilitar botón de procesamiento con IA
          document.getElementById("processBtn").disabled = false;

          this.showToast(
            "¡Transcripción completada! Revisa el texto y procesa con IA.",
            "success"
          );
        } else {
          // No hay transcripción o está vacía
          if (result.transcriptionError) {
            console.error(
              "❌ Error en transcripción:",
              result.transcriptionError
            );
            this.showToast(
              `Error en transcripción: ${result.transcriptionError}`,
              "error"
            );
          } else {
            this.showToast(
              "No se pudo transcribir el audio. Escribe manualmente el texto.",
              "warning"
            );
          }

          // Permitir entrada manual
          document.getElementById("transcriptionText").placeholder =
            "La transcripción automática falló. Escribe manualmente lo que dijiste para continuar con el procesamiento de IA.";
          document.getElementById("processBtn").disabled = false;
        }
      } else {
        throw new Error(result.error || "Error enviando audio");
      }
    } catch (error) {
      console.error("❌ Error enviando audio:", error);
      this.showToast("Error enviando audio: " + error.message, "error");
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
