import React, { useEffect, useMemo, useState } from 'react';
import { Song, VinylTheme } from '../types';

interface RecordLabelProps {
  currentTrack: Song | null;
}

const RecordLabel: React.FC<RecordLabelProps> = ({ currentTrack }) => {
  if (!currentTrack) {
    return (
      <div className="relative w-full h-full rounded-full bg-black flex flex-col items-center justify-center">
         <div className="absolute w-4 h-4 bg-neutral-800 rounded-full border-2 border-neutral-600 ring-1 ring-black/50">
           <div className="absolute inset-0.5 rounded-full bg-black"></div>
         </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-full bg-black flex flex-col items-center justify-center text-center text-white p-2">
      <p className="font-bold text-xs uppercase tracking-wider leading-tight truncate w-full">{currentTrack.title}</p>
      <div className="w-1/3 h-px bg-neutral-500 my-1"></div>
      <p className="text-[10px] opacity-80 leading-tight truncate w-full">{currentTrack.artist}</p>
      
      {/* Spindle hole */}
      <div className="absolute w-4 h-4 bg-neutral-800 rounded-full border-2 border-neutral-600 ring-1 ring-black/50">
        <div className="absolute inset-0.5 rounded-full bg-black"></div>
      </div>
    </div>
  );
};

interface VinylPlayerProps {
  currentTrack: Song | null;
  isPlaying: boolean;
  progressRatio?: number; // 0..1 from Spotify or audio element
  theme?: VinylTheme; // disc aesthetic
  colorOverride?: string; // custom RGB/HEX overrides theme when provided
}
const VinylPlayer: React.FC<VinylPlayerProps> = ({ currentTrack, isPlaying, progressRatio = 0, theme = 'clear', colorOverride }) => {
  const [tonearmDeg, setTonearmDeg] = useState<number>(25);

  const styles = useMemo(() => {
    const commonHighlight = 'radial-gradient(ellipse at 70% 30%, transparent 55%, rgba(255,255,255,0.06) 56%, transparent 64%)';

    // If a custom color override is provided, derive disc palette from it
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const toRgba = (r: number, g: number, b: number, a = 1) => `rgba(${clamp(r)}, ${clamp(g)}, ${clamp(b)}, ${a})`;
    const parseColor = (c?: string): [number, number, number] | null => {
      if (!c) return null;
      const s = c.trim().toLowerCase();
      if (s.startsWith('#')) {
        const hex = s.slice(1);
        if (hex.length === 3) {
          return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
        }
        if (hex.length >= 6) {
          return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
        }
      }
      const m = s.match(/rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/);
      if (m) return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
      return null;
    };
    const adjust = ([r, g, b]: [number, number, number], delta: number): [number, number, number] => [clamp(r + delta), clamp(g + delta), clamp(b + delta)];
    const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const rgb = parseColor(colorOverride);
    if (rgb) {
      const center = adjust(rgb, 12);
      const mid = rgb;
      const edge = adjust(rgb, -28);
      const lum = luminance(rgb);
      const groove = lum > 155 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.08)';
      const labelBorder = `${toRgba(...adjust(rgb, 10), 0.6)}`;
      return {
        base: `radial-gradient(circle, ${toRgba(...center, 0.9)} 14%, ${toRgba(...mid, 0.85)} 55%, ${toRgba(...edge, 0.85)} 85%)`,
        highlight: commonHighlight,
        groove,
        labelBorder
      };
    }

    switch (theme) {
      case 'classic':
        return {
          base: 'radial-gradient(circle, #0a0a0a 12%, #000000 55%, #000000 80%)',
          highlight: commonHighlight,
          groove: 'rgba(255,255,255,0.06)',
          labelBorder: 'rgba(75,85,99,0.6)' // gray-600
        };
      case 'sunflower':
        return {
          base: 'radial-gradient(circle, rgba(245,158,11,0.85) 12%, rgba(180,83,9,0.95) 55%, rgba(120,53,15,0.95) 85%)',
          highlight: commonHighlight,
          groove: 'rgba(0,0,0,0.25)',
          labelBorder: 'rgba(234,179,8,0.6)'
        };
      case 'warm':
        return {
          base: 'radial-gradient(circle, rgba(254,243,199,0.85) 12%, rgba(251,146,60,0.90) 55%, rgba(154,52,18,0.90) 85%)',
          highlight: commonHighlight,
          groove: 'rgba(0,0,0,0.22)',
          labelBorder: 'rgba(251,146,60,0.6)'
        };
      case 'mint':
        return {
          base: 'radial-gradient(circle, rgba(163,230,208,0.85) 15%, rgba(20,184,166,0.90) 55%, rgba(6,95,70,0.90) 85%)',
          highlight: commonHighlight,
          groove: 'rgba(0,0,0,0.18)',
          labelBorder: 'rgba(20,184,166,0.6)'
        };
      case 'clear':
      default:
        return {
          base: 'radial-gradient(circle, rgba(255,223,186,0.18) 10%, rgba(255,140,0,0.28) 40%, rgba(200,50,50,0.35) 70%, transparent 70%)',
          highlight: commonHighlight,
          groove: 'rgba(255,255,255,0.08)',
          labelBorder: 'rgba(82,82,91,0.5)'
        };
    }
  }, [theme, colorOverride]);

  useEffect(() => {
    // Interpolate tonearm angle from rest (25deg) to play (-5deg)
    if (currentTrack && isPlaying) {
      const clamped = Math.max(0, Math.min(1, progressRatio));
      const deg = 25 - 30 * clamped;
      setTonearmDeg(deg);
    } else {
      setTonearmDeg(25);
    }
  }, [currentTrack, isPlaying, progressRatio]);

  return (
    <div className="relative w-[500px] h-[500px] flex items-center justify-center">
        {/* Vinyl Disc */}
        <div className={`
            relative w-full h-full rounded-full flex items-center justify-center transition-transform duration-300
            ${isPlaying ? 'animate-spin [animation-duration:3s]' : ''}
        `}>
            {/* Disc base color/gradient */}
            <div 
                className="absolute w-full h-full rounded-full"
                style={{ background: styles.base }}
            ></div>
            {/* Glossy highlight */}
            <div
                className="absolute w-full h-full rounded-full"
                style={{ background: styles.highlight }}
            ></div>

            {/* Grooves */}
            {[...Array(15)].map((_, i) => (
                <div 
                    key={i}
                    className="absolute rounded-full border-[1px]"
                    style={{
                        width: `${98 - i * 4}%`,
                        height: `${98 - i * 4}%`,
                        borderColor: styles.groove
                    }}
                ></div>
            ))}
            
            {/* Record Label */}
            <div className="relative w-[33.33%] h-[33.33%] rounded-full overflow-hidden shadow-lg border-2" style={{ borderColor: styles.labelBorder }}>
              <RecordLabel currentTrack={currentTrack} />
            </div>
        </div>
        
        {/* Tonearm */}
        <div 
            className={`
                absolute top-1/2 right-0 w-4 h-4 z-20
                translate-y-[-240px] translate-x-[20px] 
                origin-bottom-right transition-transform duration-500 ease-in-out
            `}
            style={{ transform: `rotate(${tonearmDeg}deg)` }}
        >
            {/* Pivot base */}
            <div className="absolute bottom-[-10px] right-[-10px] w-10 h-10 bg-gradient-to-br from-neutral-500 to-neutral-700 rounded-full shadow-lg border-2 border-neutral-800">
                <div className="absolute top-1/2 left-1/2 w-2 h-2 -translate-x-1/2 -translate-y-1/2 bg-neutral-300 rounded-full ring-1 ring-neutral-900"></div>
            </div>
            {/* Arm */}
            <div className="absolute bottom-[-2px] right-[-2px] w-[280px] h-[6px] bg-gradient-to-l from-neutral-300 to-neutral-200 rounded-full shadow-md transform rotate-2">
                {/* Cartridge */}
                <div className="absolute left-[-6px] bottom-[-2px] w-8 h-6 bg-neutral-400 rounded-md shadow-lg"></div>
            </div>
        </div>
    </div>
  );
};

export default VinylPlayer;