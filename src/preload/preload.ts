import { contextBridge, ipcRenderer } from 'electron';

export interface TimerStateData {
  state: string;
  remainingTime: number;
  totalTime: number;
  isWorkPhase: boolean;
}

export interface TimerConfig {
  workDuration?: number;
  breakDuration?: number;
}

export interface ElectronAPI {
  timer: {
    start: () => Promise<TimerStateData>;
    pause: () => Promise<TimerStateData>;
    reset: () => Promise<TimerStateData>;
    configure: (config: TimerConfig) => Promise<TimerStateData>;
    getState: () => Promise<TimerStateData>;
    onTick: (callback: (stateData: TimerStateData) => void) => () => void;
    onStateChange: (callback: (stateData: TimerStateData) => void) => () => void;
    onBreakStart: (callback: () => void) => () => void;
    onBreakEnd: (callback: () => void) => () => void;
  };
  voice: {
    sendStatus: (isActive: boolean) => void;
    onRequestStatus: (callback: () => void) => () => void;
  };
  getResourcesPath: () => string;
  readAsset: (assetPath: string) => Promise<string>;
}

const electronAPI: ElectronAPI = {
  timer: {
    start: () => ipcRenderer.invoke('timer:start'),
    pause: () => ipcRenderer.invoke('timer:pause'),
    reset: () => ipcRenderer.invoke('timer:reset'),
    configure: (config: TimerConfig) => ipcRenderer.invoke('timer:configure', config),
    getState: () => ipcRenderer.invoke('timer:getState'),
    
    onTick: (callback) => {
      const subscription = (_event: any, stateData: TimerStateData) => callback(stateData);
      ipcRenderer.on('timer:tick', subscription);
      return () => ipcRenderer.removeListener('timer:tick', subscription);
    },
    
    onStateChange: (callback) => {
      const subscription = (_event: any, stateData: TimerStateData) => callback(stateData);
      ipcRenderer.on('timer:stateChange', subscription);
      return () => ipcRenderer.removeListener('timer:stateChange', subscription);
    },
    
    onBreakStart: (callback) => {
      const subscription = () => callback();
      ipcRenderer.on('timer:breakStart', subscription);
      return () => ipcRenderer.removeListener('timer:breakStart', subscription);
    },
    
    onBreakEnd: (callback) => {
      const subscription = () => callback();
      ipcRenderer.on('timer:breakEnd', subscription);
      return () => ipcRenderer.removeListener('timer:breakEnd', subscription);
    }  },
  voice: {
    sendStatus: (isActive: boolean) => {
      ipcRenderer.send('voice:status', isActive);
    },
    onRequestStatus: (callback: () => void) => {
      ipcRenderer.on('voice:requestStatus', callback);
      return () => ipcRenderer.removeListener('voice:requestStatus', callback);
    }  },
  getResourcesPath: () => {
    // In production, return process.resourcesPath + '/assets'
    // In dev, return empty (use Vite paths)
    return process.env.NODE_ENV === 'production' ? '__RESOURCES_PATH__' : '';
  },
  readAsset: (assetPath: string) => ipcRenderer.invoke('readAsset', assetPath)
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
