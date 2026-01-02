import React, { useState, useEffect } from 'react';
import { Tooltip } from '../../../components/Tooltip';
import { checkAuthStatus, logout, isBackendAvailable, AuthStatus } from '../../../services/backendProxy';
import { openOAuthPopup } from '../../../services/authService';

interface AuthBadgeProps {
    manualApiKey: string | null;
    onSetManualKey: (key: string | null) => void;
}

type AuthStatusType = 'SYSTEM' | 'MANUAL' | 'OAUTH';

export const AuthBadge: React.FC<AuthBadgeProps> = ({ manualApiKey, onSetManualKey }) => {
    const [showModal, setShowModal] = useState(false);
    const [inputKey, setInputKey] = useState('');

    // Backend OAuth state
    const [oauthStatus, setOauthStatus] = useState<AuthStatus>({ authenticated: false });
    const [isOAuthLoading, setIsOAuthLoading] = useState(false);
    const [backendAvailable, setBackendAvailable] = useState(false);

    // Determine current effective status
    const currentStatus: AuthStatusType = manualApiKey
        ? 'MANUAL'
        : oauthStatus.authenticated
            ? 'OAUTH'
            : 'SYSTEM';

    useEffect(() => {
        const checkSupport = async () => {
            // Check backend OAuth availability
            if (isBackendAvailable()) {
                setBackendAvailable(true);
                try {
                    const status = await checkAuthStatus();
                    setOauthStatus(status);
                } catch (e) {
                    console.warn("Backend auth check failed", e);
                }
            }
        };
        checkSupport();
    }, []);

    const handleOAuthConnect = async () => {
        setIsOAuthLoading(true);
        try {
            const status = await openOAuthPopup();
            setOauthStatus(status);
            onSetManualKey(null); // Clear manual key
            setShowModal(false);
        } catch (e: any) {
            console.error("OAuth failed:", e);
            alert(e.message || 'OAuth authentication failed');
        } finally {
            setIsOAuthLoading(false);
        }
    };

    const handleOAuthLogout = async () => {
        const success = await logout();
        if (success) {
            setOauthStatus({ authenticated: false });
        }
    };

    const handleManualSubmit = () => {
        if (inputKey.trim()) {
            onSetManualKey(inputKey.trim());
            setOauthStatus({ authenticated: false });
            setShowModal(false);
            setInputKey('');
        }
    };

    const handleReset = async () => {
        onSetManualKey(null);
        if (oauthStatus.authenticated) {
            await logout();
            setOauthStatus({ authenticated: false });
        }
        setShowModal(false);
    };

    const renderBadge = () => {
        if (currentStatus === 'MANUAL') {
            return (
                <div className="flex items-center gap-2 text-veritas-red border border-veritas-red bg-veritas-red/10 px-3 py-1 text-[10px] font-mono shadow-[0_0_10px_rgba(255,42,42,0.2)] hover:bg-veritas-red/20 transition-all">
                    <span className="w-1.5 h-1.5 rounded-full bg-veritas-red animate-pulse"></span>
                    MANUAL_KEY
                </div>
            );
        }
        if (currentStatus === 'OAUTH') {
            return (
                <div className="flex items-center gap-2 text-veritas-cyan border border-veritas-cyan bg-veritas-cyan/10 px-3 py-1 text-[10px] font-mono shadow-[0_0_10px_rgba(0,255,255,0.2)] hover:bg-veritas-cyan/20 transition-all">
                    <span className="w-1.5 h-1.5 rounded-full bg-veritas-cyan animate-pulse"></span>
                    GOOGLE_OAUTH
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 text-zinc-500 border border-zinc-800 hover:text-white hover:border-zinc-600 px-3 py-1 text-[10px] font-mono transition-colors">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span>
                SYS_LINK
            </div>
        );
    };

    return (
        <>
            <Tooltip content={`Authentication Source: ${currentStatus}${currentStatus === 'OAUTH' ? ` (${oauthStatus.user?.email})` : ''}`} position="bottom">
                <button onClick={() => setShowModal(true)}>
                    {renderBadge()}
                </button>
            </Tooltip>

            {showModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
                >
                    <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.9)] relative">

                        {/* Header */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-veritas-cyan via-veritas-gold to-veritas-red opacity-50"></div>
                        <button
                            onClick={() => setShowModal(false)}
                            className="absolute top-2 right-2 text-zinc-500 hover:text-white px-2 z-10 font-mono"
                        >
                            ✕
                        </button>

                        <div className="grid md:grid-cols-2">
                            {/* COL 1: BACKEND OAUTH */}
                            <div className={`p-8 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col items-center text-center relative overflow-hidden group transition-all ${!backendAvailable ? 'opacity-50 grayscale' : ''}`}>
                                <div className="absolute inset-0 bg-veritas-cyan/5 group-hover:bg-veritas-cyan/10 transition-colors pointer-events-none"></div>

                                <div className="relative z-10 w-12 h-12 rounded-full bg-veritas-cyan/20 text-veritas-cyan flex items-center justify-center text-xl mb-4 border border-veritas-cyan/50 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
                                    🔐
                                </div>
                                <h3 className="relative z-10 text-white font-mono font-bold tracking-widest mb-2 text-sm">GOOGLE OAUTH</h3>
                                <p className="relative z-10 text-[10px] text-zinc-400 leading-relaxed mb-6 font-mono h-12">
                                    Sign in with Google to use your<br />
                                    <span className="text-veritas-cyan">Gemini Code Assist subscription.</span>
                                </p>

                                {backendAvailable ? (
                                    oauthStatus.authenticated ? (
                                        <div className="relative z-10 mt-auto w-full space-y-2">
                                            <div className="text-[10px] text-veritas-cyan font-mono">
                                                ✓ {oauthStatus.user?.email}
                                            </div>
                                            <button
                                                onClick={handleOAuthLogout}
                                                className="w-full py-2 border border-zinc-700 text-zinc-400 font-mono text-xs hover:border-veritas-red hover:text-veritas-red transition-colors"
                                            >
                                                DISCONNECT
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={handleOAuthConnect}
                                            disabled={isOAuthLoading}
                                            className="relative z-10 mt-auto w-full py-3 bg-veritas-cyan text-black font-bold font-mono text-xs uppercase tracking-wider hover:bg-veritas-cyan/80 transition-colors shadow-[0_0_15px_rgba(0,255,255,0.3)] disabled:opacity-50"
                                        >
                                            {isOAuthLoading ? 'CONNECTING...' : 'SIGN IN WITH GOOGLE'}
                                        </button>
                                    )
                                ) : (
                                    <div className="relative z-10 mt-auto w-full py-3 border border-zinc-800 text-zinc-600 font-mono text-[10px] uppercase cursor-not-allowed">
                                        BACKEND NOT CONFIGURED
                                    </div>
                                )}

                                {!backendAvailable && (
                                    <p className="relative z-10 text-[9px] text-zinc-600 mt-2">Set VITE_USE_BACKEND=true</p>
                                )}
                            </div>

                            {/* COL 2: MANUAL KEY */}
                            <div className="p-8 flex flex-col items-center text-center relative overflow-hidden group">
                                <div className="absolute inset-0 bg-veritas-red/5 group-hover:bg-veritas-red/10 transition-colors pointer-events-none"></div>

                                <div className="relative z-10 w-12 h-12 rounded-full bg-veritas-red/20 text-veritas-red flex items-center justify-center text-xl mb-4 border border-veritas-red/50 shadow-[0_0_20px_rgba(255,42,42,0.2)]">
                                    ⚡
                                </div>
                                <h3 className="relative z-10 text-white font-mono font-bold tracking-widest mb-2 text-sm">MANUAL KEY</h3>
                                <p className="relative z-10 text-[10px] text-zinc-400 leading-relaxed mb-6 font-mono h-12">
                                    Enter a raw Gemini API key.<br />
                                    <span className="text-veritas-red">Bypasses all other auth.</span>
                                </p>

                                <input
                                    type="password"
                                    value={inputKey}
                                    onChange={(e) => setInputKey(e.target.value)}
                                    placeholder="AIzaSy..."
                                    className="relative z-10 w-full bg-black/50 border border-zinc-700 text-white font-mono text-xs p-3 mb-3 focus:border-veritas-red focus:outline-none text-center rounded-sm placeholder:text-zinc-700"
                                />

                                <button
                                    onClick={handleManualSubmit}
                                    disabled={!inputKey}
                                    className="relative z-10 w-full py-3 border border-veritas-red text-veritas-red font-bold font-mono text-xs uppercase tracking-wider hover:bg-veritas-red hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    USE MANUAL KEY
                                </button>
                            </div>
                        </div>

                        {/* FOOTER: RESET */}
                        {(manualApiKey || oauthStatus.authenticated) && (
                            <div className="border-t border-zinc-800 p-3 bg-zinc-900/50 text-center flex justify-center">
                                <button
                                    onClick={handleReset}
                                    className="text-[10px] text-zinc-500 hover:text-white font-mono uppercase tracking-widest border-b border-transparent hover:border-zinc-500 transition-all"
                                >
                                    DISCONNECT & RETURN TO SYSTEM DEFAULT
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};