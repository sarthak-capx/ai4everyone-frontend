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
    signupUser: () => Promise<void>; // Same as loginUser for now
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
    const [isLoadingSession, setIsLoadingSession] = useState(true);

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
            console.error('Failed to load session:', err);
            if (err.status === 401) {
                console.log('No active session found');
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
        } catch (err) {
            console.error('Failed to fetch post-login data:', err);
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
            // Broadcast logout to other tabs (still safe; session is not persisted)
            sessionStorage.setItem('logout_flag', Date.now().toString());
            // broadcastLogout();
            clearSessionData();
            console.log('User cleared');
        }
    };

    const loginWithWallet = useCallback(async (walletAddress: string) => {
        try {
            if (sessionStorage.getItem('logout_flag')) return;
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

    const signupUser = loginUser; // Backend handles creation if not exists

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

            if (!sessionData && !isConnected) {
                // No session and no wallet - clear state
                await setUser(null);
            }
        };
        init();
    }, []);

    // Auto-login/reconnect effect
    useEffect(() => {
        if (isLoadingSession) return;

        console.log('Auto-login check:', { isConnected, address: address?.slice(0, 10), userEmail: user?.email?.slice(0, 10) });

        if (isConnected && address && walletClient) {
            if (!user) {
                // No user, login
                loginWithWallet(address).catch(console.error);
            } else if (user.email && user.email.toLowerCase() !== address.toLowerCase()) {
                // Mismatch, re-login
                console.log('Wallet address mismatch, re-logging in');
                loginWithWallet(address).catch(console.error);
            } else {
                // Match, good
                console.log('Wallet matches user');
            }
        } else if (!isConnected && user) {
            // Wallet disconnected but user from session - keep for now, but perhaps prompt reconnect
            console.log('Wallet disconnected, keeping session user');
        }
    }, [isConnected, address, walletClient, user, loginWithWallet, isLoadingSession]);

    return (
        <UserContext.Provider value={{ user, isLoadingSession, setUser, loginUser, logoutUser, signupUser }}>
            {children}
        </UserContext.Provider>
    );
}; 