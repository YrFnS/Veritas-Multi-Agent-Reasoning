import { useCallback, useRef, useState, useEffect } from 'react';

export const useSoundFX = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
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
    if (!audioContextRef.current) {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      audioContextRef.current = new AudioContextClass();
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.connect(audioContextRef.current.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    // Update gain based on mute state
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : 0.1;
    }
  }, [isMuted]);

  // Sync gain with mute state changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : 0.1;
    }
  }, [isMuted]);

  const playOscillator = (
    freq: number, 
    type: OscillatorType, 
    duration: number, 
    startTime: number = 0,
    vol: number = 0.1
  ) => {
    if (isMuted || !audioContextRef.current || !gainNodeRef.current) return;
    
    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioContextRef.current.currentTime + startTime);
    
    gain.gain.setValueAtTime(vol, audioContextRef.current.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + startTime + duration);
    
    osc.connect(gain);
    gain.connect(gainNodeRef.current);
    
    osc.start(audioContextRef.current.currentTime + startTime);
    osc.stop(audioContextRef.current.currentTime + startTime + duration);
  };

  const playBlip = useCallback(() => {
    initAudio();
    playOscillator(1200, 'sine', 0.05);
  }, [initAudio, isMuted]);

  const playClick = useCallback(() => {
    initAudio();
    playOscillator(800, 'square', 0.01, 0, 0.05);
  }, [initAudio, isMuted]);

  const playActivate = useCallback(() => {
    initAudio();
    playOscillator(220, 'sawtooth', 0.3, 0, 0.05);
    playOscillator(440, 'sine', 0.3, 0.1, 0.05);
    playOscillator(880, 'square', 0.4, 0.2, 0.03);
  }, [initAudio, isMuted]);

  const playDataStream = useCallback(() => {
    initAudio();
    // Random data noise
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
    playActivate,
    playDataStream,
    playVerdict,
    playError
  };
};