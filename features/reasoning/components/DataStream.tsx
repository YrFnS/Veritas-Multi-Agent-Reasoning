import React, { useEffect, useRef, useState } from 'react';

interface DataStreamProps {
  color?: string;
  density?: 'low' | 'high';
}

const HEX_CHARS = "0123456789ABCDEF";

export const DataStream: React.FC<DataStreamProps> = ({ color = "text-veritas-cyan", density = 'high' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && canvasRef.current.parentElement) {
        setDimensions({
          width: canvasRef.current.parentElement.clientWidth,
          height: 60 // Fixed height for the stream strip
        });
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    const fontSize = 10;
    const columns = Math.floor(dimensions.width / fontSize);
    const drops: number[] = [];

    // Initialize drops
    for (let i = 0; i < columns; i++) {
      drops[i] = Math.random() * -100; // Start at random heights above
    }

    // Extract color hex from tailwind class roughly or default
    // Note: In a real canvas we need actual hex values. 
    // We'll use a mapping or default to cyan.
    let fillStyle = "#00f0ff";
    if (color.includes("red")) fillStyle = "#ff2a2a";
    if (color.includes("gold")) fillStyle = "#ffcc00";
    if (color.includes("emerald")) fillStyle = "#34d399";
    if (color.includes("pink")) fillStyle = "#ec4899";
    if (color.includes("orange")) fillStyle = "#f97316";

    let animationFrameId: number;

    const draw = () => {
      // Trail effect
      ctx.fillStyle = `rgba(0, 0, 0, ${density === 'high' ? 0.1 : 0.2})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = fillStyle;
      ctx.font = `${fontSize}px 'JetBrains Mono'`;

      for (let i = 0; i < drops.length; i++) {
        const text = HEX_CHARS.charAt(Math.floor(Math.random() * HEX_CHARS.length));
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions, color, density]);

  return (
    <div className="relative w-full overflow-hidden opacity-50 border-y border-zinc-900/50 my-2">
      <canvas ref={canvasRef} className="block" />
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black"></div>
    </div>
  );
};