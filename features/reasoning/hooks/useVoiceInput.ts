import { useCallback, useEffect, useRef, useState } from 'react';
import { readFinalSpeechTranscript } from '../services/voiceTranscript.js';

export const useVoiceInput = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return undefined;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: unknown) => {
      const finalTranscript = readFinalSpeechTranscript(
        event as Parameters<typeof readFinalSpeechTranscript>[0]
      );
      if (finalTranscript) setTranscript(finalTranscript);
    };

    recognition.onerror = (event: { error?: unknown }) => {
      const message =
        typeof event.error === 'string'
          ? event.error
          : 'Speech recognition failed.';
      console.error('Speech recognition error', message);
      setError(message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Recognition may not have started.
      }
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setError('Speech API not supported');
      return;
    }

    try {
      setTranscript('');
      setError(null);
      recognition.start();
    } catch (startError) {
      console.error('Failed to start recognition', startError);
      setError('Unable to start speech recognition.');
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    try {
      recognition.stop();
    } catch (stopError) {
      console.error('Failed to stop recognition', stopError);
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  };
};
