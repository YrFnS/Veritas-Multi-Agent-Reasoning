import React, { useState, useEffect, useRef } from 'react';
import { useSoundFX } from '../features/reasoning/hooks/useSoundFX';

interface TerminalTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  scramble?: boolean;
}

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";

export const TerminalText: React.FC<TerminalTextProps> = ({ 
  text, 
  speed = 10, 
  className = "", 
  onComplete,
  scramble = true 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const iterationRef = useRef(0);
  const { playKeystroke } = useSoundFX();

  useEffect(() => {
    // Reset state when text changes
    setDisplayedText('');
    setIsComplete(false);
    iterationRef.current = 0;
    
    let interval: any;

    if (scramble) {
        // Scramble Effect for headers or short text
        interval = setInterval(() => {
            setDisplayedText(prev => {
                const result = text.split("").map((letter, index) => {
                    if (index < iterationRef.current) {
                        return text[index];
                    }
                    return CHARS[Math.floor(Math.random() * CHARS.length)];
                }).join("");
                
                if (iterationRef.current >= text.length) {
                    clearInterval(interval);
                    setIsComplete(true);
                    if (onComplete) onComplete();
                }
                
                iterationRef.current += 1/3; 
                return result;
            });
        }, 30);
    } else {
        // Standard Typewriter optimized for long text
        const effectiveSpeed = text.length > 200 ? 1 : speed;
        const step = text.length > 500 ? 5 : 1; 

        let i = 0;
        interval = setInterval(() => {
            setDisplayedText(text.slice(0, i + step));
            
            // Audio Feedback - trigger only occasionally to avoid spamming
            if (i % 3 === 0) playKeystroke();
            
            i += step;
            if (i >= text.length) {
                setDisplayedText(text); 
                clearInterval(interval);
                setIsComplete(true);
                if (onComplete) onComplete();
            }
        }, effectiveSpeed);
    }

    return () => clearInterval(interval);
  }, [text, speed, scramble, onComplete, playKeystroke]);

  return <span className={className}>{displayedText}{!isComplete && <span className="animate-pulse">_</span>}</span>;
};