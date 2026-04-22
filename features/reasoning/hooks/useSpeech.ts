import { useState, useCallback, useRef } from 'react';
import { GeminiCore } from '../services/geminiCore';

export const useSpeech = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const initAudio = () => {
    if (!audioContextRef.current) {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        audioContextRef.current = new AudioContextClass({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }
  };

  const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  };

  const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext
  ): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const channelCount = 1;
    const sampleRate = 24000;
    const frameCount = dataInt16.length;
    const buffer = ctx.createBuffer(channelCount, frameCount, sampleRate);
    
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
    }
    return buffer;
  };

  const speak = useCallback(async (text: string) => {
    const savedKeys = JSON.parse(localStorage.getItem('veritas_api_keys') || '{}');
    const apiKey = savedKeys.gemini || process.env.GEMINI_API_KEY;
    if (!apiKey) return;

    if (sourceRef.current) {
        sourceRef.current.stop();
        setIsPlaying(false);
    }

    setIsPlaying(true);
    initAudio();

    try {
        const core = new GeminiCore(apiKey);
        const base64Audio = await core.generateSpeech(text);
        
        if (!audioContextRef.current) return;

        const rawBytes = decode(base64Audio);
        const audioBuffer = await decodeAudioData(rawBytes, audioContextRef.current);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(false);
        
        sourceRef.current = source;
        source.start();

    } catch (e) {
        console.error("Speech Error:", e);
        setIsPlaying(false);
    }
  }, []);

  const stop = useCallback(() => {
    if (sourceRef.current) {
        sourceRef.current.stop();
        setIsPlaying(false);
    }
  }, []);

  return { speak, stop, isPlaying };
};