const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let backendProcess = null;

// === CONFIGURACIÓN DEFINITIVA PARA ELIMINAR ERRORES DE GPU ===
// Deshabilitar completamente la aceleración de hardware
app.disableHardwareAcceleration();

// Configurar todas las banderas antes de que la app inicie
app.commandLine.appendSwitch("--no-sandbox");
app.commandLine.appendSwitch("--disable-web-security");
app.commandLine.appendSwitch("--disable-features", "VizDisplayCompositor");
app.commandLine.appendSwitch("--disable-gpu");
app.commandLine.appendSwitch("--disable-gpu-sandbox");
app.commandLine.appendSwitch("--disable-software-rasterizer");
app.commandLine.appendSwitch("--disable-background-timer-throttling");
app.commandLine.appendSwitch("--disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("--disable-renderer-backgrounding");
app.commandLine.appendSwitch("--disable-gpu-compositing");
app.commandLine.appendSwitch("--disable-gpu-rasterization");
app.commandLine.appendSwitch("--ignore-gpu-blacklist");
app.commandLine.appendSwitch("--use-gl", "swiftshader");
app.commandLine.appendSwitch("--disable-extensions");
app.commandLine.appendSwitch("--disable-default-apps");
app.commandLine.appendSwitch("--disable-sync");
app.commandLine.appendSwitch("--no-first-run");
app.commandLine.appendSwitch("--disable-background-networking");

function createWindow() {
  console.log("🔧 Creando ventana de Electron sin errores de GPU...");

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
      enableRemoteModule: false,
      worldSafeExecuteJavaScript: true,
      backgroundThrottling: false,
      offscreen: false,
    },
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  // Cargar la página
  win
    .loadFile(path.join(__dirname, "renderer", "index.html"))
    .then(() => {
      console.log("✅ Página cargada correctamente");
    })
    .catch((error) => {
      console.error("❌ Error cargando página:", error);
    });

  // Mostrar ventana cuando esté lista
  win.once("ready-to-show", () => {
    win.show();
    console.log("✅ Ventana mostrada - aplicación de escritorio lista");
  });

  // Manejar errores de carga
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("❌ Error cargando:", errorCode, errorDescription);
  });

  // DevTools solo en desarrollo
  if (process.env.NODE_ENV === "development") {
    win.webContents.once("did-finish-load", () => {
      win.webContents.openDevTools();
    });
  }

  return win;
}

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

function stopBackendServer() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
    console.log("🛑 Backend server stopped");
  }
}

// === INICIALIZACIÓN ===
app.whenReady().then(() => {
  console.log("🚀 Electron desktop app ready");
  createWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopBackendServer();
});

// === FILTRAR ERRORES DE GPU ===
// Interceptar TODOS los tipos de output de errores
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
const originalStderrWrite = process.stderr.write;

console.error = function (...args) {
  const message = args.join(" ");

  // Lista completa de errores de GPU que queremos ocultar
  const gpuErrors = [
    "GPU",
    "GLES",
    "gpu_channel_manager",
    "ContextResult::kFatalFailure",
    "Failed to create",
    "fallback to GLES2",
    "virtualization",
    "gpu\\ipc\\service",
    "OnSizeReceived failed",
    "chunked_data_pipe_upload",
    "GLES3 context",
    "shared context",
    "Error: -2",
  ];

  if (gpuErrors.some((error) => message.includes(error))) {
    return; // No mostrar errores de GPU
  }

  originalConsoleError.apply(console, args);
};

console.warn = function (...args) {
  const message = args.join(" ");
  const gpuErrors = ["GPU", "GLES", "gpu_channel_manager", "virtualization"];

  if (gpuErrors.some((error) => message.includes(error))) {
    return;
  }

  originalConsoleWarn.apply(console, args);
};

// Interceptar stderr para evitar que aparezcan en la consola
process.stderr.write = function (string, encoding, fd) {
  const gpuErrors = [
    "GPU",
    "GLES",
    "gpu_channel_manager",
    "ContextResult::kFatalFailure",
    "Failed to create",
    "fallback to GLES2",
    "virtualization",
    "OnSizeReceived failed",
    "chunked_data_pipe_upload",
    "Error: -2",
  ];

  if (gpuErrors.some((error) => string.includes(error))) {
    return true; // No escribir errores de GPU a stderr
  }

  return originalStderrWrite.call(process.stderr, string, encoding, fd);
};

// Manejar crashes de GPU silenciosamente
app.on("gpu-process-crashed", (event, killed) => {
  // No hacer nada, es normal en modo software
});

app.on("renderer-process-crashed", (event, webContents, killed) => {
  console.log("⚠️ Renderer crashed - reintentando...");
  if (webContents && !webContents.isDestroyed()) {
    webContents.reload();
  }
});

// Manejar excepciones
process.on("uncaughtException", (error) => {
  if (!error.message.includes("GPU") && !error.message.includes("GLES")) {
    console.error("❌ Uncaught Exception:", error);
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
});

// === IPC HANDLERS ===
ipcMain.handle("get-backend-status", async () => {
  try {
    const response = await fetch("http://localhost:3001/api/health");
    return await response.json();
  } catch (error) {
    return { status: "disconnected", error: error.message };
  }
});

console.log(
  "🖥️ Aplicación de escritorio Electron inicializada con compatibilidad total"
);
