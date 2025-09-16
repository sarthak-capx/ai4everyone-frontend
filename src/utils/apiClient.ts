import Logger from './logger';
import { getCurrentJWT } from './secureStorage';

// API Client with comprehensive error handling
interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: any;
}

class ApiError extends Error {
  public status: number;
  public code?: string;
  public details?: any;

  constructor(status: number, message: string, code?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

class ApiClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private retryAttempts: number;
  private retryDelay: number;

  constructor(baseURL: string, retryAttempts: number = 3, retryDelay: number = 1000) {
    this.baseURL = baseURL;
    this.retryAttempts = retryAttempts;
    this.retryDelay = retryDelay;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error) {
      if (attempt < this.retryAttempts && this.shouldRetry(error)) {
        await this.delay(this.retryDelay * attempt);
        return this.retryRequest(requestFn, attempt + 1);
      }
      throw error;
    }
  }

  private shouldRetry(error: any): boolean {
    // Retry on network errors or 5xx server errors
    if (error instanceof ApiError) {
      return error.status >= 500 || error.status === 429;
    }
    // Retry on network errors (TypeError)
    return error instanceof TypeError;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    
    const requestFn = async (): Promise<T> => {
      try {
        // Get JWT from secure storage (now async)
        const jwt = await getCurrentJWT();
        
        const headers: Record<string, string> = {
          ...this.defaultHeaders,
          ...(options.headers as Record<string, string>),
        };
        
        // Add Authorization header if JWT is available
        if (jwt) {
          headers['Authorization'] = `Bearer ${jwt}`;
        }
        
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          let errorData: any = {};
          try {
            errorData = await response.json();
          } catch {
            // If response is not JSON, use status text
            errorData = { message: response.statusText };
          }

          throw new ApiError(
            response.status,
            errorData.message || `HTTP ${response.status}: ${response.statusText}`,
            errorData.code,
            errorData.details
          );
        }

        // Handle empty responses
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          return await response.json();
        }
        
        // For non-JSON responses, return text
        return await response.text() as T;
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }
        
        // Network errors
        if (error instanceof TypeError) {
          throw new ApiError(0, 'Network error or server unavailable');
        }
        
        throw new ApiError(0, 'An unexpected error occurred');
      }
    };

    return this.retryRequest(requestFn);
  }

  // Convenience methods
  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers,
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

// Global API client instance
const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5050';
export const apiClient = new ApiClient(API_BASE_URL);

// Hook for API calls with error handling
import { useState, useCallback } from 'react';

export const useApiCall = <T>() => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  
  const call = useCallback(async (
    endpoint: string,
    options?: RequestInit
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await apiClient.request<T>(endpoint, options);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        setError(error);
        
        // Handle specific error codes
        switch (error.status) {
          case 401:
            // Unauthorized - clear user session (SECURE: only use sessionStorage)
            sessionStorage.removeItem('user_session');
            sessionStorage.removeItem('user_email_session');
            sessionStorage.removeItem('session_data');
            sessionStorage.removeItem('api_keys_cache');
            sessionStorage.removeItem('balance_cache');
            // Don't redirect automatically - let component handle it
            break;
          case 403:
            Logger.warn('Access denied:', error.message);
            break;
          case 429:
            Logger.warn('Rate limit exceeded:', error.message);
            break;
          case 500:
            Logger.error('Server error:', error.message);
            break;
        }
      } else {
        setError(new ApiError(0, 'An unexpected error occurred'));
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  return { call, loading, error, clearError };
};

// Utility function to get user-friendly error messages
export const getErrorMessage = (error: ApiError | null): string => {
  if (!error) return '';
  
  switch (error.status) {
    case 0:
      return 'Network error. Please check your connection and try again.';
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Please log in to continue.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    default:
      return error.message || 'An unexpected error occurred.';
  }
};

export { ApiError }; 