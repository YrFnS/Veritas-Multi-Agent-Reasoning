import React, { useState, useEffect } from 'react';
import { Tooltip } from '../../../components/Tooltip';

interface AuthBadgeProps {
    manualApiKey: string | null;
    onSetManualKey: (key: string | null) => void;
}

type AuthStatus = 'SYSTEM' | 'SUBSCRIPTION' | 'MANUAL';

export const AuthBadge: React.FC<AuthBadgeProps> = ({ manualApiKey, onSetManualKey }) => {
  const [hasSubscription, setHasSubscription] = useState(false);
  const [isAiStudioAvailable, setIsAiStudioAvailable] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [inputKey, setInputKey] = useState('');

  // Determine current effective status
  // If manual key is present, it overrides everything.
  // If no manual key, we check if subscription is active.
  const currentStatus: AuthStatus = manualApiKey ? 'MANUAL' : (hasSubscription ? 'SUBSCRIPTION' : 'SYSTEM');

  useEffect(() => {
    const checkSupport = async () => {
        const aiStudio = (window as any).aistudio;
        if (aiStudio) {
            setIsAiStudioAvailable(true);
            try {
                const hasKey = await aiStudio.hasSelectedApiKey();
                setHasSubscription(hasKey);
            } catch (e) {
                console.warn("AI Studio check failed", e);
            }
        }
    };
    checkSupport();
  }, []);

  const handleSubscriptionConnect = async () => {
    const aiStudio = (window as any).aistudio;
    if (!aiStudio) return;

    try {
        await aiStudio.openSelectKey();
        // We assume success if the promise resolves
        setHasSubscription(true);
        onSetManualKey(null); // Clear manual key to ensure subscription takes priority
        setShowModal(false);
    } catch (e: any) {
        console.error("Key Selection Failed", e);
        if (e.message && e.message.includes("Requested entity was not found")) {
            setHasSubscription(false);
            // Re-open modal to allow retry if they cancelled out of the Google flow weirdly
            setTimeout(() => setShowModal(true), 500);
        }
    }
  };

  const handleManualSubmit = () => {
      if (inputKey.trim()) {
          onSetManualKey(inputKey.trim());
          setHasSubscription(false); // Manual overrides subscription
          setShowModal(false);
          setInputKey('');
      }
  };

  const handleReset = () => {
      onSetManualKey(null);
      setHasSubscription(false);
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
      if (currentStatus === 'SUBSCRIPTION') {
          return (
             <div className="flex items-center gap-2 text-veritas-gold border border-veritas-gold bg-veritas-gold/10 px-3 py-1 text-[10px] font-mono shadow-[0_0_10px_rgba(255,204,0,0.2)] hover:bg-veritas-gold/20 transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-veritas-gold animate-pulse"></span>
                GOOGLE_SUB
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
        <Tooltip content={`Authentication Source: ${currentStatus}`} position="bottom">
            <button onClick={() => setShowModal(true)}>
                {renderBadge()}
            </button>
        </Tooltip>

        {showModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 shadow-[0_0_60px_rgba(0,0,0,0.9)] relative grid md:grid-cols-2">
                    
                    {/* Header Absolute */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-veritas-gold via-veritas-cyan to-veritas-red opacity-50"></div>
                    <button 
                        onClick={() => setShowModal(false)}
                        className="absolute top-2 right-2 text-zinc-500 hover:text-white px-2 z-10 font-mono"
                    >
                        ✕
                    </button>

                    {/* COL 1: GOOGLE SUBSCRIPTION */}
                    <div className={`p-8 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col items-center text-center relative overflow-hidden group transition-all ${!isAiStudioAvailable ? 'opacity-50 grayscale' : ''}`}>
                        <div className="absolute inset-0 bg-veritas-gold/5 group-hover:bg-veritas-gold/10 transition-colors"></div>
                        
                        {/* Google G Icon approximation */}
                        <div className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center text-xl mb-4 shadow-[0_0_20px_rgba(255,255,255,0.2)] font-bold">
                            G
                        </div>
                        <h3 className="text-white font-mono font-bold tracking-widest mb-2">GOOGLE SUBSCRIPTION</h3>
                        <p className="text-[10px] text-zinc-400 leading-relaxed mb-6 font-mono h-12">
                            Authenticate using your Google Cloud Project billing. <br/>
                            <span className="text-veritas-gold">Recommended for high usage limits.</span>
                        </p>
                        
                        {isAiStudioAvailable ? (
                            <button 
                                onClick={handleSubscriptionConnect}
                                className="mt-auto w-full py-3 bg-white text-black font-bold font-mono text-xs uppercase tracking-wider hover:bg-veritas-gold hover:text-black transition-colors shadow-[0_0_15px_rgba(255,255,255,0.3)]"
                            >
                                {hasSubscription ? 'SWITCH ACCOUNT' : 'CONNECT SUBSCRIPTION'}
                            </button>
                        ) : (
                            <div className="mt-auto w-full py-3 border border-zinc-800 text-zinc-600 font-mono text-[10px] uppercase cursor-not-allowed">
                                ENVIRONMENT UNAVAILABLE
                            </div>
                        )}
                        
                        {!isAiStudioAvailable && (
                            <p className="text-[9px] text-zinc-600 mt-2">Only available in AI Studio / IDX environments</p>
                        )}
                    </div>

                    {/* COL 2: MANUAL KEY */}
                    <div className="p-8 flex flex-col items-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-veritas-red/5 group-hover:bg-veritas-red/10 transition-colors"></div>

                        <div className="w-12 h-12 rounded-full bg-veritas-red/20 text-veritas-red flex items-center justify-center text-xl mb-4 border border-veritas-red/50 shadow-[0_0_20px_rgba(255,42,42,0.2)]">
                            ⚡
                        </div>
                        <h3 className="text-white font-mono font-bold tracking-widest mb-2">MANUAL API KEY</h3>
                        <p className="text-[10px] text-zinc-400 leading-relaxed mb-6 font-mono h-12">
                            Enter a raw Google Gemini API key directly.<br/>
                            <span className="text-veritas-red">Bypasses subscription check.</span>
                        </p>

                        <input 
                            type="password"
                            value={inputKey}
                            onChange={(e) => setInputKey(e.target.value)}
                            placeholder="AIzaSy..."
                            className="w-full bg-black/50 border border-zinc-700 text-white font-mono text-xs p-3 mb-3 focus:border-veritas-red focus:outline-none text-center rounded-sm placeholder:text-zinc-700"
                        />
                        
                        <button 
                            onClick={handleManualSubmit}
                            disabled={!inputKey}
                            className="w-full py-3 border border-veritas-red text-veritas-red font-bold font-mono text-xs uppercase tracking-wider hover:bg-veritas-red hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            USE MANUAL KEY
                        </button>
                    </div>
                    
                    {/* FOOTER: RESET */}
                    {(manualApiKey || hasSubscription) && (
                        <div className="col-span-1 md:col-span-2 border-t border-zinc-800 p-3 bg-zinc-900/50 text-center flex justify-center">
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