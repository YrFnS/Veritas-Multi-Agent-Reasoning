
import React, { useState, useEffect } from 'react';

export const SystemMonitor: React.FC = () => {
  const [lines, setLines] = useState<string[]>([]);

  const addLine = (text: string) => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
    setLines(prev => [`[${timestamp}] ${text}`, ...prev].slice(0, 5));
  };

  useEffect(() => {
    // Initial startup logs
    const timers = [
      setTimeout(() => addLine("KERNEL_INIT_OK"), 1000),
      setTimeout(() => addLine("NEURAL_LINK_ESTABLISHED"), 2000),
      setTimeout(() => addLine("MONITORING_ENTROPY..."), 4000)
    ];

    // Listen for custom events dispatched from other components
    const handleSystemEvent = (e: CustomEvent) => {
        addLine(e.detail.message.toUpperCase());
    };

    window.addEventListener('veritas-sys-event' as any, handleSystemEvent);

    return () => {
        timers.forEach(clearTimeout);
        window.removeEventListener('veritas-sys-event' as any, handleSystemEvent);
    };
  }, []);

  // MOVED: Top-right positioning (top-20) to clear the bottom chat area
  return (
    <div className="fixed top-20 right-4 z-40 hidden lg:block pointer-events-none select-none">
        <div className="flex flex-col items-end gap-1">
            <div className="bg-black/80 border border-zinc-800 p-2 min-w-[240px] backdrop-blur-md">
                <div className="flex justify-between items-center mb-2 border-b border-zinc-900 pb-1">
                    <span className="text-[9px] text-zinc-500 font-mono tracking-widest">SYS.LOG</span>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-veritas-cyan/50 rounded-full animate-pulse"></div>
                    </div>
                </div>
                <div className="font-mono text-[9px] space-y-1">
                    {lines.map((line, i) => (
                        <div key={i} className={`truncate transition-all duration-300 ${i === 0 ? 'text-veritas-cyan' : 'text-zinc-600'}`}>
                            {line}
                        </div>
                    ))}
                    {lines.length === 0 && <span className="text-zinc-700">NO_DATA</span>}
                </div>
            </div>
            
            {/* Decorative decorative footer */}
            <div className="flex gap-0.5">
                {[...Array(8)].map((_, i) => (
                    <div key={i} className="w-2 h-1 bg-zinc-800 opacity-50"></div>
                ))}
            </div>
        </div>
    </div>
  );
};

// Helper to dispatch events easily from anywhere
export const logSystemEvent = (message: string) => {
    const event = new CustomEvent('veritas-sys-event', { detail: { message } });
    window.dispatchEvent(event);
};
