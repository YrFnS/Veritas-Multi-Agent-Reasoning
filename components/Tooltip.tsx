import React, { useState } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  delay?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top', 
  className = '',
  delay = 200 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timeoutId, setTimeoutId] = useState<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    const id = setTimeout(() => setIsVisible(true), delay);
    setTimeoutId(id);
  };

  const hide = () => {
    if (timeoutId) clearTimeout(timeoutId);
    setIsVisible(false);
  };

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2'
  };

  return (
    <div 
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && (
        <div className={`absolute z-[60] w-max max-w-[200px] md:max-w-xs bg-zinc-950 border border-zinc-700 shadow-[0_4px_20px_rgba(0,0,0,0.8)] pointer-events-none backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200 ${positionStyles[position]}`}>
          <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
          {/* Corner accents */}
          <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-zinc-500"></div>
          <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-zinc-500"></div>
          
          <div className="relative z-10 px-3 py-2 text-[10px] text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};