// Utility functions for fetching API keys and balance

import { User } from '../contexts/userContext';
import { API_ENDPOINTS } from '../config';
import Logger from '../utils/logger';
import { getCurrentJWTSync, setCurrentJWT } from '../utils/secureStorage';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  created_at: string;
  is_active: boolean;
}

export const fetchApiKeysForUser = async (): Promise<ApiKey[]> => {
  const jwt = getCurrentJWTSync();
  if (!jwt) {
    throw new Error('Authentication required');
  }
  try {
    const res = await fetch(API_ENDPOINTS.API_KEYS, {
      headers: {
        'Authorization': `Bearer ${jwt}`
      }
    });
    if (!res.ok) {
      throw new Error('Network response was not ok');
    }
    const apiKeys = await res.json();
    return apiKeys;
  } catch (err) {
    Logger.error('Failed to fetch API keys:', err);
    return [];
  }
};

export const fetchUserBalance = async (userEmail: string, authToken?: string): Promise<number | null> => {
  const attemptFetch = async (jwt: string): Promise<Response> => {
    return await fetch(`${API_ENDPOINTS.BALANCE}`, {
      headers: { Authorization: `Bearer ${jwt}` }
    });
  };

  const getJwtOrThrow = (): string => {
    const jwt = authToken || getCurrentJWTSync();
    if (!jwt) {
      throw new Error('Authentication required');
    }
    return jwt;
  };

  try {
    let jwt = getJwtOrThrow();
    let response = await attemptFetch(jwt);

    if (response.status === 401) {
      // Try to refresh session and retry once
      try {
        const sessionRes = await fetch(API_ENDPOINTS.SESSION, {
          method: 'GET',
          credentials: 'include'
        });
        if (sessionRes.ok) {
          const data = await sessionRes.json();
          if (data?.token) {
            await setCurrentJWT(data.token);
            jwt = data.token;
            response = await attemptFetch(jwt);
          }
        }
      } catch (refreshErr) {
        Logger.warn('Session refresh attempt failed:', refreshErr);
      }
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication expired - please log in again');
      } else if (response.status === 404) {
        throw new Error('User profile not found');
      } else {
        throw new Error(`Server error: ${response.status}`);
      }
    }

    const data = await response.json();

    if (typeof data.balance !== 'number') {
      throw new Error('Invalid balance data received from server');
    }

    Logger.info('Balance fetched successfully:', data.balance);
    return data.balance;
  } catch (err) {
    Logger.error('Failed to fetch balance:', err);
    throw err; // Re-throw to allow proper error handling upstream
  }
}; 