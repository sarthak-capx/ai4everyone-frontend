// Production-safe logger utility
class Logger {
  private static isProduction = process.env.NODE_ENV === 'production';

  static info(message: string, data?: any) {
    if (!this.isProduction) {
      if (data) {
        console.log(`[INFO] ${message}`, data);
      } else {
        console.log(`[INFO] ${message}`);
      }
    }
  }

  static warn(message: string, data?: any) {
    if (!this.isProduction) {
      if (data) {
        console.warn(`[WARN] ${message}`, data);
      } else {
        console.warn(`[WARN] ${message}`);
      }
    }
  }

  static error(message: string, error?: any) {
    // Always log errors, even in production
    if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  }

  static debug(message: string, data?: any) {
    if (!this.isProduction) {
      if (data) {
        console.log(`[DEBUG] ${message}`, data);
      } else {
        console.log(`[DEBUG] ${message}`);
      }
    }
  }

  // Disable all console logging in production
  static disableInProduction() {
    if (this.isProduction) {
      console.log = () => {};
      console.error = () => {};
      console.warn = () => {};
      console.info = () => {};
      console.debug = () => {};
    }
  }
}

export default Logger;