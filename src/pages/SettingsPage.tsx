import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/TopSection.css';
import '../styles/BottomSection.css';
import { AlertCircle } from 'lucide-react';
import { useUser } from '../contexts/userContext';
import { fetchUserBalance } from '../components/utils';
import { API_ENDPOINTS } from '../config';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDisconnect } from 'wagmi';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import { useApiCall, getErrorMessage } from '../utils/apiClient';
import ViewDocumentationCard from '../components/ViewDocumentationCard';

interface PaymentTransaction {
    hash: string;
    amount: number;
    created_at: string;
    status?: string;
}

const SettingsPage = React.memo(() => {
    const { user, setUser } = useUser();
    const { disconnect } = useDisconnect();
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
    const navigate = useNavigate();
    const { openConnectModal } = useConnectModal();

    // API client for payment history
    const { call: fetchPaymentHistoryApi, loading: isLoadingHistory, error: paymentHistoryError, clearError: clearPaymentHistoryError } = useApiCall<{ success: boolean; data: any[] }>();

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

    useEffect(() => {
        console.log('👤 SettingsPage: User changed:', user?.id, user?.email, 'Login timestamp:', user?.loginTimestamp);
        if (user?.id) {
            // Always fetch fresh balance; do not use cached balance
            setIsLoading(true);
            const jwt = getCurrentJWTSync();
            if (jwt) {
                fetchUserBalance(user.email, jwt).then(bal => {
                    if (bal !== null) {
                        setBalance(bal);
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
        if (!user?.email) {
            console.log('❌ No user, skipping payment history fetch');
            return;
        }

        try {
            console.log('🌐 Fetching payments (by address) from server...');
            const result = await fetchPaymentHistoryApi(`/payments/payments/${user.email.toLowerCase()}`);
            if (result && result.success && Array.isArray(result.data)) {
                const mapped: PaymentTransaction[] = result.data.map((p: any) => ({
                    hash: p.tx_hash || p.receipt_id || '-',
                    amount: typeof p.amount_usd === 'number' ? p.amount_usd : (p.amount_usd ? Number(p.amount_usd) : 0),
                    created_at: p.created_at || p.timestamp || '',
                    status: p.status || undefined,
                }));
                const completedOnly = mapped.filter(t => (t.status || '').toLowerCase() === 'completed');
                setPaymentHistory(completedOnly);
            } else {
                console.log('📊 No payment history data received');
                setPaymentHistory([]);
            }
        } catch (e) {
            console.error('Error fetching payment history:', e);
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

            <div className="page-wrap">
                {/* Settings Header */}
                <h1 className="settings-header">Settings</h1>
                <p className="settings-desc">Manage your account, balance, and payment options here.</p>

                {/* Account Info Card or Connect Wallet Prompt */}
                <div className="settings-cards-row">
                    {user ? (
                        <div className="settings-account-card">
                            <div className="settings-card-title">Account information</div>
                            <div className="settings-card-content">Name: <span style={{ fontWeight: 700 }}>{getDisplayName(user)}</span></div>
                            <div className="settings-card-content">User ID: <span style={{ fontWeight: 700 }}>{user?.id ? `${user.id.slice(0, 8)}...` : '-'}</span></div>
                        </div>
                    ) : (
                        <div className="settings-account-card" style={{
                            background: '#181818',
                            border: '1px solid #333',
                            borderRadius: '12px',
                            textAlign: 'center',
                            padding: '40px 32px'
                        }}>
                            <div style={{
                                fontSize: '24px',
                                fontWeight: '700',
                                color: '#fff',
                                marginBottom: '12px',
                                fontFamily: 'system-ui, -apple-system, sans-serif'
                            }}>
                                Connect Your Wallet
                            </div>
                            <div style={{
                                color: '#bbb',
                                fontSize: '15px',
                                marginBottom: '24px',
                                lineHeight: '1.5'
                            }}>
                                Sign in with your crypto wallet to access your account settings, view balance, and manage payment methods.
                            </div>
                            <button
                                className="px-4 py-3 bg-blue-500 rounded-md hover:bg-blue-600 transition-all duration-200 text-white font-medium text-sm active:scale-95"
                                onClick={() => openConnectModal && openConnectModal()}
                            >
                                Connect Wallet to Continue
                            </button>
                        </div>
                    )}
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
                        <div style={{ fontWeight: 900, fontSize: 28, fontFamily: 'system-ui, -apple-system, sans-serif', marginBottom: 8, lineHeight: 1.1 }}>
                            Automatic Top-Up
                        </div>
                        <div style={{ color: '#bbb', fontSize: 13, marginBottom: 18 }}>
                            Enable automatic top-ups to maintain uninterrupted access. When your balance drops to zero, a pre-configured top-up amount will be charged.
                        </div>
                        <button
                            className="w-full bg-gray-800 text-white py-3 px-6 rounded-lg text-base font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[48px]"
                            disabled={true}
                        >
                            Coming Soon
                        </button>
                    </div>
                    {/* Payment Methods Card */}
                    <div style={{ background: '#181818', border: '1.5px solid #444', borderRadius: 18, padding: 32, flex: 1, color: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 280 }}>
                        <div style={{ fontWeight: 900, fontSize: 28, fontFamily: 'system-ui, -apple-system, sans-serif', marginBottom: 8, lineHeight: 1.1 }}>
                            Payment Methods
                        </div>
                        <div style={{ color: '#bbb', fontSize: 13, marginBottom: 18 }}>
                            Manage your connected payment options. Connect your wallet and the same will be used for auto top-ups (if enabled).
                        </div>
                        <button
                            className={`px-6 py-3 rounded-md font-medium text-sm transition-all duration-200 active:scale-95 ${user
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                                }`}
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
                                        <td>
                                            <span>{shortHash(transaction.hash)}</span>
                                        </td>
                                        <td>${transaction.amount.toFixed(2)}</td>
                                        <td>{formatDate(transaction.created_at)}</td>
                                        <td>{transaction.status || 'Completed'}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <p className="settings-table-note">Your recent crypto payment transactions are shown above.</p>
                <ViewDocumentationCard onClick={() => navigate('/docs')} />
            </div>
        </div>
    );
});

export default SettingsPage;