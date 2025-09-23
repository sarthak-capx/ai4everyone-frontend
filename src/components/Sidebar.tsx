import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Box, Cpu, BarChart2, Key, Settings, FileText, LogOut } from 'lucide-react';
import { fetchApiKeysForUser, fetchUserBalance } from './utils';
import { useUser } from '../contexts/userContext';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount, useDisconnect, useWalletClient } from 'wagmi';
import { API_ENDPOINTS } from '../config';
import { secureStorage } from '../utils/secureStorage';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { address, isConnected, status } = useAccount();
  const { user, setUser } = useUser();
  const { data: walletClient } = useWalletClient();
  const [error, setError] = useState('');
  const { disconnect } = useDisconnect();
  const [isSyncing, setIsSyncing] = useState(true);
  const [pendingLogin, setPendingLogin] = useState(false);
  const isWalletLoading = status === 'connecting' || status === 'reconnecting';
  const { openConnectModal } = useConnectModal();

  const loginWithWallet = async (walletAddress: string) => {
    try {
      const timestamp = Date.now();
      const message = `AI4EVERYONE Login: ${walletAddress} at ${timestamp}`;
      if (!walletClient || !address) throw new Error('No wallet client found');
      const signature = await walletClient.signMessage({ message, account: address });

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
      await setUser({ id: data.user.id, email: data.user.email, name: data.user.name }, data.token);

      try {
        const apiKeys = await fetchApiKeysForUser();
        secureStorage.setApiKeys(apiKeys);
        window.dispatchEvent(new CustomEvent('userDataFetched', { detail: { type: 'apiKeys', data: apiKeys } }));
      } catch { }

      try {
        const balance = await fetchUserBalance(data.user.email, data.token);
        if (balance !== null) {
          window.dispatchEvent(new CustomEvent('userDataFetched', { detail: { type: 'balance', data: balance } }));
        }
      } catch { }

      try {
        const paymentHistoryRes = await fetch(`${API_ENDPOINTS.BALANCE}/payment-history-jwt`, {
          headers: { 'Authorization': `Bearer ${data.token}` }
        });
        if (paymentHistoryRes.ok) {
          const paymentData = await paymentHistoryRes.json();
          const transactions = paymentData.transactions || [];
          window.dispatchEvent(new CustomEvent('userDataFetched', { detail: { type: 'paymentHistory', data: transactions } }));
        }
      } catch { }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setUser(null);
    }
  };

  useEffect(() => {
    setIsSyncing(true);
    const hasPersistedSession = false; // disabled persistence: always prompt on refresh

    if (isWalletLoading) {
      // Wait for wagmi to finish reconnecting before deciding UI state
      setPendingLogin(false);
      setIsSyncing(true);
      return;
    }

    if (isConnected && address && walletClient) {
      // If we already have a persisted session, don't prompt wallet login on refresh
      if (hasPersistedSession) {
        setPendingLogin(false);
        setIsSyncing(false);
        return;
      }

      // Otherwise, only trigger login if user is missing or mismatched
      if (!user || (user.email && user.email.toLowerCase() !== address.toLowerCase())) {
        setPendingLogin(true);
      } else {
        setIsSyncing(false);
      }
    } else if (!isConnected) {
      // Do not clear user session here; preserve logged-in state across refreshes
      setPendingLogin(false);
      setIsSyncing(false);
    } else {
      setIsSyncing(false);
    }
  }, [isConnected, address, walletClient, user, isWalletLoading]);

  useEffect(() => {
    if (pendingLogin && isConnected && address && walletClient && !isWalletLoading) {
      loginWithWallet(address).finally(() => {
        setIsSyncing(false);
        setPendingLogin(false);
      });
    }
  }, [pendingLogin, isConnected, address, walletClient, isWalletLoading]);

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    setUser(null);
    secureStorage.clearAll();
    disconnect();
  };

  const displayEmail = (email?: string) => {
    if (!email) return '';
    return email.length > 15 ? email.slice(0, 15) + '...' : email;
  };

  return (
    <aside className="flex flex-col w-[280px] min-w-[280px] bg-[#121214] text-white h-full relative rounded-l-[12px] border border-[#333] shadow-[0_4px_12px_rgba(0,0,0,0.2)] z-[1000] overflow-y-auto overflow-x-hidden">
      <div className="px-5 py-6 border-b border-[#222] cursor-pointer" onClick={() => navigate('/')}>
        <img src="/images/logo.png" alt="CapxAI Logo" style={{ height: '16px' }} />
      </div>

      <nav className="flex-1 py-5">
        <ul className="list-none p-0 m-0">
          <li className={`flex items-center px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer ${isActive('/') ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => navigate('/')}> <Home size={20} className={`${isActive('/') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/') ? 'text-white' : 'text-[#888]'} text-[16px]`}>Home</span> </li>
          <li className={`flex items-center px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer ${isActive('/models') ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => navigate('/models')}> <Box size={20} className={`${isActive('/models') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/models') ? 'text-white' : 'text-[#888]'} text-[16px]`}>Models</span> </li>
          <li className={`flex items-center px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer ${isActive('/playground') ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => navigate('/playground')}> <Cpu size={20} className={`${isActive('/playground') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/playground') ? 'text-white' : 'text-[#888]'} text-[16px]`}>Playground</span> </li>
          <li className={`flex items-center px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer ${isActive('/usage') ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => navigate('/usage')}> <BarChart2 size={20} className={`${isActive('/usage') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/usage') ? 'text-white' : 'text-[#888]'} text-[16px]`}>Usage</span> </li>
          <li className={`flex items-center px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer ${isActive('/api-keys') ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => navigate('/api-keys')}> <Key size={20} className={`${isActive('/api-keys') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/api-keys') ? 'text-white' : 'text-[#888]'} text-[16px]`}>API Keys</span> </li>
          <li className={`flex items-center px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer ${isActive('/settings') ? 'bg-white/10' : 'hover:bg-white/5'}`} onClick={() => navigate('/settings')}> <Settings size={20} className={`${isActive('/settings') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/settings') ? 'text-white' : 'text-[#888]'} text-[16px]`}>Settings</span> </li>
          <li className={`flex items-center justify-between px-5 py-3 mx-3 my-1 rounded-[8px] transition-colors cursor-pointer border border-[#333] bg-black ${isActive('/docs') ? 'bg-[#181818]' : ''}`} onClick={() => navigate('/docs')}> <div className="flex items-center"> <FileText size={20} className={`${isActive('/docs') ? 'text-white' : 'text-[#888]'} mr-3`} /> <span className={`${isActive('/docs') ? 'text-white' : 'text-[#888]'} text-[16px]`}>Docs</span> </div> <span className="text-xs text-[#888] ml-2">↗</span> </li>
        </ul>
      </nav>

      <div className="px-5 py-5 border-t border-[#222]">
        <div className="flex items-center mb-5">
          <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="mr-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M21.944 2.112a1.5 1.5 0 0 0-1.6-.2L2.7 9.1a1.5 1.5 0 0 0 .1 2.8l4.7 1.6 1.7 5.2a1.5 1.5 0 0 0 2.7.3l2.1-3.2 4.6 3.4a1.5 1.5 0  0 0 2.4-1l2-15a1.5 1.5 0 0 0-.526-1.188zM9.7 15.2l-1.2-3.7 8.2-6.2-7 7.6zm2.2 3.1l-1.1-3.3 1.7-1.3 2.1 1.5zm7.1-1.2-4.2-3.1 5.2-7.6z" fill="#888" /></svg>
          </a>
          <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="mr-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20.317 4.369a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0  0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0  0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#888" /></svg>
          </a>
          <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#888" /></svg>
          </a>
        </div>

        <div className="flex items-center">
          {isSyncing || isWalletLoading ? (
            <div className="w-[120px] h-8 flex items-center justify-center text-[#888] font-medium">
              {isConnected || isWalletLoading ? 'Checking wallet…' : 'Logging out...'}
            </div>
          ) : user ? (
            <div className="flex items-center">
              <div className="w-8 h-8 bg-[#333] rounded-full flex items-center justify-center mr-3">
                <span className="text-[14px] font-medium">{user.name ? user.name[0].toUpperCase() : user.email.slice(2, 3).toUpperCase()}</span>
              </div>
              <span className="text-[16px] text-[#bbb]">{user.name || (isConnected ? displayEmail(user.email) : 'Account')}</span>
            </div>
          ) : (
            <>
              <button className="px-3 py-2 bg-blue-500 rounded-md hover:bg-blue-600 transition" onClick={() => openConnectModal && openConnectModal()}>Connect Wallet</button>
              {isConnected && address && !pendingLogin && !isSyncing && walletClient && !isWalletLoading && (
                <button className="ml-2" onClick={() => setPendingLogin(true)}>Sign In</button>
              )}
            </>
          )}
          {user && !isSyncing && !isWalletLoading && (
            <button className="ml-auto bg-transparent border-0 p-0 cursor-pointer" aria-label="Logout" onClick={handleLogout}>
              <LogOut size={18} color="#888" />
            </button>
          )}
        </div>
        {error && <div className="text-red-500 mt-2">{error}</div>}
      </div>
    </aside>
  );
};

export default Sidebar;