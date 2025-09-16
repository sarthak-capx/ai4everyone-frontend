import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { checkBrowserSecurity, getCompatibilityErrors } from './utils/browserSecurity';
import BrowserCompatibilityErrorComponent from './components/BrowserCompatibilityError';
import Logger from './utils/logger';

// Production logging configuration
Logger.disableInProduction();

// Initialize browser security checks before app starts
const initializeApp = () => {
  // Check browser compatibility (simplified)
  const isCompatible = checkBrowserSecurity();
  const errors = getCompatibilityErrors();
  
  // Only show error screen if there are critical errors
  const criticalErrors = errors.filter(error => error.severity === 'critical');
  
  if (criticalErrors.length > 0) {
    // Show browser compatibility error for critical issues
    const container = document.getElementById('root');
    
    if (container) {
      const root = createRoot(container);
      root.render(
        <BrowserCompatibilityErrorComponent 
          errors={errors}
          onContinue={() => {
            // User chose to continue anyway - start the app
            startApp();
          }}
          onRetry={() => {
            // Retry the check
            window.location.reload();
          }}
        />
      );
    }
    return;
  }
  
  // Start the app normally (even with warnings)
  startApp();
};

// Function to start the app
const startApp = () => {
  const container = document.getElementById('root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  }
};

// Start the application
initializeApp();
