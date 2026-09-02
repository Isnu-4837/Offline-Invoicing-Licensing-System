const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const crypto = require("crypto");
const Store = require("electron-store");

// Initialize secure local configuration store for tracking unique application users
const store = new Store({
  name: "key-generator-users-registry",
  encryptionKey: "KEY_GEN_SECRET_2026"
});

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

// Helper function to register and count unique user machine IDs
function registerUser(machineId) {
  if (!machineId) return;
  const cleanId = machineId.trim().toUpperCase();
  const users = store.get("unique_app_users") || [];
  if (!users.includes(cleanId)) {
    users.push(cleanId);
    store.set("unique_app_users", users);
  }
}

// IPC handler to return the total unique user count
ipcMain.handle("get-total-users", () => {
  const users = store.get("unique_app_users") || [];
  return { totalUsers: users.length };
});

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 610, // Expanded slightly to accommodate the user count widget nicely
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

// --- IPC HANDLER FOR KEY GENERATION & USER REGISTRATION ---
ipcMain.handle("generate-key", async (event, machineId) => {
  if (!machineId) {
    return { success: false, message: "Machine ID is required!" };
  }

  // Track unique user machine ID when a key is requested
  registerUser(machineId);

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