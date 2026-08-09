const { app, BrowserWindow } = require("electron");
const { spawn } = require("child_process");
const path = require("path");

let backendProcess;
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Correctly target frontend from extraResources path
  const frontendPath = app.isPackaged
    ? path.join(process.resourcesPath, "frontend", "index.html")
    : path.join(__dirname, "..", "Frontend", "dist", "index.html");

  console.log("Loading frontend from:", frontendPath);
  mainWindow.loadFile(frontendPath);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    const backendDir = path.join(process.resourcesPath, "backend");
    const backendExe = path.join(backendDir, "invoice_backend.exe");
    
    console.log("Spawning backend from:", backendExe);
    
    backendProcess = spawn(backendExe, [], { 
      cwd: backendDir,
      windowsHide: true 
    });
  } else {
    const backendScript = path.join(__dirname, "..", "backend", "run.py");
    backendProcess = spawn("python", [backendScript]);
  }

  const fallbackTimer = setTimeout(() => {
    if (!mainWindow) {
      console.log("Failsafe triggered: Opening window...");
      createWindow();
    }
  }, 2500);

  const checkReady = (data) => {
    const message = data.toString();
    console.log("Backend:", message);

    if (message.includes("Uvicorn running on") || message.includes("Application startup complete")) {
      if (!mainWindow) {
        clearTimeout(fallbackTimer);
        createWindow();
      }
    }
  };

  if (backendProcess && backendProcess.stdout) {
      backendProcess.stdout.on("data", checkReady);
  }
  if (backendProcess && backendProcess.stderr) {
      backendProcess.stderr.on("data", checkReady);
  }
});

app.on("will-quit", () => {
  if (backendProcess) backendProcess.kill();
});