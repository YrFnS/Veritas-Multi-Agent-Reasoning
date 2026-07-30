import React, { useEffect, useRef, useState } from 'react';
import { useSoundFX } from '../features/reasoning/hooks/useSoundFX';

interface TerminalTextProps {
  text: string;
  speed?: number;
  className?: string;
  onComplete?: () => void;
  scramble?: boolean;
}

const CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
const MAX_ANIMATED_TEXT_LENGTH = 2_000;

const useReducedMotion = (): boolean => {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (event: MediaQueryListEvent) =>
      setReducedMotion(event.matches);

    setReducedMotion(query.matches);
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  return reducedMotion;
};

export const TerminalText: React.FC<TerminalTextProps> = ({
  text,
  speed = 10,
  className = '',
  onComplete,
  scramble = true,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const iterationRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const { playKeystroke } = useSoundFX();

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);
    iterationRef.current = 0;

    if (reducedMotion || text.length > MAX_ANIMATED_TEXT_LENGTH) {
      setDisplayedText(text);
      setIsComplete(true);
      onComplete?.();
      return;
    }

    let interval: number | undefined;

    if (scramble) {
      interval = window.setInterval(() => {
        const result = text
          .split('')
          .map((character, index) => {
            if (index < iterationRef.current) return text[index];
            if (/\s/.test(character)) return character;
            return CHARS[Math.floor(Math.random() * CHARS.length)];
          })
          .join('');

        setDisplayedText(result);
        iterationRef.current += 1 / 3;

        if (iterationRef.current >= text.length) {
          if (interval !== undefined) window.clearInterval(interval);
          setDisplayedText(text);
          setIsComplete(true);
          onComplete?.();
        }
      }, 30);
    } else {
      const effectiveSpeed = text.length > 200 ? 1 : Math.max(speed, 1);
      const step = text.length > 500 ? 5 : 1;
      let index = 0;

      interval = window.setInterval(() => {
        setDisplayedText(text.slice(0, index + step));

        if (index % 12 === 0 && !document.hidden) {
          playKeystroke();
        }

        index += step;
        if (index >= text.length) {
          if (interval !== undefined) window.clearInterval(interval);
          setDisplayedText(text);
          setIsComplete(true);
          onComplete?.();
        }
      }, effectiveSpeed);
    }

    return () => {
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, [text, speed, scramble, onComplete, playKeystroke, reducedMotion]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && <span className="animate-pulse">_</span>}
    </span>
  );
};
