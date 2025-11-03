import React, { useMemo } from 'react';
import { AudioFeatures } from '../types';

interface MinimalGradientBackgroundProps {
  features: AudioFeatures | null;
}

// Curated two-tone palettes mapped from energy/valence for a clean, genre‑flavored look
const MinimalGradientBackground: React.FC<MinimalGradientBackgroundProps> = ({ features }) => {
  const [c1, c2, angle] = useMemo(() => {
    const e = features?.energy;
    const v = features?.valence;

    // Fallback palette when features are unavailable
    if (e == null || v == null || !isFinite(e) || !isFinite(v)) {
      return ['#0f172a', '#111827', 195]; // slate-900 → slate-800
    }

    // Curated mappings
    // - Pop / EDM (high energy, high valence): amber ↔ rose
    // - Rock / Metal (high energy, low valence): blue ↔ violet
    // - Ambient / Downtempo (low energy, low valence): deep slate
    // - Chill / Indie (low energy, high valence): teal ↔ emerald
    // - Nocturne / Hip-Hop (mid energy, low valence): zinc ↔ blue
    // - Indie Vibes (default mid ranges): teal ↔ indigo
    let a = 190 + e * 45 - v * 20; // subtle orientation drift by features
    if (!isFinite(a)) a = 195;

    if (e >= 0.65 && v >= 0.6) {
      return ['#b45309', '#9d174d', Math.round(a)]; // amber-700 → rose-700
    }
    if (e >= 0.65 && v < 0.5) {
      return ['#1e3a8a', '#4c1d95', Math.round(a)]; // blue-800 → violet-900
    }
    if (e < 0.40 && v < 0.50) {
      return ['#0f172a', '#1f2937', Math.round(a)]; // slate-900 → slate-800
    }
    if (e < 0.45 && v >= 0.50) {
      return ['#0f766e', '#065f46', Math.round(a)]; // teal-700 → emerald-700
    }
    if (e >= 0.45 && e < 0.65 && v < 0.50) {
      return ['#27272a', '#1e40af', Math.round(a)]; // zinc-700 → blue-800
    }
    return ['#0e7490', '#4338ca', Math.round(a)]; // teal-700 → indigo-700
  }, [features]);

  const gradient = useMemo(() => `linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%)`, [c1, c2, angle]);

  return (
    <div
      className="absolute inset-0"
      style={{
        background: gradient,
        opacity: 0.5,
        filter: 'blur(12px) saturate(1.05) brightness(0.92) contrast(1.05)',
        transform: 'scale(1.04)',
        transition: 'background 350ms ease-out',
      }}
    />
  );
};

export default MinimalGradientBackground;