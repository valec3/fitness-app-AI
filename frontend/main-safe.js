const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

let backendProcess = null;

// Configurar banderas de Electron para máxima compatibilidad en Windows
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

// Deshabilitar aceleración de hardware completamente
app.disableHardwareAcceleration();

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
      enableRemoteModule: false,
      worldSafeExecuteJavaScript: true,
    },
    show: false,
    icon: path.join(__dirname, "assets", "icon.png"),
  });

  win.once("ready-to-show", () => {
    win.show();
    console.log("✅ Ventana de Electron mostrada correctamente");
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  // Solo abrir DevTools en desarrollo y si no hay errores
  if (process.env.NODE_ENV === "development") {
    win.webContents.once("did-finish-load", () => {
      win.webContents.openDevTools();
    });
  }

  // Manejar errores de carga
  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("❌ Error cargando página:", errorCode, errorDescription);
  });

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

app.whenReady().then(() => {
  console.log("🚀 Electron app ready");

  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBackendServer();
});

// Manejar errores críticos sin crashear
app.on("gpu-process-crashed", (event, killed) => {
  console.log("⚠️ GPU process crashed, killed:", killed);
  console.log("Continuando con software rendering...");
});

app.on("renderer-process-crashed", (event, webContents, killed) => {
  console.log("⚠️ Renderer process crashed, killed:", killed);
  // Recargar la ventana si es posible
  if (webContents && !webContents.isDestroyed()) {
    webContents.reload();
  }
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection:", reason);
});

// IPC handlers
ipcMain.handle("get-backend-status", async () => {
  try {
    const response = await fetch("http://localhost:3001/api/health");
    return await response.json();
  } catch (error) {
    return { status: "disconnected", error: error.message };
  }
});

console.log("🔧 Electron main process initialized with compatibility mode");
