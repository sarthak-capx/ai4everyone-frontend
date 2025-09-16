import Logger from './logger';
import { API_ENDPOINTS } from '../config';

// User context for encryption key derivation
let currentUserContext: { id: string; email: string } | null = null;

export const setUserContext = (user: { id: string; email: string } | null) => {
  currentUserContext = user;
};

const getCurrentUser = () => currentUserContext;

// Generate encryption key from user data with improved security
const deriveUserKey = async (userId: string, userEmail: string, salt?: Uint8Array): Promise<{ key: CryptoKey, salt: Uint8Array }> => {
  // Generate random salt if not provided (for new encryptions)
  const randomSalt = salt || crypto.getRandomValues(new Uint8Array(32));
  
  // Use consistent key material with user-specific entropy
  const keyMaterial = `${userId}:${userEmail}:ai4everyone-secure`;
  const encoder = new TextEncoder();
  const keyData = encoder.encode(keyMaterial);

  const importedKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: randomSalt, // Use random salt instead of predictable one
      iterations: 1000000, // High iterations for security
      hash: 'SHA-256'
    },
    importedKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );

  return { key: derivedKey, salt: randomSalt };
};

// Encrypt data using user-derived key
const encryptApiKeys = async (data: string, userId: string, userEmail: string): Promise<string> => {
  try {
    const { key, salt } = await deriveUserKey(userId, userEmail);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );
    
    // Combine salt + IV + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    Logger.error('Encryption failed:', error);
    throw new Error('Failed to encrypt API keys');
  }
};

// Decrypt data using user-derived key
const decryptApiKeys = async (encryptedData: string, userId: string, userEmail: string): Promise<string> => {
  try {
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    );
    
    // Extract salt + IV + encrypted data
    const salt = combined.slice(0, 32);
    const iv = combined.slice(32, 44);
    const encrypted = combined.slice(44);
    
    const { key } = await deriveUserKey(userId, userEmail, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    Logger.error('Decryption failed:', error);
    throw new Error('Failed to decrypt API keys');
  }
};

// JWT Encryption and Decryption Functions
export const encryptJWT = async (jwt: string, userId: string, userEmail: string): Promise<string> => {
  try {
    const { key, salt } = await deriveUserKey(userId, userEmail);
    const encoder = new TextEncoder();
    const jwtBuffer = encoder.encode(jwt);
    
    // Generate random IV for each encryption
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      jwtBuffer
    );
    
    // Combine salt + IV + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);
    
    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    Logger.error('JWT encryption failed:', error);
    throw new Error('Failed to encrypt JWT token');
  }
};

export const decryptJWT = async (encryptedJWT: string, userId: string, userEmail: string): Promise<string> => {
  try {
    // Decode from base64
    const combined = new Uint8Array(
      atob(encryptedJWT).split('').map(char => char.charCodeAt(0))
    );
    
    // Extract salt + IV + encrypted data
    const salt = combined.slice(0, 32);
    const iv = combined.slice(32, 44);
    const encrypted = combined.slice(44);
    
    const { key } = await deriveUserKey(userId, userEmail, salt);
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    );
    
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    Logger.error('JWT decryption failed:', error);
    throw new Error('Failed to decrypt JWT token');
  }
};

// Secure JWT storage functions
export const storeEncryptedJWT = async (jwt: string, userId: string, userEmail: string): Promise<void> => {
  try {
    const encryptedJWT = await encryptJWT(jwt, userId, userEmail);
    sessionStorage.setItem('encrypted_jwt', encryptedJWT);
    Logger.info('JWT encrypted and stored securely');
  } catch (error) {
    Logger.error('Failed to store encrypted JWT:', error);
    throw error;
  }
};

export const getEncryptedJWT = async (userId: string, userEmail: string): Promise<string | null> => {
  try {
    const encryptedJWT = sessionStorage.getItem('encrypted_jwt');
    if (!encryptedJWT) return null;
    
    const jwt = await decryptJWT(encryptedJWT, userId, userEmail);
    return jwt;
  } catch (error) {
    Logger.error('Failed to retrieve encrypted JWT:', error);
    // Clear corrupted JWT
    sessionStorage.removeItem('encrypted_jwt');
    return null;
  }
};

export const clearEncryptedJWT = (): void => {
  sessionStorage.removeItem('encrypted_jwt');
  Logger.info('Encrypted JWT cleared');
};

// Secure JWT Token Manager - Replaces vulnerable window object storage
class SecureTokenManager {
  private static instance: SecureTokenManager;
  private token: string | null = null;
  private tokenExpiry: number | null = null;
  private encryptionKey: CryptoKey | null = null;
  
  private constructor() {
    // Initialize encryption key
    this.initializeEncryption();
  }
  
  private async initializeEncryption() {
    try {
      // Generate a runtime encryption key for in-memory JWT storage
      this.encryptionKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      Logger.warn('Failed to initialize JWT encryption key:', error);
      // Continue without encryption - will use obfuscation fallback
    }
  }
  
  static getInstance(): SecureTokenManager {
    if (!SecureTokenManager.instance) {
      SecureTokenManager.instance = new SecureTokenManager();
    }
    return SecureTokenManager.instance;
  }
  
  async setToken(jwt: string): Promise<void> {
    try {
      // Parse JWT to get expiry
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      this.tokenExpiry = payload.exp * 1000;
      
      // Encrypt token in memory if encryption is available
      if (this.encryptionKey) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encrypted = await crypto.subtle.encrypt(
          { name: 'AES-GCM', iv },
          this.encryptionKey,
          new TextEncoder().encode(jwt)
        );
        
        // Store encrypted token with IV
        const combined = new Uint8Array(iv.length + encrypted.byteLength);
        combined.set(iv, 0);
        combined.set(new Uint8Array(encrypted), iv.length);
        this.token = btoa(String.fromCharCode(...combined));
      } else {
        // Fallback to obfuscation if encryption fails
        this.token = btoa(jwt.split('').reverse().join(''));
      }
      
      // Set auto-clear on expiry
      const timeUntilExpiry = this.tokenExpiry - Date.now();
      if (timeUntilExpiry > 0) {
        setTimeout(() => this.clearToken(), timeUntilExpiry);
      }
    } catch (error) {
      Logger.error('Failed to store JWT token securely:', error);
      throw error;
    }
  }
  
  async getToken(): Promise<string | null> {
    if (!this.token) return null;
    
    // Check expiry
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      this.clearToken();
      return null;
    }
    
    try {
      // Decrypt token if encrypted
      if (this.encryptionKey) {
        const combined = new Uint8Array(
          atob(this.token).split('').map(c => c.charCodeAt(0))
        );
        const iv = combined.slice(0, 12);
        const encrypted = combined.slice(12);
        
        const decrypted = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv },
          this.encryptionKey,
          encrypted
        );
        const jwt = new TextDecoder().decode(decrypted);
        // Update cache
        cachedJWT = jwt;
        return jwt;
      } else {
        // Fallback deobfuscation
        const jwt = atob(this.token).split('').reverse().join('');
        // Update cache
        cachedJWT = jwt;
        return jwt;
      }
    } catch (error) {
      Logger.error('Failed to retrieve JWT token:', error);
      this.clearToken();
      cachedJWT = null;
      return null;
    }
  }
  
  clearToken(): void {
    // Overwrite with random data before clearing
    if (this.token) {
      this.token = crypto.randomUUID();
      this.token = null;
    }
    this.tokenExpiry = null;
    // Clear cache
    cachedJWT = null;
  }
}

// Create singleton instance
const tokenManager = SecureTokenManager.getInstance();

// Block unauthorized access to window.__currentJWT
Object.defineProperty(window, '__currentJWT', {
  get() {
    Logger.warn('Unauthorized JWT access attempt blocked');
    return undefined;
  },
  set() {
    Logger.warn('Unauthorized JWT modification attempt blocked');
  },
  configurable: false
});

// Cached JWT for synchronous access (updated by async operations)
let cachedJWT: string | null = null;

// Utility to get current JWT from secure memory for API calls
export const getCurrentJWT = async (): Promise<string | null> => {
  return await tokenManager.getToken();
};

// Synchronous wrapper for backward compatibility
export const getCurrentJWTSync = (): string | null => {
  return cachedJWT;
};

// Utility to set current JWT in secure memory
export const setCurrentJWT = async (jwt: string): Promise<void> => {
  await tokenManager.setToken(jwt);
  // Update cache for synchronous access
  cachedJWT = jwt;
};

// Utility to clear current JWT from secure memory
export const clearCurrentJWT = (): void => {
  tokenManager.clearToken();
  // Clear cache
  cachedJWT = null;
};

// Debug utility to check JWT status
export const debugJWTStatus = async (): Promise<void> => {
  const jwt = await getCurrentJWT();
  const encryptedJWT = sessionStorage.getItem('encrypted_jwt');
  const userSession = sessionStorage.getItem('user_session');
  
  
  console.log('- Current JWT in memory:', jwt ? 'Present' : 'Missing');
  console.log('- Encrypted JWT in storage:', encryptedJWT ? 'Present' : 'Missing');
  console.log('- User session in storage:', userSession ? 'Present' : 'Missing');
  
  if (userSession) {
    try {
      const user = JSON.parse(userSession);
      console.log('- User ID:', user.id);
      console.log('- User Email:', user.email);
    } catch (e) {
      console.log('- User session parse error:', e);
    }
  }
  
  if (encryptedJWT) {
    console.log('- Encrypted JWT length:', encryptedJWT.length);
  }
};

// Simple sessionStorage-based communication (no cross-tab sync for security)
const broadcastStorageChange = (action: string, key: string) => {
  // Just use sessionStorage - no complex cross-tab communication needed
  sessionStorage.setItem('last_action', JSON.stringify({
    action,
    key,
    timestamp: Date.now()
  }));
};

// Secure storage for API keys and balance
export const secureStorage = {
  // API Keys
  setApiKeys: async (apiKeys: any[]) => {
    try {
      const userData = getCurrentUser();
      
      if (userData?.id && userData?.email) {
        // Encrypt before storing
        const encryptedData = await encryptApiKeys(
          JSON.stringify(apiKeys), 
          userData.id, 
          userData.email
        );
        sessionStorage.setItem('api_keys_cache', encryptedData);
        Logger.info('API keys stored securely');
      } else {
        // Don't store anything if no user context - security over convenience
        Logger.warn('API keys not stored - no user context available');
        return;
      }
      
      broadcastStorageChange('set', 'secure_api_keys');
    } catch (error) {
      Logger.error('Failed to store API keys:', error);
      // Don't fall back to unencrypted storage - security over availability
      throw new Error('Failed to encrypt API keys - not storing unencrypted data');
    }
  },

  getApiKeys: async () => {
    try {
      const cached = sessionStorage.getItem('api_keys_cache');
      if (!cached) return [];
      
      const userData = getCurrentUser();
      
      if (userData?.id && userData?.email) {
        // Try to decrypt with current key
        try {
          const decryptedData = await decryptApiKeys(cached, userData.id, userData.email);
          return JSON.parse(decryptedData);
        } catch (decryptError) {
          Logger.warn('Decryption failed, trying as unencrypted data:', decryptError);
          // If decryption fails, might be old unencrypted data or old encryption format
          try {
            const parsedData = JSON.parse(cached);
            // If we successfully parsed unencrypted data, re-encrypt it with new format
            if (Array.isArray(parsedData) && parsedData.length > 0) {
              Logger.info('Migrating unencrypted API keys to encrypted format');
              await secureStorage.setApiKeys(parsedData);
              return parsedData;
            }
            return [];
          } catch (parseError) {
            Logger.error('Failed to parse cached API keys:', parseError);
            return [];
          }
        }
      } else {
        // No user context, try parsing as unencrypted
        try {
          const parsedData = JSON.parse(cached);
          return Array.isArray(parsedData) ? parsedData : [];
        } catch (parseError) {
          Logger.error('Failed to parse API keys without user context:', parseError);
          return [];
        }
      }
    } catch (error) {
      Logger.error('Failed to get API keys:', error);
      return [];
    }
  },

  removeApiKeys: async () => {
    try {
      sessionStorage.removeItem('api_keys_cache');
      broadcastStorageChange('remove', 'secure_api_keys');
    } catch (error) {
      Logger.error('Failed to remove API keys:', error);
    }
  },

  // Balance
  setBalance: async (balance: number) => {
    try {
      // Store in session storage for now
      sessionStorage.setItem('balance_cache', balance.toString());
      broadcastStorageChange('set', 'secure_balance');
    } catch (error) {
      Logger.error('Failed to store balance:', error);
    }
  },

  getBalance: () => {
    try {
      // First try to get from session storage cache
      const cached = sessionStorage.getItem('balance_cache');
      if (cached) {
        return parseFloat(cached);
      }
      return 0;
    } catch (error) {
      Logger.error('Failed to get balance:', error);
      return 0;
    }
  },

  removeBalance: async () => {
    try {
      sessionStorage.removeItem('balance_cache');
      broadcastStorageChange('remove', 'secure_balance');
    } catch (error) {
      Logger.error('Failed to remove balance:', error);
    }
  },

  // Clear all secure data with enhanced cross-tab sync
  clearAll: async () => {
    try {
      // Clear sessionStorage items only
      sessionStorage.removeItem('api_keys_cache');
      sessionStorage.removeItem('balance_cache');
      sessionStorage.removeItem('session_data');
      sessionStorage.removeItem('logout_flag');
      
      // Broadcast clear action to other tabs
      broadcastStorageChange('clear', 'all');
    } catch (error) {
      Logger.error('Failed to clear all data:', error);
    }
  },

  // Secure logout - only uses sessionStorage
  secureLogout: async () => {
    try {
      // Set logout flag with timestamp
      const logoutTimestamp = Date.now().toString();
      sessionStorage.setItem('logout_flag', logoutTimestamp);
      
      // Use comprehensive cleanup function
      secureStorage.clearSensitiveData();
      
      // Broadcast logout action
      broadcastStorageChange('logout', 'all');
      
      // Remove the flag after a delay
      setTimeout(() => {
        sessionStorage.removeItem('logout_flag');
      }, 2000);
    } catch (error) {
      Logger.error('Failed to perform secure logout:', error);
    }
  },

  // Clear sensitive data from sessionStorage only
  clearSensitiveData: () => {
    try {
      // Clear sensitive sessionStorage data
      sessionStorage.removeItem('api_keys_cache');
      sessionStorage.removeItem('balance_cache');
      sessionStorage.removeItem('session_data');
      sessionStorage.removeItem('secure_session');
      sessionStorage.removeItem('csrf_token');
      sessionStorage.removeItem('logout_flag');
      
      Logger.info('Session data cleared');
    } catch (error) {
      Logger.error('Failed to clear sensitive data:', error);
    }
  },



  // Initialize cleanup events for security
  initSecurityCleanup: () => {
    // Clear sensitive data before page unload
    const handleBeforeUnload = () => {
      secureStorage.clearSensitiveData();
    };

    // Clear sensitive data on tab visibility change (when tab becomes hidden)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Small delay to allow for tab switching, not full navigation away
        setTimeout(() => {
          if (document.visibilityState === 'hidden') {
            secureStorage.clearSensitiveData();
          }
        }, 2000); // 2 second delay
      }
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Return cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  },

  // Initialize cross-tab communication listener (simplified for security)
  initCrossTabSync: () => {
    // Cross-tab sync removed for security - each tab manages its own state
    Logger.info('Cross-tab sync disabled for security');
    
    // Return empty cleanup function
    return () => {
      // No cleanup needed
    };
  }
}; 

// Initialize cached JWT from encrypted storage
export const initializeCachedJWT = async (userId: string, userEmail: string): Promise<void> => {
  try {
    const jwt = await getEncryptedJWT(userId, userEmail);
    if (jwt) {
      cachedJWT = jwt;
      Logger.debug('initializeCachedJWT: Initialized cached JWT from encrypted storage');
    } else {
      Logger.debug('initializeCachedJWT: No JWT found in encrypted storage');
    }
  } catch (error) {
    Logger.error('initializeCachedJWT: Failed to initialize cached JWT:', error);
  }
}; 