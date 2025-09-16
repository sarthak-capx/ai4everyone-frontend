// Secure API Configuration with HTTPS enforcement
const getApiBaseUrl = (): string => {
  const url = import.meta.env.VITE_BACKEND_URL;

  // Production environment checks
  if (import.meta.env.PROD) {
    // Ensure URL is provided in production
    if (!url) {
      throw new Error('Backend URL is required in production');
    }

    // Force HTTPS in production
    if (url.startsWith('http://')) {
      throw new Error('HTTPS is required in production. HTTP is not allowed.');
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      throw new Error('Invalid backend URL format');
    }

    return url;
  }

  // Development environment - allow HTTP for localhost
  return url || 'http://localhost:5000';
};

// Export the secure API URL
export const API_BASE_URL = getApiBaseUrl();

// API Endpoints
export const API_ENDPOINTS = {
  // Auth
  WALLET_LOGIN: `${API_BASE_URL}/auth/wallet-login`,
  WALLET_CONFIG: `${API_BASE_URL}/auth/wallet-config`,

  // API Keys
  API_KEYS: `${API_BASE_URL}/api-keys`,


  // Balance
  BALANCE: `${API_BASE_URL}/balance`,
  BALANCE_ADD: `${API_BASE_URL}/balance/add`,
  PAYMENT_HISTORY: `${API_BASE_URL}/balance/payment-history`,
  PAYMENT_HISTORY_JWT: `${API_BASE_URL}/balance/payment-history-jwt`,

  // AI Endpoints
  CHAT_COMPLETIONS: `${API_BASE_URL}/v1/chat/completions`,
  COMPLETIONS: `${API_BASE_URL}/v1/completions`,
  COMPLETIONS_STATUS: (taskId: string) => `${API_BASE_URL}/v1/completions/status/${taskId}`,
  COMPLETIONS_RESULT: (taskId: string) => `${API_BASE_URL}/v1/completions/result/${taskId}`,

  // Logs - FIXED: Changed from /v1/logs to /logs
  LOGS: `${API_BASE_URL}/logs`,

  // Verification
  VERIFY_WALLET: `${API_BASE_URL}/verify/wallet-address`,
  VERIFY_PAYMENT: `${API_BASE_URL}/verify/payment`,

  // Usage
  USAGE_MONTHLY_STATS: `${API_BASE_URL}/usage/monthly-stats`,

  // New Payments API
  PAYMENTS_QUOTE: `${API_BASE_URL}/payments/quote`,
  PAYMENTS_STATUS: (receiptId: string) => `${API_BASE_URL}/payments/status/${receiptId}`,
  PAYMENTS_VERIFY: `${API_BASE_URL}/payments/verify-payment`,
  PAYMENTS_GET_ALL_PAYMENTS: (userAddress: string) => `${API_BASE_URL}/payments/payments/${userAddress}`,
  PAYMENTS_ASSETS: (network: string) => `${API_BASE_URL}/payments/assets?network=${encodeURIComponent(network)}`,
}; 