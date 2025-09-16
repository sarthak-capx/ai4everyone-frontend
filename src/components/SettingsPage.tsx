import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/TopSection.css';
import '../styles/BottomSection.css';
import { CheckCircle, Mail, ShieldCheck, Fingerprint, ExternalLink, Home, Box, Cpu, BarChart2, Key, Settings, FileText, LogOut, AlertCircle } from 'lucide-react';
import { useUser } from './UserContext';
import { fetchUserBalance } from './utils';
import { API_ENDPOINTS } from '../config';
import { ConnectButton, useConnectModal } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import { useApiCall, getErrorMessage } from '../utils/apiClient';
import { safeNavigate } from '../utils/validation';

interface PaymentTransaction {
  hash: string;
  amount: number;
  created_at: string;
}

const SettingsPage = React.memo(() => {
  const { user, setUser } = useUser();
  const { disconnect } = useDisconnect();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { openConnectModal } = useConnectModal();
  
  // API client for payment history
  const { call: fetchPaymentHistoryApi, loading: isLoadingHistory, error: paymentHistoryError, clearError: clearPaymentHistoryError } = useApiCall<{ transactions: PaymentTransaction[] }>();

  // Repopulate API keys cache if missing when opening Settings
  useEffect(() => {
    const repopulateApiKeys = async () => {
      const jwt = getCurrentJWTSync();
      if (!jwt || !user?.id) return;
      try {
        if (!sessionStorage.getItem('api_keys_cache')) {
          const res = await fetch(API_ENDPOINTS.API_KEYS, {
            headers: { Authorization: `Bearer ${jwt}` }
          });
          if (res.ok) {
            const data = await res.json();
            const serverApiKeys = Array.isArray(data) ? data : [];
            await secureStorage.setApiKeys(serverApiKeys);
          }
        }
      } catch (err) {
        console.warn('Settings: failed to repopulate api_keys_cache', err);
      }
    };
    repopulateApiKeys();
  }, [user?.id]);

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  // Handle navigation
  const handleNavigation = (path: string) => {
    // 🔒 SECURITY: Use safe navigation with validation
    if (safeNavigate(navigate, path)) {
      setMobileMenuOpen(false);
    }
  };

  // Check if route is active  
  const isActive = (path: string) => location.pathname === path;

  // Handle logout
  const handleLogout = async () => {
    const jwt = getCurrentJWTSync();
    if (!user?.email || !jwt) return;
    
    try {
      await fetchUserBalance(user.email, jwt).then(bal => {
        console.log('Final balance before logout:', bal);
      });
    } catch (error) {
      console.error('Error fetching final balance:', error);
    }
    
    setUser(null);
    secureStorage.clearAll();
    disconnect();
    setMobileMenuOpen(false);
  };

  useEffect(() => {
    console.log('👤 SettingsPage: User changed:', user?.id, user?.email, 'Login timestamp:', user?.loginTimestamp);
    if (user?.id) {
      // Try to use cached balance first
      const cached = secureStorage.getBalance();
      if (cached > 0) {
        setBalance(cached);
      }
      setIsLoading(true);
      const jwt = getCurrentJWTSync();
      if (jwt) {
        fetchUserBalance(user.email, jwt).then(bal => {
          if (bal !== null) {
            setBalance(bal);
            secureStorage.setBalance(bal);
          }
          setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }

      // Only fetch payment history if we have a valid JWT
      if (jwt) {
        fetchPaymentHistory();
      }
    } else {
      setBalance(null);
      setIsLoading(false);
      setPaymentHistory([]);
      // Clear any payment history errors when user logs out
      clearPaymentHistoryError();
    }
  }, [user?.id, user?.loginTimestamp]);

  // Listen for user data fetch events (triggered after login)
  useEffect(() => {
    const handleUserDataFetched = (event: CustomEvent) => {
      console.log('📥 SettingsPage received event:', event.detail);
      if (event.detail?.type === 'balance' && user?.id) {
        console.log('💰 SettingsPage: Updating balance due to login event');
        // Update balance when login data is fetched
        const newBalance = event.detail.data;
        if (newBalance !== null) {
          setBalance(newBalance);
          secureStorage.setBalance(newBalance);
        }
        setIsLoading(false);
      } else if (event.detail?.type === 'paymentHistory' && user?.id) {
        console.log('📊 SettingsPage: Updating payment history due to login event');
        // Update payment history when login data is fetched
        const transactions = event.detail.data;
        setPaymentHistory(transactions || []);
        // Clear any payment history errors since we successfully got the data
        clearPaymentHistoryError();
      }
    };

    console.log('🎧 SettingsPage: Setting up event listener for userDataFetched');
    window.addEventListener('userDataFetched', handleUserDataFetched as EventListener);
    
    return () => {
      console.log('🎧 SettingsPage: Removing event listener');
      window.removeEventListener('userDataFetched', handleUserDataFetched as EventListener);
    };
  }, [user?.id, user?.loginTimestamp]);

  const fetchPaymentHistory = async () => {
    console.log('📊 fetchPaymentHistory called');
    if (!user) {
      console.log('❌ No user, skipping payment history fetch');
      return;
    }
    
    const jwt = getCurrentJWTSync();
    if (!jwt) {
      console.log('❌ No JWT available, skipping payment history fetch');
      return;
    }
    
    console.log('🌐 Fetching payment history from server...');
    // Use JWT-based payment history endpoint
    const result = await fetchPaymentHistoryApi('/balance/payment-history-jwt');

    if (result) {
      console.log('📊 Payment history fetched:', result.transactions?.length || 0, 'transactions');
      setPaymentHistory(result.transactions || []);
    } else {
      console.log('📊 No payment history data received');
      setPaymentHistory([]);
    }
  };



  // Helper to shorten the user email
  function shortId(email?: string) {
    if (!email) return '-';
    if (email.length <= 12) return email;
    return email.slice(0, 6) + '...' + email.slice(-4);
  }

  // Helper to generate display name from wallet address
  function getDisplayName(user: any) {
    if (user?.name) return user.name;
    if (user?.email) {
      // Show full wallet address as name
      return user.email;
    }
    return 'Unknown User';
  }

  // Helper to shorten transaction hash
  function shortHash(hash: string) {
    if (hash.length <= 20) return hash;
    return hash.slice(0, 10) + '...' + hash.slice(-10);
  }

  // Helper to format date
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString();
  }

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
                        <span>{user.name ? user.name[0].toUpperCase() : user.email.slice(2, 3).toUpperCase()}</span>
                      </div>
                      <span className="mobile-username">
                        {user.name || (user.email.length > 15 ? user.email.slice(0, 15) + '...' : user.email)}
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

      <div className="settings-content-container">
        {/* Settings Header */}
        <h1 className="settings-header">Settings</h1>
        <p className="settings-desc">Manage your account, balance, and payment options here.</p>

        {/* Account Info Card Only */}
        <div className="settings-cards-row">
          {/* Account Info Card */}
          <div className="settings-account-card">
            <div className="settings-card-title">Account information</div>
            <div className="settings-card-content">Name: <span style={{ fontWeight: 700 }}>{getDisplayName(user)}</span></div>
            <div className="settings-card-content">User ID: <span style={{ fontWeight: 700 }}>{user?.id ? `${user.id.slice(0, 8)}...` : '-'}</span></div>
          </div>
        </div>

        {/* Billing Header */}
        <h1 className="settings-section-heading">Billing</h1>
        <p className="settings-section-desc">Check your current balance and add more money when needed.</p>

        {/* Billing Info Section */}
        <div className="settings-balance-section">
          <div className="settings-balance-title">
            Account Balance
            <div className="settings-balance-amount">
              <span className="currency">$</span>{isLoading ? '...' : (balance !== null ? balance.toFixed(2) : '0.00')}
            </div>
          </div>
          <button className="settings-balance-button" onClick={() => navigate('/usage')}>Add to Balance</button>
        </div>

        {/* Automatic Top-Up and Payment Methods */}
        <div style={{ display: 'flex', gap: 32, marginBottom: 40, maxWidth: 900 }}>
          {/* Automatic Top-Up Card */}
          <div style={{ background: '#181818', border: '1.5px solid #444', borderRadius: 18, padding: 32, flex: 1, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 280 }}>
            <div style={{ fontWeight: 900, fontSize: 28, fontFamily: 'Schibsted Grotesk', marginBottom: 8, lineHeight: 1.1 }}>
              Automatic Top-Up
            </div>
            <div style={{ color: '#bbb', fontSize: 13, marginBottom: 18 }}>
            Enable automatic top-ups to maintain uninterrupted access. When your balance drops to zero, a pre-configured top-up amount will be charged.
            </div>
            <button style={{ background: '#fff', color: '#181818', fontWeight: 700, fontSize: 18, borderRadius: 10, border: 'none', padding: '12px 28px', cursor: 'not-allowed', marginTop: 'auto', minWidth: 120, width: '60%' }}>
              Coming Soon
            </button>
          </div>
          {/* Payment Methods Card */}
          <div style={{ background: '#181818', border: '1.5px solid #444', borderRadius: 18, padding: 32, flex: 1, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 280 }}>
            <div style={{ fontWeight: 900, fontSize: 28, fontFamily: 'Schibsted Grotesk', marginBottom: 8, lineHeight: 1.1 }}>
              Payment Methods
            </div>
            <div style={{ color: '#bbb', fontSize: 13, marginBottom: 18 }}>
            Manage your connected payment options. Connect your wallet and the same will be used for auto top-ups (if enabled).
            </div>
            <button
              style={{
                background: user ? '#444' : '#fff',
                color: user ? '#bbb' : '#181818',
                fontWeight: 700,
                fontSize: 18,
                borderRadius: 10,
                border: 'none',
                padding: '12px 28px',
                cursor: user ? 'not-allowed' : 'pointer',
                marginTop: 'auto',
                minWidth: 120,
                width: '60%',
                textAlign: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              disabled={!!user}
              onClick={() => {
                if (!user && openConnectModal) openConnectModal();
              }}
            >
              {user ? 'Connected!' : 'Connect Wallet'}
            </button>
          </div>
        </div>

        {/* Billing History Table and Docs Box */}
        <h1 className="settings-section-heading">Billing History</h1>
        <p className="settings-section-desc">See all your past payments.</p>
        
        {/* Error Display */}
        {paymentHistoryError && (
          <div style={{
            background: '#2a1a1a',
            border: '1px solid #ff4444',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            color: '#ff6666'
          }}>
            <AlertCircle size={20} />
            <div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                Failed to load payment history
              </div>
              <div style={{ fontSize: '14px', color: '#ff9999' }}>
                {getErrorMessage(paymentHistoryError)}
              </div>
            </div>
            <button
              onClick={clearPaymentHistoryError}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: '1px solid #ff6666',
                color: '#ff6666',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Dismiss
            </button>
          </div>
        )}
        


        <div className="settings-table-container">
          <table className="settings-table">
            <thead>
              <tr>
                <th>Transaction Hash</th>
                <th>Amount (USD)</th>
                <th>Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingHistory ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>Loading payment history...</td></tr>
              ) : paymentHistory.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No payment history found</td></tr>
              ) : (
                paymentHistory.map((transaction, index) => (
                  <tr key={index}>
                    <td>{shortHash(transaction.hash)}</td>
                    <td>${transaction.amount.toFixed(2)}</td>
                    <td>{formatDate(transaction.created_at)}</td>
                    <td>Completed</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="settings-table-note">Your recent crypto payment transactions are shown above.</p>
        <div 
          className="docs_box"
          onClick={() => navigate('/docs')}
          style={{ cursor: 'pointer', width: '90%', maxWidth: '1200px' }}
        >
          <img src="/images/Icon.png" alt="Document Icon" className="docs-icon-img" />
          <div className="docs-content">
            <h3 className="docs-heading-gabriella">View Documentation</h3>
            <p className="docs-subtitle">Learn more about how generations and logging work.</p>
          </div>
          <ExternalLink size={24} className="docs-icon" />
        </div>
      </div>
    </div>
  );
});

export default SettingsPage; 