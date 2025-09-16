import Logger from './logger';

// Simplified browser security feature requirements
interface BrowserSecurityFeatures {
  crypto: boolean;
  storage: boolean;
  https: boolean;
  basicJS: boolean;
}

// Simplified browser compatibility error types
interface BrowserCompatibilityError {
  feature: string;
  message: string;
  severity: 'critical' | 'warning';
}

// Simplified browser security checker class
export class BrowserSecurity {
  private static readonly MIN_CHROME_VERSION = 80;  // More reasonable
  private static readonly MIN_FIREFOX_VERSION = 75; // More reasonable
  private static readonly MIN_SAFARI_VERSION = 13;  // More reasonable
  private static readonly MIN_EDGE_VERSION = 80;    // More reasonable

  // Check only essential security features
  static checkSecurityFeatures(): BrowserSecurityFeatures {
    const features: BrowserSecurityFeatures = {
      crypto: this.checkCryptoSupport(),
      storage: this.checkStorageSupport(),
      https: this.checkHttpsSupport(),
      basicJS: this.checkBasicJSSupport()
    };

    Logger.info('Browser security features check:', features);
    return features;
  }

  // Check if crypto APIs are available (essential for your app)
  private static checkCryptoSupport(): boolean {
    try {
      return !!(window.crypto && 
                window.crypto.subtle && 
                window.crypto.getRandomValues);
    } catch (error) {
      Logger.warn('Crypto API check failed:', error);
      return false;
    }
  }

  // Check if secure storage is available (essential for your app)
  private static checkStorageSupport(): boolean {
    try {
      return !!(window.sessionStorage && 
                typeof window.sessionStorage.setItem === 'function');
    } catch (error) {
      Logger.warn('Storage API check failed:', error);
      return false;
    }
  }

  // Check if HTTPS is enforced (more lenient)
  private static checkHttpsSupport(): boolean {
    // Allow localhost for development
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      return true;
    }
    return location.protocol === 'https:';
  }

  // Check basic JavaScript features (very lenient)
  private static checkBasicJSSupport(): boolean {
    try {
      return !!(window.Promise && 
                window.Array && 
                window.Object);
    } catch (error) {
      Logger.warn('Basic JS features check failed:', error);
      return false;
    }
  }

  // Get browser information
  static getBrowserInfo(): { name: string; version: string; userAgent: string } {
    const userAgent = navigator.userAgent;
    let name = 'Unknown';
    let version = 'Unknown';

    // Detect browser and version
    if (userAgent.includes('Chrome')) {
      name = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Firefox')) {
      name = 'Firefox';
      const match = userAgent.match(/Firefox\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      name = 'Safari';
      const match = userAgent.match(/Version\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    } else if (userAgent.includes('Edge')) {
      name = 'Edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    }

    return { name, version, userAgent };
  }

  // Check if browser version meets minimum requirements (more lenient)
  static checkBrowserVersion(): boolean {
    const { name, version } = this.getBrowserInfo();
    const versionNum = parseInt(version, 10);

    if (isNaN(versionNum)) {
      Logger.warn('Could not determine browser version - allowing access');
      return true; // Allow if we can't determine version
    }

    const minVersions: Record<string, number> = {
      Chrome: this.MIN_CHROME_VERSION,
      Firefox: this.MIN_FIREFOX_VERSION,
      Safari: this.MIN_SAFARI_VERSION,
      Edge: this.MIN_EDGE_VERSION
    };

    const minVersion = minVersions[name];
    if (!minVersion) {
      Logger.warn(`Unknown browser: ${name}, allowing access`);
      return true; // Allow unknown browsers
    }

    const isSupported = versionNum >= minVersion;
    Logger.info(`Browser version check: ${name} ${version} (min: ${minVersion}) - ${isSupported ? 'PASS' : 'WARNING'}`);
    
    return isSupported;
  }

  // Get simplified compatibility errors (much fewer)
  static getCompatibilityErrors(): BrowserCompatibilityError[] {
    const features = this.checkSecurityFeatures();
    const errors: BrowserCompatibilityError[] = [];

    // Only check essential features
    if (!features.crypto) {
      errors.push({
        feature: 'Crypto API',
        message: 'Your browser does not support encryption features. Some security features may not work properly.',
        severity: 'critical'
      });
    }

    if (!features.storage) {
      errors.push({
        feature: 'Secure Storage',
        message: 'Your browser does not support secure storage. API keys may not be saved properly.',
        severity: 'critical'
      });
    }

    // HTTPS is now a warning, not critical
    if (!features.https) {
      errors.push({
        feature: 'HTTPS Connection',
        message: 'You are not using a secure connection. For better security, use HTTPS.',
        severity: 'warning'
      });
    }

    // Basic JS is very lenient
    if (!features.basicJS) {
      errors.push({
        feature: 'JavaScript Support',
        message: 'Your browser has limited JavaScript support. The app may not work properly.',
        severity: 'warning'
      });
    }

    // Browser version is now a warning, not critical
    if (!this.checkBrowserVersion()) {
      const { name, version } = this.getBrowserInfo();
      errors.push({
        feature: 'Browser Version',
        message: `Your ${name} browser (version ${version}) is older than recommended. Consider updating for better security and performance.`,
        severity: 'warning'
      });
    }

    return errors;
  }

  // Check if browser is compatible (much more lenient)
  static isCompatible(): boolean {
    const errors = this.getCompatibilityErrors();
    // Only block if critical features are missing
    const criticalErrors = errors.filter(error => error.severity === 'critical');
    return criticalErrors.length === 0;
  }

  // Initialize browser security checks (simplified)
  static initialize(): boolean {
    Logger.info('Initializing simplified browser security checks...');
    
    const { name, version } = this.getBrowserInfo();
    Logger.info(`Browser detected: ${name} ${version}`);
    
    const features = this.checkSecurityFeatures();
    Logger.info('Security features status:', features);
    
    const isCompatible = this.isCompatible();
    
    if (!isCompatible) {
      Logger.warn('Browser has some compatibility issues (but app will still work)');
      const errors = this.getCompatibilityErrors();
      Logger.warn('Compatibility warnings:', errors);
    } else {
      Logger.info('Browser compatibility check passed');
    }
    
    return isCompatible;
  }
}

// Export convenience functions
export const checkBrowserSecurity = () => BrowserSecurity.initialize();
export const getBrowserInfo = () => BrowserSecurity.getBrowserInfo();
export const getCompatibilityErrors = () => BrowserSecurity.getCompatibilityErrors();
export const isBrowserCompatible = () => BrowserSecurity.isCompatible(); 