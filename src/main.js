/**
 * Hermes Desktop Translator
 * Main process
 */

// Core modules
const path = require('path');
const os = require('os');
const { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, clipboard, nativeImage, shell } = require('electron');
const Store = require('electron-store').default;
const keytar = require('keytar');

// App icon paths
const iconPath = path.join(__dirname, 'assets', 'HermesTranslateApp.ico');

// Custom modules
const Translator = require('./utils/translator');

// App configuration
const isDev = process.env.NODE_ENV === 'development';
const APP_NAME = 'Hermes Translator';
const APP_VERSION = '1.1.0';
const KEYTAR_SERVICE = 'HermesDesktopTranslator';
const KEYTAR_ACCOUNT = 'deepl-api-key';

// Create store for app settings and history
const store = new Store({
  defaults: {
    targetLang: 'EN-US',
    sourceLanguage: 'auto',
    shortcut: 'Control+Alt+H',
    minimizeToTray: true,
    minimizeToTrayOnEsc: true,
    closeOnFocusLoss: true,
    autoTranslateClipboard: true,
    realTimeTranslation: true,
    showTrayNotifications: true,
    saveHistory: true,
    darkTheme: false,
    translationHistory: [],
    recentLanguagePairs: [],
    apiKeySet: false
  }
});

/**
 * Get API key from secure storage
 * @returns {Promise<string|null>} The API key or null if not found
 */
async function getApiKey() {
  try {
    return await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
  } catch (error) {
    console.error('Error retrieving API key from keychain:', error);
    return null;
  }
}

/**
 * Save API key to secure storage
 * @param {string} apiKey - The API key to save
 * @returns {Promise<boolean>} Whether saving was successful
 */
async function saveApiKey(apiKey) {
  try {
    await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, apiKey);
    store.set('apiKeySet', true);
    return true;
  } catch (error) {
    console.error('Error saving API key to keychain:', error);
    return false;
  }
}

/**
 * Delete API key from secure storage
 * @returns {Promise<boolean>} Whether deletion was successful
 */
async function deleteApiKey() {
  try {
    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    store.set('apiKeySet', false);
    return true;
  } catch (error) {
    console.error('Error deleting API key from keychain:', error);
    return false;
  }
}

// Global variables
let translator = null;
let translationWindow = null;
let settingsWindow = null;
let historyWindow = null;
let aboutWindow = null;
let tray = null;
let isAppQuitting = false;

/**
 * Initialize DeepL translator with the stored API key
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initializeTranslator() {
  console.log('API key found, initializing translator');
  
  // Try to get API key from keychain
  const apiKey = await getApiKey();
  
  if (!apiKey) {
    console.log('No API key found, cannot initialize translator');
    return false;
  }
  
  try {
    console.log('Initializing DeepL translator with API key');
    translator = new Translator(apiKey);
    console.log('DeepL translator initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing DeepL translator:', error);
    return false;
  }
}

/**
 * Create the translation window
 * @returns {BrowserWindow} The created window
 */
function createTranslationWindow() {
  console.log('Creating translation window...');
  
  // Don't create a new window if one already exists
  if (translationWindow && !translationWindow.isDestroyed()) {
    translationWindow.show();
    return translationWindow;
  }
  
  // Create new window
  translationWindow = new BrowserWindow({
    width: 700,
    height: 500,
    minWidth: 400,
    minHeight: 300,
    frame: false,
    show: false,
    resizable: true,
    fullscreenable: false,
    alwaysOnTop: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });
  
  // Load the translation HTML file
  translationWindow.loadFile(path.join(__dirname, 'renderer', 'translation.html'));
  
  // Show when ready
  translationWindow.once('ready-to-show', () => {
    console.log('Translation window ready to show');
    translationWindow.show();
  });
  
  // Register for ESC key to minimize to tray or close
  translationWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      const minimizeToTray = store.get('minimizeToTray', true);
      const escClosesApp = store.get('minimizeToTrayOnEsc', true);
      
      if (minimizeToTray) {
        // Just minimize to tray regardless of the ESC setting
        hideTranslationWindow();
      } else if (escClosesApp) {
        // Close the app if ESC closes app is enabled and minimize to tray is disabled
        isAppQuitting = true;
        app.quit();
      }
    }
  });
  
  // Hide translation window when it loses focus, unless settings is shown
  translationWindow.on('blur', () => {
    // Only hide on focus loss if the setting is enabled
    const minimizeToTray = store.get('minimizeToTray', true);
    const closeOnFocusLoss = store.get('closeOnFocusLoss', true);
    
    if (!isDev && closeOnFocusLoss && 
        (!settingsWindow || settingsWindow.isDestroyed() || !settingsWindow.isVisible()) &&
        (!historyWindow || historyWindow.isDestroyed() || !historyWindow.isVisible())) {
      
      if (minimizeToTray) {
        hideTranslationWindow();
      } else {
        isAppQuitting = true;
        app.quit();
      }
    }
  });
  
  // Handle window close
  translationWindow.on('close', (event) => {
    // Check if we should minimize to tray instead of closing
    if (!isAppQuitting) {
      const minimizeToTray = store.get('minimizeToTray', true);
      
      if (minimizeToTray) {
        // Prevent the window from being destroyed
        event.preventDefault();
        hideTranslationWindow();
      } else {
        // Let the window close normally
        isAppQuitting = true;
      }
    }
  });
  
  // Apply theme before loading page
  translationWindow.webContents.on('dom-ready', () => {
    const isDarkTheme = store.get('darkTheme', false);
    console.log('Applying theme to translation window:', isDarkTheme ? 'dark' : 'light');
    translationWindow.webContents.executeJavaScript(`
      if (${isDarkTheme}) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    `).catch(err => console.error('Error applying theme to translation window:', err));
  });
  
  return translationWindow;
}

/**
 * Create the settings window
 * @returns {BrowserWindow} The created window
 */
function createSettingsWindow() {
  console.log('Creating settings window...');
  
  // Don't create a new window if one already exists
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    return settingsWindow;
  }
  
  // Create the parent window if it doesn't exist
  if (!translationWindow || translationWindow.isDestroyed()) {
    createTranslationWindow();
  }

  // Create settings as an overlay of the translation window
  settingsWindow = new BrowserWindow({
    width: 600,
    height: 500,
    parent: translationWindow,
    modal: true,
    resizable: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });
  
  // Position in the center of the parent window
  const parentBounds = translationWindow.getBounds();
  const childBounds = settingsWindow.getBounds();
  
  settingsWindow.setPosition(
    Math.floor(parentBounds.x + (parentBounds.width - childBounds.width) / 2),
    Math.floor(parentBounds.y + (parentBounds.height - childBounds.height) / 2)
  );
  
  // Load the settings HTML file
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  
  // Show when ready
  settingsWindow.once('ready-to-show', () => {
    console.log('Settings window ready to show');
    settingsWindow.show();
  });

  // Prevent closing, just hide
  settingsWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      settingsWindow.hide();
    }
  });
  
  // Apply theme before loading page
  settingsWindow.webContents.on('dom-ready', () => {
    const isDarkTheme = store.get('darkTheme', false);
    console.log('Applying theme to settings window:', isDarkTheme ? 'dark' : 'light');
    settingsWindow.webContents.executeJavaScript(`
      if (${isDarkTheme}) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    `).catch(err => console.error('Error applying theme to settings window:', err));
  });
  
  return settingsWindow;
}

/**
 * Create the tray icon
 */
function createTray() {
  try {
    // Create tray icon
    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));
    tray.setToolTip(APP_NAME);
    
    // Create tray menu
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Translator',
        click: () => {
          if (translationWindow && !translationWindow.isDestroyed()) {
            translationWindow.show();
          } else {
            createTranslationWindow();
          }
        }
      },
      {
        label: 'Settings',
        click: () => {
          createSettingsWindow();
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          isAppQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // Double-click to open
    tray.on('double-click', () => {
      if (translationWindow && !translationWindow.isDestroyed()) {
        translationWindow.show();
      } else {
        createTranslationWindow();
      }
    });
    
    return tray;
  } catch (error) {
    console.error('Failed to create tray:', error);
  }
}

/**
 * Register global shortcut to show/hide the translation window
 * @param {boolean} force - Whether to force re-registration even if shortcut hasn't changed
 */
function registerGlobalShortcut(force = false) {
  // Unregister existing shortcuts first
  globalShortcut.unregisterAll();
  
  const shortcut = store.get('shortcut');
  console.log(`Registering global shortcut: ${shortcut}`);
  
  try {
    globalShortcut.register(shortcut, () => {
      toggleTranslationWindow();
    });
    
    if (!globalShortcut.isRegistered(shortcut)) {
      console.error(`Failed to register global shortcut: ${shortcut}`);
      return false;
    }
    
    console.log(`Global shortcut registered: ${shortcut}`);
    return true;
  } catch (error) {
    console.error(`Error registering global shortcut: ${error.message}`);
    return false;
  }
}

/**
 * Hide the translation window without destroying it
 */
function hideTranslationWindow() {
  if (translationWindow && !translationWindow.isDestroyed()) {
    translationWindow.hide();
    
    // Show notification in the tray if enabled
    const showTrayNotifications = store.get('showTrayNotifications', true);
    if (showTrayNotifications && tray) {
      tray.displayBalloon({
        title: APP_NAME,
        content: 'App minimized to tray. Click the tray icon to restore.',
        iconType: 'info'
      });
    }
  }
}

/**
 * Create the history window
 * @returns {BrowserWindow} The history window
 */
function createHistoryWindow() {
  console.log('Creating history window...');
  
  // Don't create a new window if one already exists
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.show();
    return historyWindow;
  }
  
  // Create the parent window if it doesn't exist
  if (!translationWindow || translationWindow.isDestroyed()) {
    createTranslationWindow();
  }

  // Create history as an overlay of the translation window
  historyWindow = new BrowserWindow({
    width: 700,
    height: 600,
    parent: translationWindow,
    modal: true,
    resizable: true,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });
  
  // Position in the center of the parent window
  const parentBounds = translationWindow.getBounds();
  const childBounds = historyWindow.getBounds();
  
  historyWindow.setPosition(
    Math.floor(parentBounds.x + (parentBounds.width - childBounds.width) / 2),
    Math.floor(parentBounds.y + (parentBounds.height - childBounds.height) / 2)
  );
  
  // Load the history HTML file
  historyWindow.loadFile(path.join(__dirname, 'renderer', 'history.html'));
  
  // Show when ready
  historyWindow.once('ready-to-show', () => {
    console.log('History window ready to show');
    historyWindow.show();
  });

  // Prevent closing, just hide
  historyWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      historyWindow.hide();
    }
  });
  
  // Apply theme before loading page
  historyWindow.webContents.on('dom-ready', () => {
    const isDarkTheme = store.get('darkTheme', false);
    console.log('Applying theme to history window:', isDarkTheme ? 'dark' : 'light');
    historyWindow.webContents.executeJavaScript(`
      if (${isDarkTheme}) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    `).catch(err => console.error('Error applying theme to history window:', err));
  });
  
  return historyWindow;
}

/**
 * Create the about window
 * @returns {BrowserWindow} The about window
 */
function createAboutWindow() {
  console.log('Creating about window...');
  
  // Don't create a new window if one already exists
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    return aboutWindow;
  }
  
  // Create the parent window if it doesn't exist
  if (!translationWindow || translationWindow.isDestroyed()) {
    createTranslationWindow();
  }

  // Create about as an overlay of the translation window
  aboutWindow = new BrowserWindow({
    width: 500,
    height: 650,
    parent: translationWindow,
    modal: true,
    resizable: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      enableRemoteModule: false
    }
  });
  
  // Position in the center of the parent window
  const parentBounds = translationWindow.getBounds();
  const childBounds = aboutWindow.getBounds();
  
  aboutWindow.setPosition(
    Math.floor(parentBounds.x + (parentBounds.width - childBounds.width) / 2),
    Math.floor(parentBounds.y + (parentBounds.height - childBounds.height) / 2)
  );
  
  // Load the about HTML file
  aboutWindow.loadFile(path.join(__dirname, 'renderer', 'about.html'));
  
  // Show when ready
  aboutWindow.once('ready-to-show', () => {
    console.log('About window ready to show');
    aboutWindow.show();
  });

  // Prevent closing, just hide
  aboutWindow.on('close', (event) => {
    if (!isAppQuitting) {
      event.preventDefault();
      aboutWindow.hide();
    }
  });
  
  // Apply theme before loading page
  aboutWindow.webContents.on('dom-ready', () => {
    const isDarkTheme = store.get('darkTheme', false);
    console.log('Applying theme to about window:', isDarkTheme ? 'dark' : 'light');
    aboutWindow.webContents.executeJavaScript(`
      if (${isDarkTheme}) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
    `).catch(err => console.error('Error applying theme to about window:', err));
  });
  
  return aboutWindow;
}

/**
 * Translate text using DeepL API
 * @param {string} text - Text to translate
 * @param {string} sourceLang - Source language code
 * @param {string} targetLang - Target language code
 * @returns {Promise<object>} Translation result
 */
async function translateText(text, sourceLang = 'auto', targetLang = null) {
  if (!translator) {
    throw new Error('Translator not initialized');
  }
  
  // Use the stored target language if none provided
  if (!targetLang) {
    targetLang = store.get('targetLang', 'EN-US');
  }
  
  console.log(`Translating with DeepL: ${sourceLang} -> ${targetLang}`);
  
  try {
    const result = await translator.translate(text, sourceLang, targetLang);
    
    // Store the detected language instead of 'auto' if source was auto
    const detectedSourceLang = result.detectedSourceLang || sourceLang;
    
    // Save to history only if enabled in settings
    if (store.get('saveHistory', true)) {
      const history = store.get('translationHistory', []);
      const newEntry = {
        originalText: text,
        translatedText: result.text,
        sourceLang: detectedSourceLang,
        targetLang,
        timestamp: new Date().toISOString()
      };
      
      store.set('translationHistory', [newEntry, ...history].slice(0, 50));
    }
    
    // Track recently used language pairs (max 5)
    const recentPairs = store.get('recentLanguagePairs', []);
    
    // Create a pair string for comparison
    const currentPair = `${detectedSourceLang}:${targetLang}`;
    
    // Remove this pair if it exists already
    const filteredPairs = recentPairs.filter(pair => pair !== currentPair);
    
    // Add current pair to the beginning
    const updatedPairs = [currentPair, ...filteredPairs].slice(0, 5);
    
    // Save updated pairs
    store.set('recentLanguagePairs', updatedPairs);
    
    return result;
  } catch (error) {
    console.error('DeepL API error:', error);
    throw new Error(`DeepL API error: ${error.message}`);
  }
}

// IPC Handlers

// Get settings
ipcMain.handle('get-settings', async () => {
  return {
    apiKey: await getApiKey() || '',
    apiKeySet: store.get('apiKeySet', false),
    shortcut: store.get('shortcut', 'Control+Alt+H'),
    targetLang: store.get('targetLang', 'EN-US'),
    sourceLanguage: store.get('sourceLanguage', 'auto'),
    minimizeToTray: store.get('minimizeToTray', true),
    minimizeToTrayOnEsc: store.get('minimizeToTrayOnEsc', true),
    closeOnFocusLoss: store.get('closeOnFocusLoss', true),
    autoTranslateClipboard: store.get('autoTranslateClipboard', false),
    realTimeTranslation: store.get('realTimeTranslation', true),
    showTrayNotifications: store.get('showTrayNotifications', true),
    saveHistory: store.get('saveHistory', true),
    darkTheme: store.get('darkTheme', false)
  };
});

// Save settings
ipcMain.handle('save-settings', async (event, newSettings) => {
  console.log('Saving settings:', newSettings);
  
  try {
    // Extract API key for secure storage
    const { apiKey, ...otherSettings } = newSettings;
    
    // Securely store API key if it has changed
    if (apiKey) {
      const currentApiKey = await getApiKey();
      if (apiKey !== currentApiKey) {
        const success = await saveApiKey(apiKey);
        if (!success) {
          throw new Error('Failed to save API key securely');
        }
      }
    }
    
    // Store other settings normally
    for (const [key, value] of Object.entries(otherSettings)) {
      store.set(key, value);
    }
    
    // Apply changes that require immediate action
    if (newSettings.darkTheme !== undefined && translationWindow) {
      // Notify all windows of theme change
      translationWindow.webContents.send('settings-changed', { darkTheme: newSettings.darkTheme });
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('settings-changed', { darkTheme: newSettings.darkTheme });
      }
      if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.webContents.send('settings-changed', { darkTheme: newSettings.darkTheme });
      }
    }
    
    // Update global shortcut
    if (newSettings.shortcut) {
      registerGlobalShortcut(true);
    }
    
    // Reinitialize translator if API key was changed
    if (apiKey) {
      await initializeTranslator();
    }
    
    // Send success event to settings window
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      console.log('Sending settings-saved event to settings window');
      settingsWindow.webContents.send('settings-saved');
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    // Send error back to the renderer
    return { success: false, error: error.message };
  }
});

// Translate text
ipcMain.handle('translate-text', async (event, data) => {
  console.log('Received translation request:', data);
  
  try {
    if (!translator) {
      console.log('Translator not initialized, initializing now...');
      initializeTranslator();
    }
    
    if (!translator) {
      return { error: 'Translator not initialized. Please check your API key.' };
    }
    
    const { text, sourceLanguage, targetLanguage } = data;
    console.log(`Translating from ${sourceLanguage} to ${targetLanguage}: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
    
    // Translate the text
    const result = await translateText(text, sourceLanguage, targetLanguage);
    
    // Return the result
    return {
      translatedText: result.text,
      detectedLanguage: result.detectedSourceLang,
      originalText: text
    };
  } catch (error) {
    console.error('Translation error:', error);
    return { error: `Translation failed: ${error.message}` };
  }
});

// Get translation history
ipcMain.handle('get-history', () => {
  return store.get('translationHistory', []);
});

// Delete single history item
ipcMain.handle('delete-history-item', (event, index) => {
  try {
    const history = store.get('translationHistory', []);
    
    if (index >= 0 && index < history.length) {
      history.splice(index, 1);
      store.set('translationHistory', history);
      return { success: true };
    } else {
      return { success: false, error: 'Invalid index' };
    }
  } catch (error) {
    console.error('Error deleting history item:', error);
    return { success: false, error: error.message };
  }
});

// Clear all history
ipcMain.handle('clear-history', () => {
  try {
    store.set('translationHistory', []);
    return { success: true };
  } catch (error) {
    console.error('Error clearing history:', error);
    return { success: false, error: error.message };
  }
});

// Use history item in translation window
ipcMain.on('use-history-item', (event, item) => {
  try {
    if (translationWindow && !translationWindow.isDestroyed()) {
      // Send original text to source and translated text to target
      translationWindow.webContents.send('set-translation', {
        originalText: item.originalText,
        translatedText: item.translatedText,
        sourceLang: item.sourceLang,
        targetLang: item.targetLang
      });
      
      // Close the history window
      if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.hide();
      }
      
      // Show the translation window
      translationWindow.show();
    }
  } catch (error) {
    console.error('Error using history item:', error);
  }
});

// Open history window
ipcMain.on('open-history', () => {
  createHistoryWindow();
});

// Close history window
ipcMain.on('close-history', () => {
  if (historyWindow && !historyWindow.isDestroyed()) {
    historyWindow.hide();
  }
});

// Open settings (toggle)
ipcMain.on('open-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // If settings window already exists, toggle visibility
    if (settingsWindow.isVisible()) {
      settingsWindow.hide();
    } else {
      // Reposition in case parent window has moved
      if (translationWindow && !translationWindow.isDestroyed()) {
        const parentBounds = translationWindow.getBounds();
        const childBounds = settingsWindow.getBounds();
        
        settingsWindow.setPosition(
          Math.floor(parentBounds.x + (parentBounds.width - childBounds.width) / 2),
          Math.floor(parentBounds.y + (parentBounds.height - childBounds.height) / 2)
        );
      }
      settingsWindow.show();
    }
  } else {
    // Create a new settings window
    createSettingsWindow();
  }
});

// Close settings
ipcMain.on('close-settings', () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.hide();
    
    // Show the translation window if available and API key is valid
    if (translator && translationWindow && !translationWindow.isDestroyed()) {
      translationWindow.show();
    } else if (store.get('apiKey')) {
      // If we have an API key but no translation window, create one
      createTranslationWindow();
    }
  }
});

// Window management events
ipcMain.on('close-translation-window', () => {
  // Check if we should minimize to tray instead of closing
  const minimizeToTray = store.get('minimizeToTray', true);
  
  if (minimizeToTray) {
    hideTranslationWindow();
  } else {
    isAppQuitting = true;
    app.quit();
  }
});

ipcMain.on('minimize-translation-window', () => {
  if (translationWindow && !translationWindow.isDestroyed()) {
    translationWindow.minimize();
  }
});

// Test translation
ipcMain.on('test-translation', async (event, text) => {
  console.log(`Test translation requested for: "${text}"`);
  
  try {
    // Make sure the translator is initialized
    if (!translator) {
      console.log('Translator not initialized, initializing now...');
      initializeTranslator();
    }
    
    // Make sure we have a translation window
    if (!translationWindow || translationWindow.isDestroyed()) {
      createTranslationWindow();
    } else {
      translationWindow.show();
    }
    
    // Hide settings window
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.hide();
    }
    
    // Wait a bit to ensure window is ready
    setTimeout(() => {
      if (translationWindow && !translationWindow.isDestroyed()) {
        translationWindow.webContents.send('set-source-text', text);
      }
    }, 300);
  } catch (error) {
    console.error('Error handling test translation:', error);
  }
});

// Validate API key
ipcMain.handle('validate-api-key', async (event, apiKey) => {
  return await Translator.validateApiKey(apiKey);
});

// Get supported languages
ipcMain.handle('get-supported-languages', async () => {
  if (!translator) {
    throw new Error('Translator not initialized');
  }
  
  try {
    return await translator.getSupportedLanguages();
  } catch (error) {
    console.error('Error getting supported languages:', error);
    throw error;
  }
});

// Get recent language pairs
ipcMain.handle('get-recent-language-pairs', () => {
  return store.get('recentLanguagePairs', []);
});

// Get usage data
ipcMain.handle('get-usage', async () => {
  try {
    if (!translator) {
      console.log('Translator not initialized, initializing now...');
      await initializeTranslator();
    }
    
    if (!translator) {
      return { error: 'Translator not initialized. Please check your API key.' };
    }
    
    const usage = await translator.getUsage();
    console.log('API usage retrieved:', usage);
    return usage;
  } catch (error) {
    console.error('Error getting API usage:', error);
    return { error: `Error getting API usage: ${error.message}` };
  }
});

// Open about window
ipcMain.on('open-about', () => {
  createAboutWindow();
});

// Close about window
ipcMain.on('close-about', () => {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.hide();
  }
});

// Get system information
ipcMain.handle('get-system-info', async () => {
  return {
    appVersion: APP_VERSION,
    os: `${os.platform()} ${os.release()}`,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node
  };
});

// Open external links
ipcMain.handle('open-external', async (event, url) => {
  try {
    console.log('Opening external URL:', url);
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Error opening external URL:', error);
    return { success: false, error: error.message };
  }
});

// App lifecycle events

// App is ready
app.whenReady().then(async () => {
  console.log('App ready, initializing...');
  
  try {
    // Create tray icon
    createTray();
    
    // Register global shortcut
    registerGlobalShortcut();
    
    // Check if we have an API key
    const apiKeySet = store.get('apiKeySet', false);
    
    if (!apiKeySet) {
      console.log('No API key found, showing settings window');
      createSettingsWindow();
    } else {
      // Initialize translator with API key from keychain
      const success = await initializeTranslator();
      
      if (success) {
        // Create translation window
        createTranslationWindow();
      } else {
        // If initialization failed, show settings window
        console.log('Translator initialization failed, showing settings window');
        createSettingsWindow();
      }
    }
    
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        // Check if API key exists before creating window
        if (store.get('apiKeySet', false)) {
          createTranslationWindow();
        } else {
          createSettingsWindow();
        }
      }
    });
  } catch (error) {
    console.error('Initialization error:', error);
    createSettingsWindow();
  }
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Unregister shortcuts before quit
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// When app is quitting
app.on('before-quit', () => {
  isAppQuitting = true;
});

/**
 * Toggle the visibility of the translation window
 * Called when the global shortcut is pressed
 */
function toggleTranslationWindow() {
  console.log('Global shortcut triggered');
  
  // Get selected text from clipboard
  const text = clipboard.readText('selection').trim();
  console.log(`Clipboard text: "${text}"`);
  
  // Ensure the translation window exists or create it
  if (!translationWindow || translationWindow.isDestroyed()) {
    console.log('Creating translation window');
    createTranslationWindow();
  } else if (!translationWindow.isVisible()) {
    console.log('Showing existing translation window');
    translationWindow.show();
  } else {
    console.log('Translation window already visible');
  }
  
  // If settings window is open, hide it
  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
    settingsWindow.hide();
  }
  
  // Only send clipboard text to translation window if auto-translate clipboard is enabled
  if (text && store.get('autoTranslateClipboard', false)) {
    console.log('Auto-translate clipboard is enabled, sending clipboard text');
    setTimeout(() => {
      if (translationWindow && !translationWindow.isDestroyed()) {
        console.log('Sending clipboard text to translation window');
        translationWindow.webContents.send('set-source-text', text);
      }
    }, 300);
  }
} 