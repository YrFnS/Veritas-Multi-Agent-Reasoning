import React, { useEffect, useRef, useState } from 'react';
import { ProcessState } from '../features/reasoning/types';

interface NeuralBackgroundProps {
  processState?: ProcessState;
}

interface VisualConfig {
  r: number;
  g: number;
  b: number;
  speed: number;
}

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

const getConfig = (state: ProcessState): VisualConfig => {
  switch (state) {
    case ProcessState.ANALYZING:
      return { r: 0, g: 240, b: 255, speed: 2 };
    case ProcessState.AUDITING:
      return { r: 255, g: 42, b: 42, speed: 3 };
    case ProcessState.JUDGING:
      return { r: 255, g: 204, b: 0, speed: 1.5 };
    case ProcessState.INTERROGATION:
      return { r: 249, g: 115, b: 22, speed: 2 };
    case ProcessState.ERROR:
      return { r: 255, g: 0, b: 0, speed: 5 };
    case ProcessState.COMPLETE:
      return { r: 52, g: 211, b: 153, speed: 0.5 };
    default:
      return { r: 0, g: 240, b: 255, speed: 0.8 };
  }
};

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

export const NeuralBackground: React.FC<NeuralBackgroundProps> = ({
  processState = ProcessState.IDLE,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateConfigRef = useRef(getConfig(processState));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    stateConfigRef.current = getConfig(processState);
  }, [processState]);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrameId = 0;
    let running = !document.hidden;

    const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    const hardwareConcurrency = navigator.hardwareConcurrency || 4;
    const nodeCount =
      width < 768 ? 24 : hardwareConcurrency <= 4 ? 36 : 52;
    const connectionDistance = width < 768 ? 120 : 150;
    const connectionDistanceSquared = connectionDistance ** 2;
    const mouseDistance = 200;
    const mouseDistanceSquared = mouseDistance ** 2;
    const supportsPointerInteraction = window.matchMedia(
      '(hover: hover) and (pointer: fine)'
    ).matches;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * devicePixelRatio);
      canvas.height = Math.floor(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
      );
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    const nodes: Node[] = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
    }));

    const mouse = { x: -10_000, y: -10_000 };
    const handleMouseMove = (event: MouseEvent) => {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    };

    if (supportsPointerInteraction) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    const loop = () => {
      if (!running) return;

      const { r, g, b, speed } = stateConfigRef.current;
      context.globalAlpha = 1;
      context.fillStyle = 'rgba(3, 3, 3, 0.18)';
      context.fillRect(0, 0, width, height);

      nodes.forEach((node, index) => {
        node.x += node.vx * speed;
        node.y += node.vy * speed;

        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        context.beginPath();
        context.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
        context.fillStyle = `rgb(${r}, ${g}, ${b})`;
        context.globalAlpha = 0.5;
        context.fill();

        for (let otherIndex = index + 1; otherIndex < nodes.length; otherIndex += 1) {
          const other = nodes[otherIndex];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distanceSquared = dx * dx + dy * dy;

          if (distanceSquared >= connectionDistanceSquared) continue;

          const distance = Math.sqrt(distanceSquared);
          const opacity = 1 - distance / connectionDistance;
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * 0.15})`;
          context.lineWidth = 1;
          context.stroke();
        }

        if (!supportsPointerInteraction) return;

        const mouseDx = node.x - mouse.x;
        const mouseDy = node.y - mouse.y;
        const mouseDistanceForNode =
          mouseDx * mouseDx + mouseDy * mouseDy;

        if (mouseDistanceForNode >= mouseDistanceSquared) return;

        const distance = Math.sqrt(mouseDistanceForNode);
        const opacity = 1 - distance / mouseDistance;
        context.beginPath();
        context.moveTo(node.x, node.y);
        context.lineTo(mouse.x, mouse.y);
        context.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.2})`;
        context.lineWidth = 1;
        context.stroke();

        if (distance < 100) {
          node.x += mouseDx * 0.01;
          node.y += mouseDy * 0.01;
        }
      });

      context.globalAlpha = 1;
      animationFrameId = window.requestAnimationFrame(loop);
    };

    const handleVisibilityChange = () => {
      running = !document.hidden;
      if (running) {
        window.cancelAnimationFrame(animationFrameId);
        animationFrameId = window.requestAnimationFrame(loop);
      } else {
        window.cancelAnimationFrame(animationFrameId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (running) animationFrameId = window.requestAnimationFrame(loop);

    return () => {
      running = false;
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [reducedMotion]);

  const visualConfig = getConfig(processState);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-40 transition-colors duration-1000">
      {reducedMotion ? (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(circle at center, rgba(${visualConfig.r}, ${visualConfig.g}, ${visualConfig.b}, 0.12), transparent 58%)`,
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="block w-full h-full" />
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_90%)]" />
    </div>
  );
};
