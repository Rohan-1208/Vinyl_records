import React, { useEffect, useMemo, useState } from 'react';
import { VinylTheme } from '../types';

interface VinylColorSelectorProps {
  theme: VinylTheme;
  onChange: (theme: VinylTheme) => void;
}

const PRESETS: { key: VinylTheme; name: string; swatch: string }[] = [
  { key: 'classic',   name: 'Classic Black',   swatch: 'linear-gradient(135deg,#000,#0b0b0b)' },
  { key: 'sunflower', name: 'Sunflower Gold',  swatch: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  { key: 'warm',      name: 'Warm Cream',      swatch: 'linear-gradient(135deg,#fef3c7,#fb923c)' },
  { key: 'mint',      name: 'Mint Teal',       swatch: 'linear-gradient(135deg,#a7f3d0,#14b8a6)' },
  { key: 'clear',     name: 'Clear Acrylic',   swatch: 'linear-gradient(135deg,rgba(255,255,255,0.6),rgba(255,255,255,0.2))' },
];

const VinylColorSelector: React.FC<VinylColorSelectorProps> = ({ theme, onChange }) => {
  const [open, setOpen] = useState(false);

  // Persist selection for consistent sessions
  useEffect(() => {
    try { localStorage.setItem('vinylTheme', theme); } catch {}
  }, [theme]);

  const current = useMemo(() => PRESETS.find(p => p.key === theme) || PRESETS[0], [theme]);

  return (
    <div className="relative">
      <button
        className="flex items-center space-x-2 bg-neutral-800/70 text-white/90 border border-neutral-600/50 rounded-md px-3 py-1.5 text-sm hover:bg-neutral-700/70"
        title="Change vinyl color"
        onClick={() => setOpen(v => !v)}
      >
        <span
          className="inline-block w-4 h-4 rounded-full border border-white/20"
          style={{ background: current.swatch }}
        />
        <span>{current.name}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 max-h-60 overflow-y-auto styled-scrollbar bg-neutral-900/90 border border-neutral-700/50 rounded-md shadow-xl z-50 p-2">
          {PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => { onChange(p.key); setOpen(false); }}
              className="flex items-center w-full space-x-2 px-2 py-1.5 rounded-md hover:bg-white/5 text-sm text-white"
            >
              <span className="inline-block w-5 h-5 rounded-full border border-white/20" style={{ background: p.swatch }} />
              <span>{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VinylColorSelector;