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
import { API_ENDPOINTS } from '../config';

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
            // Temporarily disabled: do not persist session between refreshes
            // const userWithoutJWT = {
            //     id: user.id,
            //     email: user.email,
            //     name: user.name,
            //     loginTimestamp: user.loginTimestamp
            // };
            // sessionStorage.setItem('user_session', JSON.stringify(userWithoutJWT));
            // lastSessionUpdate.current = Date.now();
            // if (jwt) {
            //     await storeEncryptedJWT(jwt, user.id, user.email);
            // }
            // broadcastSessionUpdate('login', { email: user.email });
        } catch (error) {
            console.error('Failed to save session:', error);
            clearSessionData();
        }
    };

    useEffect(() => {
        if (isInitialized.current) return;
        isInitialized.current = true;

        // Disabled: always require fresh wallet connect on refresh
        setUserState(null);
        clearSessionData();
        // Skip session load and server bootstrap
        return;

        // The original implementation for session persistence is intentionally disabled.
        // loadUserSession().then(async ({ user: loadedUser, jwt }) => { ... })
    }, []);

    // Set user function with proper session management
    const setUser = async (user: User | null, jwt?: string) => {
        if (user) {
            const userWithTimestamp = {
                ...user,
                loginTimestamp: Date.now()
            };
            setUserState(userWithTimestamp);
            // Disabled persistence: do not save to sessionStorage or encrypted storage
            // await saveUserSession(userWithTimestamp, jwt);
            setUserContext({ id: user.id, email: user.email });
            // Keep JWT only in-memory for this session
            if (jwt) {
                await setCurrentJWT(jwt);
            }
        } else {
            setUserState(null);
            // Clear JWT from secure memory
            clearCurrentJWT();
            // Broadcast logout to other tabs (still safe; session is not persisted)
            sessionStorage.setItem('logout_flag', Date.now().toString());
            broadcastLogout();
        }
    };

    return (
        <UserContext.Provider value={{ user, setUser }}>
            {children}
        </UserContext.Provider>
    );
}; 