const { app, BrowserWindow, ipcMain } = require("electron");
const { spawn, exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { machineIdSync } = require("node-machine-id");

// Initialize secure local configuration via native Node.js fs storage to avoid ESM require errors
const CONFIG_FILE = path.join(app.getPath("userData"), "system-security-config.json");

function readStore() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch (e) {}
  return {};
}

function writeStore(data) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(data), "utf8");
  } catch (e) {}
}

let backendProcess;
let mainWindow;
let isQuitting = false;

// --- SECURE IPC TRIAL & LICENSE HANDLERS ---
ipcMain.handle("get-machine-id", () => {
  return machineIdSync();
});

ipcMain.handle("check-trial", () => {
  const deviceId = machineIdSync();
  const trialKey = `trial_${deviceId}_start`;
  const lastSeenKey = `trial_${deviceId}_last_seen`;
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  
  const storeData = readStore();
  const isActivated = storeData[`activated_${deviceId}`] || false;
  if (isActivated) {
    return { status: "activated", daysLeft: 0 };
  }

  const now = Date.now();
  const startTime = storeData[trialKey];
  const lastSeenTime = storeData[lastSeenKey] || 0;

  // No trial started yet
  if (!startTime) {
    return { status: "not_started", daysLeft: 7 };
  }

  // System clock tamper check (rolled back)
  if (now < lastSeenTime) {
    return { status: "tampered", daysLeft: 0 };
  }

  storeData[lastSeenKey] = now;
  writeStore(storeData);

  const elapsed = now - startTime;
  if (elapsed > SEVEN_DAYS_MS) {
    return { status: "expired", daysLeft: 0 };
  }

  const daysLeft = Math.ceil((SEVEN_DAYS_MS - elapsed) / (1000 * 60 * 60 * 24));
  return { status: "active", daysLeft };
});

ipcMain.handle("start-trial", () => {
  const deviceId = machineIdSync();
  const trialKey = `trial_${deviceId}_start`;
  const lastSeenKey = `trial_${deviceId}_last_seen`;
  
  const storeData = readStore();
  if (!storeData[trialKey]) {
    const now = Date.now();
    storeData[trialKey] = now;
    storeData[lastSeenKey] = now;
    writeStore(storeData);
  }
  return { success: true, trial_days_remaining: 7 };
});

ipcMain.handle("activate-license", (_, licenseKey) => {
  const cleanKey = (licenseKey || "").trim();
  // Example offline key validation criteria (14 chars alphanumeric)
  if (cleanKey.length === 14) {
    const deviceId = machineIdSync();
    const storeData = readStore();
    storeData[`activated_${deviceId}`] = true;
    writeStore(storeData);
    return { success: true };
  }
  return { success: false, message: "Invalid license key format or code." };
});
// -------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
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
