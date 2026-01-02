import { useCallback, useState, useEffect } from 'react';

// GLOBAL SINGLETONS to prevent AudioContext stacking
let globalAudioContext: AudioContext | null = null;
let globalGainNode: GainNode | null = null;

export const useSoundFX = () => {
  // Persist mute state
  const [isMuted, setIsMuted] = useState(() => {
    try {
      return localStorage.getItem('veritas_sound_muted') === 'true';
    } catch {
      return false;
    }
  });

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newState = !prev;
      localStorage.setItem('veritas_sound_muted', String(newState));
      return newState;
    });
  }, []);

  const initAudio = useCallback(() => {
    if (!globalAudioContext) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      globalAudioContext = new AudioContextClass();
      globalGainNode = globalAudioContext.createGain();
      globalGainNode.connect(globalAudioContext.destination);
    }
    if (globalAudioContext.state === 'suspended') {
      globalAudioContext.resume();
    }
    // Update gain based on mute state
    if (globalGainNode) {
      globalGainNode.gain.value = isMuted ? 0 : 0.1;
    }
  }, [isMuted]);

  // Sync gain with mute state changes
  useEffect(() => {
    if (globalGainNode) {
      globalGainNode.gain.value = isMuted ? 0 : 0.1;
    }
  }, [isMuted]);

  const playOscillator = (
    freq: number, 
    type: OscillatorType, 
    duration: number, 
    startTime: number = 0,
    vol: number = 0.1
  ) => {
    if (isMuted || !globalAudioContext || !globalGainNode) return;
    
    const osc = globalAudioContext.createOscillator();
    const gain = globalAudioContext.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, globalAudioContext.currentTime + startTime);
    
    gain.gain.setValueAtTime(vol, globalAudioContext.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, globalAudioContext.currentTime + startTime + duration);
    
    osc.connect(gain);
    gain.connect(globalGainNode);
    
    osc.start(globalAudioContext.currentTime + startTime);
    osc.stop(globalAudioContext.currentTime + startTime + duration);
  };

  const playBlip = useCallback(() => {
    initAudio();
    playOscillator(1200, 'sine', 0.05);
  }, [initAudio, isMuted]);

  const playClick = useCallback(() => {
    initAudio();
    playOscillator(800, 'square', 0.01, 0, 0.05);
  }, [initAudio, isMuted]);

  const playKeystroke = useCallback(() => {
    // High-tech mechanical click
    if (isMuted || !globalAudioContext || !globalGainNode) return;
    // Don't init here to avoid lag on every char, assume initAudio called by parent
    
    // Simple noise burst simulation using high freq square
    const osc = globalAudioContext.createOscillator();
    const gain = globalAudioContext.createGain();
    
    // Randomize pitch slightly for organic feel
    osc.frequency.value = 800 + Math.random() * 200; 
    osc.type = 'square';
    
    // Very short duration
    gain.gain.setValueAtTime(0.02, globalAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, globalAudioContext.currentTime + 0.03);
    
    osc.connect(gain);
    gain.connect(globalGainNode);
    
    osc.start();
    osc.stop(globalAudioContext.currentTime + 0.03);
  }, [isMuted]);

  const playActivate = useCallback(() => {
    initAudio();
    playOscillator(220, 'sawtooth', 0.3, 0, 0.05);
    playOscillator(440, 'sine', 0.3, 0.1, 0.05);
    playOscillator(880, 'square', 0.4, 0.2, 0.03);
  }, [initAudio, isMuted]);

  const playDataStream = useCallback(() => {
    initAudio();
    for(let i=0; i<5; i++) {
        playOscillator(1000 + Math.random() * 2000, 'square', 0.02, i * 0.03, 0.02);
    }
  }, [initAudio, isMuted]);

  const playVerdict = useCallback(() => {
    initAudio();
    const root = 261.63; // C4
    playOscillator(root, 'triangle', 1.5, 0, 0.1);
    playOscillator(root * 1.25, 'triangle', 1.5, 0.1, 0.1); // E4
    playOscillator(root * 1.5, 'triangle', 1.5, 0.2, 0.1); // G4
    playOscillator(root * 2, 'sine', 2.0, 0.3, 0.05); // C5
  }, [initAudio, isMuted]);

  const playError = useCallback(() => {
    initAudio();
    playOscillator(150, 'sawtooth', 0.4, 0, 0.1);
    playOscillator(140, 'sawtooth', 0.4, 0, 0.1);
  }, [initAudio, isMuted]);

  return {
    isMuted,
    toggleMute,
    playBlip,
    playClick,
    playKeystroke,
    playActivate,
    playDataStream,
    playVerdict,
    playError
  };
};