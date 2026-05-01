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

  win.loadURL("http://localhost:3000");

  win.removeMenu();
}

app.whenReady().then(createWindow);