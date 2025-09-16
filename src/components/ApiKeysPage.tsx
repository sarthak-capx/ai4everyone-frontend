import React, { useEffect, useState, useRef } from 'react';
import { ExternalLink, Key, X as CloseIcon, Trash2, Home, Box, Cpu, BarChart2, Settings, FileText, LogOut, Loader2, Copy } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/TopSection.css';
import '../styles/BottomSection.css';
import '../styles/ApiKeysPage.css';
import '../styles/ModelsPage.css';
import { fetchApiKeysForUser } from './utils';
import { useUser } from './UserContext';
import { API_ENDPOINTS } from '../config';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import { ApiKeySchema, sanitizeInput, validateNavigationPath, safeNavigate } from '../utils/validation';

// Define the type for an API key row
interface ApiKeyRow {
  id: string;
  name: string;
  key?: string;  // Full key for newly created keys
  key_prefix?: string;  // Prefix for existing encrypted keys
  created_at: string;
  is_active?: boolean;
  last_used_at?: string;
  expires_at?: string;
}

const ApiKeysPage: React.FC = React.memo(() => {
  const [showModal, setShowModal] = useState(false);
  const [apiKeyName, setApiKeyName] = useState('');
  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showNewKeyModal, setShowNewKeyModal] = useState(false);
  const isCreatingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { user, setUser } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const { disconnect } = useDisconnect();

  // 🔒 SECURITY: Enhanced memory clearing function for API keys
  const clearApiKeysFromMemory = () => {
    try {
      // Only clear if there are actually keys to clear
      if (apiKeys.length > 0) {
        // Clear the state directly without overwriting with dummy data
        setApiKeys([]);
      }
      
      // Clear any cached data
      secureStorage.clearSensitiveData();
      
      console.log('🔒 API keys cleared from memory');
    } catch (error) {
      console.error('Error clearing API keys from memory:', error);
    }
  };

  // 🔒 SECURITY: Enhanced page visibility change handler
  const handleVisibilityChange = () => {
    // Only clear data when page is hidden for extended periods (not just tab switching)
    if (document.hidden) {
      // Set a timer to clear data after 5 minutes of being hidden
      const clearTimer = setTimeout(() => {
        clearApiKeysFromMemory();
      }, 5 * 60 * 1000); // 5 minutes
      
      // Store the timer so we can clear it if page becomes visible again
      (window as any).__clearApiKeysTimer = clearTimer;
    } else {
      // Page became visible again, clear the timer
      if ((window as any).__clearApiKeysTimer) {
        clearTimeout((window as any).__clearApiKeysTimer);
        (window as any).__clearApiKeysTimer = null;
      }
    }
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // 🔒 SECURITY: Enhanced navigation handler with memory clearing
  const handleNavigation = (path: string) => {
    // Clear sensitive data before navigation
    clearApiKeysFromMemory();
    
    // 🔒 SECURITY: Use safe navigation with validation
    if (safeNavigate(navigate, path)) {
      setMobileMenuOpen(false);
    }
  };

  // Check if route is active  
  const isActive = (path: string) => location.pathname === path;

  // Copy full API key to clipboard
  const handleCopyFullKey = async (fullKey: string) => {
    try {
      await navigator.clipboard.writeText(fullKey);
      
      // Show success feedback
      console.log('✅ Full API key copied to clipboard');
    } catch (error) {
      console.error('Failed to copy full API key:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = fullKey;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      console.log('✅ Full API key copied to clipboard (fallback method)');
    }
  };



  // 🔒 SECURITY: Enhanced logout handler with memory clearing
  const handleLogout = () => {
    // Clear sensitive data before logout
    clearApiKeysFromMemory();
    setUser(null);
    secureStorage.clearAll();
    disconnect();
    setMobileMenuOpen(false);
  };

  // 🔒 SECURITY: Enhanced API key fetching with memory management
  const fetchApiKeys = async () => {
    console.log('🔄 fetchApiKeys called');
    setLoading(true);
    setError('');
    try {
      const jwt = getCurrentJWTSync();
      console.log('🔑 JWT available:', !!jwt);
      if (!user || !jwt) {
        console.log('❌ No user or JWT, setting error');
        setError('Log in to view');
        setApiKeys([]);
        return;
      }

      // Try to use cached API keys first for better UX
      const cached = await secureStorage.getApiKeys();
      console.log('💾 Cached API keys:', cached.length);
      if (cached.length > 0) {
        setApiKeys(cached);
        // Don't clear loading state yet, still fetch fresh data
      }

      // Always fetch from server to ensure freshness
      console.log('🌐 Fetching from server...');
      const res = await fetch(API_ENDPOINTS.API_KEYS, {
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      const data = await res.json();
      const serverApiKeys = Array.isArray(data) ? data : [];
      console.log('📋 Server API keys:', serverApiKeys.length);
      
      // 🔒 SECURITY: No logging of sensitive data
      
      // 🔒 SECURITY: Clear old data before setting new data
      setApiKeys([]);
      
      // Update both state and cache
      setApiKeys(serverApiKeys);
      await secureStorage.setApiKeys(serverApiKeys);
      console.log('✅ API keys updated in state and cache');
      
      // 🔒 SECURITY: No aggressive memory clearing - let React handle state naturally
      
    } catch (err) {
      console.error('❌ Error fetching API keys:', err);
      setError('Network error while fetching API keys');
      // Don't clear API keys if we have cached data
      if (apiKeys.length === 0) {
        setApiKeys([]);
      }
    } finally {
      setLoading(false);
      console.log('🏁 fetchApiKeys completed');
    }
  };

  useEffect(() => {
    console.log('👤 ApiKeysPage: User changed:', user?.id, user?.email, 'Login timestamp:', user?.loginTimestamp);
    if (user?.id) {
      console.log('🔄 ApiKeysPage: Fetching API keys due to user change');
      fetchApiKeys();
    } else {
      console.log('🗑️ ApiKeysPage: Clearing API keys due to no user');
      setApiKeys([]);
    }
    // eslint-disable-next-line
  }, [user?.id, user?.loginTimestamp]);

  // Listen for user data fetch events (triggered after login)
  useEffect(() => {
    const handleUserDataFetched = (event: CustomEvent) => {
      console.log('📥 ApiKeysPage received event:', event.detail);
      if (event.detail?.type === 'apiKeys' && user?.id) {
        console.log('🔄 ApiKeysPage: Refetching API keys due to login event');
        // Refetch API keys when login data is fetched
        fetchApiKeys();
      }
    };

    console.log('🎧 ApiKeysPage: Setting up event listener for userDataFetched');
    window.addEventListener('userDataFetched', handleUserDataFetched as EventListener);
    
    return () => {
      console.log('🎧 ApiKeysPage: Removing event listener');
      window.removeEventListener('userDataFetched', handleUserDataFetched as EventListener);
    };
  }, [user?.id, user?.loginTimestamp]);

  // Create a new API key - BULLETPROOF VERSION
  const handleCreateKey = async () => {
    // MULTIPLE PROTECTION LAYERS
    if (isCreatingRef.current) {
      return;
    }
    
    if (isCreatingKey) {
      return;
    }
    
    if (abortControllerRef.current) {
      return;
    }

    // Validate and sanitize API key name
    const sanitizedName = sanitizeInput(apiKeyName);
    const validationResult = ApiKeySchema.safeParse({ name: sanitizedName });
    if (!validationResult.success) {
      setError(validationResult.error.errors[0].message);
      return;
    }

    if (!sanitizedName.trim()) {
      setError('Please enter a name for the API key');
      return;
    }

    // SET ALL PROTECTION FLAGS IMMEDIATELY
    isCreatingRef.current = true;
    setIsCreatingKey(true);
    
    // Create new AbortController for this request
    abortControllerRef.current = new AbortController();
    
    setError('');
    
    try {
      const jwt = getCurrentJWTSync();
      if (!user || !jwt) {
        setError('Please log in to create API keys');
        return;
      }

      const res = await fetch(API_ENDPOINTS.API_KEYS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ name: sanitizedName }),
        signal: abortControllerRef.current.signal
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setShowModal(false);
        setApiKeyName('');
        
        // Show the newly created API key to the user
        if (data.key) {
          setNewlyCreatedKey(data.key);
          setShowNewKeyModal(true);
        }
        
        // Refetch the API keys from backend to ensure latest list
        fetchApiKeys();
      } else {
        setError(data.error || 'Failed to create API key');
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Create API key request was cancelled');
        return;
      }
      console.error('Error creating API key:', err);
      setError('Network error while creating API key');
    } finally {
      // RESET ALL PROTECTION FLAGS
      isCreatingRef.current = false;
      setIsCreatingKey(false);
      abortControllerRef.current = null;
    }
  };

  const cancelOngoingRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    isCreatingRef.current = false;
    setIsCreatingKey(false);
  };

  // 🔒 SECURITY: Comprehensive cleanup on component unmount
  useEffect(() => {
    // Add page visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      // Remove page visibility listener
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
      // Clear any pending timers
      if ((window as any).__clearApiKeysTimer) {
        clearTimeout((window as any).__clearApiKeysTimer);
        (window as any).__clearApiKeysTimer = null;
      }
      
      // Cancel any ongoing requests
      cancelOngoingRequest();
      
      // 🔒 SECURITY: Clear sensitive data from memory
      clearApiKeysFromMemory();
    };
  }, []); // Empty dependency array for mount/unmount only

  // 🔒 SECURITY: Enhanced delete function with memory clearing
  const handleDeleteKey = async (keyId: string) => {
    try {
      const jwt = getCurrentJWTSync();
      if (!user || !jwt) {
        setError('Please log in to delete API keys');
        return;
      }

      const res = await fetch(`${API_ENDPOINTS.API_KEYS}/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwt}`
        }
      });

      if (res.ok) {
        // Update state with filtered keys first
        const updatedKeys = apiKeys.filter(key => key.id !== keyId);
        setApiKeys(updatedKeys);
        
        // Update the cache with the new list
        await secureStorage.setApiKeys(updatedKeys);
        
        // 🔒 SECURITY: Only clear memory if no keys remain
        if (updatedKeys.length === 0) {
          // Small delay to ensure UI updates first
          setTimeout(() => {
            clearApiKeysFromMemory();
          }, 100);
        }
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete API key');
      }
    } catch (err) {
      console.error('Error deleting API key:', err);
      setError('Network error while deleting API key');
    }
  };

  return (
    <div className="models-page">
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-logo">
          <img 
            src="/images/logo.png" 
            alt="Logo" 
            className="logo-img"
          />
        </div>
        <div className="mobile-menu-icon" onClick={toggleMobileMenu}>
          <img 
            src="/images/menu_alt_02.png" 
            alt="Menu" 
            className="menu-icon-img"
          />
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <>
          {/* Backdrop */}
          <div className="mobile-sidebar-backdrop" onClick={toggleMobileMenu}></div>
          
          {/* Mobile Sidebar */}
          <div className="mobile-sidebar">
            {/* Header */}
            <div className="mobile-sidebar-header">
              <img src="/images/logo.png" alt="UNSTOPPABLE" className="mobile-sidebar-logo" />
            </div>

            {/* Navigation */}
            <nav className="mobile-sidebar-nav">
              <div 
                className={`mobile-nav-item ${isActive('/') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/')}
              >
                <Home size={18} />
                <span>Home</span>
              </div>
              
              <div 
                className={`mobile-nav-item ${isActive('/models') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/models')}
              >
                <Box size={18} />
                <span>Models</span>
              </div>
              
              <div 
                className={`mobile-nav-item ${isActive('/playground') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/playground')}
              >
                <Cpu size={18} />
                <span>Playground</span>
              </div>
              
              <div 
                className={`mobile-nav-item ${isActive('/usage') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/usage')}
              >
                <BarChart2 size={18} />
                <span>Usage</span>
              </div>
              
              <div 
                className={`mobile-nav-item ${isActive('/api-keys') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/api-keys')}
              >
                <Key size={18} />
                <span>API Keys</span>
              </div>
              
              <div 
                className={`mobile-nav-item ${isActive('/settings') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/settings')}
              >
                <Settings size={18} />
                <span>Settings</span>
              </div>
              
              <div 
                className={`mobile-nav-item docs-item ${isActive('/docs') ? 'active' : ''}`} 
                onClick={() => handleNavigation('/docs')}
              >
                <FileText size={18} />
                <span>Docs</span>
                <ExternalLink size={14} className="external-icon" />
              </div>
            </nav>

            {/* Footer */}
            <div className="mobile-sidebar-footer">
              {/* Social Icons */}
              <div className="mobile-social-icons">
                <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M21.944 2.112a1.5 1.5 0 0 0-1.6-.2L2.7 9.1a1.5 1.5 0 0 0 .1 2.8l4.7 1.6 1.7 5.2a1.5 1.5 0 0 0 2.7.3l2.1-3.2 4.6 3.4a1.5 1.5 0 0 0 2.4-1l2-15a1.5 1.5 0 0 0-.526-1.188zM9.7 15.2l-1.2-3.7 8.2-6.2-7 7.6zm2.2 3.1l-1.1-3.3 1.7-1.3 2.1 1.5zm7.1-1.2-4.2-3.1 5.2-7.6z" fill="#9B9797"/>
                  </svg>
                </a>
                
                <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" aria-label="Discord">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#9B9797"/>
                  </svg>
                </a>
                
                <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#9B9797"/>
                  </svg>
                </a>
              </div>

              {/* User Section */}
              <div className="mobile-user-section">
                {user ? (
                  <div className="mobile-user-profile">
                    <div className="mobile-user-info">
                      <div className="mobile-avatar">
                        <span>{user.name ? user.name[0].toUpperCase() : 'U'}</span>
                      </div>
                      <span className="mobile-username">
                        {user.email.length > 15 ? user.email.slice(0, 15) + '...' : user.email}
                      </span>
                    </div>
                    <button className="mobile-logout-btn" onClick={handleLogout} aria-label="Logout">
                      <LogOut size={18} color="#888" />
                    </button>
                  </div>
                ) : (
                  <div className="mobile-connect-section">
                    <ConnectButton />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Top Banner */}
      <div className="banner-container">
        <img 
          src="/images/quminsoda2_isometric_view_pixel_art_of_a_secure_server_room_w_2d9eee63-d8d8-4067-a459-d8d9b92eca8d_0 1.png" 
          alt="AI4Everyone Banner" 
          className="banner-image desktop-banner" 
        />
        <img 
          src="/images/quminsoda2_isometric_view_pixel_art_of_a_secure_server_room_w_2d9eee63-d8d8-4067-a459-d8d9b92eca8d_0 1.png" 
          alt="AI4Everyone Mobile Banner" 
          className="banner-image mobile-banner" 
        />
      </div>

      {/* Heading, subtitle, and create key button */}
      <div className="content-container" style={{ padding: 0, marginTop: '-50px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="content-header-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
          <div style={{ flex: 1 }}>
            <h1 className="mainheading" style={{ fontWeight: 900, fontSize: 40, marginBottom: 0 }}>API KEYS</h1>
            <p className="sub_title" style={{ marginBottom: 0 }}>Your access gateway to the Unstoppable API platform.</p>
            {/* Mobile-only button below heading */}
            <button 
              className="create-key-btn-mobile"
              style={{ 
                background: isCreatingKey ? '#666' : '#fff', 
                color: '#000', 
                fontWeight: 700, 
                fontSize: 18, 
                borderRadius: 10, 
                border: 'none', 
                padding: '12px 28px', 
                cursor: isCreatingKey ? 'not-allowed' : 'pointer', 
                marginTop: 18, 
                display: 'none',
                opacity: isCreatingKey ? 0.7 : 1
              }}
              onClick={() => !isCreatingRef.current && setShowModal(true)}
              disabled={isCreatingKey || isCreatingRef.current}
            >
              {isCreatingKey ? 'Creating...' : '+ Create Key'}
            </button>
          </div>
          {/* Desktop-only button to the right */}
          <button 
            className="create-key-btn-desktop"
            style={{ 
              background: isCreatingKey ? '#666' : '#fff', 
              color: '#000', 
              fontWeight: 700, 
              fontSize: 18, 
              borderRadius: 10, 
              border: 'none', 
              padding: '12px 28px', 
              cursor: isCreatingKey ? 'not-allowed' : 'pointer', 
              marginLeft: 24,
              opacity: isCreatingKey ? 0.7 : 1
            }}
            onClick={() => !isCreatingRef.current && setShowModal(true)}
            disabled={isCreatingKey || isCreatingRef.current}
          >
            {isCreatingKey ? 'Creating...' : '+ Create Key'}
          </button>
        </div>
      </div>

      {/* Modal Popup */}
      {showModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
          <div className="modal-card" style={{ background: '#181818', borderRadius: 20, boxShadow: '0 4px 32px 0 rgba(0,0,0,0.45)', border: '1.5px solid #333', padding: 36, minWidth: 500, maxWidth: '90vw', position: 'relative', display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Loading overlay */}
            {isCreatingKey && (
              <div 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.8)',
                  borderRadius: 20,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10,
                  color: '#fff',
                  fontSize: 18,
                  fontWeight: 600
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
                  Creating API Key...
                </div>
              </div>
            )}
            <button 
              onClick={() => !isCreatingKey && setShowModal(false)} 
              style={{ 
                position: 'absolute', 
                top: 18, 
                right: 18, 
                background: 'none', 
                border: 'none', 
                cursor: isCreatingKey ? 'not-allowed' : 'pointer', 
                zIndex: 2,
                opacity: isCreatingKey ? 0.5 : 1
              }} 
              disabled={isCreatingKey}
              aria-label="Close"
            >
              <CloseIcon size={28} color="#fff" />
            </button>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: 'Orbitron, Schibsted Grotesk, Arial Black, sans-serif', fontWeight: 900, fontSize: 28, color: '#fff', lineHeight: 1.1, letterSpacing: 1, textTransform: 'uppercase' }}>
                Create a<br />New API Key
              </div>
            </div>
            <input
              className="modal-input"
              type="text"
              placeholder="API Key Name"
              value={apiKeyName}
              onChange={e => {
                if (isCreatingKey) return; // Prevent changes during creation
                let value = e.target.value.replace(/[^a-zA-Z0-9]/g, '');
                // 🔒 SECURITY: Add length validation to prevent DoS
                if (value.length <= 50) { // Match Zod schema max length
                  setApiKeyName(value);
                }
              }}
              maxLength={50} // HTML attribute for additional protection
              disabled={isCreatingKey}
              aria-label="API Key Name"
              style={{ 
                minHeight: 24, 
                display: 'flex', 
                alignItems: 'center',
                opacity: isCreatingKey ? 0.7 : 1,
                cursor: isCreatingKey ? 'not-allowed' : 'text'
              }}
            />
            <div style={{ display: 'flex', gap: 18, marginTop: 8 }}>
              <button
                onClick={() => !isCreatingKey && setShowModal(false)}
                disabled={isCreatingKey}
                style={{
                  flex: 1,
                  background: isCreatingKey ? '#444' : '#23232a',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 16,
                  borderRadius: 12,
                  border: 'none',
                  padding: '14px 0',
                  cursor: isCreatingKey ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s',
                  opacity: isCreatingKey ? 0.7 : 1,
                }}
              >
                Cancel
              </button>
              <button
                style={{
                  flex: 2,
                  background: isCreatingKey ? '#666' : '#fff',
                  color: '#181818',
                  fontWeight: 700,
                  fontSize: 16,
                  borderRadius: 12,
                  border: 'none',
                  padding: '14px 0',
                  cursor: isCreatingKey ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  transition: 'background 0.2s',
                  opacity: isCreatingKey ? 0.7 : 1,
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isCreatingRef.current && !isCreatingKey && !abortControllerRef.current) {
                    handleCreateKey();
                  }
                }}
                disabled={isCreatingKey || isCreatingRef.current || !!abortControllerRef.current}
              >
                {isCreatingKey ? (
                  <>
                    <Loader2 size={20} style={{ marginRight: 4, animation: 'spin 1s linear infinite' }} /> 
                    Creating...
                  </>
                ) : (
                  <>
                    <Key size={20} style={{ marginRight: 4 }} /> 
                    Create API Key
                  </>
                )}
              </button>
            </div>
            {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
          </div>
        </div>
      )}

      {/* New API Key Success Modal */}
      {showNewKeyModal && newlyCreatedKey && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1a1a1a',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            position: 'relative',
            border: '1px solid #333'
          }}>
            <button 
              onClick={() => {
                setShowNewKeyModal(false);
                setNewlyCreatedKey(null);
              }}
              style={{ 
                position: 'absolute', 
                top: 18, 
                right: 18, 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer', 
                zIndex: 2
              }}
              aria-label="Close"
            >
              <CloseIcon size={28} color="#fff" />
            </button>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ 
                fontFamily: 'Orbitron, Schibsted Grotesk, Arial Black, sans-serif', 
                fontWeight: 900, 
                fontSize: 24, 
                color: '#4CAF50', 
                lineHeight: 1.1, 
                letterSpacing: 1, 
                textTransform: 'uppercase',
                marginBottom: 8
              }}>
                ✅ API Key Created Successfully!
              </div>
              <div style={{ color: '#888', fontSize: 14 }}>
                Copy your API key now - it won't be shown again!
              </div>
            </div>
            
            <div style={{
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: 24,
              position: 'relative'
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '12px',
                color: '#fff',
                wordBreak: 'break-all',
                lineHeight: 1.4,
                marginBottom: 12
              }}>
                {newlyCreatedKey}
              </div>
              <button
                onClick={() => handleCopyFullKey(newlyCreatedKey)}
                style={{
                  background: '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#45a049'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#4CAF50'}
              >
                <Copy size={16} />
                Copy API Key
              </button>
            </div>
            
            <div style={{ color: '#ff9800', fontSize: 12, marginBottom: 24 }}>
              ⚠️ Important: Store this API key securely. You won't be able to see it again after closing this dialog.
            </div>
            
            <button
              onClick={() => {
                setShowNewKeyModal(false);
                setNewlyCreatedKey(null);
              }}
              style={{
                background: '#fff',
                color: '#181818',
                fontWeight: 700,
                fontSize: 16,
                borderRadius: 12,
                border: 'none',
                padding: '14px 24px',
                cursor: 'pointer',
                width: '100%',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
            >
              Got it, I've copied my API key
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="table-container" style={{ marginTop: 32, width: '90%' }}>
        <table className="data-table" style={{ fontSize: '14px' }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Key</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4}>Loading...</td></tr>
            ) : apiKeys.length === 0 ? (
              <tr><td colSpan={4}>No API keys found.</td></tr>
            ) : (
              apiKeys.map((row, idx) => (
                <tr key={row.id || idx}>
                  <td>{row.name}</td>
                  <td>
                    <span>{row.key || (row.key_prefix ? `${row.key_prefix}...` : 'N/A')}</span>
                  </td>
                  <td>{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</td>
                  <td style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    minWidth: '150px',
                    padding: '8px 16px'
                  }}>
                    <span style={{ flex: '1' }}>Tokens/sec</span>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      flex: '1' 
                    }}>
                      <button
                        onClick={() => handleDeleteKey(row.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: '4px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '4px',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        title="Delete API Key"
                      >
                        <Trash2 size={18} color="#FF4444" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="table-note" style={{ margin: '25px' , textAlign: 'left' }}>
      Please Note: The full API key is shown once during creation - copy it immediately. In the table above, you can only see the key prefix.
      </p>

      {/* Docs Box */}
      <div
        className="docs-box"
        onClick={() => navigate('/docs')}
        style={{ cursor: 'pointer', marginTop: '40px' }}
      >
        <img src="/images/Icon.png" alt="Document Icon" className="docs-icon-img" />
        <div className="docs-content">
          <h3 className="docs-heading-gabriella">View Documentation</h3>
          <p className="docs-subtitle">Learn more about how generations and logging work.</p>
        </div>
        <ExternalLink size={24} className="docs-icon" />
      </div>
    </div>
  );
});

export default ApiKeysPage; 