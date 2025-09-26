import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, Home, Box, Cpu, BarChart2, Key, Settings, FileText, X, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../contexts/userContext';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useDisconnect, useAccount } from 'wagmi';
import { secureStorage } from '../utils/secureStorage';
import { safeNavigate } from '../utils/validation';

const MobileNav = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logoutUser } = useUser();
    const { address, isConnected } = useAccount();
    const isWalletLoading = status === 'connecting' || status === 'reconnecting';
    const { openConnectModal } = useConnectModal();

    const sidebarRef = useRef<HTMLDivElement | null>(null);
    const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

    // Lock body scroll when menu is open
    useEffect(() => {
        if (mobileMenuOpen) {
            const prev = document.body.style.overflow;
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = prev; };
        }
    }, [mobileMenuOpen]);

    // Close on Escape
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        };
        if (mobileMenuOpen) {
            window.addEventListener('keydown', onKeyDown);
        }
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [mobileMenuOpen]);

    // Focus first focusable when opening
    useEffect(() => {
        if (mobileMenuOpen && firstFocusableRef.current) {
            firstFocusableRef.current.focus();
        }
    }, [mobileMenuOpen]);

    const navItemBase = 'flex items-center gap-[11px] p-3 cursor-pointer transition-all duration-200 text-[#848484] text-[16px] font-normal hover:bg-white/10 hover:text-white active:bg-white/20 active:scale-[0.98]';
    const navActive = 'bg-white/10 text-white';

    const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);

    const handleNavigation = (path: string) => {
        if (safeNavigate(navigate, path)) {
            setMobileMenuOpen(false);
        }
    };

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        logoutUser();
    };

    const displayEmail = (email?: string) => {
        if (!email) return '';
        return email.length > 15 ? email.slice(0, 15) + '...' : email;
    };

    const showAccountInfo = isConnected && !!user;

    return (
        <div className="md:hidden">
            {/* Mobile Header */}
            <div className="flex w-full bg-[#121214] py-3 px-5 justify-between items-center relative z-[100]">
                <div className="flex-1">
                    <img
                        src="/images/logo.png"
                        alt="Logo"
                        className="h-8 w-auto max-w-[200px] object-contain"
                    />
                </div>
                <button
                    type="button"
                    aria-label="Open menu"
                    aria-controls="mobile-sidebar"
                    aria-expanded={mobileMenuOpen}
                    className="w-10 h-10 cursor-pointer flex items-center justify-center rounded-md transition-all duration-200 hover:bg-white/10 active:bg-white/20 active:scale-95"
                    onClick={toggleMobileMenu}
                >
                    <img
                        src="/images/menu_alt_02.png"
                        alt="Menu"
                        className="w-6 h-6 opacity-80 transition-all duration-200 hover:opacity-100"
                    />
                </button>
            </div>

            {/* Mobile Sidebar Overlay and Drawer */}
            <div
                className={`fixed inset-0 bg-black/75 backdrop-blur-sm z-[1000] transition-all duration-300 ease-in-out ${mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                onClick={toggleMobileMenu}
                aria-hidden="true"
            />
            <div
                id="mobile-sidebar"
                ref={sidebarRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-sidebar-title"
                className={`fixed top-0 right-0 h-screen w-[85vw] max-w-[320px] bg-[#121214] border-l border-[#383940] z-[1001] flex flex-col transform transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="h-[56px] bg-[#2F2F2F] flex items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
                    <img src="/images/logo.png" alt="UNSTOPPABLE" className="h-[16px] w-auto object-contain" />
                    <button
                        type="button"
                        ref={firstFocusableRef}
                        aria-label="Close menu"
                        className="p-2 rounded-md transition-all duration-200 hover:bg-white/10 active:bg-white/20 active:scale-95 hover:text-white"
                        onClick={() => setMobileMenuOpen(false)}
                    >
                        <X size={18} className="text-[#9B9797] transition-colors duration-200" />
                    </button>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-0 overflow-y-auto" role="navigation" aria-label="Main navigation">
                    <button
                        className={`${navItemBase} ${isActive('/') ? navActive : ''} w-full text-left`}
                        onClick={() => handleNavigation('/')}
                        aria-current={isActive('/') ? 'page' : undefined}
                    >
                        <Home size={18} />
                        <span>Home</span>
                    </button>

                    <button
                        className={`${navItemBase} ${isActive('/models') ? navActive : ''} w-full text-left`}
                        onClick={() => handleNavigation('/models')}
                        aria-current={isActive('/models') ? 'page' : undefined}
                    >
                        <Box size={18} />
                        <span>Models</span>
                    </button>

                    <button
                        className={`${navItemBase} ${isActive('/playground') ? navActive : ''} w-full text-left`}
                        onClick={() => handleNavigation('/playground')}
                        aria-current={isActive('/playground') ? 'page' : undefined}
                    >
                        <Cpu size={18} />
                        <span>Playground</span>
                    </button>

                    <button
                        className={`${navItemBase} ${isActive('/usage') ? navActive : ''} w-full text-left`}
                        onClick={() => handleNavigation('/usage')}
                        aria-current={isActive('/usage') ? 'page' : undefined}
                    >
                        <BarChart2 size={18} />
                        <span>Usage</span>
                    </button>

                    <button
                        className={`${navItemBase} ${isActive('/api-keys') ? navActive : ''} w-full text-left`}
                        onClick={() => handleNavigation('/api-keys')}
                        aria-current={isActive('/api-keys') ? 'page' : undefined}
                    >
                        <Key size={18} />
                        <span>API Keys</span>
                    </button>

                    <button
                        className={`${navItemBase} ${isConnected ? navActive : ''} w-full text-left`}
                        onClick={() => handleNavigation('/settings')}
                        aria-current={isActive('/settings') ? 'page' : undefined}
                    >
                        <Settings size={18} />
                        <span>Settings</span>
                    </button>

                    <button
                        className={`${navItemBase} ${isActive('/docs') ? navActive : ''} bg-black border border-[#383940] rounded-[12px] mx-4 my-3 justify-between text-white w-[calc(100%-2rem)] text-left`}
                        onClick={() => handleNavigation('/docs')}
                        aria-current={isActive('/docs') ? 'page' : undefined}
                    >
                        <div className="flex items-center gap-[11px]">
                            <FileText size={18} />
                            <span>Docs</span>
                        </div>
                        <ExternalLink size={14} className="text-[#9B9797]" />
                    </button>
                </nav>

                {/* Footer */}
                <div className="px-3 pb-3">
                    {/* Social Icons */}
                    <div className="flex items-center gap-[21px] py-2">
                        <a href="https://t.me/" target="_blank" rel="noopener noreferrer" aria-label="Telegram" className="flex items-center justify-center w-6 h-6 transition-opacity duration-200 hover:opacity-80">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M21.944 2.112a1.5 1.5 0  0 0-1.6-.2L2.7 9.1a1.5 1.5 0  0 0 .1 2.8l4.7 1.6 1.7 5.2a1.5 1.5 0  0 0 2.7.3l2.1-3.2 4.6 3.4a1.5 1.5 0  0 0 2.4-1l2-15a1.5 1.5 0  0 0-.526-1.188zM9.7 15.2l-1.2-3.7 8.2-6.2-7 7.6zm2.2 3.1l-1.1-3.3 1.7-1.3 2.1 1.5zm7.1-1.2-4.2-3.1 5.2-7.6z" fill="#9B9797" />
                            </svg>
                        </a>

                        <a href="https://discord.gg/" target="_blank" rel="noopener noreferrer" aria-label="Discord" className="flex items-center justify-center w-6 h-6 transition-opacity duration-200 hover:opacity-80">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M20.317 4.369a19.791 19.791 0  0 0-4.885-1.515.074.074 0  0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0  0 0-5.487 0 12.64 12.64 0  0 0-.617-1.25.077.077 0  0 0-.079-.037A19.736 19.736 0  0 0 3.677 4.37a.07.07 0  0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0  0 0 .031.057 19.9 19.9 0  0 0 5.993 3.03.078.078 0  0 0 .084-.028 14.09 14.09 0  0 1 1.226-1.994.076.076 0  0 0-.041-.106 13.107 13.107 0  0 1-1.872-.892.077.077 0  0 1-.008-.128 10.2 10.2 0  0 0 .372-.292.074.074 0  0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0  0 1 .078.01c.12.098.246.198.373.292a.077.077 0  0 1-.006.127 12.299 12.299 0  0 1-1.873.892.077.077 0  0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0  0 0 .084.028 19.839 19.839 0  0 0 6.002-3.03.077.077 0  0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0  0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" fill="#9B9797" />
                            </svg>
                        </a>

                        <a href="https://x.com/" target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" className="flex items-center justify-center w-6 h-6 transition-opacity duration-200 hover:opacity-80">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#9B9797" />
                            </svg>
                        </a>
                    </div>

                    {/* User Section */}
                    <div className="p-3">
                        {showAccountInfo ? (
                            <div className="flex justify-between items-center gap-[11px]">
                                <div className="flex items-center gap-[11px]">
                                    <div className="w-6 h-6 bg-[#9B9797] rounded-full flex items-center justify-center text-[12px] font-semibold text:white">
                                        <span>{user?.name ? user.name[0].toUpperCase() : address?.slice(0, 2)?.toUpperCase()}</span>
                                    </div>
                                    <span className="text-[16px] text-[#9B9797]">
                                        {user?.email ? displayEmail(user.email) : (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Account')}
                                    </span>
                                </div>
                                <button
                                    className="bg-transparent border-0 p-0 cursor-pointer flex items-center justify-center"
                                    onClick={() => {
                                        handleLogout();
                                        setMobileMenuOpen(false);
                                    }}
                                    aria-label="Logout"
                                >
                                    <LogOut size={18} color="#888" />
                                </button>
                            </div>
                        ) : (
                            <button
                                className="w-full px-3 py-2 bg-blue-500 rounded-md hover:bg-blue-600 transition"
                                onClick={() => {
                                    openConnectModal && openConnectModal();
                                    setMobileMenuOpen(false);
                                }}
                            >
                                Connect Wallet
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobileNav; 