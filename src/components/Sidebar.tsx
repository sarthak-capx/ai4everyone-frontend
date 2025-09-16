import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Box, Cpu, BarChart2, Key, Settings, FileText, MessageCircle, X, LogOut } from 'lucide-react';
import '../styles/Sidebar.css';
import { fetchApiKeysForUser, fetchUserBalance } from './utils';
import { useUser } from './UserContext';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, useWalletClient } from 'wagmi';
import { API_ENDPOINTS } from '../config';
import { secureStorage } from '../utils/secureStorage';
import { ethers } from 'ethers';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { user, setUser } = useUser();
  const { data: walletClient } = useWalletClient();
  const [error, setError] = useState('');
  const { disconnect } = useDisconnect();
  const [isSyncing, setIsSyncing] = useState(true);
  const [pendingLogin, setPendingLogin] = useState(false);

  const loginWithWallet = async (walletAddress: string) => {
    try {
      // Step 1: Generate message and timestamp
      const timestamp = Date.now();
      const message = `AI4EVERYONE Login: ${walletAddress} at ${timestamp}`;

      // Step 2: Prompt user to sign the message using the selected wallet
      if (!walletClient || !address) throw new Error('No wallet client found');
      const signature = await walletClient.signMessage({ message, account: address });

      // Step 3: Send address, message, signature, and timestamp to backend
      const res = await fetch(API_ENDPOINTS.WALLET_LOGIN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: walletAddress, message, signature, timestamp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Wallet login failed');
        setUser(null);
        return;
      }
      console.log('🔄 Login successful, setting user state...');
      await setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name
        // Remove jwt field - will be stored encrypted separately
      }, data.token); // Pass JWT as second parameter to setUser
      
      console.log('✅ User state set, fetching data...');
      
      // Fetch API keys after user is set
      try {
        const apiKeys = await fetchApiKeysForUser();
        console.log('📋 API Keys fetched:', apiKeys.length, 'keys');
        secureStorage.setApiKeys(apiKeys);
        // Trigger a custom event to notify components that data has been fetched
        window.dispatchEvent(new CustomEvent('userDataFetched', { 
          detail: { type: 'apiKeys', data: apiKeys } 
        }));
        console.log('📢 Dispatched apiKeys event');
      } catch (err) {
        console.error('❌ Failed to fetch API keys during login:', err);
      }
      
      // Fetch balance after user is set
      try {
        const balance = await fetchUserBalance(data.user.email, data.token);
        if (balance !== null) {
          console.log('💰 Balance fetched:', balance);
          secureStorage.setBalance(balance);
          // Trigger a custom event to notify components that data has been fetched
          window.dispatchEvent(new CustomEvent('userDataFetched', { 
            detail: { type: 'balance', data: balance } 
          }));
          console.log('📢 Dispatched balance event');
        }
      } catch (err) {
        console.error('❌ Failed to fetch balance during login:', err);
      }

      // Fetch payment history after user is set
      try {
        console.log('📊 Fetching payment history...');
        const paymentHistoryRes = await fetch(`${API_ENDPOINTS.BALANCE}/payment-history-jwt`, {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        });
        
        if (paymentHistoryRes.ok) {
          const paymentData = await paymentHistoryRes.json();
          const transactions = paymentData.transactions || [];
          console.log('📊 Payment history fetched:', transactions.length, 'transactions');
          
          // Trigger a custom event to notify components that payment history has been fetched
          window.dispatchEvent(new CustomEvent('userDataFetched', { 
            detail: { type: 'paymentHistory', data: transactions } 
          }));
          console.log('📢 Dispatched paymentHistory event');
        } else {
          console.error('❌ Failed to fetch payment history:', paymentHistoryRes.status);
        }
      } catch (err) {
        console.error('❌ Failed to fetch payment history during login:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setUser(null);
    }
  };

  useEffect(() => {
    setIsSyncing(true);
    if (isConnected && address && walletClient) {
      if (!user || (user.email && user.email.toLowerCase() !== address.toLowerCase())) {
        setPendingLogin(true);
      } else {
        setIsSyncing(false);
      }
    } else if (!isConnected && user) {
      setUser(null);
      setIsSyncing(false);
    } else {
      setIsSyncing(false);
    }
  }, [isConnected, address, walletClient]);

  useEffect(() => {
    if (pendingLogin && isConnected && address && walletClient) {
      loginWithWallet(address).finally(() => {
        setIsSyncing(false);
        setPendingLogin(false);
      });
    }
  }, [pendingLogin, isConnected, address, walletClient]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    setUser(null);
    secureStorage.clearAll();
    disconnect();
  };

  // Helper function to safely display user email
  const displayEmail = (email?: string) => {
    if (!email) return '';
    return email.length > 15 ? email.slice(0, 15) + '...' : email;
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo" onClick={() => navigate('/')}>
        <img src="/images/logo.png" alt="CapxAI Logo" style={{ height: '16px' }} />
      </div>
      <nav className="sidebar-nav">
        <ul>
          <li className={isActive('/') ? 'active' : ''} onClick={() => navigate('/')}> <Home size={20} /> <span>Home</span> </li>
          <li className={isActive('/models') ? 'active' : ''} onClick={() => navigate('/models')}> <Box size={20} /> <span>Models</span> </li>
          <li className={isActive('/playground') ? 'active' : ''} onClick={() => navigate('/playground')}> <Cpu size={20} /> <span>Playground</span> </li>
          <li className={isActive('/usage') ? 'active' : ''} onClick={() => navigate('/usage')}> <BarChart2 size={20} /> <span>Usage</span> </li>
          <li className={isActive('/api-keys') ? 'active' : ''} onClick={() => navigate('/api-keys')}> <Key size={20} /> <span>API Keys</span> </li>
          <li className={isActive('/settings') ? 'active' : ''} onClick={() => navigate('/settings')}> <Settings size={20} /> <span>Settings</span> </li>
          <li className={`docs-link with-external-icon${isActive('/docs') ? ' active' : ''}`} onClick={() => navigate('/docs')}> <FileText size={20} /> <span>Docs</span> <span className="external-icon">↗</span> </li>
        </ul>
      </nav>
      <div className="sidebar-footer">
        <div className="social-icons">
          {/* Telegram SVG */}
          <a href="https://t.me/" target="_blank" rel="noopener noreferrer" className="telegram-icon" aria-label="Telegram">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.944 2.112a1.5 1.5 0 0 0-1.6-.2L2.7 9.1a1.5 1.5 0 0 0 .1 2.8l4.7 1.6 1.7 5.2a1.5 1.5 0 0 0 2.7.3l2.1-3.2 4.6 3.4a1.5 1.5 0 0 0 2.4-1l2-15a1.5 1.5 0 0 0-.526-1.188zM9.7 15.2l-1.2-3.7 8.2-6.2-7 7.6zm2.2 3.1l-1.1-3.3 1.7-1.3 2.1 1.5zm7.1-1.2-4.2-3.1 5.2-7.6z" fill="#888"/>
            </svg>
          </a>
          {/* Discord SVG */}
          <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" className="discord-icon" aria-label="Discord" style={{ marginLeft: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#888"/>
            </svg>
          </a>
          {/* X (Twitter) SVG */}
          <a href="https://x.com/" target="_blank" rel="noopener noreferrer" className="x-icon" aria-label="X" style={{ marginLeft: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#888"/>
            </svg>
          </a>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {isSyncing ? (
            <div style={{ width: 120, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontWeight: 500 }}>
              {isConnected ? 'Logging in...' : 'Logging out...'}
            </div>
          ) : user ? (
            <div className="user-profile">
              <div className="avatar">
                <span>{user.name ? user.name[0].toUpperCase() : user.email.slice(2, 3).toUpperCase()}</span>
              </div>
              <span className="username">
                {user.name || displayEmail(user.email)}
              </span>
            </div>
          ) : (
            <>
              <ConnectButton />
              {/* Show retry login button if wallet is connected but login not triggered */}
              {isConnected && address && !pendingLogin && !isSyncing && walletClient && (
                <button style={{ marginLeft: 8 }} onClick={() => setPendingLogin(true)}>
                  Sign In
                </button>
              )}
            </>
          )}
          {user && !isSyncing && (
            <button className="logout-btn" style={{ background: 'none', border: 'none', padding: 0, marginLeft: 'auto', cursor: 'pointer' }} aria-label="Logout" onClick={handleLogout}>
              <LogOut size={18} color="#888" />
            </button>
          )}
        </div>
        {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      </div>
    </aside>
  );
};

export default Sidebar;