const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let backendProcess = null;

// Configurar banderas de Electron para evitar errores de GPU en Windows
app.commandLine.appendSwitch("--disable-gpu");
app.commandLine.appendSwitch("--disable-gpu-sandbox");
app.commandLine.appendSwitch("--disable-software-rasterizer");
app.commandLine.appendSwitch("--disable-gpu-compositing");
app.commandLine.appendSwitch("--disable-gpu-rasterization");
app.commandLine.appendSwitch("--disable-background-timer-throttling");
app.commandLine.appendSwitch("--disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("--disable-renderer-backgrounding");
app.commandLine.appendSwitch("--disable-features", "VizDisplayCompositor");
app.commandLine.appendSwitch("--no-sandbox");
app.commandLine.appendSwitch("--ignore-gpu-blacklist");
app.commandLine.appendSwitch("--disable-web-security");
app.commandLine.appendSwitch("--disable-accelerated-2d-canvas");
app.commandLine.appendSwitch("--disable-accelerated-jpeg-decoding");
app.commandLine.appendSwitch("--disable-accelerated-mjpeg-decode");
app.commandLine.appendSwitch("--disable-accelerated-video-decode");
app.commandLine.appendSwitch("--disable-accelerated-video-encode");
app.commandLine.appendSwitch(
  "--disable-gpu-memory-buffer-compositor-resources"
);
app.commandLine.appendSwitch("--disable-gpu-memory-buffer-video-frames");
app.commandLine.appendSwitch("--disable-background-media-suspend");

// Habilitar acceso a media devices (micrófono/cámara)
app.commandLine.appendSwitch("--enable-media-stream");
app.commandLine.appendSwitch("--allow-file-access-from-files");
app.commandLine.appendSwitch("--use-fake-ui-for-media-stream");
app.commandLine.appendSwitch(
  "--disable-features",
  "MediaDevicesDispatcherHost"
);

// Suprimir mensajes específicos de error de GPU
process.on("uncaughtException", (error) => {
  if (error.message && error.message.includes("gpu")) {
    // Ignorar errores de GPU
    return;
  }
  console.error("Uncaught Exception:", error);
});

console.log(
  "🖥️ Aplicación de escritorio Electron inicializada con compatibilidad total"
);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
    },
    show: false, // No mostrar hasta que esté listo
    icon: path.join(__dirname, "assets", "icon.png"), // Opcional: agregar icono
  });

  // Configurar permisos de media para permitir acceso al micrófono
  win.webContents.session.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      console.log(`🔑 Solicitud de permiso: ${permission}`);

      if (permission === "media") {
        // Conceder automáticamente permisos de media (micrófono/cámara)
        console.log("✅ Permiso de media concedido");
        callback(true);
      } else {
        // Denegar otros permisos por defecto
        callback(false);
      }
    }
  );

  // También configurar permisos específicos
  win.webContents.session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin, details) => {
      console.log(
        `🔍 Verificación de permiso: ${permission} para ${requestingOrigin}`
      );

      if (permission === "media" || permission === "microphone") {
        console.log("✅ Permiso de micrófono verificado");
        return true;
      }

      return false;
    }
  );

  // Mostrar ventana cuando esté lista para evitar flash blanco
  win.once("ready-to-show", () => {
    console.log("🖼️ Ventana mostrada - aplicación de escritorio lista");
    win.show();
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Event listener para cuando la página termine de cargar
  win.webContents.once("did-finish-load", () => {
    console.log("📄 Página cargada correctamente");
  });

  // Habilitar DevTools en desarrollo
  if (process.env.NODE_ENV === "development") {
    win.webContents.openDevTools();
  }

  return win;
}

/**
 * Inicia el servidor backend de Node.js
 */
function startBackendServer() {
  const backendPath = path.join(__dirname, "..", "backend");

  try {
    backendProcess = spawn("node", ["server.js"], {
      cwd: backendPath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    backendProcess.stdout.on("data", (data) => {
      console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on("data", (data) => {
      console.error(`Backend Error: ${data}`);
    });

    backendProcess.on("close", (code) => {
      console.log(`Backend process closed with code ${code}`);
    });

    console.log("✅ Backend server started");
  } catch (error) {
    console.error("❌ Error starting backend server:", error);
  }
}

/**
 * Detiene el servidor backend
 */
function stopBackendServer() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    console.log("🛑 Backend server stopped");
  }
}

app.whenReady().then(() => {
  // Iniciar el backend primero
  // startBackendServer();

  // Esperar un poco para que el backend se inicie
  setTimeout(() => {
    createWindow();
  }, 2000);

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  // Detener el backend cuando se cierren todas las ventanas
  // stopBackendServer();

  if (process.platform !== "darwin") app.quit();
});

// Manejar el cierre de la aplicación
app.on("before-quit", () => {
  stopBackendServer();
});

// Manejar errores de GPU y otros errores críticos
app.on("gpu-process-crashed", (event, killed) => {
  console.log("GPU process crashed, killed:", killed);
});

app.on("renderer-process-crashed", (event, webContents, killed) => {
  console.log("Renderer process crashed, killed:", killed);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

// IPC handlers para comunicación con el renderer
ipcMain.handle("get-backend-status", async () => {
  try {
    const response = await fetch("http://localhost:3001/api/health");
    return await response.json();
  } catch (error) {
    return { status: "disconnected", error: error.message };
  }
});
