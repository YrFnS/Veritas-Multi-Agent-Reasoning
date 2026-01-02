import React, { useEffect, useRef } from 'react';

export const NeuralBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Node configuration
    const NODE_COUNT = 60;
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

    const draw = () => {
      // Clear with slight trail effect
      ctx.fillStyle = 'rgba(3, 3, 3, 0.1)'; 
      ctx.fillRect(0, 0, width, height);

      // Update and Draw Nodes
      nodes.forEach((node, i) => {
        // Move
        node.x += node.vx;
        node.y += node.vy;

        // Bounce
        if (node.x < 0 || node.x > width) node.vx *= -1;
        if (node.y < 0 || node.y > height) node.vy *= -1;

        // Draw Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#00f0ff'; // Veritas Cyan
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
            ctx.strokeStyle = `rgba(0, 240, 255, ${opacity * 0.15})`;
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
            ctx.strokeStyle = `rgba(255, 204, 0, ${opacity * 0.2})`; // Gold interaction
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Push nodes away slightly
            if (dist < 100) {
               node.x += dx * 0.01;
               node.y += dy * 0.01;
            }
        }
      });

      requestAnimationFrame(draw);
    };

    const animId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
       <canvas ref={canvasRef} className="block w-full h-full" />
       {/* Vignette Overlay */}
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,#000000_90%)]"></div>
    </div>
  );
};