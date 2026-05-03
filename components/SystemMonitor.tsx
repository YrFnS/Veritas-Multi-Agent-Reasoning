
import React, { useState, useEffect, useRef } from 'react';

export const SystemMonitor: React.FC = () => {
  const [lines, setLines] = useState<string[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartInfo = useRef({ startX: 0, startY: 0, initialPosX: 0, initialPosY: 0 });

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

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStartInfo.current.startX;
      const dy = e.clientY - dragStartInfo.current.startY;
      
      setPosition({
        x: dragStartInfo.current.initialPosX + dx,
        y: dragStartInfo.current.initialPosY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartInfo.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: position.x,
      initialPosY: position.y
    };
  };

  // Top-right positioning (top-20) configurable with translate
  return (
    <div 
      className="absolute top-20 right-4 z-50 hidden lg:block select-none"
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
    >
        <div className="flex flex-col items-end gap-1">
            <div className={`bg-black/80 border ${isMinimized ? 'border-zinc-800/50' : 'border-zinc-800'} p-2 min-w-[240px] backdrop-blur-md transition-shadow shadow-[0_0_15px_rgba(0,0,0,0.5)]`}>
                <div 
                    className="flex justify-between items-center cursor-move group mb-2 border-b border-zinc-900 pb-1"
                    onMouseDown={handleMouseDown}
                >
                    <span className="text-[9px] text-zinc-500 font-mono tracking-widest group-hover:text-veritas-cyan transition-colors">SYS.LOG</span>
                    <div className="flex gap-2 items-center">
                        <div className={`w-1.5 h-1.5 rounded-full ${isDragging ? 'bg-veritas-cyan' : 'bg-veritas-cyan/50 animate-pulse'}`}></div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="text-zinc-500 text-[10px] hover:text-white pb-0.5 cursor-pointer px-1 -mr-1"
                        >
                            {isMinimized ? '+' : '-'}
                        </button>
                    </div>
                </div>
                
                {!isMinimized && (
                    <>
                        <div className="font-mono text-[9px] space-y-1">
                            {lines.map((line, i) => (
                                <div key={i} className={`truncate transition-all duration-300 ${i === 0 ? 'text-veritas-cyan' : 'text-zinc-600'}`}>
                                    {line}
                                </div>
                            ))}
                            {lines.length === 0 && <span className="text-zinc-700">NO_DATA</span>}
                        </div>
                    </>
                )}
            </div>
            
            {/* Decorative footer */}
            {!isMinimized && (
                <div className="flex gap-0.5">
                    {[...Array(8)].map((_, i) => (
                        <div key={i} className="w-2 h-1 bg-zinc-800 opacity-50"></div>
                    ))}
                </div>
            )}
        </div>
    </div>
  );
};

// Helper to dispatch events easily from anywhere
export const logSystemEvent = (message: string) => {
    const event = new CustomEvent('veritas-sys-event', { detail: { message } });
    window.dispatchEvent(event);
};
