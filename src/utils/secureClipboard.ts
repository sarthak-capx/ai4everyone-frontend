import Logger from './logger';

// Interface for clipboard copy options
export interface ClipboardOptions {
  isSensitive?: boolean;      // Manual override for sensitive data
  timeout?: number;           // Auto-clear timeout in milliseconds (default 30s)
  showNotification?: boolean; // Show success/warning notifications
}

// Interface for notification callback
export interface NotificationCallback {
  (message: string, type: 'success' | 'warning' | 'info' | 'error'): void;
}

// Global notification callback - can be set by components
let notificationCallback: NotificationCallback | null = null;

export const setNotificationCallback = (callback: NotificationCallback) => {
  notificationCallback = callback;
};

// Patterns to detect sensitive data
const SENSITIVE_PATTERNS = [
  /^sk-[a-zA-Z0-9]{48,}$/,           // OpenAI API keys
  /^pk-[a-zA-Z0-9]{48,}$/,           // Public keys  
  /^rk-[a-zA-Z0-9]{48,}$/,           // Restricted keys
  /^ak-[a-zA-Z0-9]{48,}$/,           // Access keys
  /^xoxb-[a-zA-Z0-9-]{50,}$/,        // Slack bot tokens
  /^ghp_[a-zA-Z0-9]{36}$/,           // GitHub personal access tokens
  /^gho_[a-zA-Z0-9]{36}$/,           // GitHub OAuth tokens
  /^eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/, // JWT tokens
  /^[a-fA-F0-9]{32,}$/,              // Long hex strings (API keys, hashes)
  /^0x[a-fA-F0-9]{40}$/,             // Ethereum addresses
  /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // Bitcoin addresses
  /^[A-Za-z0-9]{88}$/,               // Base64 encoded keys (64 bytes)
  /^[A-Za-z0-9+/]{40,}={0,2}$/,      // Base64 patterns
];

// Track active clipboard timers to prevent conflicts
const activeTimers = new Set<NodeJS.Timeout>();

// Detect if text contains sensitive information
const isSensitiveData = (text: string): boolean => {
  // Check against known sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text.trim())) {
      return true;
    }
  }
  
  // Additional heuristics
  const trimmed = text.trim();
  
  // Very long strings (likely tokens/keys)
  if (trimmed.length > 50 && !/\s/.test(trimmed)) {
    return true;
  }
  
  // Contains "key", "token", "secret" etc.
  if (/^(.*key.*|.*token.*|.*secret.*|.*password.*)$/i.test(trimmed.toLowerCase())) {
    return true;
  }
  
  return false;
};

// Show notification to user
const showNotification = (message: string, type: 'success' | 'warning' | 'info' | 'error' = 'info') => {
  if (notificationCallback) {
    notificationCallback(message, type);
  } else {
    // Fallback to Logger if no notification system
    Logger.info(`[Clipboard] ${message}`);
  }
};

// Clear clipboard content safely
const clearClipboard = async (): Promise<void> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText('');
      Logger.info('Clipboard cleared for security');
    }
  } catch (error) {
    Logger.warn('Failed to clear clipboard:', error);
  }
};

// Main secure clipboard copy function
export const secureClipboardCopy = async (
  text: string, 
  options: ClipboardOptions = {}
): Promise<boolean> => {
  const {
    isSensitive = isSensitiveData(text),
    timeout = 30000, // 30 seconds default
    showNotification: showNotif = true
  } = options;

  try {
    // Check if clipboard API is available
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      throw new Error('Clipboard API not supported');
    }

    // Copy to clipboard
    await navigator.clipboard.writeText(text);
    Logger.info('Text copied to clipboard');

    // Show appropriate notification
    if (showNotif) {
      if (isSensitive) {
        showNotification(
          `⚠️ Sensitive data copied - will auto-clear in ${timeout / 1000}s`,
          'warning'
        );
      } else {
        showNotification('✅ Copied to clipboard!', 'success');
      }
    }

    // Set up auto-clear for sensitive data
    if (isSensitive && timeout > 0) {
      const timerId = setTimeout(async () => {
        try {
          // Verify clipboard still contains our data before clearing
          const currentClipboard = await navigator.clipboard.readText();
          if (currentClipboard === text) {
            await clearClipboard();
            if (showNotif) {
              showNotification('🗑️ Clipboard cleared for security', 'info');
            }
          }
        } catch (error) {
          Logger.warn('Failed to auto-clear clipboard:', error);
        } finally {
          activeTimers.delete(timerId);
        }
      }, timeout);

      activeTimers.add(timerId);
    }

    return true;

  } catch (error) {
    Logger.error('Clipboard copy failed:', error);
    
    if (showNotif) {
      showNotification(
        '❌ Copy failed - please select and copy manually',
        'error'
      );
    }

    // Fallback: try to select text for manual copy
    try {
      // Create temporary element for text selection
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      // Try execCommand as fallback
      const success = document.execCommand('copy');
      document.body.removeChild(textArea);
      
      if (success && showNotif) {
        showNotification('✅ Copied using fallback method', 'success');
        return true;
      }
    } catch (fallbackError) {
      Logger.error('Fallback copy method failed:', fallbackError);
    }

    return false;
  }
};

// Manual clear function for immediate clearing
export const clearClipboardNow = async (): Promise<void> => {
  // Clear any pending timers
  activeTimers.forEach(timer => clearTimeout(timer));
  activeTimers.clear();
  
  // Clear clipboard
  await clearClipboard();
  showNotification('🗑️ Clipboard cleared manually', 'info');
};

// Utility to check if text would be considered sensitive
export const checkSensitiveData = (text: string): boolean => {
  return isSensitiveData(text);
};

// Initialize clipboard security (can be called from main app)
export const initClipboardSecurity = () => {
  // Clear any active timers on page unload
  window.addEventListener('beforeunload', () => {
    activeTimers.forEach(timer => clearTimeout(timer));
    activeTimers.clear();
  });

  // Optional: Clear clipboard when window loses focus (aggressive security)
  // Uncomment if you want this behavior
  /*
  window.addEventListener('blur', () => {
    setTimeout(() => clearClipboard(), 1000);
  });
  */

  Logger.info('Clipboard security initialized');
};

export default {
  secureClipboardCopy,
  clearClipboardNow,
  checkSensitiveData,
  initClipboardSecurity,
  setNotificationCallback
};