import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Vibrant } from 'node-vibrant/browser';

interface AmbientGradientProps {
  imageUrl: string | null;
}

// A soft, animated gradient derived from the album art's dominant colors
// Slowly rotates and drifts to add life; keeps opacity subtle.
const AmbientGradient: React.FC<AmbientGradientProps> = ({ imageUrl }) => {
  const [colors, setColors] = useState<string[]>(['#0b1120', '#1f2937', '#111827']);
  const [angle, setAngle] = useState<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!imageUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const palette = await Vibrant.from(imageUrl).maxColorCount(16).getPalette();
        if (!palette || cancelled) return;
        const picks: string[] = [];
        const order = ['Vibrant', 'Muted', 'DarkVibrant', 'LightVibrant', 'DarkMuted', 'LightMuted'] as const;
        for (const key of order) {
          const sw = palette[key];
          if (sw) picks.push(sw.getHex());
          if (picks.length >= 4) break;
        }
        if (picks.length < 3) {
          // Fallback: ensure at least 3 colors
          while (picks.length < 3) picks.push('#111827');
        }
        setColors(picks);
      } catch (e) {
        // ignore extraction errors
      }
    })();
    return () => { cancelled = true; };
  }, [imageUrl]);

  useEffect(() => {
    const tick = () => {
      setAngle((a) => (a + 0.02) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  const gradient = useMemo(() => {
    // Build a multi-stop gradient using extracted colors
    const stops = colors.slice(0, 4);
    const g = `conic-gradient(from ${angle}deg at 50% 50%, ${stops[0]} 0%, ${stops[1]} 25%, ${stops[2]} 55%, ${stops[3] || stops[2]} 85%, ${stops[0]} 100%)`;
    return g;
  }, [colors, angle]);

  return (
    <div
      className="absolute inset-0"
      style={{
        background: gradient,
        opacity: 0.35,
        filter: 'blur(35px) saturate(1.05)',
        transform: 'scale(1.05)',
        transition: 'background 600ms linear',
      }}
    />
  );
};

export default AmbientGradient;