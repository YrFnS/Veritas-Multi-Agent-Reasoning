import React, { useEffect, useState } from 'react';

interface BootSequenceProps {
  onComplete: () => void;
}

export const BootSequence: React.FC<BootSequenceProps> = ({ onComplete }) => {
  const [lines, setLines] = useState<string[]>([]);
  
  const SEQUENCE = [
    "INITIALIZING CORE KERNEL...",
    "LOADING NEURAL WEIGHTS...",
    "CONNECTING TO AGENT MATRIX [ANALYST, SKEPTIC, JUDGE]...",
    "ESTABLISHING SECURE HANDSHAKE...",
    "CALIBRATING TRUTH SENSORS...",
    "VERITAS PROTOCOL v1.0 ONLINE"
  ];

  useEffect(() => {
    let delay = 0;
    SEQUENCE.forEach((line, index) => {
      delay += Math.random() * 300 + 200;
      setTimeout(() => {
        setLines(prev => [...prev, line]);
        if (index === SEQUENCE.length - 1) {
          setTimeout(onComplete, 800);
        }
      }, delay);
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center font-mono p-10">
      <div className="w-full max-w-2xl">
        {lines.map((line, i) => (
          <div key={i} className="text-veritas-cyan text-sm md:text-base mb-2 animate-pulse-fast">
            <span className="opacity-50 mr-2">{`>`}</span>
            {line}
          </div>
        ))}
        <div className="h-4 w-3 bg-veritas-cyan animate-pulse mt-2"></div>
      </div>
      
      {/* Background Scanline */}
      <div className="absolute inset-0 bg-scanline-overlay pointer-events-none opacity-20"></div>
    </div>
  );
};