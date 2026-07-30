import { useCallback, useRef, useState } from 'react';
import { GeminiCore } from '../services/geminiCore';
import { readProviderKeys } from '../services/providerKeys.js';

export const useSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume();
    }
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let index = 0; index < binaryString.length; index += 1) {
      bytes[index] = binaryString.charCodeAt(index);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    context: AudioContext
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const sampleRate = 24000;
    const buffer = context.createBuffer(1, dataInt16.length, sampleRate);
    const channelData = buffer.getChannelData(0);

    for (let index = 0; index < dataInt16.length; index += 1) {
      channelData[index] = dataInt16[index] / 32768;
    }
    return buffer;
  };

  const stop = useCallback(() => {
    if (!sourceRef.current) return;
    try {
      sourceRef.current.stop();
    } catch {
      // The source may already have ended.
    }
    sourceRef.current = null;
    setIsPlaying(false);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      const apiKey = readProviderKeys().gemini;
      if (!apiKey) {
        console.warn('Gemini API key is required for text-to-speech.');
        return;
      }

      stop();
      setIsPlaying(true);
      initAudio();

      try {
        const core = new GeminiCore(apiKey);
        const base64Audio = await core.generateSpeech(text);
        if (!audioContextRef.current) return;

        const rawBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(
          rawBytes,
          audioContextRef.current
        );

        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
          sourceRef.current = null;
          setIsPlaying(false);
        };

        sourceRef.current = source;
        source.start();
      } catch (error) {
        console.error('Speech error:', error);
        sourceRef.current = null;
        setIsPlaying(false);
      }
    },
    [stop]
  );

  return { speak, stop, isPlaying };
};
