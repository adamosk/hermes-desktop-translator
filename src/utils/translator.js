/**
 * DeepL Translation Utility
 * Handles interaction with the DeepL API
 */

const deepl = require('deepl-node');

class Translator {
  /**
   * Create a new translator instance
   * @param {string} apiKey - DeepL API key
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('API key is required');
    }
    
    try {
      this.translator = new deepl.Translator(apiKey);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize DeepL translator:', error);
      this.isInitialized = false;
      throw error;
    }
  }
  
  /**
   * Translate text using DeepL API
   * @param {string} text - Text to translate
   * @param {string} sourceLang - Source language code (or 'auto' for auto-detection)
   * @param {string} targetLang - Target language code
   * @returns {Promise<object>} - Translation result
   */
  async translate(text, sourceLang = 'auto', targetLang) {
    if (!this.isInitialized) {
      throw new Error('Translator not initialized');
    }
    
    if (!text || !targetLang) {
      throw new Error('Text and target language are required');
    }
    
    try {
      // Convert auto or empty string to null for DeepL API
      const sourceLanguage = !sourceLang || sourceLang === 'auto' ? null : sourceLang;
      
      // Perform translation
      const result = await this.translator.translateText(text, sourceLanguage, targetLang);
      
      return {
        text: result.text,
        detectedSourceLang: result.detectedSourceLang,
        originalText: text
      };
    } catch (error) {
      console.error('DeepL API error:', error);
      throw new Error(`DeepL API error: ${error.message}`);
    }
  }
  
  /**
   * Get supported languages from DeepL API
   * @returns {Promise<Array>} - List of supported languages
   */
  async getSupportedLanguages() {
    if (!this.isInitialized) {
      throw new Error('Translator not initialized');
    }
    
    try {
      return await this.translator.getSourceLanguages();
    } catch (error) {
      console.error('Failed to get supported languages:', error);
      throw error;
    }
  }

  /**
   * Get API usage information from DeepL
   * @returns {Promise<Object>} - Usage information including character count and limit
   */
  async getUsage() {
    if (!this.isInitialized) {
      throw new Error('Translator not initialized');
    }
    
    try {
      const usage = await this.translator.getUsage();
      
      return {
        character: usage.character ? {
          count: usage.character.count,
          limit: usage.character.limit,
          percent: usage.character.count / usage.character.limit * 100,
          remaining: usage.character.limit - usage.character.count
        } : null,
        limitReached: usage.anyLimitReached()
      };
    } catch (error) {
      console.error('Failed to get usage information:', error);
      throw new Error(`DeepL API usage error: ${error.message}`);
    }
  }

  /**
   * Validate API key by attempting to get supported languages
   * @param {string} apiKey - DeepL API key to validate
   * @returns {Promise<boolean>} - True if valid, false otherwise
   */
  static async validateApiKey(apiKey) {
    if (!apiKey) {
      return false;
    }
    
    try {
      // Create a temporary translator instance
      const tempTranslator = new deepl.Translator(apiKey);
      
      // Try to get languages - this will fail if the API key is invalid
      await tempTranslator.getSourceLanguages();
      
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      return false;
    }
  }
}

module.exports = Translator; 