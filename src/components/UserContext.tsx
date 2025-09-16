import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { disconnect } from '@wagmi/core';
import { 
  getEncryptedJWT, 
  storeEncryptedJWT, 
  clearEncryptedJWT,
  setCurrentJWT,
  clearCurrentJWT,
  setUserContext,
  initializeCachedJWT
} from '../utils/secureStorage';
import Logger from '../utils/logger';

export interface User {
  id: string; // This is the UUID from Supabase Auth
  email: string; // wallet address
  name?: string;
  loginTimestamp?: number; // Timestamp when user logged in
  // Remove jwt field - will be stored encrypted separately
}

interface UserContextType {
  user: User | null;
  setUser: (user: User | null, jwt?: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

// Generate unique tab ID for cross-tab communication
const TAB_ID = Math.random().toString(36).substr(2, 9);
const SESSION_SYNC_KEY = 'session_sync';
const LOGOUT_SYNC_KEY = 'logout_sync';

// Validate session data format
const validateSession = (sessionData: string): boolean => {
  try {
    const parsed = JSON.parse(sessionData);
    return parsed && typeof parsed === 'object' && 
           typeof parsed.id === 'string' && 
           typeof parsed.email === 'string' &&
           parsed.id.length > 0 && 
           parsed.email.length > 0;
  } catch {
    return false;
  }
};

// Cross-tab communication using sessionStorage only
const broadcastSessionUpdate = (action: 'login' | 'logout' | 'update', data?: any) => {
  const message = {
    tabId: TAB_ID,
    action,
    timestamp: Date.now(),
    data
  };
  
  // Use sessionStorage for cross-tab communication (consistent with security model)
  sessionStorage.setItem(SESSION_SYNC_KEY, JSON.stringify(message));
  
  // Clear after a short delay to prevent accumulation
  setTimeout(() => {
    if (sessionStorage.getItem(SESSION_SYNC_KEY) === JSON.stringify(message)) {
      sessionStorage.removeItem(SESSION_SYNC_KEY);
    }
  }, 100);
};

const broadcastLogout = () => {
  const message = {
    tabId: TAB_ID,
    action: 'logout',
    timestamp: Date.now()
  };
  
  // Use sessionStorage for logout broadcast
  sessionStorage.setItem(LOGOUT_SYNC_KEY, JSON.stringify(message));
  
  // Clear after a short delay
  setTimeout(() => {
    if (sessionStorage.getItem(LOGOUT_SYNC_KEY) === JSON.stringify(message)) {
      sessionStorage.removeItem(LOGOUT_SYNC_KEY);
    }
  }, 100);
};

export const useUser = () => useContext(UserContext);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<User | null>(null);
  const isInitialized = useRef(false);
  const lastSessionUpdate = useRef<number>(0);

  // Clear all session data consistently (sessionStorage only)
  const clearSessionData = () => {
    sessionStorage.removeItem('user_session');
    sessionStorage.removeItem('user_email_session');
    sessionStorage.removeItem('secure_api_keys');
    sessionStorage.removeItem('secure_balance');
    sessionStorage.removeItem('session_data');
    sessionStorage.removeItem('logout_flag');
    sessionStorage.removeItem(SESSION_SYNC_KEY);
    sessionStorage.removeItem(LOGOUT_SYNC_KEY);
    clearEncryptedJWT(); // Clear encrypted JWT
  };

  // Load user session from storage
  const loadUserSession = async (): Promise<{ user: User | null; jwt: string | null }> => {
    try {
      const sessionData = sessionStorage.getItem('user_session');
      if (!sessionData) return { user: null, jwt: null };
      
      const user = JSON.parse(sessionData);
      if (user && user.id && user.email) {
        lastSessionUpdate.current = Date.now();
        
        // Try to load encrypted JWT
        let jwt: string | null = null;
        try {
          jwt = await getEncryptedJWT(user.id, user.email);
        } catch (jwtError) {
          console.warn('Failed to load encrypted JWT:', jwtError);
          // Continue without JWT - user can re-authenticate
        }
        
        return { user, jwt };
      }
      
      clearSessionData();
      return { user: null, jwt: null };
    } catch (error) {
      console.error('Failed to load user session:', error);
      clearSessionData();
      return { user: null, jwt: null };
    }
  };

  // Save user session to storage
  const saveUserSession = async (user: User, jwt?: string) => {
    try {
      // Store user data without JWT
      const userWithoutJWT = {
        id: user.id,
        email: user.email,
        name: user.name,
        loginTimestamp: user.loginTimestamp
      };
      
      sessionStorage.setItem('user_session', JSON.stringify(userWithoutJWT));
      lastSessionUpdate.current = Date.now();
      
      // Store JWT separately in encrypted form if provided
      if (jwt) {
        await storeEncryptedJWT(jwt, user.id, user.email);
      }
      
      // Broadcast session update to other tabs
      broadcastSessionUpdate('login', { email: user.email });
    } catch (error) {
      console.error('Failed to save session:', error);
      clearSessionData();
    }
  };

  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    // Check for logout flags first (sessionStorage only)
    const logoutFlag = sessionStorage.getItem('logout_flag');
    
    if (logoutFlag) {
      setUserState(null);
      clearSessionData();
      return;
    }

    // Load user session on mount
    loadUserSession().then(async ({ user: loadedUser, jwt }) => {
      if (loadedUser) {
        setUserState(loadedUser);
        // Set user context for encryption
        setUserContext({ id: loadedUser.id, email: loadedUser.email });
        
        // Initialize cached JWT from encrypted storage
        await initializeCachedJWT(loadedUser.id, loadedUser.email);
        
        // Store JWT in secure memory for API calls
        if (jwt) {
          await setCurrentJWT(jwt);
        }
      }
    });

    // Enhanced cross-tab communication handler (sessionStorage only)
    const handleStorageChange = (event: StorageEvent) => {
      // Ignore events from this tab
      if (event.key === SESSION_SYNC_KEY || event.key === LOGOUT_SYNC_KEY) {
        try {
          const message = JSON.parse(event.newValue || '{}');
          
          // Ignore messages from this tab
          if (message.tabId === TAB_ID) return;
          
          // Handle logout messages
          if (event.key === LOGOUT_SYNC_KEY && message.action === 'logout') {
            setUserState(null);
            clearSessionData();
            return;
          }
          
          // Handle session updates
          if (event.key === SESSION_SYNC_KEY) {
            if (message.action === 'logout') {
              setUserState(null);
              clearSessionData();
            } else if (message.action === 'login' || message.action === 'update') {
              // Reload session data from storage
              loadUserSession().then(async ({ user: currentUser, jwt }) => {
                if (currentUser) {
                  setUserState(currentUser);
                  // Set user context for encryption
                  setUserContext({ id: currentUser.id, email: currentUser.email });
                  
                  // Initialize cached JWT from encrypted storage
                  await initializeCachedJWT(currentUser.id, currentUser.email);
                  
                  // Store JWT in secure memory for API calls
                  if (jwt) {
                    await setCurrentJWT(jwt);
                  }
                }
              });
            }
          }
        } catch (error) {
          console.error('Failed to parse cross-tab message:', error);
        }
      }
    };

    // Listen for storage changes from other tabs
    window.addEventListener('storage', handleStorageChange);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Set user function with proper session management
  const setUser = async (user: User | null, jwt?: string) => {
    if (user) {
      // Add login timestamp to force re-renders
      const userWithTimestamp = {
        ...user,
        loginTimestamp: Date.now()
      };
      setUserState(userWithTimestamp);
      await saveUserSession(userWithTimestamp, jwt);
      // Set user context for encryption
      setUserContext({ id: user.id, email: user.email });
      
      // Initialize cached JWT from encrypted storage
      await initializeCachedJWT(user.id, user.email);
      
      // Store JWT in secure memory for API calls
      if (jwt) {
        await setCurrentJWT(jwt);
      }
    } else {
      setUserState(null);
      // Clear JWT from secure memory
      clearCurrentJWT();
      // Set logout flag for cross-tab sync
      sessionStorage.setItem('logout_flag', Date.now().toString());
      // Broadcast logout to other tabs
      broadcastLogout();
    }
  };

  return (
    <UserContext.Provider value={{ user, setUser }}>
      {children}
    </UserContext.Provider>
  );
}; 