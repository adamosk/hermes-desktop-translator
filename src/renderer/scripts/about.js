/**
 * Hermes Translator - About UI JavaScript
 * Handles the about page functionality and system information display
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const closeButton = document.getElementById('closeAboutBtn');
  const versionDisplay = document.getElementById('app-version');
  const osInfoDisplay = document.getElementById('os-info');
  const electronVersionDisplay = document.getElementById('electron-version');
  const nodeVersionDisplay = document.getElementById('node-version');
  const licenseLink = document.getElementById('license-link');
  const githubLink = document.getElementById('github-link');
  
  /**
   * Initialize the about page
   */
  function init() {
    // Set up event listeners
    setupEventListeners();
    
    // Load application and system info from the main process
    loadSystemInfo();
  }
  
  /**
   * Set up all event listeners
   */
  function setupEventListeners() {
    // Close button
    closeButton.addEventListener('click', () => {
      window.api.closeAbout();
    });
    
    // License link
    licenseLink.addEventListener('click', (event) => {
      event.preventDefault();
      openExternalLink('https://github.com/adamosk/hermes-desktop-translator/blob/main/LICENSE');
    });
    
    // GitHub link
    githubLink.addEventListener('click', (event) => {
      event.preventDefault();
      openExternalLink('https://github.com/adamosk/hermes-desktop-translator');
    });
    
    // External links
    document.querySelectorAll('.external-link').forEach(link => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        const url = event.currentTarget.getAttribute('data-url');
        if (url) {
          openExternalLink(url);
        }
      });
    });
    
    // Handle keyboard events
    document.addEventListener('keydown', (event) => {
      // Close on Escape
      if (event.key === 'Escape') {
        window.api.closeAbout();
      }
    });
  }
  
  /**
   * Open an external link in the default browser
   * @param {string} url - The URL to open
   */
  function openExternalLink(url) {
    if (!url) return;
    
    console.log('Opening external URL:', url);
    try {
      window.api.openExternal(url)
        .then(result => {
          if (!result || !result.success) {
            console.error('Failed to open URL:', result?.error || 'Unknown error');
          }
        })
        .catch(error => {
          console.error('Error opening URL:', error);
        });
    } catch (error) {
      console.error('Exception opening URL:', error);
    }
  }
  
  /**
   * Load system information from the main process
   */
  async function loadSystemInfo() {
    try {
      // Get system info from the main process
      const sysInfo = await window.api.getSystemInfo();
      
      // Update the displayed version
      if (sysInfo.appVersion) {
        versionDisplay.textContent = sysInfo.appVersion;
      }
      
      // Update OS info
      if (sysInfo.os) {
        osInfoDisplay.textContent = sysInfo.os;
      }
      
      // Update Electron version
      if (sysInfo.electronVersion) {
        electronVersionDisplay.textContent = sysInfo.electronVersion;
      }
      
      // Update Node.js version
      if (sysInfo.nodeVersion) {
        nodeVersionDisplay.textContent = sysInfo.nodeVersion;
      }
    } catch (error) {
      console.error('Failed to load system information:', error);
    }
  }
  
  // Initialize when DOM is loaded
  init();
}); 