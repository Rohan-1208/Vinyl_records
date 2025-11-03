import React, { useEffect, useRef } from 'react';

// Animated, aesthetic starfield with subtle twinkle and nebula glow
const StarryBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(canvas.clientWidth * dpr);
      canvas.height = Math.floor(canvas.clientHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    const W = () => canvas.clientWidth;
    const H = () => canvas.clientHeight;

    // Build layered stars scaled by viewport area for consistent density
    const areaScale = Math.sqrt((W() * H()) / (1280 * 720));
    const layers = [
      { count: Math.floor(140 * areaScale), speed: 0.015, sizeMin: 0.6, sizeMax: 1.2, alpha: 0.55 },
      { count: Math.floor(90 * areaScale), speed: 0.03, sizeMin: 0.9, sizeMax: 2.0, alpha: 0.65 },
      { count: Math.floor(50 * areaScale), speed: 0.06, sizeMin: 1.4, sizeMax: 3.2, alpha: 0.75 },
    ];

    type Star = { x: number; y: number; r: number; phase: number; hue: number };
    const stars: Star[][] = layers.map(l => new Array(l.count).fill(0).map(() => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      r: l.sizeMin + Math.random() * (l.sizeMax - l.sizeMin),
      phase: Math.random() * Math.PI * 2,
      hue: 210 + Math.random() * 40, // cool whites with faint blue tint
    })));

    // Nebula clouds
    const clouds = new Array(3).fill(0).map(() => ({
      x: Math.random() * W(),
      y: Math.random() * H(),
      radius: Math.max(W(), H()) * (0.25 + Math.random() * 0.15),
      hue: 200 + Math.random() * 60,
      alpha: 0.04 + Math.random() * 0.04,
    }));

    const drawBackground = () => {
      const w = W();
      const h = H();
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, '#0b1120'); // deep midnight blue
      sky.addColorStop(1, '#01060f');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // Soft radial haze for depth
      const cx = w * 0.7, cy = h * 0.35;
      const haze = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.hypot(w, h) * 0.6);
      haze.addColorStop(0, 'rgba(26, 37, 68, 0.18)');
      haze.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, 0, w, h);

      // Nebula glows
      ctx.globalCompositeOperation = 'screen';
      for (const cloud of clouds) {
        const g = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius);
        g.addColorStop(0, `hsla(${cloud.hue}, 60%, 60%, ${cloud.alpha})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    let lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      drawBackground();

      // Render stars by layer with subtle drift and twinkle
      for (let li = 0; li < layers.length; li++) {
        const layer = layers[li];
        const group = stars[li];
        for (let i = 0; i < group.length; i++) {
          const s = group[i];
          // Parallax drift to the right
          s.x += layer.speed * 25 * dt;
          if (s.x > W() + 10) s.x = -10;

          // Twinkle around base alpha
          const tw = 0.6 + 0.4 * Math.sin(now * 0.002 + s.phase);
          const a = layer.alpha * tw;

          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${s.hue}, 30%, ${70 + li * 5}%, ${a})`;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    loop();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
};

export default StarryBackground;