/**
 * Preload Script
 * Exposes a minimal API for renderer processes to communicate with the main process
 */

const { contextBridge, ipcRenderer, clipboard, shell } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Settings
    getSettings: () => {
      return ipcRenderer.invoke('get-settings');
    },
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
    validateApiKey: (apiKey) => ipcRenderer.invoke('validate-api-key', apiKey),
    
    // Translation
    translateText: (params) => ipcRenderer.invoke('translate-text', params),
    getSupportedLanguages: () => ipcRenderer.invoke('get-supported-languages'),
    getRecentLanguagePairs: () => ipcRenderer.invoke('get-recent-language-pairs'),
    
    // API Usage
    getUsage: () => ipcRenderer.invoke('get-usage'),
    
    // History
    getHistory: () => ipcRenderer.invoke('get-history'),
    deleteHistoryItem: (index) => ipcRenderer.invoke('delete-history-item', index),
    clearHistory: () => ipcRenderer.invoke('clear-history'),
    useHistoryItem: (item) => ipcRenderer.send('use-history-item', item),
    
    // System Information
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
    
    // Window management
    openSettings: () => ipcRenderer.send('open-settings'),
    closeSettings: () => ipcRenderer.send('close-settings'),
    openHistory: () => ipcRenderer.send('open-history'),
    closeHistory: () => ipcRenderer.send('close-history'),
    openAbout: () => ipcRenderer.send('open-about'),
    closeAbout: () => ipcRenderer.send('close-about'),
    closeTranslationWindow: () => ipcRenderer.send('close-translation-window'),
    minimizeTranslationWindow: () => ipcRenderer.send('minimize-translation-window'),
    testTranslation: (text) => ipcRenderer.send('test-translation', text),
    
    // External links
    openExternal: (url) => {
      if (url && typeof url === 'string') {
        console.log('Opening external URL via preload:', url);
        return ipcRenderer.invoke('open-external', url);
      } else {
        console.error('Invalid URL provided:', url);
        return Promise.reject(new Error('Invalid URL'));
      }
    },
    
    // Clipboard
    readClipboard: () => clipboard.readText(),
    writeClipboard: (text) => clipboard.writeText(text),
    
    // Event listeners
    on: (channel, callback) => {
      // Whitelist channels
      const validChannels = [
        'settings-data',
        'settings-saved',
        'translation-result',
        'history-data',
        'set-source-text',
        'settings-changed',
        'set-translation'
      ];
      if (validChannels.includes(channel)) {
        console.log(`Adding listener for channel: ${channel}`);
        // Remove existing listeners to avoid duplicates
        ipcRenderer.removeAllListeners(channel);
        // Add the event listener
        ipcRenderer.on(channel, (event, ...args) => callback(...args));
      } else {
        console.warn(`Attempted to listen to unauthorized channel: ${channel}`);
      }
    },
    
    // Settings change listener
    onSettingsChanged: (callback) => {
      console.log('Setting up settings-changed listener');
      ipcRenderer.removeAllListeners('settings-changed');
      ipcRenderer.on('settings-changed', (event, settings) => {
        console.log('Settings changed event received:', settings);
        callback(settings);
      });
    },
    
    // Remove event listener
    removeListener: (channel) => {
      const validChannels = [
        'settings-data',
        'settings-saved',
        'translation-result',
        'history-data',
        'set-source-text',
        'settings-changed',
        'set-translation'
      ];
      if (validChannels.includes(channel)) {
        console.log(`Removing listener for channel: ${channel}`);
        ipcRenderer.removeAllListeners(channel);
      } else {
        console.warn(`Attempted to remove listener from unauthorized channel: ${channel}`);
      }
    }
  }
); 