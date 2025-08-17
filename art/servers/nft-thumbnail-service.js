/**
 * NFT Thumbnail Service
 * Provides API to capture thumbnails from the deterministic animation after 30 seconds
 */

class NFTThumbnailService {
  constructor() {
    this.thumbnails = new Map(); // Store thumbnails by seed/botId combination
    this.callbackQueue = new Map(); // Queue callbacks waiting for thumbnails
  }

  /**
   * Request thumbnail for a specific seed and bot ID
   * Returns promise that resolves when thumbnail is ready (after 30 seconds)
   */
  async requestThumbnail(seed, botId, seriesId = 1) {
    const key = `${seed}-${botId}-${seriesId}`;
    
    // Return existing thumbnail if already captured
    if (this.thumbnails.has(key)) {
      return this.thumbnails.get(key);
    }

    // Return promise that will resolve when thumbnail is ready
    return new Promise((resolve, reject) => {
      // Store callback for this request
      this.callbackQueue.set(key, { resolve, reject, timestamp: Date.now() });
      
      // Open the deterministic-full.html with specific parameters
      this.initializeThumbnailCapture(seed, botId, seriesId, key);
    });
  }

  /**
   * Initialize the thumbnail capture process
   */
  initializeThumbnailCapture(seed, botId, seriesId, key) {
    // This would typically open the deterministic-full.html in a headless browser
    // For demo purposes, we'll show how to integrate with the existing page
    console.log(`Starting thumbnail capture for seed: ${seed}, bot: ${botId}, series: ${seriesId}`);
    
    // Set a timeout to check for completion
    setTimeout(() => {
      this.checkThumbnailStatus(key);
    }, 31000); // Check after 31 seconds (30s + buffer)
  }

  /**
   * Check if thumbnail is ready
   */
  checkThumbnailStatus(key) {
    const callback = this.callbackQueue.get(key);
    if (!callback) return;

    // In a real implementation, this would check the iframe or headless browser
    // For now, we'll simulate the thumbnail data
    const thumbnailData = this.simulateThumbnailCapture(key);
    
    if (thumbnailData) {
      this.thumbnails.set(key, thumbnailData);
      callback.resolve(thumbnailData);
      this.callbackQueue.delete(key);
    } else {
      callback.reject(new Error('Thumbnail capture failed'));
      this.callbackQueue.delete(key);
    }
  }

  /**
   * Simulate thumbnail capture (replace with actual iframe communication)
   */
  simulateThumbnailCapture(key) {
    // In real implementation, this would communicate with the iframe
    // containing deterministic-full.html to get the actual thumbnail
    return {
      data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // placeholder
      key: key,
      capturedAt: Date.now(),
      metadata: {
        seed: key.split('-')[0],
        botId: parseInt(key.split('-')[1]),
        seriesId: parseInt(key.split('-')[2])
      }
    };
  }

  /**
   * Integration with existing deterministic-full.html page
   */
  static integrateWithExistingPage() {
    // This function would be called from deterministic-full.html
    // when the thumbnail is captured
    window.addEventListener('message', (event) => {
      if (event.data.type === 'THUMBNAIL_CAPTURED') {
        const { seed, botId, seriesId, thumbnailData } = event.data;
        const key = `${seed}-${botId}-${seriesId}`;
        
        // Store thumbnail and resolve any waiting promises
        if (window.nftThumbnailService) {
          const callback = window.nftThumbnailService.callbackQueue.get(key);
          if (callback) {
            window.nftThumbnailService.thumbnails.set(key, {
              data: thumbnailData,
              key: key,
              capturedAt: Date.now(),
              metadata: { seed, botId, seriesId }
            });
            callback.resolve(window.nftThumbnailService.thumbnails.get(key));
            window.nftThumbnailService.callbackQueue.delete(key);
          }
        }
      }
    });
  }

  /**
   * Get thumbnail dimensions (standardized for NFT)
   */
  getThumbnailDimensions() {
    return {
      width: 512,
      height: 512,
      format: 'PNG'
    };
  }

  /**
   * Convert thumbnail to different formats
   */
  convertThumbnail(thumbnailData, format = 'PNG') {
    // Implementation would handle format conversion
    return thumbnailData; // For now, return as-is
  }

  /**
   * Validate thumbnail data
   */
  validateThumbnail(thumbnailData) {
    if (!thumbnailData || !thumbnailData.data) {
      return false;
    }
    
    // Check if it's a valid data URL
    return thumbnailData.data.startsWith('data:image/');
  }

  /**
   * Get all captured thumbnails
   */
  getAllThumbnails() {
    return Array.from(this.thumbnails.entries()).map(([key, data]) => ({
      key,
      ...data
    }));
  }

  /**
   * Clear old thumbnails (cleanup)
   */
  clearOldThumbnails(maxAge = 24 * 60 * 60 * 1000) { // 24 hours default
    const now = Date.now();
    for (const [key, data] of this.thumbnails.entries()) {
      if (now - data.capturedAt > maxAge) {
        this.thumbnails.delete(key);
      }
    }
  }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NFTThumbnailService;
} else if (typeof window !== 'undefined') {
  window.NFTThumbnailService = NFTThumbnailService;
  window.nftThumbnailService = new NFTThumbnailService();
  NFTThumbnailService.integrateWithExistingPage();
}