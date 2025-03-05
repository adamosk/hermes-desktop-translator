/**
 * Hermes Translator - Settings UI JavaScript
 * Handles the settings UI functionality and communication with the main process
 */

// DOM elements
let apiKeyInput;
let shortcutInput;
let recordShortcutBtn;
let saveBtn;
let closeSettingsBtn;
let alertEl;
let minimizeToTrayCheckbox;
let minimizeToTrayOnEscCheckbox;
let closeOnFocusLossCheckbox;
let autoTranslateClipboardCheckbox;
let realTimeTranslationCheckbox;
let showTrayNotificationsCheckbox;
let saveHistoryCheckbox;
let clearHistoryLink;
let darkThemeCheckbox;

// Shortcut recording state
let isRecordingShortcut = false;

// Store original API key to check for changes later
let originalApiKey = '';

/**
 * Initialize the settings page
 */
function init() {
  // Get DOM elements
  apiKeyInput = document.getElementById('apiKey');
  shortcutInput = document.getElementById('shortcut');
  recordShortcutBtn = document.getElementById('recordShortcutBtn');
  saveBtn = document.getElementById('saveBtn');
  closeSettingsBtn = document.getElementById('closeSettingsBtn');
  alertEl = document.getElementById('alert');
  minimizeToTrayCheckbox = document.getElementById('minimizeToTray');
  minimizeToTrayOnEscCheckbox = document.getElementById('minimizeToTrayOnEsc');
  closeOnFocusLossCheckbox = document.getElementById('closeOnFocusLoss');
  autoTranslateClipboardCheckbox = document.getElementById('autoTranslateClipboard');
  realTimeTranslationCheckbox = document.getElementById('realTimeTranslation');
  showTrayNotificationsCheckbox = document.getElementById('showTrayNotifications');
  saveHistoryCheckbox = document.getElementById('saveHistory');
  clearHistoryLink = document.getElementById('clearHistoryLink');
  darkThemeCheckbox = document.getElementById('darkTheme');
  
  // Set up event listeners
  setupEventListeners();
  
  // Load initial settings
  loadSettings();
  
  // Display API usage info
  displayApiUsage();
}

/**
 * Apply theme based on settings
 */
function applyTheme(isDarkTheme) {
  console.log('Applying theme:', isDarkTheme ? 'dark' : 'light');
  if (isDarkTheme) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

/**
 * Load and apply settings from the main process
 */
async function loadSettings() {
  try {
    const settings = await window.api.getSettings();
    
    // Apply settings to form elements
    apiKeyInput.value = settings.apiKey || '';
    shortcutInput.value = settings.shortcut || '';
    minimizeToTrayCheckbox.checked = settings.minimizeToTray || false;
    minimizeToTrayOnEscCheckbox.checked = settings.minimizeToTrayOnEsc || false;
    closeOnFocusLossCheckbox.checked = settings.closeOnFocusLoss || false;
    autoTranslateClipboardCheckbox.checked = settings.autoTranslateClipboard || false;
    realTimeTranslationCheckbox.checked = settings.realTimeTranslation || false;
    showTrayNotificationsCheckbox.checked = settings.showTrayNotifications || false;
    saveHistoryCheckbox.checked = settings.saveHistory || false;
    darkThemeCheckbox.checked = settings.darkTheme || false;
    
    // Store original API key to check for changes later
    originalApiKey = settings.apiKey || '';
    
    // Update minimizeToTrayOnEsc disabled state
    updateMinimizeToTrayOnEscState();
    
    return settings;
  } catch (error) {
    console.error('Error loading settings:', error);
    showAlert('Error loading settings', 'error');
    return {};
  }
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Settings saved response
  window.api.on('settings-saved', handleSettingsSaved);
  
  // Save button click
  saveBtn.addEventListener('click', handleSave);
  
  // Close button click
  closeSettingsBtn.addEventListener('click', function(e) {
    console.log('Close button clicked');
    handleClose();
  });
  
  // Shortcut recording
  recordShortcutBtn.addEventListener('click', startRecordingShortcut);
  
  // Listen for key combinations when recording shortcut
  document.addEventListener('keydown', handleShortcutRecording);
  
  // Clear history link
  clearHistoryLink.addEventListener('click', handleClearHistory);
  
  // Dark theme toggle - apply immediately for preview
  darkThemeCheckbox.addEventListener('change', function(e) {
    console.log('Dark theme checkbox changed:', this.checked);
    applyTheme(this.checked);
  });
  
  // Add minimizeToTray change listener to update the state of minimizeToTrayOnEsc
  minimizeToTrayCheckbox.addEventListener('change', function() {
    console.log(`Toggle ${this.id} changed to:`, this.checked);
    updateMinimizeToTrayOnEscState();
  });
  
  // Setup debugging for toggle inputs
  const toggles = document.querySelectorAll('input[type="checkbox"]');
  toggles.forEach(toggle => {
    toggle.addEventListener('change', function() {
      console.log(`Toggle ${this.id} changed to:`, this.checked);
    });
    
    // Ensure the toggle is clickable
    toggle.addEventListener('click', function(e) {
      console.log(`Toggle ${this.id} clicked`);
      // Don't stop propagation - this would interfere with the change event
    });
  });
}

/**
 * Start recording a shortcut
 */
function startRecordingShortcut() {
  if (isRecordingShortcut) {
    stopRecordingShortcut();
    return;
  }
  
  isRecordingShortcut = true;
  recordShortcutBtn.textContent = 'Cancel';
  recordShortcutBtn.classList.add('recording');
  shortcutInput.value = 'Press a key combination...';
  showAlert('Press the key combination you want to use as a shortcut', 'info');
}

/**
 * Stop recording a shortcut
 */
function stopRecordingShortcut() {
  isRecordingShortcut = false;
  recordShortcutBtn.textContent = 'Record';
  recordShortcutBtn.classList.remove('recording');
}

/**
 * Handle keydown events when recording a shortcut
 */
function handleShortcutRecording(event) {
  if (!isRecordingShortcut) return;
  
  // Ignore standalone modifier keys
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) {
    return;
  }
  
  // Prevent default behavior
  event.preventDefault();
  
  // Build shortcut string
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Meta');
  
  // Require at least one modifier
  if (modifiers.length === 0) {
    showAlert('Shortcut must include at least one modifier key (Ctrl, Alt, Shift)', 'error');
    return;
  }
  
  // Check for reserved system shortcuts
  const key = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const shortcut = [...modifiers, key].join('+');
  
  // List of known dangerous shortcuts to prevent
  const dangerousShortcuts = [
    'Control+W', 'Control+Q', 'Alt+F4', 'Control+Alt+Delete',
    'Control+Shift+Escape', 'F1', 'Control+Tab', 'Alt+Tab'
  ];
  
  if (dangerousShortcuts.includes(shortcut)) {
    showAlert('This shortcut is reserved by the system or may cause issues', 'error');
    return;
  }
  
  // Set the shortcut
  shortcutInput.value = shortcut;
  
  // Stop recording
  stopRecordingShortcut();
  showAlert(`Shortcut set to: ${shortcut}`, 'success');
}

/**
 * Handle save button click
 */
async function handleSave() {
  console.log('Save button clicked');
  
  const apiKey = apiKeyInput.value.trim();
  const shortcut = shortcutInput.value.trim();
  
  // Validate inputs
  if (!apiKey) {
    return showAlert('API key is required', 'error');
  }
  
  if (!shortcut) {
    return showAlert('Shortcut is required', 'error');
  }
  
  // Show loading indicator
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    // Validate API key first
    const isValid = await validateApiKey(apiKey);
    
    if (!isValid) {
      throw new Error('Invalid API key. Please check and try again.');
    }
    
    // Save settings to main process
    await window.api.saveSettings({
      apiKey,
      shortcut,
      minimizeToTray: minimizeToTrayCheckbox.checked,
      minimizeToTrayOnEsc: minimizeToTrayOnEscCheckbox.checked,
      closeOnFocusLoss: closeOnFocusLossCheckbox.checked,
      autoTranslateClipboard: autoTranslateClipboardCheckbox.checked,
      realTimeTranslation: realTimeTranslationCheckbox.checked,
      showTrayNotifications: showTrayNotificationsCheckbox.checked,
      saveHistory: saveHistoryCheckbox.checked,
      darkTheme: darkThemeCheckbox.checked
    });
    
    // Set a fallback timeout in case we don't receive the settings-saved event
    setTimeout(() => {
      // If button is still showing "Saving...", assume success but event was missed
      if (saveBtn.textContent === 'Saving...') {
        console.log('Fallback: settings-saved event not received, handling manually');
        handleSettingsSaved();
      }
    }, 2000);
    
    // Alert will be shown by the handler when we get confirmation
  } catch (error) {
    console.error('Error saving settings:', error);
    showAlert(error.message || 'Failed to save settings', 'error');
    
    // Reset button
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Settings';
  }
}

/**
 * Handle close button click
 */
function handleClose() {
  console.log('Close button clicked');
  window.api.closeSettings();
}

/**
 * Handle settings saved response from main process
 */
function handleSettingsSaved() {
  console.log('Settings saved successfully');
  showAlert('Settings saved successfully!', 'success');
  
  // Reset button
  saveBtn.disabled = false;
  saveBtn.textContent = 'Save Settings';
  
  // Close settings after a delay
  setTimeout(() => {
    console.log('Closing settings window after successful save');
    window.api.closeSettings();
  }, 1500);
}

/**
 * Show alert message
 * @param {string} message - The message to show
 * @param {string} type - The type of alert (success, error, info)
 */
function showAlert(message, type = 'info') {
  alertEl.textContent = message;
  alertEl.className = 'alert ' + type;
  alertEl.style.display = 'block';
  
  // Auto hide after 5 seconds
  setTimeout(() => {
    alertEl.style.display = 'none';
  }, 5000);
}

/**
 * Handle clear history button click
 */
function handleClearHistory(event) {
  event.preventDefault();
  
  // Confirm before clearing
  const confirmClear = window.confirm('Are you sure you want to clear all translation history? This action cannot be undone.');
  
  if (confirmClear) {
    // Ask user to type "delete" to confirm
    const confirmInput = window.prompt('Type "delete" to confirm clearing all history');
    
    if (confirmInput && confirmInput.toLowerCase() === 'delete') {
      clearHistory();
    } else if (confirmInput !== null) {
      showAlert('History clearing cancelled. You must type "delete" to confirm.', 'info');
    }
  }
}

/**
 * Clear all history
 */
async function clearHistory() {
  try {
    await window.api.clearHistory();
    showAlert('Translation history has been cleared.', 'success');
  } catch (error) {
    console.error('Error clearing history:', error);
    showAlert('Failed to clear history', 'error');
  }
}

/**
 * Validate the API key
 */
async function validateApiKey(apiKey) {
  if (!apiKey) {
    showAlert('Please enter an API key', 'error');
    return false;
  }
  
  try {
    showAlert('Validating API key...', 'info');
    const isValid = await window.api.validateApiKey(apiKey);
    
    if (isValid) {
      showAlert('API key is valid!', 'success');
      return true;
    } else {
      showAlert('Invalid API key. Please check that you entered it correctly.', 'error');
      return false;
    }
  } catch (error) {
    if (error.message && error.message.includes('network')) {
      showAlert('Network error while validating API key. Please check your internet connection.', 'error');
    } else if (error.message && error.message.includes('quota')) {
      showAlert('Your DeepL API quota has been exceeded. Please check your usage or upgrade your plan.', 'error');
    } else {
      showAlert(`Error validating API key: ${error.message || 'Unknown error'}`, 'error');
    }
    return false;
  }
}

/**
 * Save settings to the main process
 */
async function saveSettings() {
  try {
    // Disable save button while saving
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    // Build settings object
    const settings = {
      apiKey: apiKeyInput.value.trim(),
      shortcut: shortcutInput.value,
      minimizeToTray: minimizeToTrayCheckbox.checked,
      minimizeToTrayOnEsc: minimizeToTrayOnEscCheckbox.checked,
      closeOnFocusLoss: closeOnFocusLossCheckbox.checked,
      autoTranslateClipboard: autoTranslateClipboardCheckbox.checked,
      realTimeTranslation: realTimeTranslationCheckbox.checked,
      showTrayNotifications: showTrayNotificationsCheckbox.checked,
      saveHistory: saveHistoryCheckbox.checked,
      darkTheme: darkThemeCheckbox.checked
    };
    
    // Validate API key first
    if (settings.apiKey && settings.apiKey !== originalApiKey) {
      const isValid = await validateApiKey(settings.apiKey);
      
      if (!isValid) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Settings';
        return;
      }
    }
    
    // Save settings
    const result = await window.api.saveSettings(settings);
    
    if (result.success) {
      showAlert('Settings saved successfully', 'success');
      
      // Update original API key to detect future changes
      originalApiKey = settings.apiKey;
      
      setTimeout(() => {
        window.api.closeSettings();
      }, 1500);
    } else {
      throw new Error(result.error || 'Failed to save settings');
    }
  } catch (error) {
    console.error('Error saving settings:', error);
    showAlert(`Error saving settings: ${error.message}`, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Settings';
  }
}

/**
 * Update the disabled state of minimizeToTrayOnEsc checkbox
 * This should be disabled if minimizeToTray is unchecked
 */
function updateMinimizeToTrayOnEscState() {
  console.log('Updating minimizeToTrayOnEsc state');
  if (minimizeToTrayCheckbox && minimizeToTrayOnEscCheckbox) {
    // Disable "Minimize to tray when ESC pressed" if "Minimize to tray" is unchecked
    minimizeToTrayOnEscCheckbox.disabled = !minimizeToTrayCheckbox.checked;
    
    // Add visual indication for disabled state
    const container = minimizeToTrayOnEscCheckbox.closest('.setting-item');
    if (container) {
      if (minimizeToTrayOnEscCheckbox.disabled) {
        container.classList.add('disabled');
      } else {
        container.classList.remove('disabled');
      }
    }
  }
}

/**
 * Display API usage information in the settings
 */
async function displayApiUsage() {
  try {
    // Try to get API usage info
    const usage = await window.api.getUsage();
    
    if (usage.error) {
      console.error('Error getting API usage:', usage.error);
      return;
    }
    
    if (usage.character) {
      // Get the dedicated container for API usage
      const usageContainer = document.getElementById('api-usage-container');
      
      if (!usageContainer) {
        console.error('API usage container not found');
        return;
      }
      
      // Format numbers for display
      const used = usage.character.count.toLocaleString();
      const total = usage.character.limit.toLocaleString();
      const remaining = usage.character.remaining.toLocaleString();
      const percent = usage.character.percent.toFixed(1);
      
      // Create a progress bar
      const progressClass = usage.character.percent > 90 ? 'warning' : 
                          usage.character.percent > 75 ? 'caution' : 'normal';
      
      // Update the content
      usageContainer.innerHTML = `
        <div class="usage-stats">
          <div class="usage-text">
            <span class="usage-label">Characters used:</span>
            <span class="usage-value">${used} of ${total} (${percent}%)</span>
          </div>
          <div class="usage-text">
            <span class="usage-label">Characters remaining:</span>
            <span class="usage-value ${progressClass}">${remaining}</span>
          </div>
          <div class="usage-progress-container">
            <div class="usage-progress-bar ${progressClass}" style="width: ${Math.min(100, usage.character.percent)}%"></div>
          </div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Failed to display API usage:', error);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 