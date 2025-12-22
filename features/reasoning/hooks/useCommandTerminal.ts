import React, { useState, useCallback } from 'react';

export const useCommandTerminal = (
  isProcessing: boolean,
  onExecute: (prompt: string) => void
) => {
  const [userPrompt, setUserPrompt] = useState('');
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const handleExecute = useCallback(() => {
    if (userPrompt.trim()) {
      onExecute(userPrompt);
      setCmdHistory(prev => [userPrompt, ...prev]);
      setHistoryIndex(-1);
      setUserPrompt('');
    }
  }, [userPrompt, onExecute]);

  const handleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isProcessing) handleExecute();
    }
    // Command History Navigation
    if (e.ctrlKey) {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const nextIndex = historyIndex + 1;
        if (nextIndex < cmdHistory.length) {
          setHistoryIndex(nextIndex);
          setUserPrompt(cmdHistory[nextIndex]);
        }
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const prevIndex = historyIndex - 1;
        if (prevIndex >= 0) {
          setHistoryIndex(prevIndex);
          setUserPrompt(cmdHistory[prevIndex]);
        } else if (prevIndex === -1) {
          setHistoryIndex(-1);
          setUserPrompt('');
        }
      }
    }
  }, [historyIndex, cmdHistory, isProcessing, handleExecute]);

  return {
    userPrompt,
    setUserPrompt,
    handleInputKeyDown,
    handleExecute
  };
};