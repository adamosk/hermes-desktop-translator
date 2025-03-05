/**
 * Hermes Translator - Translation UI JavaScript
 * Handles the translation UI functionality and communication with the main process
 */

// DOM elements
const sourceTextArea = document.getElementById('source-text');
const targetTextArea = document.getElementById('target-text');
const sourceLanguageSelect = document.getElementById('source-language');
const targetLanguageSelect = document.getElementById('target-language');
const errorMessageEl = document.getElementById('errorMessage');
const progressBarEl = document.getElementById('progressBar');
const settingsBtn = document.getElementById('settings-button');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');
const clearSourceBtn = document.getElementById('clearSourceBtn');
const clearTargetBtn = document.getElementById('clearTargetBtn');
const pasteBtn = document.getElementById('pasteBtn');
const copySourceBtn = document.getElementById('copy-source');
const copyTargetBtn = document.getElementById('copy-target');
const sourceControlsBar = document.getElementById('sourceControlsBar');
const targetControlsBar = document.getElementById('targetControlsBar');
const translateFromSourceBtn = document.getElementById('translate-from-source');
const translateFromTargetBtn = document.getElementById('translate-from-target');
const sourceCharCount = document.getElementById('source-char-count');
const targetCharCount = document.getElementById('target-char-count');

// App settings
let realTimeTranslation = true;

// Translation timeout and debounce
let translationTimeout = null;
const DEBOUNCE_TIME = 800; // ms

// Direction of last translation
let lastTranslationDirection = 'source-to-target';

/**
 * Initialize the translation page
 */
async function init() {
  // Set up event listeners
  setupEventListeners();
  
  // Set up keyboard shortcuts
  setupKeyboardShortcuts();
  
  // Load settings for language selections
  await loadSettings();
  
  // Load recent language pairs
  await loadRecentLanguagePairs();
  
  // Listen for settings changes
  window.api.onSettingsChanged(handleSettingsChanged);
  
  // Update API usage statistics
  await updateApiUsage();
  
  // Update usage every 5 minutes
  setInterval(updateApiUsage, 5 * 60 * 1000);
  
  // Also update usage after each translation
  sourceTextArea.addEventListener('input', debounce(async () => {
    // Update after a short delay when translation is complete
    setTimeout(updateApiUsage, 1500);
  }, 300));
}

/**
 * Load settings
 */
async function loadSettings() {
  try {
    const settings = await window.api.getSettings();
    
    // Language settings
    if (settings.sourceLanguage) sourceLanguageSelect.value = settings.sourceLanguage;
    if (settings.targetLang) targetLanguageSelect.value = settings.targetLang;
    
    // Other settings
    realTimeTranslation = settings.realTimeTranslation !== false;
    
    // Show/hide translate buttons based on real-time setting
    toggleTranslateButtons(!realTimeTranslation);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

/**
 * Load recent language pairs and add them to the UI
 */
async function loadRecentLanguagePairs() {
  try {
    const recentPairs = await window.api.getRecentLanguagePairs();
    
    if (!recentPairs || recentPairs.length === 0) {
      return;
    }
    
    // Create recent pairs container if it doesn't exist
    let recentPairsContainer = document.getElementById('recent-pairs');
    
    if (!recentPairsContainer) {
      recentPairsContainer = document.createElement('div');
      recentPairsContainer.id = 'recent-pairs';
      recentPairsContainer.className = 'recent-pairs';
      
      // Insert after the translation-container
      const translationContainer = document.querySelector('.translation-container');
      translationContainer.parentNode.insertBefore(recentPairsContainer, translationContainer.nextSibling);
    } else {
      // Clear existing pairs
      recentPairsContainer.innerHTML = '';
    }
    
    // Add heading
    const heading = document.createElement('div');
    heading.className = 'recent-pairs-heading';
    heading.innerHTML = '<i class="fas fa-history"></i> Recent Language Pairs';
    recentPairsContainer.appendChild(heading);
    
    // Add pairs
    const pairsWrapper = document.createElement('div');
    pairsWrapper.className = 'recent-pairs-list';
    
    recentPairs.forEach(pair => {
      const [sourceLang, targetLang] = pair.split(':');
      
      // Get language names from select elements
      const sourceLanguageName = getLanguageNameFromCode(sourceLang, sourceLanguageSelect);
      const targetLanguageName = getLanguageNameFromCode(targetLang, targetLanguageSelect);
      
      const pairButton = document.createElement('button');
      pairButton.className = 'recent-pair-button';
      pairButton.innerHTML = `
        <span class="recent-pair-source">${sourceLanguageName}</span>
        <i class="fas fa-arrow-right"></i>
        <span class="recent-pair-target">${targetLanguageName}</span>
      `;
      
      // Add click handler to select this language pair
      pairButton.addEventListener('click', () => {
        sourceLanguageSelect.value = sourceLang;
        targetLanguageSelect.value = targetLang;
        
        // Translate if there's text in the source
        if (sourceTextArea.value.trim()) {
          translateFromSource();
        }
      });
      
      pairsWrapper.appendChild(pairButton);
    });
    
    recentPairsContainer.appendChild(pairsWrapper);
  } catch (error) {
    console.error('Error loading recent language pairs:', error);
  }
}

/**
 * Get language name from language code using select element
 */
function getLanguageNameFromCode(code, selectElement) {
  for (const option of selectElement.options) {
    if (option.value === code) {
      return option.textContent;
    }
  }
  return code; // Fallback to code if name not found
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Settings button
  settingsBtn.addEventListener('click', toggleSettings);
  
  // History button
  document.getElementById('history-button').addEventListener('click', () => {
    window.api.openHistory();
  });
  
  // About button
  document.getElementById('about-button').addEventListener('click', () => {
    window.api.openAbout();
  });
  
  // Window controls
  minimizeBtn.addEventListener('click', () => window.api.minimizeTranslationWindow());
  closeBtn.addEventListener('click', () => window.api.closeTranslationWindow());
  
  // Text input
  sourceTextArea.addEventListener('input', () => handleTextAreaInput('source'));
  targetTextArea.addEventListener('input', () => handleTextAreaInput('target'));
  
  // Language selectors
  sourceLanguageSelect.addEventListener('change', handleLanguageChange);
  targetLanguageSelect.addEventListener('change', handleLanguageChange);
  
  // Copy buttons
  copySourceBtn.addEventListener('click', () => handleCopy(sourceTextArea));
  copyTargetBtn.addEventListener('click', () => handleCopy(targetTextArea));
  
  // Paste and clear buttons
  pasteBtn.addEventListener('click', () => {
    const clipboardText = window.api.readClipboard();
    if (clipboardText) {
      sourceTextArea.value = clipboardText;
      handleTextAreaInput('source');
    }
  });
  
  clearSourceBtn.addEventListener('click', () => {
    sourceTextArea.value = '';
    errorMessageEl.style.display = 'none';
  });
  
  clearTargetBtn.addEventListener('click', () => {
    targetTextArea.value = '';
  });
  
  // Translate buttons
  translateFromSourceBtn.addEventListener('click', () => {
    const text = sourceTextArea.value.trim();
    if (text) {
      translateText(text, 'source-to-target');
    }
  });
  
  translateFromTargetBtn.addEventListener('click', () => {
    const text = targetTextArea.value.trim();
    if (text) {
      translateText(text, 'target-to-source');
    }
  });
  
  // Listen for translation results
  window.api.on('translation-result', (result) => {
    if (result.error) {
      showError(result.error);
    } else {
      handleTranslationResult(result);
    }
  });
  
  // Listen for source text from main process
  window.api.on('set-source-text', (text) => {
    if (text) {
      handleShortcutText(text);
    }
  });
  
  // Listen for history item use
  window.api.on('set-translation', (data) => {
    handleHistoryItem(data);
  });
}

/**
 * Handle text input in either textarea
 * @param {string} source - Which textarea triggered the input ('source' or 'target')
 */
function handleTextAreaInput(source) {
  // Clear any existing timeout
  if (translationTimeout) {
    clearTimeout(translationTimeout);
  }
  
  const isSource = source === 'source';
  const text = isSource ? sourceTextArea.value.trim() : targetTextArea.value.trim();
  
  // Hide error message when typing
  if (errorMessageEl.style.display !== 'none') {
    errorMessageEl.style.display = 'none';
  }
  
  // If real-time translation is enabled, translate after debounce
  if (realTimeTranslation && text) {
    translationTimeout = setTimeout(() => {
      const direction = isSource ? 'source-to-target' : 'target-to-source';
      translateText(text, direction);
    }, DEBOUNCE_TIME);
  }
}

/**
 * Handle language changes
 */
function handleLanguageChange() {
  console.log('Language changed, saving preferences');
  
  // Save selected languages as permanent settings
  window.api.saveSettings({
    sourceLanguage: sourceLanguageSelect.value,
    targetLang: targetLanguageSelect.value
  });
  
  // Translate again if there's text
  const text = sourceTextArea.value.trim();
  if (text && (realTimeTranslation || lastTranslationDirection === 'source-to-target')) {
    translateText(text, 'source-to-target');
  } else if (targetTextArea.value.trim() && lastTranslationDirection === 'target-to-source') {
    translateText(targetTextArea.value.trim(), 'target-to-source');
  }
}

/**
 * Send text to main process for translation
 * @param {string} text - Text to translate
 * @param {string} direction - Direction of translation ('source-to-target' or 'target-to-source')
 */
async function translateText(text, direction = 'source-to-target') {
  showProgressBar();
  
  // Store last translation direction
  lastTranslationDirection = direction;
  
  try {
    // Determine source and target languages based on direction
    let sourceLang, targetLang;
    
    if (direction === 'source-to-target') {
      sourceLang = sourceLanguageSelect.value || 'auto';
      targetLang = targetLanguageSelect.value;
    } else {
      // For target-to-source, swap the languages
      sourceLang = targetLanguageSelect.value;
      // If source is set to auto, use a specific language for reverse translation
      targetLang = sourceLanguageSelect.value === 'auto' ? 'EN-US' : sourceLanguageSelect.value;
    }
    
    // Send to main process for translation
    const result = await window.api.translateText({
      text,
      sourceLanguage: sourceLang,
      targetLanguage: targetLang
    });
    
    // Handle result based on direction
    handleTranslationResult(result, direction);
  } catch (error) {
    console.error('Translation error:', error);
    handleTranslationError(error);
  } finally {
    hideProgressBar();
  }
}

/**
 * Handle translation result
 * @param {object} result - Translation result from DeepL
 * @param {string} direction - Direction of translation
 */
function handleTranslationResult(result, direction = 'source-to-target') {
  if (result.error) {
    showError(result.error);
    return;
  }
  
  if (direction === 'source-to-target') {
    targetTextArea.value = result.translatedText;
    
    // If source language was auto-detected, update the source language dropdown
    if (sourceLanguageSelect.value === 'auto' && result.detectedLanguage) {
      // Find the option with the detected language code
      const options = Array.from(sourceLanguageSelect.options);
      const detectedOption = options.find(option => 
        option.value.toLowerCase() === result.detectedLanguage.toLowerCase());
      
      if (detectedOption) {
        // Add visual indication of detected language in auto mode
        sourceLanguageSelect.title = `Detected: ${detectedOption.text}`;
      }
    }
  } else {
    // For target to source translation
    sourceTextArea.value = result.translatedText;
  }
}

/**
 * Toggle the visibility of translate buttons based on real-time setting
 * @param {boolean} show - Whether to show the buttons
 */
function toggleTranslateButtons(show) {
  sourceControlsBar.style.display = show ? 'block' : 'none';
  targetControlsBar.style.display = show ? 'block' : 'none';
}

/**
 * Handle text received from global shortcut
 * @param {string} text - Text to translate
 */
function handleShortcutText(text) {
  // Set the text in source area
  sourceTextArea.value = text;
  
  // Translate it
  translateText(text, 'source-to-target');
}

/**
 * Copy text to clipboard
 * @param {HTMLTextAreaElement} textArea - The textarea to copy from
 */
function handleCopy(textArea) {
  const text = textArea.value.trim();
  if (text) {
    window.api.writeClipboard(text);
    
    // Show visual feedback animation
    textArea.classList.add('copy-flash');
    setTimeout(() => textArea.classList.remove('copy-flash'), 500);
    
    // Optional: Show a brief success indicator text on the button
    const button = textArea === sourceTextArea ? copySourceBtn : copyTargetBtn;
    const originalText = button.textContent || button.innerHTML;
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = originalText;
    }, 1000);
  }
}

/**
 * Handle translation errors with more specific messages
 * @param {Error} error - The error that occurred
 */
function handleTranslationError(error) {
  let errorMessage = 'Translation failed.';
  
  if (!navigator.onLine) {
    errorMessage = 'You appear to be offline. Please check your internet connection and try again.';
  } else if (error.message) {
    if (error.message.includes('network')) {
      errorMessage = 'Network error while translating. Please check your internet connection.';
    } else if (error.message.includes('quota')) {
      errorMessage = 'Your DeepL API quota has been exceeded. Please check your usage or upgrade your plan.';
    } else if (error.message.includes('Translator not initialized')) {
      errorMessage = 'Translator not initialized. Please check your API key in settings.';
    } else {
      errorMessage = `Translation error: ${error.message}`;
    }
  }
  
  showError(errorMessage);
  hideProgressBar();
}

/**
 * Show error message with auto-hide after delay
 * @param {string} message - The error message to display
 */
function showError(message) {
  if (!errorMessageEl) return;
  
  errorMessageEl.textContent = message;
  errorMessageEl.style.display = 'block';
  
  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorMessageEl.style.display = 'none';
  }, 5000);
}

/**
 * Show the progress bar
 */
function showProgressBar() {
  progressBarEl.style.display = 'block';
}

/**
 * Hide the progress bar
 */
function hideProgressBar() {
  progressBarEl.style.display = 'none';
}

/**
 * Toggle settings window
 */
function toggleSettings() {
  window.api.openSettings();
}

/**
 * Handle a history item being used
 * @param {Object} data - The history item data
 */
function handleHistoryItem(data) {
  if (!data) return;
  
  const { originalText, translatedText, sourceLang, targetLang } = data;
  
  // Set the source and target texts
  sourceTextArea.value = originalText || '';
  targetTextArea.value = translatedText || '';
  
  // Set the source and target languages if available
  if (sourceLang && sourceLang !== 'auto') {
    sourceLanguageSelect.value = sourceLang;
  }
  
  if (targetLang) {
    targetLanguageSelect.value = targetLang;
  }
}

/**
 * Handle settings changed event
 * @param {Object} settings - The changed settings
 */
function handleSettingsChanged(settings) {
  console.log('Translation window received settings change:', settings);
  
  // Apply theme changes without page reload
  if (settings.darkTheme !== undefined) {
    console.log('Applying theme change to translation window:', settings.darkTheme ? 'dark' : 'light');
    if (settings.darkTheme) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
  
  // Handle other settings updates if needed
  if (settings.realTimeTranslation !== undefined) {
    console.log('Updating realTimeTranslation setting:', settings.realTimeTranslation);
    realTimeTranslation = settings.realTimeTranslation;
    toggleTranslateButtons(!realTimeTranslation);
  }
  
  // Update language settings
  if (settings.sourceLanguage && sourceLanguageSelect.value !== settings.sourceLanguage) {
    console.log('Updating source language:', settings.sourceLanguage);
    sourceLanguageSelect.value = settings.sourceLanguage;
  }
  
  if (settings.targetLang && targetLanguageSelect.value !== settings.targetLang) {
    console.log('Updating target language:', settings.targetLang);
    targetLanguageSelect.value = settings.targetLang;
  }
}

/**
 * Set up keyboard shortcuts and accessibility features
 */
function setupKeyboardShortcuts() {
  // Global keyboard shortcuts for the window
  document.addEventListener('keydown', (event) => {
    // Only handle shortcuts if modifiers are present to avoid interfering with regular typing
    const isModifierKey = event.ctrlKey || event.metaKey;
    
    if (isModifierKey) {
      switch (event.key) {
        // Ctrl+Enter to translate from source
        case 'Enter':
          if (document.activeElement === sourceTextArea) {
            event.preventDefault();
            translateText(sourceTextArea.value, 'source-to-target');
          } else if (document.activeElement === targetTextArea) {
            event.preventDefault();
            translateText(targetTextArea.value, 'target-to-source');
          }
          break;
          
        // Ctrl+1 focus source
        case '1':
          event.preventDefault();
          sourceTextArea.focus();
          break;
          
        // Ctrl+2 focus target
        case '2':
          event.preventDefault();
          targetTextArea.focus();
          break;
          
        // Ctrl+S for settings
        case 's':
          event.preventDefault();
          window.api.openSettings();
          break;
          
        // Ctrl+H for history
        case 'h':
          event.preventDefault();
          window.api.openHistory();
          break;
          
        // Ctrl+C copy active text area
        case 'c':
          // Only handle if nothing is selected (defer to default behavior otherwise)
          if (!window.getSelection().toString()) {
            const activeElement = document.activeElement;
            if (activeElement === sourceTextArea) {
              event.preventDefault();
              handleCopy(sourceTextArea);
            } else if (activeElement === targetTextArea) {
              event.preventDefault();
              handleCopy(targetTextArea);
            }
          }
          break;
      }
    }
    
    // Alt+S to swap languages (no text)
    if (event.altKey && event.key === 's') {
      event.preventDefault();
      swapLanguages();
    }
  });
  
  // Add shortcut for speech recognition (Alt+V)
  document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 'v') {
      e.preventDefault();
      
      // Determine which text area is active or use source by default
      const activeElement = document.activeElement;
      if (activeElement === sourceTextArea) {
        toggleSpeechRecognition(sourceTextArea, document.getElementById('source-mic'));
      } else if (activeElement === targetTextArea) {
        toggleSpeechRecognition(targetTextArea, document.getElementById('target-mic'));
      } else {
        toggleSpeechRecognition(sourceTextArea, document.getElementById('source-mic'));
      }
    }
  });
}

/**
 * Swap source and target languages
 */
function swapLanguages() {
  // Get current values
  const sourceLang = sourceLanguageSelect.value;
  const targetLang = targetLanguageSelect.value;
  
  // Don't swap if source is auto
  if (sourceLang === 'auto') {
    showNotification('Cannot swap when source language is set to Auto-detect');
    return;
  }
  
  // Swap the languages
  sourceLanguageSelect.value = targetLang;
  targetLanguageSelect.value = sourceLang;
  
  // Also swap the text if both have content
  const sourceText = sourceTextArea.value.trim();
  const targetText = targetTextArea.value.trim();
  
  if (sourceText && targetText) {
    sourceTextArea.value = targetText;
    targetTextArea.value = sourceText;
    
    // Update character counts
    updateCharCount(sourceTextArea, sourceCharCount);
    updateCharCount(targetTextArea, targetCharCount);
  }
  
  showNotification('Languages swapped');
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} [type='default'] - The type of notification
 */
function showNotification(message, type = 'default') {
  // Remove any existing notification
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Show notification with animation
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  // Hide and remove after delay
  setTimeout(() => {
    notification.classList.remove('show');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

/**
 * Update character and word count for a textarea
 * @param {HTMLTextAreaElement} textArea - The textarea to count
 * @param {HTMLElement} countElement - The element to display the count
 */
function updateCharCount(textArea, countElement) {
  const text = textArea.value;
  const charCount = text.length;
  
  // Count words (split by whitespace and filter out empty strings)
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  
  countElement.textContent = `${charCount} chars | ${wordCount} words`;
}

/**
 * Display API usage information
 * Shows the current character count, limit, and remaining characters
 */
async function updateApiUsage() {
  try {
    const usage = await window.api.getUsage();
    
    if (usage.error) {
      console.error('Error getting usage:', usage.error);
      return;
    }
    
    if (usage.character) {
      const remaining = usage.character.remaining;
      const usageThreshold = 1000; // Only show if below 1K characters
      
      // Get or create the usage info element
      let usageElement = document.getElementById('api-usage');
      
      // If remaining characters are below threshold, show warning
      if (remaining < usageThreshold) {
        if (!usageElement) {
          usageElement = document.createElement('div');
          usageElement.id = 'api-usage';
          usageElement.className = 'api-usage warning';
          
          // Insert before the window controls
          const windowControls = document.querySelector('.window-controls');
          if (windowControls) {
            windowControls.parentNode.insertBefore(usageElement, windowControls);
          }
        }
        
        // Format numbers with commas
        const formattedRemaining = remaining.toLocaleString();
        
        // Show the usage data
        usageElement.innerHTML = `<span title="DeepL API Usage Warning: Only ${formattedRemaining} characters left">
          <i class="far fa-exclamation-triangle"></i> ${formattedRemaining}
        </span>`;
        
        // Make sure it's visible and has warning class
        usageElement.style.display = 'flex';
        usageElement.classList.add('warning');
      } else {
        // If element exists but we're above threshold, hide it
        if (usageElement) {
          usageElement.style.display = 'none';
        }
      }
    }
  } catch (error) {
    console.error('Failed to get API usage:', error);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', init); 