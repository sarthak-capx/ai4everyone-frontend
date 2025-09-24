import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import HomePage from './pages/HomePage';
import ModelsPage from './pages/ModelsPage';
import ApiKeysPage from './pages/ApiKeysPage';
import SettingsPage from './pages/SettingsPage';
import PlaygroundPage from './pages/PlaygroundPage';
import UsagePage from './pages/UsagePage';
import DocsPage from './pages/DocsPage';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/App.css';
import AppLayout from './pages/AppLayout';

import '@rainbow-me/rainbowkit/styles.css';
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { mainnet, polygon, arbitrum, optimism, base, sepolia } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider } from './contexts/userContext';
import { initClipboardSecurity } from './utils/secureClipboard';
import { API_ENDPOINTS } from './config';

const validatePackageIntegrity = () => {
  const errors: string[] = [];

  try {
    // Validate RainbowKit
    if (typeof getDefaultConfig !== 'function') {
      errors.push('RainbowKit getDefaultConfig function is compromised');
    }
    if (typeof RainbowKitProvider !== 'function') {
      errors.push('RainbowKit RainbowKitProvider function is compromised');
    }

    // Validate Wagmi
    if (typeof WagmiProvider !== 'function') {
      errors.push('Wagmi WagmiProvider function is compromised');
    }
    if (typeof http !== 'function') {
      errors.push('Wagmi http function is compromised');
    }

    // Check for suspicious modifications
    const rainbowKitFunctions = Object.getOwnPropertyNames(RainbowKitProvider.prototype || {});
    const wagmiFunctions = Object.getOwnPropertyNames(WagmiProvider.prototype || {});

    // Look for suspicious function names that might indicate tampering
    const suspiciousPatterns = ['steal', 'hack', 'malicious', 'inject', 'override'];
    for (const pattern of suspiciousPatterns) {
      if (rainbowKitFunctions.some(fn => fn.toLowerCase().includes(pattern))) {
        errors.push(`Suspicious function detected in RainbowKit: ${pattern}`);
      }
      if (wagmiFunctions.some(fn => fn.toLowerCase().includes(pattern))) {
        errors.push(`Suspicious function detected in Wagmi: ${pattern}`);
      }
    }

    // Additional security checks for function tampering
    const originalFunctions = {
      getDefaultConfig: getDefaultConfig.toString(),
      WagmiProvider: WagmiProvider.toString()
    };

    // Check if functions have been modified (basic check)
    if (originalFunctions.getDefaultConfig.includes('fetch') &&
      originalFunctions.getDefaultConfig.includes('attacker')) {
      errors.push('RainbowKit getDefaultConfig function appears to be tampered with');
    }

    if (originalFunctions.WagmiProvider.includes('fetch') &&
      originalFunctions.WagmiProvider.includes('attacker')) {
      errors.push('Wagmi WagmiProvider function appears to be tampered with');
    }

    // Check for unexpected network requests in function definitions
    const networkPatterns = ['fetch(', 'XMLHttpRequest', 'navigator.sendBeacon'];
    for (const pattern of networkPatterns) {
      if (originalFunctions.getDefaultConfig.includes(pattern)) {
        errors.push(`Suspicious network request pattern detected in RainbowKit: ${pattern}`);
      }
      if (originalFunctions.WagmiProvider.includes(pattern)) {
        errors.push(`Suspicious network request pattern detected in Wagmi: ${pattern}`);
      }
    }

  } catch (error) {
    errors.push(`Package integrity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  if (errors.length > 0) {
    console.error('Package integrity validation failed:', errors);
    throw new Error(`Security validation failed: ${errors.join(', ')}`);
  }

  console.log('Package integrity validation passed');
};

const config = getDefaultConfig({
  appName: 'AI4EVERYONE',
  projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
  chains: [mainnet, polygon, arbitrum, optimism, base, sepolia],
  transports: {
    [mainnet.id]: http(),
    [polygon.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [sepolia.id]: http()
  }
})

const queryClient = new QueryClient();

function App() {

  return (
    <ErrorBoundary onError={(error, errorInfo) => {
      // Send to monitoring service
      console.error('App error:', error, errorInfo);
    }}>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <UserProvider>
              <Router>
                <ErrorBoundary fallback={<div>Page failed to load</div>}>
                  <Routes>
                    <Route element={<AppLayout />}>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/models" element={<ModelsPage />} />
                      <Route path="/api-keys" element={<ApiKeysPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/playground" element={<PlaygroundPage />} />
                      <Route path="/usage" element={<UsagePage />} />
                      <Route path="/docs" element={<DocsPage />} />
                    </Route>
                  </Routes>
                </ErrorBoundary>
              </Router>
            </UserProvider>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

export default App;