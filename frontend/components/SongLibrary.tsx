import React, { useState, useEffect, useRef } from 'react';
import { Song, SpotifyPlaylist } from '../types';
import { CloseIcon, PlayIcon, SearchIcon } from './Icons';
import { API_BASE } from '../constants';

// Fallback image for broken album art URLs (inline SVG)
const PLACEHOLDER_ART =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23111111"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666666" font-size="14" font-family="Arial, Helvetica, sans-serif">No Art</text></svg>';

interface SongLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayNow: (song: Song) => void;
  currentTrack: Song | null;
  library: Song[];
  playlists: SpotifyPlaylist[];
  selectedPlaylistId: string | null;
  onSelectPlaylist: (playlistId: string | null) => void;
  isAuthenticated?: boolean; // enable Spotify-backed search when authenticated
}

const SongListItem: React.FC<{ song: Song; onPlay: () => void; isPlaying: boolean; }> = ({ song, onPlay, isPlaying }) => (
    <div className="group relative flex items-center space-x-4 p-3 pr-6 rounded-lg overflow-hidden transition-colors duration-300 bg-transparent">
      {/* Mini vinyl thumbnail instead of square art */}
      <div className="relative w-20 h-20 flex-shrink-0">
        <div
          className="relative rounded-full"
          style={{
            width: 80,
            height: 80,
            backgroundImage:
              'radial-gradient(circle at 50% 45%, #0a0a0a 0%, #111 30%, #0b0b0b 55%, #000 100%), ' +
              'repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.06) 0px, rgba(255,255,255,0.0) 1px, rgba(0,0,0,0.0) 2px)',
            boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25), inset 0 0 0 4px rgba(0,0,0,0.4)',
            filter: isPlaying ? 'drop-shadow(0 8px 22px rgba(0,0,0,0.45))' : 'drop-shadow(0 6px 18px rgba(0,0,0,0.35))',
          }}
        >
          {/* center label with album art */}
          <div
            className="absolute rounded-full"
            style={{
              width: 28,
              height: 28,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#222',
              backgroundImage: `url(${song.albumArt || PLACEHOLDER_ART})`,
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
          {isPlaying && (
            <div className="absolute -left-2 -top-2 w-24 h-24 rounded-full border-2 border-white/20 animate-spin-slow" />
          )}
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold truncate text-white">{song.title}</p>
        <p className="text-sm text-gray-300 truncate">{song.artist}</p>
      </div>

      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button onClick={onPlay} title="Play Now" className="p-3 rounded-full hover:bg-white/20">
          <PlayIcon className="w-5 h-5 text-white" />
        </button>
      </div>
    </div>
);

// Memoize list items to avoid re-renders unless props actually change
const MemoizedSongListItem = React.memo(SongListItem, (prev, next) => {
  return (
    prev.isPlaying === next.isPlaying &&
    prev.song.id === next.song.id &&
    prev.song.title === next.song.title &&
    prev.song.artist === next.song.artist &&
    prev.song.albumArt === next.song.albumArt
  );
});

const SongLibrary: React.FC<SongLibraryProps> = (props) => {
  const { 
    isOpen, onClose, onPlayNow, currentTrack, library, playlists, selectedPlaylistId, onSelectPlaylist, isAuthenticated
  } = props;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // In-memory cache of recent search results (30s TTL)
  const searchCacheRef = useRef<Map<string, { ts: number; data: Song[] }>>(new Map());

  // Local filter if no query or not authenticated
  const locallyFiltered = library.filter(song => {
    if (searchQuery.trim() === '') return true;
    const q = searchQuery.toLowerCase();
    return song.title.toLowerCase().includes(q) || song.artist.toLowerCase().includes(q);
  });

  // Spotify-backed search when authenticated
  useEffect(() => {
    if (!isOpen) return; // avoid background fetches
    const q = searchQuery.trim();
    if (q.length === 0) {
      setSearchError(null);
      setIsSearching(false);
      // Clear remote results when query is empty
      setSearchResults([]);
      return;
    }
    if (!isAuthenticated) {
      // No Spotify session; rely on local filtering
      setSearchResults([]);
      return;
    }

    const base = API_BASE || '';
    const controller = new AbortController();

    // Try cache first
    const cached = searchCacheRef.current.get(q);
    const now = Date.now();
    if (cached && now - cached.ts < 30_000) {
      setSearchResults(cached.data);
      setSearchError(null);
      setIsSearching(false);
      return () => controller.abort();
    }

    // Keep previous results visible while fetching newer ones
    setIsSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const url = `${base}/api/spotify/search?q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' }, signal: controller.signal });
        if (res.ok) {
          const data: Song[] = await res.json();
          setSearchResults(data);
          searchCacheRef.current.set(q, { ts: Date.now(), data });
        } else {
          setSearchError(`Search failed (${res.status})`);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') {
          console.error('Spotify search error', e);
          setSearchError('Search error');
        }
      } finally {
        setIsSearching(false);
      }
    }, 150); // reduced debounce for snappier UX

    return () => { clearTimeout(t); controller.abort(); };
  }, [searchQuery, isOpen, isAuthenticated]);
  
  const showingSongs = searchQuery.trim().length > 0 && isAuthenticated ? searchResults : locallyFiltered;
  
  const renderContent = () => {
    if (showingSongs.length > 0) {
        return (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {showingSongs.map(song => (
                <MemoizedSongListItem 
                    key={`${song.id}-${song.spotifyUri || song.title}`}
                    song={song} 
                    onPlay={() => { onPlayNow(song); onClose(); }}
                    isPlaying={currentTrack?.id === song.id}
                />
            ))}
            </div>
        );
    }
    
    return (
        <div className="w-full h-full flex items-center justify-center text-stone-500 text-center px-4">
            <p>
                {searchQuery ? `No results found for "${searchQuery}".` : `Your library is empty.`}
            </p>
        </div>
    );
  };

  return (
    <>
      <div
        className={`
          fixed inset-0 bg-black/70 backdrop-blur-md z-40 transition-opacity duration-500 ease-in-out
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
      >
        <div className="p-6 h-full flex flex-col text-white container mx-auto">
          <div className="flex justify-between items-center mb-4 flex-shrink-0">
             <h1 className="text-2xl font-signature text-amber-200">Record Collection</h1>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <CloseIcon className="w-6 h-6" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 flex-shrink-0">
            <div className="relative col-span-2">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <SearchIcon className="w-5 h-5 text-gray-500" />
              </span>
              <input
                type="text"
                placeholder={isAuthenticated ? 'Search Spotify by title or artist…' : 'Search local library by title or artist…'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/30 text-white placeholder-gray-500 border border-transparent rounded-md py-2 pl-10 pr-24 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-transparent"
              />
              <div className="absolute right-3 inset-y-0 flex items-center gap-3">
                {isSearching && (
                  <span className="text-xs text-white/60">Searching…</span>
                )}
                {searchQuery.trim().length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs text-amber-300 hover:text-amber-200 focus:outline-none"
                    title="Clear search"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
            <div>
              <select
                value={selectedPlaylistId || ''}
                onChange={(e) => onSelectPlaylist(e.target.value || null)}
                className="w-full bg-black/30 text-white border border-transparent rounded-md py-2 px-3 focus:outline-none focus:ring-2 focus:ring-amber-300/50 focus:border-transparent"
                title="Choose Liked Tracks or a Playlist"
              >
                <option value="">Liked Tracks</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

           <div className="flex-1 overflow-y-auto no-scrollbar -mr-4 pr-4">
            {searchError && <div className="text-red-400 text-xs mb-2">{searchError}</div>}
            {renderContent()}
          </div>
        </div>
      </div>
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>
    </>
  );
};

export default SongLibrary;