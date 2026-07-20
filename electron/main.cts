/**
 * Electron main process. Loads the Vite dev server when VITE_DEV_SERVER_URL is
 * set (electron:dev), otherwise the built dist/index.html (packaged app).
 */
import { app, BrowserWindow } from 'electron';
import * as path from 'path';

const devServerUrl = process.env.VITE_DEV_SERVER_URL;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0a10',
    // Window/taskbar icon while running; the packaged exe icon comes from
    // electron-builder (win.icon in electron-builder.yml, same source image).
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    // Default menu stays available behind Alt (F11 fullscreen, Ctrl+Shift+I) but
    // doesn't eat vertical space during play.
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (devServerUrl) {
    void win.loadURL(devServerUrl);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // macOS convention: re-create a window when the dock icon is clicked.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
