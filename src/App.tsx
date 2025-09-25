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
});

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