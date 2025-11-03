import React, { useEffect, useMemo, useState } from 'react';
import { BackgroundMode, VinylTheme } from '../types';

interface AppearanceModalProps {
  open: boolean;
  onClose: () => void;
  backgroundMode: BackgroundMode;
  customBgColor: string;
  onChangeBackgroundMode: (mode: BackgroundMode) => void;
  onChangeCustomBgColor: (color: string) => void;
  vinylTheme: VinylTheme;
  vinylColorOverride: string | null;
  onChangeVinylColorOverride: (color: string | null) => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
const rgbToHex = (r: number, g: number, b: number) =>
  '#' + [r, g, b].map(n => clamp(n).toString(16).padStart(2, '0')).join('');
const hexToRgb = (hex: string): [number, number, number] | null => {
  const h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  if (h.length >= 6) {
    try {
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return [r, g, b];
    } catch {
      return null;
    }
  }
  return null;
};

const AppearanceModal: React.FC<AppearanceModalProps> = ({
  open,
  onClose,
  backgroundMode,
  customBgColor,
  onChangeBackgroundMode,
  onChangeCustomBgColor,
  vinylTheme,
  vinylColorOverride,
  onChangeVinylColorOverride,
  anchorRef,
}) => {
  const [bgHex, setBgHex] = useState<string>(customBgColor.startsWith('#') ? customBgColor : '#111827');
  const [vinylHex, setVinylHex] = useState<string>(vinylColorOverride?.startsWith('#') ? vinylColorOverride : '#111827');

  useEffect(() => {
    setBgHex(customBgColor.startsWith('#') ? customBgColor : '#111827');
  }, [customBgColor]);

  useEffect(() => {
    setVinylHex(vinylColorOverride?.startsWith('#') ? vinylColorOverride : '#111827');
  }, [vinylColorOverride]);

  const bgRgb = useMemo(() => hexToRgb(bgHex) || [17, 24, 39], [bgHex]);
  const vinylRgb = useMemo(() => hexToRgb(vinylHex) || [17, 24, 39], [vinylHex]);

  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const recalc = () => {
      const el = anchorRef?.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPos({ left: Math.round(r.left), top: Math.round(r.top) });
    };
    if (open) {
      recalc();
      window.addEventListener('resize', recalc);
      window.addEventListener('scroll', recalc, true);
    }
    return () => {
      window.removeEventListener('resize', recalc);
      window.removeEventListener('scroll', recalc, true);
    };
  }, [open, anchorRef]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const p = panelRef.current;
      const anchor = anchorRef?.current;
      const target = e.target as Node | null;
      if (!p || !target) return;
      const insidePanel = p.contains(target);
      const insideAnchor = !!anchor && anchor.contains(target);
      if (!insidePanel && !insideAnchor) {
        onClose();
      }
    };
    if (open) document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open, onClose, anchorRef]);

  if (!open || !pos) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-40 w-[560px] max-w-[92vw] bg-neutral-900 text-white rounded-xl border border-white/10 shadow-2xl"
      style={{ left: pos.left, top: pos.top - 8, transform: 'translateY(-100%)' }}
    >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white" aria-label="Close">✕</button>
        </div>

        <div className="p-4 space-y-6">
          {/* Background options */}
          <section>
            <p className="text-sm text-white/70 mb-2">Background</p>
            <div className="flex items-center gap-2 mb-3">
              <button
                className={`px-3 py-1.5 rounded-md border ${backgroundMode==='album'?'bg-white/10 border-white/20':'border-white/10 hover:bg-white/5'}`}
                onClick={() => onChangeBackgroundMode('album')}
              >Song Art</button>
              <button
                className={`px-3 py-1.5 rounded-md border ${backgroundMode==='blur'?'bg-white/10 border-white/20':'border-white/10 hover:bg-white/5'}`}
                onClick={() => onChangeBackgroundMode('blur')}
              >Blurred Art</button>
              <button
                className={`px-3 py-1.5 rounded-md border ${backgroundMode==='custom'?'bg-white/10 border-white/20':'border-white/10 hover:bg-white/5'}`}
                onClick={() => onChangeBackgroundMode('custom')}
              >Custom Color</button>
            </div>

            {backgroundMode === 'custom' && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgHex}
                    onChange={(e) => { setBgHex(e.target.value); onChangeCustomBgColor(e.target.value); }}
                  />
                  <span className="text-xs text-white/60">{bgHex}</span>
                </div>
                <div className="flex-1 grid grid-cols-3 gap-3">
                  {(['R','G','B'] as const).map((label, idx) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="w-4 text-xs text-white/60">{label}</span>
                      <input
                        type="range"
                        min={0}
                        max={255}
                        value={[bgRgb[0], bgRgb[1], bgRgb[2]][idx]}
                        onChange={(e) => {
                          const val = clamp(parseInt(e.target.value, 10));
                          const next: [number, number, number] = [bgRgb[0], bgRgb[1], bgRgb[2]] as any;
                          next[idx] = val;
                          const hex = rgbToHex(next[0], next[1], next[2]);
                          setBgHex(hex);
                          onChangeCustomBgColor(hex);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Vinyl color */}
          <section>
            <p className="text-sm text-white/70 mb-2">Vinyl Color</p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={vinylHex}
                  onChange={(e) => { setVinylHex(e.target.value); onChangeVinylColorOverride(e.target.value); }}
                />
                <span className="text-xs text-white/60">{vinylHex}</span>
              </div>
              <button
                className="px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/5"
                onClick={() => { onChangeVinylColorOverride(null); }}
                title="Reset to theme preset"
              >Use Theme ({vinylTheme})</button>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-3">
              {(['R','G','B'] as const).map((label, idx) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-4 text-xs text-white/60">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={[vinylRgb[0], vinylRgb[1], vinylRgb[2]][idx]}
                    onChange={(e) => {
                      const val = clamp(parseInt(e.target.value, 10));
                      const next: [number, number, number] = [vinylRgb[0], vinylRgb[1], vinylRgb[2]] as any;
                      next[idx] = val;
                      const hex = rgbToHex(next[0], next[1], next[2]);
                      setVinylHex(hex);
                      onChangeVinylColorOverride(hex);
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
            <button onClick={onClose} className="px-3 py-1.5 rounded-md border border-white/10 hover:bg-white/5">Close</button>
          </div>
        </div>
    </div>
  );
};

export default AppearanceModal;