const { app, BrowserWindow } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");

let backendProcess;
let mainWindow;
let isQuitting = false;

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

  const frontendPath = app.isPackaged
    ? path.join(process.resourcesPath, "frontend", "index.html")
    : path.join(__dirname, "..", "Frontend", "dist", "index.html");

  console.log("Loading frontend from:", frontendPath);
  mainWindow.loadFile(frontendPath);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      forceKillAndExit();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
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
    const backendDir = path.join(__dirname, "..", "Backend");
    const venvPython = process.platform === "win32"
      ? path.join(backendDir, ".venv", "Scripts", "python.exe")
      : path.join(backendDir, ".venv", "bin", "python");
    
    const backendScript = path.join(backendDir, "run.py");
    
    console.log("Starting development backend using:", venvPython);
    
    backendProcess = spawn(venvPython, [backendScript], {
      cwd: backendDir,
      windowsHide: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    backendProcess.stdout.on("data", (data) => {
      console.log(`[Python OUT]: ${data.toString()}`);
    });

    backendProcess.stderr.on("data", (data) => {
      console.error(`[Python ERR]: ${data.toString()}`);
    });
  }

  // Increased failsafe timer to 5 seconds to give Uvicorn time to boot
  const fallbackTimer = setTimeout(() => {
    if (!mainWindow) {
      console.log("Failsafe triggered: Opening window...");
      createWindow();
    }
  }, 5000);

  const checkReady = (data) => {
    const message = data.toString();
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

function forceKillAndExit() {
  if (isQuitting) return;
  isQuitting = true;

  if (mainWindow) {
    mainWindow.hide();
  }

  if (backendProcess) {
    if (process.platform === "win32") {
      if (backendProcess.pid) {
        exec(`taskkill /pid ${backendProcess.pid} /T /F`, () => {});
      }
      if (app.isPackaged) {
        exec(`taskkill /f /im invoice_backend.exe /T`, () => {});
      }
    } else {
      backendProcess.kill("SIGKILL");
    }
  }

  setTimeout(() => {
    app.exit(0);
  }, 100);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    forceKillAndExit();
  }
});

app.on("before-quit", (e) => {
  if (!isQuitting) {
    e.preventDefault();
    forceKillAndExit();
  }
});