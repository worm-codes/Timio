import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { TimerEngine, TimerConfig, TimerStateData } from './timerEngine';
import { IdleDetector } from './idleDetector';

let mainWindow: BrowserWindow | null = null;
let timerEngine: TimerEngine;
let idleDetector: IdleDetector;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 620,
    minWidth: 420,
    minHeight: 620,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false // Allow loading local files in production
    },
    backgroundColor: '#0a0e27',
    title: 'Timio',
    autoHideMenuBar: true
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    // mainWindow.webContents.openDevTools(); // Disable for production
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle minimize/restore properly
  mainWindow.on('minimize', () => {
    if (mainWindow) {
      mainWindow.setSkipTaskbar(false);
    }
  });

  mainWindow.on('restore', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function initializeTimer() {
  timerEngine = new TimerEngine();
  idleDetector = new IdleDetector(timerEngine);

  // Forward timer events to renderer
  timerEngine.on('tick', (stateData: TimerStateData) => {
    mainWindow?.webContents.send('timer:tick', stateData);
  });

  timerEngine.on('stateChange', (stateData: TimerStateData) => {
    mainWindow?.webContents.send('timer:stateChange', stateData);
  });

  timerEngine.on('breakStart', () => {
    mainWindow?.webContents.send('timer:breakStart');
    
    // Set window always on top during break
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(true, 'floating');
      mainWindow.show();
      mainWindow.focus();
    }
    
    // Play system beep
    shell.beep();
  });

  timerEngine.on('breakEnd', () => {
    mainWindow?.webContents.send('timer:breakEnd');
    
    // Return window to normal z-order and bring to front
    if (mainWindow) {
      mainWindow.setAlwaysOnTop(false);
      mainWindow.show();
      mainWindow.focus();
    }
    
    // Play system beep for break end notification
    shell.beep();
  });

  // IPC Handlers
  ipcMain.handle('timer:start', () => {
    timerEngine.start();
    return timerEngine.getState();
  });

  ipcMain.handle('timer:pause', () => {
    timerEngine.pause();
    return timerEngine.getState();
  });

  ipcMain.handle('timer:reset', () => {
    timerEngine.reset();
    return timerEngine.getState();
  });

  // Read asset file as base64
  ipcMain.handle('readAsset', async (_event, assetPath: string) => {
    try {
      const fs = await import('fs');
      const resourcesPath = process.resourcesPath;
      // Decode URL-encoded path (e.g., "7%20Bird" -> "7 Bird")
      const decodedPath = decodeURIComponent(assetPath);
      const fullPath = path.join(resourcesPath, 'assets', decodedPath);
      const data = fs.readFileSync(fullPath);
      return `data:image/png;base64,${data.toString('base64')}`;
    } catch (error) {
      console.error('Failed to read asset:', assetPath, error);
      throw error;
    }
  });

  ipcMain.handle('timer:configure', (_event, config: Partial<TimerConfig>) => {
    timerEngine.configure(config);
    
    // Configure idle detector if idle settings provided
    if (config.idleEnabled !== undefined || config.idleThreshold !== undefined) {
      const enabled = config.idleEnabled ?? true;
      const threshold = config.idleThreshold ?? 5 * 60; // Default 5 minutes
      const voiceEnabled = (config as any).voiceDetection ?? false;
      
      idleDetector.configure(enabled, threshold, voiceEnabled);
    }
    
    return timerEngine.getState();
  });

  ipcMain.handle('timer:getState', () => {
    return timerEngine.getState();
  });

  // Voice detection IPC handlers
  ipcMain.on('voice:status', (_event, isActive: boolean) => {
    idleDetector.setVoiceActive(isActive);
  });

  // Read voice detection setting from localStorage on startup
  if (mainWindow) {
    mainWindow.webContents.on('did-finish-load', () => {
      // Request initial voice status
      mainWindow?.webContents.send('voice:requestStatus');
      
      // Also configure voice detection in idle detector
      // This will be properly set when renderer sends status
    });
  }
}

// App lifecycle
app.whenReady().then(() => {
  // Disable GPU cache errors
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
  
  createWindow();
  initializeTimer();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    timerEngine.destroy();
    idleDetector.destroy();
    app.quit();
  }
});

app.on('will-quit', () => {
  if (timerEngine) {
    timerEngine.destroy();
  }
  if (idleDetector) {
    idleDetector.destroy();
  }
});
