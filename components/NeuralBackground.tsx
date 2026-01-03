
import React, { useEffect, useRef } from 'react';
import { ProcessState } from '../features/reasoning/types';

interface NeuralBackgroundProps {
  processState?: ProcessState;
}

export const NeuralBackground: React.FC<NeuralBackgroundProps> = ({ processState = ProcessState.IDLE }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Map state to color configurations
  const getConfig = (state: ProcessState) => {
    switch (state) {
      case ProcessState.ANALYZING: return { r: 0, g: 240, b: 255, speed: 2 }; // Cyan
      case ProcessState.AUDITING: return { r: 255, g: 42, b: 42, speed: 3 }; // Red
      case ProcessState.JUDGING: return { r: 255, g: 204, b: 0, speed: 1.5 }; // Gold
      case ProcessState.INTERROGATION: return { r: 249, g: 115, b: 22, speed: 2 }; // Orange
      case ProcessState.ERROR: return { r: 255, g: 0, b: 0, speed: 5 }; // Bright Red / Chaos
      case ProcessState.COMPLETE: return { r: 52, g: 211, b: 153, speed: 0.5 }; // Emerald / Calm
      default: return { r: 0, g: 240, b: 255, speed: 0.8 }; // Idle
    }
  };

  // State Config Ref to hold current target values for the animation loop
  const stateConfigRef = useRef(getConfig(processState));

  // Update ref when prop changes
  useEffect(() => {
    stateConfigRef.current = getConfig(processState);
  }, [processState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', resize);
    resize();

    const NODE_COUNT = window.innerWidth < 768 ? 30 : 60;
    const CONNECTION_DISTANCE = 150;
    const MOUSE_DISTANCE = 200;

    interface Node {
      x: number;
      y: number;
      vx: number;
      vy: number;
    }

    const nodes: Node[] = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5
      });
    }

    let mouse = { x: 0, y: 0 };
    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove);

    let animationFrameId: number;

    const loop = () => {
      const { r, g, b, speed } = stateConfigRef.current;
      
      // Clear with slight trail effect
      ctx.fillStyle = 'rgba(3, 3, 3, 0.15)'; 
      ctx.fillRect(0, 0, width, height);

      // Update and Draw Nodes
      nodes.forEach((node, i) => {
        // Move (Speed factor applied)
        node.x += node.vx * speed;
        node.y += node.vy * speed;

        // Bounce
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Draw Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`; 
        ctx.globalAlpha = 0.5;
        ctx.fill();

        // Connect to other nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < CONNECTION_DISTANCE) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            const opacity = 1 - dist / CONNECTION_DISTANCE;
            ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.15})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }

        // Connect to Mouse
        const dx = node.x - mouse.x;
        const dy = node.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < MOUSE_DISTANCE) {
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(mouse.x, mouse.y);
            const opacity = 1 - dist / MOUSE_DISTANCE;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.2})`; 
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Push nodes away
            if (dist < 100) {
               node.x += dx * 0.01;
               node.y += dy * 0.01;
            }
        }
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-40 transition-colors duration-1000">
       <canvas ref={canvasRef} className="block w-full h-full" />
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_90%)]"></div>
    </div>
  );
};
