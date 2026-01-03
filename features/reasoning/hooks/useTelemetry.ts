
import { useState, useEffect, useRef } from 'react';
import { ProcessState } from '../types';

interface TelemetryData {
  cpu: number;
  memory: number;
  network: number;
  entropy: number;
  fps: number;
}

export const useTelemetry = (processState: ProcessState) => {
  const [metrics, setMetrics] = useState<TelemetryData>({
    cpu: 12,
    memory: 24,
    network: 150,
    entropy: 0.05,
    fps: 60
  });

  const requestRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Configuration for target values based on state
  const getTargets = (state: ProcessState) => {
    switch (state) {
      case ProcessState.ANALYZING: 
        return { cpu: 98, mem: 85, net: 950, ent: 0.9 };
      case ProcessState.AUDITING: 
        return { cpu: 75, mem: 60, net: 400, ent: 0.6 };
      case ProcessState.JUDGING: 
        return { cpu: 40, mem: 90, net: 120, ent: 0.1 }; // High memory (synthesis), low entropy (order)
      case ProcessState.ERROR: 
        return { cpu: 10, mem: 10, net: 0, ent: 1.0 }; // Chaos
      case ProcessState.IDLE: 
      default: 
        return { cpu: 5, mem: 15, net: 2, ent: 0.01 };
    }
  };

  useEffect(() => {
    const update = (time: number) => {
      if (lastTimeRef.current !== undefined) {
        const delta = time - lastTimeRef.current;
        
        // Only update roughly every 100ms for readable numbers, but animate smoothly
        if (delta > 100) {
            const target = getTargets(processState);
            
            setMetrics(prev => ({
                // Lerp towards target with random jitter
                cpu: Math.min(100, Math.max(0, prev.cpu + (target.cpu - prev.cpu) * 0.1 + (Math.random() - 0.5) * 5)),
                memory: Math.min(100, Math.max(0, prev.memory + (target.mem - prev.memory) * 0.05 + (Math.random() - 0.5) * 2)),
                network: Math.max(0, prev.network + (target.net - prev.network) * 0.2 + (Math.random() - 0.5) * 50),
                entropy: Math.max(0, Math.min(1, prev.entropy + (target.ent - prev.entropy) * 0.1)),
                fps: 58 + Math.random() * 4
            }));
            lastTimeRef.current = time;
        }
      }
      requestRef.current = requestAnimationFrame(update);
    };

    requestRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(requestRef.current);
  }, [processState]);

  return metrics;
};
