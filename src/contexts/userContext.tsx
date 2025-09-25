import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
    clearEncryptedJWT,
    setCurrentJWT,
    clearCurrentJWT,
    setUserContext,
    secureStorage,
} from '../utils/secureStorage';
import { useAccount, useWalletClient, useDisconnect } from 'wagmi';
import { apiClient } from '../utils/apiClient';
import { API_ENDPOINTS } from '../config';
import { fetchApiKeysForUser, fetchUserBalance } from '../components/utils';

interface LoginResponse {
    user: {
        id: string;
        email: string;
        name?: string;
    };
    token: string;
}

interface SessionResponse {
    user: {
        id: string;
        email: string;
        name?: string;
    };
    token: string;
}

interface PaymentHistoryResponse {
    transactions: any[];
}

export interface User {
    id: string; // This is the UUID from Supabase Auth
    email: string; // wallet address
    name?: string;
    loginTimestamp?: number; // Timestamp when user logged in
    // Remove jwt field - will be stored encrypted separately
}

interface UserContextType {
    user: User | null;
    isLoadingSession: boolean;
    setUser: (user: User | null, jwt?: string) => Promise<void>;
    loginUser: () => Promise<void>;
    logoutUser: () => void;
    signupUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUserState] = useState<User | null>(null);
    const isInitialized = useRef(false);
    const mounted = useRef(false); // Add mounted ref
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    const [sessionLoaded, setSessionLoaded] = useState(false); // Add sessionLoaded state

    const { address, isConnected } = useAccount();
    const { data: walletClient } = useWalletClient();
    const { disconnect } = useDisconnect();

    // Clear all session data consistently (sessionStorage only)
    const clearSessionData = () => {
        sessionStorage.removeItem('user_session');
        sessionStorage.removeItem('user_email_session');
        sessionStorage.removeItem('secure_api_keys');
        sessionStorage.removeItem('secure_balance');
        sessionStorage.removeItem('session_data');
        sessionStorage.removeItem('api_keys_cache');
        sessionStorage.removeItem('balance_cache');
        clearEncryptedJWT(); // Clear encrypted JWT
    };

    // Load user session from server
    const loadUserSession = async () => {
        try {
            console.log('Loading user session...');
            const data: SessionResponse = await apiClient.get<SessionResponse>('/auth/session', undefined, 'include');
            console.log('Session loaded:', data.user ? 'success' : 'no user');
            if (data.user && data.token) {
                await setUser({ id: data.user.id, email: data.user.email, name: data.user.name }, data.token);
                // Fetch additional data
                await fetchPostLoginData(data.user.email, data.token);
                return { user: data.user, token: data.token };
            }
            return null;
        } catch (err: any) {
            if (err.status === 401) {
                console.log('No active session found');
            } else {
                console.error('Failed to load session:', err);
            }
            return null;
        }
    };

    // Fetch post-login data
    const fetchPostLoginData = async (email: string, token: string) => {
        try {
            const apiKeys = await fetchApiKeysForUser();
            secureStorage.setApiKeys(apiKeys);
            window.dispatchEvent(new CustomEvent('userDataFetched', { detail: { type: 'apiKeys', data: apiKeys } }));

            const balance = await fetchUserBalance(email, token);
            if (balance !== null) {
                window.dispatchEvent(new CustomEvent('userDataFetched', { detail: { type: 'balance', data: balance } }));
            }

            const paymentData: PaymentHistoryResponse = await apiClient.get<PaymentHistoryResponse>('/balance/payment-history-jwt');
            const transactions = paymentData.transactions || [];
            window.dispatchEvent(new CustomEvent('userDataFetched', { detail: { type: 'paymentHistory', data: transactions } }));
        } catch (err: any) {
            if (err.status !== 401) {
                console.error('Failed to fetch post-login data:', err);
            }
        }
    };

    // Set user function with proper session management
    const setUser = async (userInput: User | null, jwt?: string) => {
        if (userInput) {
            const userWithTimestamp = {
                ...userInput,
                loginTimestamp: Date.now()
            };
            setUserState(userWithTimestamp);
            setUserContext({ id: userInput.id, email: userInput.email });
            // Keep JWT only in-memory for this session
            if (jwt) {
                await setCurrentJWT(jwt);
            }
            console.log('User set:', userInput.email);
        } else {
            setUserState(null);
            // Clear JWT from secure memory
            clearCurrentJWT();
            clearSessionData();
            console.log('User cleared');
        }
    };

    const loginWithWallet = useCallback(async (walletAddress: string) => {
        try {
            const timestamp = Date.now();
            const message = `AI4EVERYONE Login: ${walletAddress} at ${timestamp}`;
            if (!walletClient || !address) throw new Error('No wallet client found');
            const signature = await walletClient.signMessage({ message, account: address });

            console.log('Logging in with wallet:', walletAddress);
            const data: LoginResponse = await apiClient.post<LoginResponse>('/auth/wallet-login', {
                address: walletAddress,
                message,
                signature,
                timestamp
            }, undefined, 'include');  // Include credentials to set session cookies

            console.log('Login response:', data.user ? 'success' : 'failed');
            await setUser({ id: data.user.id, email: data.user.email, name: data.user.name }, data.token);

            // Fetch additional user data
            await fetchPostLoginData(data.user.email, data.token);
        } catch (err: any) {
            console.error('Login failed:', err);
            await setUser(null);
            throw err;
        }
    }, [address, walletClient]);

    const loginUser = useCallback(async () => {
        if (!isConnected || !address) {
            throw new Error('Wallet not connected');
        }
        await loginWithWallet(address);
    }, [loginWithWallet, isConnected, address]);

    const signupUser = loginUser;

    const logoutUser = useCallback(async () => {
        try {
            // Clear local state
            await setUser(null);
            // Clear server session
            await fetch('/auth/session', { method: 'DELETE', credentials: 'include' }).catch(console.error);
            secureStorage.secureLogout();
            disconnect();
            console.log('Logout completed');
        } catch (err) {
            console.error('Logout error:', err);
            // Still disconnect wallet even if server logout fails
            disconnect();
        }
    }, [disconnect]);

    // Initialization effect - load session
    useEffect(() => {
        const init = async () => {
            if (isInitialized.current) return;
            isInitialized.current = true;

            setIsLoadingSession(true);
            const sessionData = await loadUserSession();
            setIsLoadingSession(false);
            setSessionLoaded(true); // Set loaded after session check

            if (!sessionData && !isConnected) {
                // No session and no wallet - clear state
                await setUser(null);
            }
        };
        init();
    }, []);

    // Set mounted after initial render
    useEffect(() => {
        mounted.current = true;
    }, []);

    // Auto-sign after wallet connection - only after mounted and session loaded
    useEffect(() => {
        if (mounted.current && sessionLoaded && isConnected && address && !user && walletClient) {
            console.log('Auto-signing after connection...');
            loginWithWallet(address).catch(err => {
                console.error('Auto-sign failed:', err);
                // Don't disconnect; user can logout and retry
            });
        }
    }, [mounted, sessionLoaded, isConnected, address, user, walletClient, loginWithWallet]); // Add sessionLoaded to deps

    return (
        <UserContext.Provider value={{ user, isLoadingSession, setUser, loginUser, logoutUser, signupUser }}>
            {children}
        </UserContext.Provider>
    );
}; 