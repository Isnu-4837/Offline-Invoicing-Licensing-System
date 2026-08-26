const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const crypto = require("crypto");

// MUST match the APP_SECRET in your FastAPI main.py
const APP_SECRET = "ERP_SECURE_2026";
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

function calculateChecksum(baseStr) {
  let total = 0;
  for (let i = 0; i < baseStr.length; i++) {
    total += baseStr.charCodeAt(i);
  }
  const char1 = CHARS[total % CHARS.length];
  const char2 = CHARS[(total * 7) % CHARS.length];
  return char1 + char2;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 560, // Slightly taller for the new Machine ID input
    autoHideMenuBar: true,
    resizable: false, // Locks the window so your design stays perfect
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile("index.html");
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// --- NEW IPC HANDLER FOR KEY GENERATION ---
ipcMain.handle("generate-key", async (event, machineId) => {
  if (!machineId) {
    return { success: false, message: "Machine ID is required!" };
  }

  try {
    // 1. Generate the cryptographic hardware hash
    const rawString = machineId.trim().toUpperCase() + APP_SECRET;
    const hashHex = crypto.createHash("sha256").update(rawString).digest("hex").toUpperCase();
    
    // 2. Use 12 characters as the base and generate a signature
    const baseKey = hashHex.substring(0, 12);
    const signature = calculateChecksum(baseKey);
    const finalKey = baseKey + signature;
    
    // 3. Format with dashes for the UI: XXXX-XXXX-XXXX-XX
    const formattedKey = `${finalKey.slice(0,4)}-${finalKey.slice(4,8)}-${finalKey.slice(8,12)}-${finalKey.slice(12,14)}`;
    
    return { success: true, key: formattedKey };
  } catch (error) {
    return { success: false, message: "Error encrypting key." };
  }
});