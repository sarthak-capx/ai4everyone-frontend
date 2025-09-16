import React from 'react';
import { BrowserCompatibilityError } from '../utils/browserSecurity';

interface BrowserCompatibilityErrorProps {
  errors: BrowserCompatibilityError[];
  onContinue?: () => void;
  onRetry?: () => void;
}

const BrowserCompatibilityErrorComponent: React.FC<BrowserCompatibilityErrorProps> = ({ 
  errors, 
  onContinue,
  onRetry 
}) => {
  const criticalErrors = errors.filter(error => error.severity === 'critical');
  const warningErrors = errors.filter(error => error.severity === 'warning');

  const getBrowserUpdateLinks = () => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Chrome')) {
      return 'https://www.google.com/chrome/';
    } else if (userAgent.includes('Firefox')) {
      return 'https://www.mozilla.org/firefox/';
    } else if (userAgent.includes('Safari')) {
      return 'https://www.apple.com/safari/';
    } else if (userAgent.includes('Edge')) {
      return 'https://www.microsoft.com/edge/';
    }
    
    return 'https://browsehappy.com/';
  };

  // If only warnings, show a simple banner instead of full screen
  if (criticalErrors.length === 0 && warningErrors.length > 0) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#ffa726',
        color: '#000',
        padding: '12px 20px',
        fontSize: '14px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'Orbitron, Arial, sans-serif'
      }}>
        <div style={{ flex: 1 }}>
          <strong>⚠️ Browser Compatibility Notice:</strong> Your browser has some compatibility warnings, but the app should still work. 
          <a 
            href={getBrowserUpdateLinks()} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ color: '#000', textDecoration: 'underline', marginLeft: '8px' }}
          >
            Update browser
          </a>
        </div>
        <button
          onClick={onContinue}
          style={{
            background: 'none',
            border: '1px solid #000',
            borderRadius: '4px',
            padding: '4px 12px',
            cursor: 'pointer',
            marginLeft: '12px'
          }}
        >
          Continue
        </button>
      </div>
    );
  }

  // If critical errors, show full screen (but still allow continue)
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#1a1a1a',
      color: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Orbitron, Arial, sans-serif',
      zIndex: 9999
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
        background: '#2a2a2a',
        borderRadius: '12px',
        padding: '24px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            margin: '0 0 8px 0',
            color: '#ff6b6b'
          }}>
            Browser Compatibility Issues
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#ccc',
            margin: 0
          }}>
            Some features may not work properly with your current browser.
          </p>
        </div>

        {/* Critical Errors */}
        {criticalErrors.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: '0 0 12px 0',
              color: '#ff6b6b'
            }}>
              Critical Issues ({criticalErrors.length})
            </h2>
            <div style={{ marginBottom: '12px' }}>
              {criticalErrors.map((error, index) => (
                <div key={index} style={{
                  background: '#3a1a1a',
                  border: '1px solid #ff4444',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    color: '#ff6b6b'
                  }}>
                    {error.feature}
                  </div>
                  <div style={{ color: '#ddd' }}>
                    {error.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warning Errors */}
        {warningErrors.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              margin: '0 0 12px 0',
              color: '#ffa726'
            }}>
              Warnings ({warningErrors.length})
            </h2>
            <div style={{ marginBottom: '12px' }}>
              {warningErrors.map((error, index) => (
                <div key={index} style={{
                  background: '#3a2a1a',
                  border: '1px solid #ffa726',
                  borderRadius: '6px',
                  padding: '12px',
                  marginBottom: '8px',
                  fontSize: '14px'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    marginBottom: '4px',
                    color: '#ffa726'
                  }}>
                    {error.feature}
                  </div>
                  <div style={{ color: '#ddd' }}>
                    {error.message}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Solutions */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            margin: '0 0 12px 0',
            color: '#4caf50'
          }}>
            Recommendations
          </h2>
          <div style={{
            background: '#1a3a1a',
            border: '1px solid #4caf50',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '14px'
          }}>
            <ul style={{
              margin: '0 0 12px 0',
              paddingLeft: '20px',
              color: '#ddd'
            }}>
              <li>Update your browser to the latest version</li>
              <li>Enable JavaScript in your browser settings</li>
              <li>Use a modern browser (Chrome, Firefox, Safari, Edge)</li>
            </ul>
            <div style={{ textAlign: 'center' }}>
              <a
                href={getBrowserUpdateLinks()}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  background: '#4caf50',
                  color: '#ffffff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Download Latest Browser
              </a>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ textAlign: 'center' }}>
          {onContinue && (
            <button
              onClick={onContinue}
              style={{
                background: '#4caf50',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Continue Anyway
            </button>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              style={{
                background: '#2196f3',
                color: '#ffffff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                marginRight: '8px'
              }}
            >
              Retry Check
            </button>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#666',
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrowserCompatibilityErrorComponent; 