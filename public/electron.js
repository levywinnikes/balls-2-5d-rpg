const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets/items/iron_shield.png')
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../build/index.html')}`;
  mainWindow.loadURL(startUrl);

  // Open the DevTools only in dev mode
  if (process.env.ELECTRON_START_URL) {
      mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers for Native Save System ---

const getSaveDir = () => {
    const docPath = app.getPath('documents');
    const savePath = path.join(docPath, 'TibiaReact', 'Saves');
    if (!fs.existsSync(savePath)) {
        fs.mkdirSync(savePath, { recursive: true });
    }
    return savePath;
};

ipcMain.handle('save-game', async (event, { name, data }) => {
    try {
        const dir = getSaveDir();
        const filePath = path.join(dir, `${name}.dat`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2)); // Using JSON inside .dat for now
        return { success: true, path: filePath };
    } catch (error) {
        console.error('Save failed:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-game', async (event, name) => {
    try {
        const dir = getSaveDir();
        // Allow loading by full filename or just name
        const filename = name.endsWith('.dat') || name.endsWith('.json') ? name : `${name}.dat`;
        const filePath = path.join(dir, filename);
        
        if (!fs.existsSync(filePath)) return { success: false, error: 'File not found' };
        
        const content = fs.readFileSync(filePath, 'utf-8');
        return { success: true, data: JSON.parse(content) };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('list-saves', async () => {
    try {
        const dir = getSaveDir();
        const files = fs.readdirSync(dir);
        return { 
            success: true, 
            files: files.filter(f => f.endsWith('.dat') || f.endsWith('.json')).map(f => ({
                name: f,
                path: path.join(dir, f),
                stat: fs.statSync(path.join(dir, f))
            }))
        };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

ipcMain.handle('delete-game', async (event, name) => {
    try {
        const dir = getSaveDir();
        const filename = name.endsWith('.dat') || name.endsWith('.json') ? name : `${name}.dat`;
        const filePath = path.join(dir, filename);
        
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            return { success: true };
        }
        return { success: false, error: 'File not found' };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
