/**
 * Hermes Translator - History UI JavaScript
 * Handles the history UI functionality and communication with the main process
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const historyList = document.getElementById('history-list');
  const emptyHistoryMessage = document.getElementById('empty-history');
  const errorMessage = document.getElementById('errorMessage');
  const closeButton = document.getElementById('close-button');
  const refreshButton = document.getElementById('refresh-button');
  const clearAllButton = document.getElementById('clear-all-button');
  
  // Modal elements
  const deleteModal = document.getElementById('delete-modal');
  const modalClose = document.getElementById('modal-close');
  const cancelDelete = document.getElementById('cancel-delete');
  const confirmDelete = document.getElementById('confirm-delete');
  const confirmDeleteContainer = document.querySelector('.confirm-delete-container');
  const confirmText = document.getElementById('confirm-text');
  
  // History data
  let historyData = [];
  
  /**
   * Initialize the history panel
   */
  function init() {
    setupEventListeners();
    loadHistory();
    
    // Listen for settings changes
    window.api.onSettingsChanged(handleSettingsChanged);
  }
  
  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Close button
    closeButton.addEventListener('click', () => {
      window.api.closeHistory();
    });
    
    // Refresh button
    refreshButton.addEventListener('click', () => {
      loadHistory();
    });
    
    // Clear all button
    clearAllButton.addEventListener('click', () => {
      showDeleteModal();
    });
    
    // Modal close button
    modalClose.addEventListener('click', () => {
      hideDeleteModal();
    });
    
    // Cancel delete button
    cancelDelete.addEventListener('click', () => {
      hideDeleteModal();
    });
    
    // Confirm delete button
    confirmDelete.addEventListener('click', () => {
      if (confirmDeleteContainer.style.display === 'none') {
        // Show the confirmation input
        confirmDeleteContainer.style.display = 'block';
        confirmDelete.textContent = 'Confirm Delete';
      } else {
        // Check if the confirmation text is correct
        if (confirmText.value.toLowerCase() === 'delete') {
          deleteAllHistory();
        } else {
          showError('Please type "delete" to confirm');
        }
      }
    });
    
    // Listen for Enter key in confirmation text
    confirmText.addEventListener('keyup', (event) => {
      if (event.key === 'Enter') {
        if (confirmText.value.toLowerCase() === 'delete') {
          deleteAllHistory();
        } else {
          showError('Please type "delete" to confirm');
        }
      }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
      if (event.target === deleteModal) {
        hideDeleteModal();
      }
    });
  }
  
  /**
   * Handle settings changed event
   * @param {Object} settings - The changed settings
   */
  function handleSettingsChanged(settings) {
    console.log('History window received settings change:', settings);
    
    // Apply theme changes without page reload
    if (settings.darkTheme !== undefined) {
      console.log('Applying theme change to history window:', settings.darkTheme ? 'dark' : 'light');
      try {
        if (settings.darkTheme) {
          document.documentElement.setAttribute('data-theme', 'dark');
        } else {
          document.documentElement.removeAttribute('data-theme');
        }
      } catch (error) {
        console.error('Error applying theme to history window:', error);
      }
    }
  }
  
  /**
   * Load translation history
   */
  async function loadHistory() {
    try {
      historyData = await window.api.getHistory();
      renderHistory();
    } catch (error) {
      console.error('Failed to load history:', error);
      showError('Failed to load history');
    }
  }
  
  /**
   * Render history items
   */
  function renderHistory() {
    // Clear previous items
    historyList.innerHTML = '';
    
    // Show empty message if no history
    if (!historyData || historyData.length === 0) {
      emptyHistoryMessage.style.display = 'flex';
      historyList.style.display = 'none';
      return;
    }
    
    // Hide empty message and show history
    emptyHistoryMessage.style.display = 'none';
    historyList.style.display = 'block';
    
    // Create history item for each entry
    historyData.forEach((item, index) => {
      const historyItem = createHistoryItem(item, index);
      historyList.appendChild(historyItem);
    });
  }
  
  /**
   * Create a history item element
   * @param {Object} item - History item data
   * @param {number} index - Index in the history array
   * @returns {HTMLElement} - The history item element
   */
  function createHistoryItem(item, index) {
    const { originalText, translatedText, sourceLang, targetLang, timestamp } = item;
    
    // Format the timestamp
    const date = new Date(timestamp);
    const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    
    // Create the history item element
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    historyItem.dataset.index = index;
    
    // Create the history item content
    historyItem.innerHTML = `
      <div class="history-item-header">
        <div class="history-item-time">${formattedDate}</div>
        <div class="history-langs">
          <span class="source-lang">${sourceLang}</span>
          <span class="arrow"><i class="fa-solid fa-arrow-right"></i></span>
          <span class="target-lang">${targetLang}</span>
        </div>
      </div>
      
      <div class="history-text original-text">
        <span class="history-text-label">Original:</span>
        ${originalText}
      </div>
      
      <div class="history-text translated-text">
        <span class="history-text-label">Translation:</span>
        ${translatedText}
      </div>
      
      <div class="history-item-actions">
        <button class="history-action-button use-button" data-action="use" title="Use this translation">
          <i class="fa-solid fa-sync-alt"></i> Use
        </button>
        <button class="history-action-button copy-button" data-action="copy" title="Copy translation">
          <i class="fa-solid fa-copy"></i> Copy
        </button>
        <button class="history-action-button delete-button" data-action="delete" title="Delete this item">
          <i class="fa-solid fa-trash-alt"></i> Delete
        </button>
      </div>
    `;
    
    // Add event listeners for the action buttons
    const actionButtons = historyItem.querySelectorAll('.history-action-button');
    actionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        handleHistoryAction(action, index, item);
      });
    });
    
    return historyItem;
  }
  
  /**
   * Handle history item actions
   * @param {string} action - The action to perform (use, copy, delete)
   * @param {number} index - The index of the history item
   * @param {Object} item - The history item data
   */
  function handleHistoryAction(action, index, item) {
    switch (action) {
      case 'use':
        // Set the translation in the translation window
        window.api.useHistoryItem(item);
        break;
        
      case 'copy':
        // Copy the translation to clipboard
        window.api.writeClipboard(item.translatedText);
        showNotification('Translation copied to clipboard');
        break;
        
      case 'delete':
        // Delete the history item
        deleteHistoryItem(index);
        break;
    }
  }
  
  /**
   * Delete a single history item
   * @param {number} index - The index of the history item to delete
   */
  async function deleteHistoryItem(index) {
    try {
      await window.api.deleteHistoryItem(index);
      // Remove the item from the local array
      historyData.splice(index, 1);
      // Re-render the history
      renderHistory();
      showNotification('History item deleted');
    } catch (error) {
      console.error('Failed to delete history item:', error);
      showError('Failed to delete history item');
    }
  }
  
  /**
   * Delete all history
   */
  async function deleteAllHistory() {
    try {
      await window.api.clearHistory();
      // Clear the local array
      historyData = [];
      // Re-render the history
      renderHistory();
      hideDeleteModal();
      showNotification('All history has been deleted');
    } catch (error) {
      console.error('Failed to clear history:', error);
      showError('Failed to clear history');
    }
  }
  
  /**
   * Show the delete confirmation modal
   */
  function showDeleteModal() {
    deleteModal.style.display = 'flex';
    confirmDeleteContainer.style.display = 'none';
    confirmDelete.textContent = 'Delete All';
    confirmText.value = '';
  }
  
  /**
   * Hide the delete confirmation modal
   */
  function hideDeleteModal() {
    deleteModal.style.display = 'none';
  }
  
  /**
   * Show an error message
   * @param {string} message - The error message to show
   */
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
      errorMessage.style.display = 'none';
    }, 3000);
  }
  
  /**
   * Show a notification message
   * @param {string} message - The notification message
   */
  function showNotification(message) {
    // Create a notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // Add to the document
    document.body.appendChild(notification);
    
    // Show the notification
    setTimeout(() => {
      notification.classList.add('show');
    }, 10);
    
    // Hide and remove after 2 seconds
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 2000);
  }
  
  // Initialize the history panel
  init();
}); 