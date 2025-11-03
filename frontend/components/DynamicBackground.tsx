import React, { useEffect, useRef } from 'react';
import { AudioFeatures } from '../types';

interface DynamicBackgroundProps {
  features?: AudioFeatures | null;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ features }) => {
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

    const tempo = clamp(features?.tempo ?? 120, 60, 180);
    const energy = clamp(features?.energy ?? 0.5, 0, 1);
    const valence = clamp(features?.valence ?? 0.5, 0, 1);
    const danceability = clamp(features?.danceability ?? 0.5, 0, 1);

    // Map valence to hue (cool blues -> warm ambers)
    const hue = Math.floor(220 - valence * 180);
    const baseSpeed = 0.4 + energy * 1.2 + (tempo - 60) / 240; // 0.4 .. ~2.1
    const count = Math.floor(60 + danceability * 120); // 60 .. 180 particles

    const particles = new Array(count).fill(0).map(() => ({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      r: Math.random() * 1.8 + 0.5,
      vx: (Math.random() - 0.5) * baseSpeed,
      vy: (Math.random() - 0.5) * baseSpeed,
      a: Math.random() * 0.6 + 0.2,
    }));

    // Soft bokeh glows for warmth and depth
    const glowCount = Math.floor(8 + energy * 12);
    const glows = new Array(glowCount).fill(0).map(() => ({
      x: Math.random() * canvas.clientWidth,
      y: Math.random() * canvas.clientHeight,
      r: Math.random() * (80 + energy * 120) + 60,
      hue: (hue + (Math.random() * 40 - 20) + 360) % 360,
      alpha: 0.05 + Math.random() * 0.08,
      drift: (Math.random() - 0.5) * (0.15 + energy * 0.3),
    }));

    const draw = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Layered background: vertical gradient plus faint diagonal tint
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `hsl(${hue}, 55%, ${10 + energy * 12}%)`);
      g.addColorStop(1, `hsl(${(hue + 40) % 360}, 55%, ${12 + energy * 14}%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      // Diagonal sheen
      const dg = ctx.createLinearGradient(0, 0, w, h);
      dg.addColorStop(0, 'rgba(255,255,255,0.02)');
      dg.addColorStop(1, 'rgba(0,0,0,0.02)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, w, h);

      // Bokeh glows
      ctx.globalCompositeOperation = 'screen';
      for (const glow of glows) {
        glow.x += glow.drift;
        glow.y += glow.drift * 0.4;
        if (glow.x < -glow.r) glow.x = w + glow.r;
        if (glow.x > w + glow.r) glow.x = -glow.r;
        if (glow.y < -glow.r) glow.y = h + glow.r;
        if (glow.y > h + glow.r) glow.y = -glow.r;
        const rg = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
        rg.addColorStop(0, `hsla(${glow.hue}, 70%, 60%, ${glow.alpha})`);
        rg.addColorStop(0.6, `hsla(${glow.hue}, 70%, 60%, ${glow.alpha * 0.25})`);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(glow.x, glow.y, glow.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';

      // Subtle waves using sine modulation by tempo
      const waveCount = 3;
      for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        const amp = 10 + energy * 25 + i * 3;
        const yBase = (h / (waveCount + 1)) * (i + 1);
        for (let x = 0; x <= w; x += 8) {
          const y = yBase + Math.sin((x + Date.now() * 0.0015 * baseSpeed) / (18 - energy * 8)) * amp;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `hsla(${(hue + i * 15) % 360}, 70%, ${40 - i * 6}%, 0.08)`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Particles
      ctx.globalCompositeOperation = 'lighter';
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        if (p.y < -10) p.y = h + 10;
        if (p.y > h + 10) p.y = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${p.a})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    };

    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
    };
  }, [features]);

  return <canvas ref={canvasRef} className="absolute inset-0" />;
};

export default DynamicBackground;