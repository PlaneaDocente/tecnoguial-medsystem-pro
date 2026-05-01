const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "icon.ico"),
    webPreferences: {
      contextIsolation: true,
    },
  });

  win.loadURL("https://tu-proyecto.vercel.app");
  win.removeMenu();
}

app.whenReady().then(createWindow);