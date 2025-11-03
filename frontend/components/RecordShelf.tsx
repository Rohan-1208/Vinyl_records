import React, { useRef, useEffect } from 'react';
import { Song } from '../types';

interface RecordShelfProps {
  songs: Song[];
  currentIndex: number;
  onSelect: (song: Song) => void;
  variant?: 'vinyl'; // future: 'sleeve'
}

// Small vinyl thumbnails in a horizontal shelf
const RecordShelf: React.FC<RecordShelfProps> = ({ songs, currentIndex, onSelect, variant = 'vinyl' }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const VISIBLE_COUNT = 5;
  const ITEM_WIDTH = 120; // matches label container width
  const GAP = 16; // Tailwind gap-4
  const PADDING_X = 32; // px-4 => 16 left + 16 right
  const visibleCount = Math.min(songs.length, VISIBLE_COUNT);
  const pageWidth = ITEM_WIDTH * visibleCount + GAP * Math.max(0, visibleCount - 1) + PADDING_X;
  const pageScrollChunk = ITEM_WIDTH * VISIBLE_COUNT + GAP * (VISIBLE_COUNT - 1);

  // Ensure the active record is brought into view when it changes
  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [currentIndex, songs.length]);

  if (songs.length === 0) return null;

  return (
    <>
    <div className="pointer-events-auto">
      <div className="relative">
        {/* Scroll container */}
        <div
          ref={scrollRef}
          className="flex items-end gap-4 px-4 py-2 bg-black/15 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg overflow-x-auto no-scrollbar snap-x snap-mandatory"
          style={{ width: pageWidth }}
        >
          {songs.map((song, idx) => {
            const isActive = idx === currentIndex;
            const size = isActive ? 96 : 80;
            const labelSize = isActive ? 32 : 26;
            const shadow = isActive ? '0 10px 25px rgba(0,0,0,0.45)' : '0 6px 18px rgba(0,0,0,0.35)';
            const ringOpacity = isActive ? 0.35 : 0.25;
            const groove = 'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.0) 1px, rgba(0,0,0,0.0) 2px)';
            const discBase = 'radial-gradient(circle at 50% 45%, #0a0a0a 0%, #111 30%, #0b0b0b 55%, #000 100%)';
            const labelImg = song.albumArt ? `url(${song.albumArt})` : undefined;
            return (
              <button
                key={`${song.id}-${song.spotifyUri || song.title}`}
                className="group flex-none flex flex-col items-center focus:outline-none w-[120px] snap-center"
                onClick={() => onSelect(song)}
                title={`${song.title} — ${song.artist}`}
                ref={isActive ? activeRef : undefined}
                style={{
                  filter: `drop-shadow(${shadow})`,
                  transform: isActive ? 'translateY(-2px)' : 'translateY(0)',
                  transition: 'transform 200ms ease, filter 200ms ease',
                }}
              >
                <div
                  className="relative rounded-full"
                  style={{
                    width: size,
                  height: size,
                  backgroundImage: `${discBase}, ${groove}`,
                  boxShadow: `inset 0 0 0 1px rgba(255,255,255,${ringOpacity}), inset 0 0 0 4px rgba(0,0,0,0.4)`,
                }}
              >
                {/* center label */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: labelSize,
                    height: labelSize,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: '#222',
                    backgroundImage: labelImg,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)',
                  }}
                />
                {/* spindle hole */}
                <div
                  className="absolute rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: '#000',
                    boxShadow: '0 0 0 1px rgba(255,255,255,0.15) inset',
                  }}
                />
              </div>

              <div className="mt-2 w-[120px] text-center">
                <div className={`text-xs ${isActive ? 'text-white' : 'text-white/80'} truncate`}>{song.title}</div>
                <div className="text-[10px] text-white/60 truncate">{song.artist}</div>
              </div>
              </button>
            );
          })}
        </div>

        {/* Left/Right arrows */}
        <button
          type="button"
          aria-label="Scroll left"
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/40 text-white rounded-full p-2 border border-white/20 backdrop-blur-sm"
          onClick={() => {
            const el = scrollRef.current;
            if (!el) return;
            el.scrollBy({ left: -pageScrollChunk, behavior: 'smooth' });
          }}
        >
          ◀
        </button>

        <button
          type="button"
          aria-label="Scroll right"
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-black/30 hover:bg-black/40 text-white rounded-full p-2 border border-white/20 backdrop-blur-sm"
          onClick={() => {
            const el = scrollRef.current;
            if (!el) return;
            el.scrollBy({ left: pageScrollChunk, behavior: 'smooth' });
          }}
        >
          ▶
        </button>
      </div>
    </div>
    <style>{`
      .no-scrollbar::-webkit-scrollbar { display: none; }
      .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
    `}</style>
    </>
  );
};

export default RecordShelf;