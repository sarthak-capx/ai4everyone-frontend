import React, { useEffect, useState, useRef } from 'react';
import { Key, X as CloseIcon, Trash2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../styles/ApiKeysPage.css';
import { fetchApiKeysForUser } from '../components/utils';
import { useUser } from '../contexts/userContext';
import { API_ENDPOINTS } from '../config';
import { secureStorage, getCurrentJWTSync } from '../utils/secureStorage';
import { ApiKeySchema, sanitizeInput } from '../utils/validation';
import ViewDocumentationCard from '../components/ViewDocumentationCard';
import { secureClipboardCopy } from '../utils/secureClipboard';
import { useAccount } from 'wagmi';

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
    const [isCreatingKey, setIsCreatingKey] = useState(false);

    const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
    const [showNewKeyModal, setShowNewKeyModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
    const isCreatingRef = useRef(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const { user } = useUser();
    const { isConnected } = useAccount();
    const navigate = useNavigate();
    const [copiedMap, setCopiedMap] = useState<Record<string, boolean>>({});

    const handleCopyKey = async (row: ApiKeyRow) => {
        const valueToCopy = row.key || (row.key_prefix ? row.key_prefix : '');
        if (!valueToCopy) return;
        await secureClipboardCopy(valueToCopy, { isSensitive: true, showNotification: true });
        setCopiedMap(prev => ({ ...prev, [row.id]: true }));
        setTimeout(() => setCopiedMap(prev => ({ ...prev, [row.id]: false })), 1200);
    };

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

    // 🔒 SECURITY: Enhanced navigation handler with memory clearing
    const handleNavigation = (path: string) => {
        // Clear sensitive data before navigation
        clearApiKeysFromMemory();
        navigate(path);
    };

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



    // 🔒 SECURITY: Enhanced API key fetching with memory management
    const fetchApiKeys = async () => {
        console.log('🔄 fetchApiKeys called');
        setLoading(true);
        setError('');
        try {
            const jwt = getCurrentJWTSync();
            console.log('🔑 JWT available:', !!jwt);
            if (!user) {
                setError(isConnected ? 'Please log in to view API keys' : 'Connect wallet to view API keys');
                setApiKeys([]);
                setLoading(false);
                return;
            }
            if (!jwt) {
                setError('Please log in to view API keys');
                setApiKeys([]);
                setLoading(false);
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

        // Prevent duplicate names (case-insensitive) using latest server data
        try {
            const jwt = getCurrentJWTSync();
            if (!user || !jwt) {
                setError('Please log in to create API keys');
                return;
            }
            const resList = await fetch(API_ENDPOINTS.API_KEYS, { headers: { 'Authorization': `Bearer ${jwt}` } });
            if (resList.ok) {
                const list = await resList.json();
                const duplicateServer = Array.isArray(list) && list.some((k: any) => (k.name || '').trim().toLowerCase() === sanitizedName.trim().toLowerCase());
                if (duplicateServer) {
                    setError('API key name already exists');
                    return;
                }
            }
        } catch { }

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
                    // Immediately persist the new plaintext key in secure storage
                    try {
                        const current = await secureStorage.getApiKeys();
                        const incoming = Array.isArray(current) ? current : [];
                        // The POST returns the created row (sanitized) plus plaintext `key`
                        const createdRow = { ...(data || {}), key: data.key };
                        // Merge by id, prefer the new one so it carries `key`
                        const merged = [createdRow, ...incoming.filter((k: any) => k.id !== createdRow.id)];
                        await secureStorage.setApiKeys(merged);
                    } catch { }
                }

                // Refetch the API keys from backend to ensure latest list
                fetchApiKeys();
            } else {
                if (res.status === 409) {
                    setError('API key name already exists');
                } else {
                    setError(data.error || 'Failed to create API key');
                }
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

    // Delete API key
    const handleDeleteKey = async (keyId: string) => {
        try {
            const jwt = getCurrentJWTSync();
            if (!user || !jwt) {
                setError('Please log in to delete API keys');
                return;
            }

            const res = await fetch(`${API_ENDPOINTS.API_KEYS}/${keyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${jwt}` }
            });

            if (res.ok) {
                const updatedKeys = apiKeys.filter(key => key.id !== keyId);
                setApiKeys(updatedKeys);
                await secureStorage.setApiKeys(updatedKeys);
                if (updatedKeys.length === 0) {
                    setTimeout(() => { clearApiKeysFromMemory(); }, 100);
                }
                setShowDeleteModal(false);
                setDeleteKeyId(null);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to delete API key');
            }
        } catch (err) {
            console.error('Error deleting API key:', err);
            setError('Network error while deleting API key');
        }
    };

    const openDeleteConfirm = (keyId: string) => {
        setDeleteKeyId(keyId);
        setShowDeleteModal(true);
    };

    const closeDeleteConfirm = () => {
        setShowDeleteModal(false);
        setDeleteKeyId(null);
    };

    return (
        <div className="models-page">
            {/* Banner - aligned with ModelsPage style */}
            <div className="w-full h-[220px] md:h-[250px] overflow-hidden relative bg-[#142C96]">
                <img
                    src="/images/quminsoda2_isometric_view_pixel_art_of_a_secure_server_room_w_2d9eee63-d8d8-4067-a459-d8d9b92eca8d_0 1.png"
                    alt="AI4Everyone Banner"
                    className="w-full h-full object-cover object-center relative z-[1] hidden md:block"
                />
                <img
                    src="/images/quminsoda2_isometric_view_pixel_art_of_a_secure_server_room_w_2d9eee63-d8d8-4067-a459-d8d9b92eca8d_0 1.png"
                    alt="AI4Everyone Mobile Banner"
                    className="w-full h-full object-cover object-center md:hidden block relative z-[1]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/80 to-transparent z-[2]"></div>
            </div>

            {/* Header row */}
            <div className="flex flex-col items-start page-wrap md:mt-[-35px] relative z-[3] px-4 md:px-0 ">
                <div className="flex-1">
                    <h1 className="font-black text-[40px] text-white">API Keys</h1>
                    <p className="text-sm md:text-base text-[#999999] text-left mb-4 w-full">Your access gateway to the Unstoppable API platform.</p>
                </div>
            </div>

            {/* Create Key buttons row */}
            {user && (
                <div className="page-wrap relative z-[3] px-4 md:px-0">
                    <div className="content-header-row" style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <div style={{ flex: 1 }}>
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
            )}

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
                        ) : !user ? (
                            <tr><td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>
                                {!isConnected ? 'Connect wallet to view API keys' : 'Please log in to view API keys'}
                            </td></tr>
                        ) : apiKeys.length === 0 ? (
                            <tr><td colSpan={4}>No API keys found.</td></tr>
                        ) : (
                            apiKeys.map((row, idx) => (
                                <tr key={row.id || idx}>
                                    <td>{row.name}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span>{row.key || (row.key_prefix ? `${row.key_prefix}...` : 'N/A')}</span>

                                        </div>
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
                                                onClick={() => openDeleteConfirm(row.id)}
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
            <p className="table-note" style={{ margin: '16px auto 0 auto', textAlign: 'left', width: '90%', maxWidth: '1200px' }}>
                Please Note: The full API key is shown once during creation - copy it immediately. In the table above, you can only see the key prefix.
            </p>

            {/* Docs Box */}
            <ViewDocumentationCard onClick={() => navigate('/docs')} className="mt-10" />

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    zIndex: 2100,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 20
                }}>
                    <div style={{
                        background: '#181818',
                        borderRadius: 16,
                        border: '1px solid #333',
                        width: '90%',
                        maxWidth: 420,
                        padding: 24,
                        color: '#fff',
                        position: 'relative'
                    }}>
                        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Delete API Key?</div>
                        <div style={{ color: '#bbb', fontSize: 14, marginBottom: 20 }}>This will deactivate the selected key. This action can’t be undone.</div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                onClick={closeDeleteConfirm}
                                style={{
                                    background: '#23232a',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    fontWeight: 600
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteKeyId && handleDeleteKey(deleteKeyId)}
                                style={{
                                    background: '#FF4444',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 10,
                                    padding: '10px 16px',
                                    cursor: 'pointer',
                                    fontWeight: 800
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
});

export default ApiKeysPage; 