import React, { useState, useEffect, useCallback } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import '../styles/UsagePage.css';

import { fetchUserBalance } from '../components/utils';
import { useUser } from '../contexts/userContext';
import { useAccount, useSwitchChain, useWaitForTransactionReceipt } from 'wagmi';
// import { ConnectButton } from '@rainbow-me/rainbowkit';
// import { parseEther } from 'viem';
import { polygon, arbitrum, optimism, base, sepolia } from 'viem/chains';
import ViewDocumentationCard from '../components/ViewDocumentationCard';
import { API_ENDPOINTS } from '../config';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import Logger from '../utils/logger';
// import { safeNavigate } from '../utils/validation';
import { ethers } from 'ethers';
import { createPaymentQuote, CAPX_PAYMASTER_ABI, ERC20_ABI, fetchAssets, AssetInfo } from '../utils/payments';
import { formatWalletError } from '../utils/errorMessages';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const supportedChains = [
    { id: polygon.id, name: 'Polygon' },
    { id: arbitrum.id, name: 'Arbitrum' },
    { id: optimism.id, name: 'Optimism' },
    { id: base.id, name: 'Base' },
    { id: sepolia.id, name: 'Ethereum Sepolia (Testnet)' },
];

// Helper to create a smooth SVG path from points (Catmull-Rom to Bezier)
function getSmoothLinePath(points: [number, number][]) {
    if (points.length < 2) return '';
    let d = `M${points[0][0]},${points[0][1]}`;
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2 < points.length ? i + 2 : points.length - 1];
        const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
        const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
        const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
        const cp2y = p2[1] - (p3[1] - p1[1]) / 6;
        d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2[0]},${p2[1]}`;
    }
    return d;
}

// Add a function to jitter the data for a rougher line
function jitter(val: number, amount: number) {
    return val + (Math.random() - 0.5) * amount;
}

// Change selectedChainId to string | number
type ChainId = number | string;

// Add custom dropdown component
function ChainDropdown({ chains, selectedChainId, setSelectedChainId }: {
    chains: { id: string | number; name: string }[];
    selectedChainId: string | number;
    setSelectedChainId: (id: string | number) => void;
}) {
    const [open, setOpen] = React.useState(false);
    const selected = chains.find(c => c.id === selectedChainId);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            setOpen(o => !o);
            e.preventDefault();
        }
        if (e.key === 'Escape') setOpen(false);
    }

    return (
        <div
            className="custom-chain-dropdown"
            tabIndex={0}
            ref={dropdownRef}
            onKeyDown={handleKeyDown}
            style={{ position: 'relative', width: '100%' }}
        >
            <div
                className="custom-chain-dropdown-selected"
                onClick={() => setOpen(o => !o)}
                style={{
                    background: '#1A1D21',
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: 40,
                }}
            >
                <span>{selected?.name || 'Select chain'}</span>
                <span style={{ marginLeft: 8, fontSize: 18, userSelect: 'none' }}>▼</span>
            </div>
            {open && (
                <div
                    className="custom-chain-dropdown-menu"
                    style={{
                        position: 'absolute',
                        top: '110%',
                        left: 0,
                        right: 0,
                        background: '#1A1D21',
                        color: 'white',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px #0008',
                        zIndex: 1000,
                        border: '1px solid #444',
                        overflow: 'hidden',
                    }}
                >
                    {chains.map(chain => (
                        <div
                            key={chain.id}
                            className="custom-chain-dropdown-option"
                            onClick={() => {
                                setSelectedChainId(chain.id);
                                setOpen(false);
                            }}
                            style={{
                                padding: '12px',
                                cursor: 'pointer',
                                background: chain.id === selectedChainId ? '#2a2d30' : 'transparent',
                                fontWeight: chain.id === selectedChainId ? 600 : 400,
                            }}
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    setSelectedChainId(chain.id);
                                    setOpen(false);
                                }
                            }}
                        >
                            {chain.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const UsagePage: React.FC = React.memo(() => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState<number | null>(10); // Default to $10
    const [customAmount, setCustomAmount] = useState('10'); // Default to $10
    const [balance, setBalance] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [paymentStep, setPaymentStep] = useState('idle'); // idle, processing, waiting, verifying
    const [balanceError, setBalanceError] = useState<string | null>(null);
    const [paymentError, setPaymentError] = useState<string | null>(null);
    const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
    const [hoveredBar, setHoveredBar] = useState<{ type: 'api' | 'transaction', index: number, value: number, month: string } | null>(null);
    const { user } = useUser();
    const navigate = useNavigate();
    const { chain, isConnected: isWalletConnected, status } = useAccount();
    const isWalletLoading = status === 'connecting' || status === 'reconnecting';
    const { switchChainAsync } = useSwitchChain();
    const [selectedChainId, setSelectedChainId] = useState<ChainId>(polygon.id);
    const [monthlyStats, setMonthlyStats] = useState<any[]>([]);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
    const [assets, setAssets] = useState<AssetInfo[]>([]);
    const [selectedAssetSymbol, setSelectedAssetSymbol] = useState<'USDC' | 'USDT'>('USDC');
    const [isAssetsLoading, setIsAssetsLoading] = useState(false);

    // const handleLogout = () => {
    //     setUser(null);
    //     secureStorage.secureLogout();
    //     disconnect();
    //     setMobileMenuOpen(false);
    // };

    // Load assets for the selected network
    useEffect(() => {
        const load = async () => {
            setAssets([]);
            setIsAssetsLoading(true);
            try {
                if (selectedChainId === 'solana') return;
                const network = selectedChainId === sepolia.id ? 'sepolia' : 'sepolia';
                const list = await fetchAssets(network);
                setAssets(list);
                if (list.length > 0) setSelectedAssetSymbol(list[0].symbol);
            } catch (e) {
                Logger.error('Failed to load assets', e);
            } finally {
                setIsAssetsLoading(false);
            }
        };
        load();
    }, [selectedChainId]);

    // Automatically switch chain only when modal is open to avoid wallet popups on refresh
    useEffect(() => {
        if (!isModalOpen) return;
        if (typeof selectedChainId === 'number' && chain && chain.id !== selectedChainId) {
            switchChainAsync({ chainId: selectedChainId }).catch(err => {
                Logger.error("Failed to switch chain automatically:", err);
                setSelectedChainId(chain.id);
            });
        }
    }, [isModalOpen, selectedChainId, chain, switchChainAsync]);

    useEffect(() => {
        if (isWalletLoading) {
            setIsLoading(true);
            setBalanceError(null);
            return;
        }
        if (isWalletConnected && user?.id) {
            setBalanceError(null);
            setIsLoading(true);
            fetchBalanceWithRetry();
        } else if (isWalletConnected && !user?.id) {
            setBalance(null);
            setBalanceError('Please log in to view');
            setIsLoading(false);
        } else {
            setBalance(null);
            setBalanceError('Connect wallet to view');
            setIsLoading(false);
        }
    }, [user?.id, isWalletConnected, isWalletLoading]);

    const fetchBalanceWithRetry = useCallback(async (retryCount = 0) => {
        if (!user?.email) return;

        const maxRetries = 2;
        setIsLoading(true);

        try {
            const jwt = getCurrentJWTSync();
            if (!jwt) {
                throw new Error('No authentication token available');
            }

            const newBalance = await fetchUserBalance(user.email, jwt);
            setBalance(newBalance);
            setBalanceError(null);
            Logger.info('Balance fetched successfully:', newBalance);
        } catch (error) {
            Logger.error("Failed to fetch balance:", error);

            if (retryCount < maxRetries) {
                setTimeout(() => {
                    fetchBalanceWithRetry(retryCount + 1);
                }, 1000 * (retryCount + 1));
            } else {
                setBalance(null);
                setBalanceError('Could not load balance - please refresh the page');
            }
        } finally {
            setIsLoading(false);
        }
    }, [user?.email]);

    useEffect(() => {
        const repopulateCachesIfMissing = async () => {
            const jwt = getCurrentJWTSync();
            if (!user?.id || !jwt) return;

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

                // No balance caching
            } catch (err) {
                Logger.warn('Cache repopulation failed on Usage page:', err);
            }
        };

        repopulateCachesIfMissing();
    }, [user?.id, user?.email]);

    const fetchBalance = useCallback(async () => {
        await fetchBalanceWithRetry();
    }, [fetchBalanceWithRetry]);

    // const handleAddBalance = async () => {
    //   if (!user) {
    //     setPaymentError('Please log in to add balance.');
    //     return;
    //   }
    //   setPaymentError('');
    //   try {
    //     const response = await fetch(API_ENDPOINTS.BALANCE_ADD, {
    //       method: 'POST',
    //       headers: { 'Content-Type': 'application/json' },
    //       body: JSON.stringify({
    //         user_email: user.email,
    //         amount_usd: selectedAmount || parseFloat(customAmount)
    //       }),
    //     });
    //
    //     if (!response.ok) {
    //       if (response.status === 401) {
    //         throw new Error('Please log in to add balance');
    //       }
    //       throw new Error('Failed to add balance');
    //     }
    //
    //     const data = await response.json();
    //     setBalance(parseFloat(data.balance));
    //     setIsModalOpen(false);
    //     setSelectedAmount(10);
    //     setCustomAmount('10');
    //   } catch (err) {
    //     setPaymentError(err instanceof Error ? err.message : 'Failed to add balance. Please try again later.');
    //     Logger.error('Error adding balance:', err);
    //   }
    // };

    const handlePayWithCrypto = async () => {
        if (typeof selectedChainId !== 'number') {
            setPaymentError('Invalid chain selected.');
            return;
        }
        if (!user || !user.id) {
            setPaymentError('Please log in completely to make a payment.');
            return;
        }

        const usdAmount = selectedAmount || parseFloat(customAmount);
        if (!usdAmount || usdAmount <= 0) {
            setPaymentError('Please enter a valid amount');
            return;
        }

        try {
            setPaymentStep('processing');
            setPaymentError(null);

            if (!(window as any).ethereum) {
                setPaymentError('No EVM wallet detected.');
                setPaymentStep('idle');
                return;
            }
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();
            const payerAddress = await signer.getAddress();

            // 1) Get quote from backend
            const quote = await createPaymentQuote({
                user_id: user.id,
                user_address: payerAddress as `0x${string}`,
                pay_asset: (selectedAssetSymbol as any) || 'USDC',
                pay_amount: usdAmount,
                chainId: selectedChainId,
            });

            // 2) Ensure allowance (Metamask transaction)
            const erc20 = new ethers.Contract(quote.asset, ERC20_ABI, signer);
            const allowance: bigint = await erc20.allowance(payerAddress, quote.paymaster);
            const amountBig = BigInt(quote.amount);
            if (allowance < amountBig) {
                const approveTx = await erc20.approve(quote.paymaster, amountBig);
                await approveTx.wait();
            }

            // 3) Call pay on paymaster (Metamask transaction)
            const paymaster = new ethers.Contract(quote.paymaster, CAPX_PAYMASTER_ABI, signer);
            const tx = await paymaster.pay(quote.receiptId, quote.asset, quote.amount, quote.timestamp, quote.signature);
            setPaymentStep('waiting');
            const receipt = await tx.wait();

            // 4) Verify and credit balance to user (Server transaction)
            setPaymentStep('verifying');
            const verifyRes = await fetch(API_ENDPOINTS.PAYMENTS_VERIFY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chainId: selectedChainId,
                    txHash: receipt.hash,
                    receiptId: quote.receiptId,
                    userId: user.id,
                    usdAmount,
                }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData.error || 'Verification failed');

            fetchBalance();
            setIsModalOpen(false);
            setPaymentStep('idle');
        } catch (err) {
            Logger.error('Payment failed:', err);
            setPaymentError(formatWalletError(err));
            setPaymentStep('idle');
        }
    };

    const { data: receipt, isLoading: isConfirming, isSuccess: isConfirmed, isError: isConfirmingError } = useWaitForTransactionReceipt({ hash: txHash });

    useEffect(() => {
        if (isConfirming) {
            setPaymentStep('waiting');
        } else if (isConfirmed && receipt) {
            setPaymentStep('verifying');
            verifyPayment(receipt.transactionHash, selectedAmount || parseFloat(customAmount) || 0, receipt.chainId)
                .finally(() => setPaymentStep('idle'));
        } else if (isConfirmingError) {
            setPaymentError('Transaction cancelled by user.');
            setPaymentStep('idle');
        }
    }, [isConfirming, isConfirmed, isConfirmingError, receipt]);

    const purchaseAmount = selectedAmount || parseFloat(customAmount) || 0;
    const balanceAfterPurchase = (balance || 0) + purchaseAmount;

    const getPaymentButtonText = () => {
        if (isAssetsLoading) return 'Initializing...';
        if (assets.length === 0) return 'Initializing...';
        switch (paymentStep) {
            case 'processing': return 'Processing...';
            case 'waiting': return 'Confirming transaction...';
            case 'verifying': return 'Verifying payment...';
            default: return 'Pay with Crypto';
        }
    };

    const verifyPayment = useCallback(async (txHashToVerify: `0x${string}`, amount: number, chainIdToVerify: number) => {
        if (!user) {
            alert('Error: User not logged in.');
            return;
        }

        try {
            const response = await fetch(API_ENDPOINTS.VERIFY_PAYMENT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txHash: txHashToVerify,
                    chainId: chainIdToVerify,
                    userId: user.id,
                    amount: amount.toString(),
                }),
            });

            const data = await response.json();

            if (response.ok) {
                alert('Payment verified successfully! Your balance has been updated.');
                fetchBalance();
                setIsModalOpen(false);
            } else {
                throw new Error(data.error || 'Verification failed.');
            }
        } catch (error) {
            Logger.error('Verification request failed:', error);
            alert(`An error occurred during verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }, [user, fetchBalance]);

    useEffect(() => {
        const fetchStats = async () => {
            setStatsLoading(true);
            setStatsError(null);
            try {
                let url = API_ENDPOINTS.USAGE_MONTHLY_STATS;
                let headers: Record<string, string> = {};
                if (user && user.id) {
                    url += `?user_id=${encodeURIComponent(user.id)}`;
                } else {
                    const apiKeys = await secureStorage.getApiKeys();
                    if (Array.isArray(apiKeys) && apiKeys.length > 0 && apiKeys[0].key) {
                        headers['Authorization'] = `Bearer ${apiKeys[0].key}`;
                    }
                }
                const res = await fetch(url, { headers });
                if (!res.ok) throw new Error('Failed to fetch usage stats');
                const data = await res.json();
                Logger.debug('Usage stats response:', data);
                setMonthlyStats(data.stats || []);
            } catch (err: any) {
                Logger.info('No usage stats available:', err.message);
                setStatsError(null);
                setMonthlyStats([]);
            } finally {
                setStatsLoading(false);
            }
        };
        fetchStats();
    }, [user?.id]);

    const hasRealData = monthlyStats.length > 0;
    Logger.debug('Monthly stats:', monthlyStats);
    Logger.debug('Has real data:', hasRealData);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartMonths = hasRealData
        ? monthlyStats.map(s => {
            const [year, month] = s.month.split('-');
            return monthNames[parseInt(month) - 1];
        })
        : ['Jun', 'Jul'];

    const apiCostData = hasRealData
        ? monthlyStats.map(s => s.api_cost_usd)
        : [0, 0];

    const transactionData = hasRealData
        ? monthlyStats.map(s => s.spending_usd)
        : [0, 0];

    const maxApiCost = Math.max(...apiCostData, 1);
    const maxTransactions = Math.max(...transactionData, 1);

    const apiCostBars = apiCostData.map(val => Math.min((val / maxApiCost) * 100, 100));
    const transactionBars = transactionData.map(val => Math.min((val / maxTransactions) * 100, 100));

    const apiCallsLineData = (() => {
        const arr = Array(12).fill(0);
        if (monthlyStats && monthlyStats.length > 0) {
            monthlyStats.forEach(stat => {
                const [year, month] = stat.month.split('-');
                const monthIndex = parseInt(month, 10) - 1;
                arr[monthIndex] = stat.api_calls;
            });
        }
        return arr;
    })();

    return (
        <div className="w-full min-h-screen bg-transparent">
            {/* Banner Section - aligned with ModelsPage */}
            <div className="w-full h-[220px] md:h-[250px] overflow-hidden relative bg-[#142C96]">
                <img
                    src="/images/quminsoda2_isometric_view_pixel_art_of_a_green_high-tech_data_ae05a0f4-4dcc-4cfd-80d1-e5ed208e9383_2 1.png"
                    alt="AI4Everyone Banner"
                    className="w-full h-full object-cover object-center relative z-[1] hidden md:block"
                />
                <img
                    src="/images/quminsoda2_isometric_view_pixel_art_of_a_green_high-tech_data_ae05a0f4-4dcc-4cfd-80d1-e5ed208e9383_2 1.png"
                    alt="AI4Everyone Mobile Banner"
                    className="w-full h-full object-cover object-center md:hidden block relative z-[1]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/80 to-transparent z-[2]"></div>
            </div>

            <div className="flex flex-col items-start page-wrap md:mt-[-35px] relative z-[3] px-4 md:px-0">
                <div className="flex-1">
                    <h1 className="font-black text-[40px] text-white">Usage</h1>
                    <p className="text-sm md:text-base text-[#999999] text-left mb-4 w-full">Monitor your API activity, track spending, and manage your account balance all in one place.</p>
                </div>
            </div>

            <div className="page-wrap relative z-[3] flex flex-col gap-0">
                {/* Account Balance Card */}
                <div className="bg-[#111] border border-[#333] rounded-[14px] text-white text-[16px] flex items-center justify-between px-[26px] py-5 mt-[10px] mb-[10px] max-w-[1200px] w-full box-border">
                    <div>
                        <div className="text-[22px] font-bold mb-2">Account Balance</div>
                        {isLoading ? (
                            <div className="usage-balance-amount">Loading...</div>
                        ) : balanceError ? (
                            <div className="usage-balance-amount" style={{ color: '#ff4444', fontSize: '18px' }}>{balanceError}</div>
                        ) : (
                            <div className="font-['Orbitron','Schibsted Grotesk'] text-[56px] font-black tracking-[2px]">
                                <span className="text-[40px] mr-2 opacity-70">$</span>
                                {balance?.toFixed(2) || '0.00'}
                            </div>
                        )}
                    </div>
                    <button
                        className="bg-white text-[#181818] font-bold text-[20px] rounded-[12px] border-0 px-8 py-4 cursor-pointer ml-6 min-w-[180px] transition-colors hover:bg-[#eaeaea]"
                        onClick={() => {
                            setIsModalOpen(true);
                            setPaymentError(null);
                        }}
                    >
                        Add to Balance
                    </button>
                </div>

                {user ? (
                    <>
                        {/* Usage Charts */}
                        {statsLoading ? (
                            <div className="usage-charts-row">
                                <div className="usage-chart-card">
                                    <div className="usage-chart-title">Loading...</div>
                                    <div className="usage-chart-desc">Fetching your usage data...</div>
                                </div>
                            </div>
                        ) : (
                            <div className="usage-charts-row">
                                {/* API Cost */}
                                <div className="usage-chart-card">
                                    <div className="usage-chart-title">API Cost</div>
                                    <div className="usage-chart-desc">See how much you've spent on API calls each month.</div>
                                    <div className="usage-bar-chart-with-axes-outer">
                                        <div className="usage-bar-yaxis usage-bar-yaxis-overlay">
                                            {hasRealData ? (
                                                // Dynamic Y-axis based on real data
                                                [Math.ceil(maxApiCost), Math.ceil(maxApiCost * 0.8), Math.ceil(maxApiCost * 0.6), Math.ceil(maxApiCost * 0.4), Math.ceil(maxApiCost * 0.2), 0].map((v, index) => (
                                                    <span key={index} className="usage-bar-yaxis-label">${v}</span>
                                                ))
                                            ) : (
                                                // Fallback Y-axis
                                                ['$8', '$6', '$4', '$2', '$1', '$0'].map((v, i) => (
                                                    <span key={i} className="usage-bar-yaxis-label">{v}</span>
                                                ))
                                            )}
                                            <div className="usage-bar-yaxis-vertical"></div>
                                        </div>
                                        <div className="usage-bar-chart" style={{ position: 'relative' }}>
                                            {apiCostBars.map((val: number, i: number) => (
                                                <div
                                                    key={i}
                                                    className="usage-bar usage-bar-blue"
                                                    style={{
                                                        height: `${val}%`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        opacity: hoveredBar && hoveredBar.type === 'api' && hoveredBar.index === i ? 0.8 : 1,
                                                        transform: hoveredBar && hoveredBar.type === 'api' && hoveredBar.index === i ? 'scaleY(1.02)' : 'scaleY(1)'
                                                    }}
                                                    onMouseEnter={() => setHoveredBar({
                                                        type: 'api',
                                                        index: i,
                                                        value: apiCostData[i],
                                                        month: chartMonths[i]
                                                    })}
                                                    onMouseLeave={() => setHoveredBar(null)}
                                                />
                                            ))}

                                            {/* Tooltip for API Cost */}
                                            {hoveredBar && hoveredBar.type === 'api' && (
                                                <div
                                                    className="chart-tooltip"
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: `${apiCostBars[hoveredBar.index] + 5}%`,
                                                        left: `${(hoveredBar.index / apiCostBars.length) * 100 + (50 / apiCostBars.length)}%`,
                                                        transform: 'translateX(-50%)',
                                                        background: '#1a1d21',
                                                        color: 'white',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        border: '1px solid #333',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                        zIndex: 1000,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <div style={{ color: '#4FC3F7' }}>API Cost</div>
                                                    <div>{hoveredBar.month}: <strong>${hoveredBar.value.toFixed(2)}</strong></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="usage-bar-xaxis-horizontal"></div>
                                    </div>
                                    <div className="usage-bar-chart-labels usage-bar-chart-xaxis-labels">
                                        {chartMonths.map((month) => (
                                            <span key={month}>{month}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Transactions */}
                                <div className="usage-chart-card">
                                    <div className="usage-chart-title">Transactions</div>
                                    <div className="usage-chart-desc">Track how much you've deposited to your account.</div>
                                    <div className="usage-bar-chart-with-axes-outer">
                                        <div className="usage-bar-yaxis usage-bar-yaxis-overlay">
                                            {hasRealData ? (
                                                // Dynamic Y-axis based on real data
                                                [Math.ceil(maxTransactions), Math.ceil(maxTransactions * 0.8), Math.ceil(maxTransactions * 0.6), Math.ceil(maxTransactions * 0.4), Math.ceil(maxTransactions * 0.2), 0].map((v, index) => (
                                                    <span key={index} className="usage-bar-yaxis-label">${v}</span>
                                                ))
                                            ) : (
                                                // Fallback Y-axis
                                                [Math.ceil(maxTransactions), Math.ceil(maxTransactions * 0.8), Math.ceil(maxTransactions * 0.6), Math.ceil(maxTransactions * 0.4), Math.ceil(maxTransactions * 0.2), 0].map((v, index) => (
                                                    <span key={index} className="usage-bar-yaxis-label">${v}</span>
                                                ))
                                            )}
                                            <div className="usage-bar-yaxis-vertical"></div>
                                        </div>
                                        <div className="usage-bar-chart" style={{ position: 'relative' }}>
                                            {transactionBars.map((val: number, i: number) => (
                                                <div
                                                    key={i}
                                                    className="usage-bar usage-bar-purple"
                                                    style={{
                                                        height: `${val}%`,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease',
                                                        opacity: hoveredBar && hoveredBar.type === 'transaction' && hoveredBar.index === i ? 0.8 : 1,
                                                        transform: hoveredBar && hoveredBar.type === 'transaction' && hoveredBar.index === i ? 'scaleY(1.02)' : 'scaleY(1)'
                                                    }}
                                                    onMouseEnter={() => setHoveredBar({
                                                        type: 'transaction',
                                                        index: i,
                                                        value: transactionData[i],
                                                        month: chartMonths[i]
                                                    })}
                                                    onMouseLeave={() => setHoveredBar(null)}
                                                />
                                            ))}

                                            {/* Tooltip for Transactions */}
                                            {hoveredBar && hoveredBar.type === 'transaction' && (
                                                <div
                                                    className="chart-tooltip"
                                                    style={{
                                                        position: 'absolute',
                                                        bottom: `${transactionBars[hoveredBar.index] + 5}%`,
                                                        left: `${(hoveredBar.index / transactionBars.length) * 100 + (50 / transactionBars.length)}%`,
                                                        transform: 'translateX(-50%)',
                                                        background: '#1a1d21',
                                                        color: 'white',
                                                        padding: '8px 12px',
                                                        borderRadius: '6px',
                                                        fontSize: '12px',
                                                        fontWeight: '500',
                                                        border: '1px solid #333',
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                                        zIndex: 1000,
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    <div style={{ color: '#B983FF' }}>Transactions</div>
                                                    <div>{hoveredBar.month}: <strong>${hoveredBar.value.toFixed(2)}</strong></div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="usage-bar-xaxis-horizontal"></div>
                                    </div>
                                    <div className="usage-bar-chart-labels usage-bar-chart-xaxis-labels">
                                        {chartMonths.map((month) => (
                                            <span key={month}>{month}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Spending Section */}
                        <div className="usage-spending-section">
                            <div className="usage-chart-title">Monthly API Calls</div>
                            <div className="usage-chart-desc">Track your API usage trends across each month.</div>
                            <div className="usage-line-chart-row">
                                <div className="usage-line-chart">

                                    <svg width="100%" height="220" viewBox="0 0 900 220" className="usage-line-svg">
                                        {(() => {
                                            const maxApiCalls = Math.max(...apiCallsLineData, 1); // Avoid division by zero
                                            const chartHeight = 220;
                                            const chartWidth = 900; // Increased width
                                            const points: [number, number][] = apiCallsLineData.map((y, i) => [
                                                i === 0 ? 0 : i === 11 ? chartWidth : i * (chartWidth / 11),
                                                chartHeight - ((y / maxApiCalls) * (chartHeight - 20))
                                            ]);
                                            points[0][0] = 0;
                                            points[points.length - 1][0] = chartWidth;
                                            const d = getSmoothLinePath(points);
                                            // Y grid lines
                                            const yTicks = 6;
                                            const yGrid = Array.from({ length: yTicks }, (_, i) => i * (chartHeight / (yTicks - 1)));
                                            // X grid lines and labels
                                            return (
                                                <>
                                                    {/* Y grid lines */}
                                                    {yGrid.map((v, i) => (
                                                        <line
                                                            key={i}
                                                            x1={0}
                                                            x2={chartWidth}
                                                            y1={v}
                                                            y2={v}
                                                            stroke="#444"
                                                            strokeWidth={i === yGrid.length - 1 ? 2 : 1}
                                                            opacity={0.3}
                                                        />
                                                    ))}
                                                    {/* X grid lines and month labels */}
                                                    {points.map(([x, y], i) => (
                                                        <g key={i}>
                                                            <line
                                                                x1={x}
                                                                x2={x}
                                                                y1={0}
                                                                y2={chartHeight}
                                                                stroke="#444"
                                                                strokeWidth={1}
                                                                opacity={0.15}
                                                            />
                                                            <text
                                                                x={x}
                                                                y={chartHeight - 4}
                                                                textAnchor="middle"
                                                                fill="#fff"
                                                                fontSize="13"
                                                                opacity={0.8}
                                                            >
                                                                {monthNames[i]}
                                                            </text>
                                                        </g>
                                                    ))}
                                                    {/* The line */}
                                                    <path
                                                        d={d}
                                                        fill="none"
                                                        stroke="url(#spending-gradient)"
                                                        strokeWidth="3"
                                                        style={{ filter: 'drop-shadow(0 0 4px #fff2)' }}
                                                    />
                                                    {/* Tooltip logic remains unchanged */}
                                                    {points.map(([x, y], i) => (
                                                        <rect
                                                            key={i}
                                                            x={x - 18}
                                                            y={0}
                                                            width={36}
                                                            height={chartHeight}
                                                            fill="transparent"
                                                            style={{ cursor: "pointer" }}
                                                            onMouseEnter={() => setHoveredPoint(i)}
                                                            onMouseLeave={() => setHoveredPoint(null)}
                                                        />
                                                    ))}
                                                    {hoveredPoint !== null && (() => {
                                                        const [x, y] = points[hoveredPoint];
                                                        const tooltipWidth = 60;
                                                        const tooltipHeight = 28;
                                                        const tooltipPadding = 8;
                                                        // If the tooltip would go above the SVG, show it below the point
                                                        const showBelow = (y - tooltipHeight - tooltipPadding < 0);
                                                        const tooltipY = showBelow ? y + 18 : y - tooltipHeight - tooltipPadding;
                                                        const textY = showBelow ? y + 34 : y - tooltipHeight + 4;
                                                        return (
                                                            <g>
                                                                <rect
                                                                    x={x - tooltipWidth / 2}
                                                                    y={tooltipY}
                                                                    width={tooltipWidth}
                                                                    height={tooltipHeight}
                                                                    rx="6"
                                                                    fill="#1a1d21"
                                                                    stroke="#4FC3F7"
                                                                    strokeWidth="1"
                                                                    opacity="0.95"
                                                                />
                                                                <text
                                                                    x={x}
                                                                    y={textY}
                                                                    textAnchor="middle"
                                                                    fill="#fff"
                                                                    fontSize="13"
                                                                    fontWeight="bold"
                                                                >
                                                                    {monthNames[hoveredPoint]}: {apiCallsLineData[hoveredPoint]}
                                                                </text>
                                                            </g>
                                                        );
                                                    })()}
                                                    <defs>
                                                        <linearGradient id="spending-gradient" x1="0" y1="0" x2="900" y2="0" gradientUnits="userSpaceOnUse">
                                                            <stop offset="0%" stopColor="#b983ff" />
                                                            <stop offset="20%" stopColor="#7d7dff" />
                                                            <stop offset="40%" stopColor="#4ec9b0" />
                                                            <stop offset="60%" stopColor="#7CFF7C" />
                                                            <stop offset="80%" stopColor="#ffb7ef" />
                                                            <stop offset="100%" stopColor="#b7ffea" />
                                                        </linearGradient>
                                                    </defs>
                                                </>
                                            );
                                        })()}
                                    </svg>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '50px', background: '#111', border: '1px solid #333', borderRadius: '14px', marginTop: '20px' }}>
                        <h3 style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>Please Log In</h3>
                        <p style={{ color: '#bbb', fontSize: '16px', marginTop: '10px' }}>
                            {!isWalletConnected ? 'Connect your wallet' : 'Please log in'} to view your account balance and usage statistics.
                        </p>
                    </div>
                )}


                {/* View Documentation Card */}
                <ViewDocumentationCard onClick={() => navigate('/docs')} className="mt-10" />
            </div>

            {/* Add to Balance Modal */}
            {isModalOpen && (
                <div className="usage-modal-overlay" onClick={e => {
                    if (e.target === e.currentTarget) {
                        setIsModalOpen(false);
                    }
                }}>
                    <div className="usage-modal" onClick={(e) => e.stopPropagation()}>
                        <button className="usage-modal-close-btn" onClick={() => setIsModalOpen(false)}>
                            <X size={20} />
                        </button>

                        <div className="usage-modal-header">Add to your balance</div>
                        <div className="usage-modal-sub-header">Select an amount and chain to complete your payment.</div>

                        <div className="purchase-amount-input-wrapper">
                            <input
                                type="text"
                                placeholder="Purchase Amount"
                                className="purchase-amount-input"
                                value={customAmount}
                                maxLength={12}
                                onChange={(e) => {
                                    let value = e.target.value.replace(/[^0-9]/g, '');
                                    if (value.length > 12) value = value.slice(0, 12);
                                    setCustomAmount(value);
                                    setSelectedAmount(null);
                                }}
                            />
                        </div>

                        <div className="usage-modal-amounts">
                            {[10, 25, 50, 100].map((amount) => (
                                <button
                                    key={amount}
                                    className={`usage-modal-amount-btn ${selectedAmount === amount ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSelectedAmount(amount);
                                        setCustomAmount(amount.toString());
                                    }}
                                >
                                    ${amount}
                                </button>
                            ))}
                            <button
                                className={`usage-modal-amount-btn ${!selectedAmount && customAmount ? 'selected' : ''}`}
                                onClick={() => setSelectedAmount(null)}
                            >
                                Custom
                            </button>
                        </div>

                        <div className="chain-selector">
                            <label htmlFor="chain-select">Payment Chain</label>
                            <div style={{ flex: 1 }}>
                                <ChainDropdown
                                    chains={supportedChains}
                                    selectedChainId={selectedChainId}
                                    setSelectedChainId={setSelectedChainId}
                                />
                            </div>
                        </div>

                        {selectedChainId !== 'solana' && assets.length > 0 && (
                            <div className="chain-selector" style={{ marginTop: 12 }}>
                                <label htmlFor="asset-select">Asset</label>
                                <select
                                    id="asset-select"
                                    value={selectedAssetSymbol}
                                    onChange={(e) => setSelectedAssetSymbol(e.target.value as 'USDC' | 'USDT')}
                                    style={{ flex: 1, background: '#1A1D21', color: 'white', borderRadius: 8, padding: '10px', border: '1px solid #444' }}
                                >
                                    {assets.map((a) => (
                                        <option key={a.symbol} value={a.symbol}>{a.symbol}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="balance-preview">
                            <div className="balance-preview-label">Balance after purchase</div>
                            <div className="balance-preview-amount">${balanceAfterPurchase.toFixed(2)}</div>
                        </div>

                        {paymentError && <div className="usage-modal-error" style={{ color: '#ff4444', fontWeight: 600 }}>{paymentError}</div>}

                        <div className="usage-modal-buttons">
                            <button className="usage-modal-btn usage-modal-btn-secondary" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </button>
                            <button className="usage-modal-btn" onClick={handlePayWithCrypto} disabled={paymentStep !== 'idle' || isAssetsLoading || assets.length === 0}>
                                {getPaymentButtonText()}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default UsagePage; 