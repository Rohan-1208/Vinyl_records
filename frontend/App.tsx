import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import VinylPlayer from './components/VinylPlayer';
import ControlHub from './components/Controls';
import SongLibrary from './components/SongLibrary';
import TopBar from './components/TopBar';
import SongTitle from './components/SongTitle';
import ProgressBar from './components/ProgressBar';
import { Song, SpotifyPlaylist, BackgroundMode, AudioFeatures, VinylTheme } from './types';
import { mediaSessionService } from './services/mediaSessionService';
import { API_BASE, proxiedImage } from './constants';
import StarryBackground from './components/StarryBackground';
import DynamicBackground from './components/DynamicBackground';
import GrainOverlay from './components/GrainOverlay';
import AmbientGradient from './components/AmbientGradient';
import MinimalGradientBackground from './components/MinimalGradientBackground';
import AppearanceModal from './components/AppearanceModal';
import RecordShelf from './components/RecordShelf';

const App: React.FC = () => {
  const [library, setLibrary] = useState<Song[]>([]);
  const [playQueue, setPlayQueue] = useState<Song[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [screensaverActive, setScreensaverActive] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const [bg1Url, setBg1Url] = useState('');
  const [bg2Url, setBg2Url] = useState('');
  const [isBg1Active, setIsBg1Active] = useState(true);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(() => {
    const saved = localStorage.getItem('backgroundMode');
    return (saved as BackgroundMode) || 'album';
  });

  // Spotify Web Playback SDK state
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null);
  const [spotifyReady, setSpotifyReady] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [spotifyLimited, setSpotifyLimited] = useState<boolean>(false);
  const spotifyPlayerRef = useRef<any>(null);
  const playQueueRef = useRef<Song[]>([]);
  const pendingPlayRef = useRef<Song | null>(null);
  const [progressRatio, setProgressRatio] = useState<number>(0);
  const [nowPlaying, setNowPlaying] = useState<{ isPlaying: boolean; progressMs: number; durationMs: number; track: Song | null } | null>(null);
   const audioRef = useRef<HTMLAudioElement | null>(null);
  const spotifyProgressRef = useRef<{ baseMs: number; durationMs: number; ts: number } | null>(null);
  // Prevent duplicate auto-advance triggers and track last handled track
  const autoNextGuardRef = useRef<{ lastUri: string | null; lastTs: number }>({ lastUri: null, lastTs: 0 });
  // Ref to hold latest playNextSong to avoid temporal-dead-zone in effects
  const playNextSongRef = useRef<(() => void) | null>(null);
  const lastExternalUriRef = useRef<string | null>(null);

  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('selectedDeviceId');
      return saved || null;
    } catch {
      return null;
    }
  });
  const [audioFeatures, setAudioFeatures] = useState<AudioFeatures | null>(null);
  const [vinylTheme, setVinylTheme] = useState<VinylTheme>(() => {
    try {
      const saved = localStorage.getItem('vinylTheme') as VinylTheme | null;
      return (saved as VinylTheme) || 'clear';
    } catch {
      return 'clear';
    }
  });

  // Custom color states
  const [customBgColor, setCustomBgColor] = useState<string>(() => {
    try {
      return localStorage.getItem('customBgColor') || '#111827';
    } catch {
      return '#111827';
    }
  });
  const [vinylCustomColor, setVinylCustomColor] = useState<string | null>(() => {
    try {
      const v = localStorage.getItem('vinylCustomColor');
      return v && v.length > 0 ? v : null;
    } catch {
      return null;
    }
  });
  const [appearanceOpen, setAppearanceOpen] = useState<boolean>(false);
  const appearanceAnchorRef = useRef<HTMLButtonElement | null>(null);
  const [showShelf, setShowShelf] = useState<boolean>(() => {
    try {
      const s = localStorage.getItem('showShelf');
      return s ? s === '1' : true;
    } catch {
      return true;
    }
  });
  const [displayTrack, setDisplayTrack] = useState<Song | null>(null);
  // Global volume (0..1), persisted
  const [volume, setVolume] = useState<number>(() => {
    try {
      const v = localStorage.getItem('volume');
      if (v == null) return 0.8;
      const f = parseFloat(v);
      return isFinite(f) ? Math.max(0, Math.min(1, f)) : 0.8;
    } catch {
      return 0.8;
    }
  });

  // Persist selected device choice for smoother reloads; empty string treated as null
  useEffect(() => {
    try {
      localStorage.setItem('selectedDeviceId', selectedDeviceId || '');
    } catch {}
  }, [selectedDeviceId]);

  useEffect(() => {
    try {
      localStorage.setItem('backgroundMode', backgroundMode);
    } catch {}
  }, [backgroundMode]);

  // (moved below currentTrack) – see effect further down

  useEffect(() => {
    try {
      localStorage.setItem('vinylTheme', vinylTheme);
    } catch {}
  }, [vinylTheme]);

  useEffect(() => {
    try { localStorage.setItem('customBgColor', customBgColor); } catch {}
  }, [customBgColor]);
  useEffect(() => {
    try { localStorage.setItem('vinylCustomColor', vinylCustomColor || ''); } catch {}
  }, [vinylCustomColor]);
  useEffect(() => {
    try { localStorage.setItem('showShelf', showShelf ? '1' : '0'); } catch {}
  }, [showShelf]);
  useEffect(() => {
    try { localStorage.setItem('volume', String(volume)); } catch {}
  }, [volume]);

  const currentTrack = playQueue.length > 0 ? playQueue[currentTrackIndex] : null;
  // Derive elapsed/total ms for progress bar
  const displayedDurationMs = nowPlaying?.durationMs ?? ((currentTrack?.duration || 0) * 1000);
  const displayedElapsedMs = isFinite(progressRatio) ? Math.round((progressRatio || 0) * (displayedDurationMs || 0)) : 0;

  // Apply volume to local audio when it changes
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }
  }, [volume]);

  // Memoize the current album art URL and guard updates to avoid loops
  const artUrl = useMemo(() => {
    return (nowPlaying?.track?.albumArt) || currentTrack?.albumArt || '';
  }, [nowPlaying?.track?.albumArt, currentTrack?.albumArt]);
  const artSrc = useMemo(() => proxiedImage(artUrl), [artUrl]);

  const lastAppliedArtRef = useRef<string>('');

  useEffect(() => {
    if (backgroundMode !== 'album' && backgroundMode !== 'blur') return;
    if (!artSrc) return;
    if (artSrc === lastAppliedArtRef.current) return;
    setIsBg1Active(prev => {
      if (prev) setBg2Url(artSrc); else setBg1Url(artSrc);
      return !prev;
    });
    lastAppliedArtRef.current = artSrc;
    // Update the displayed track only when the background changes
    setDisplayTrack((nowPlaying?.track ?? currentTrack) || null);
  }, [backgroundMode, artUrl]);

  // Keep displayed track in sync when not using album/blur backgrounds
  useEffect(() => {
    if (backgroundMode === 'album' || backgroundMode === 'blur') return;
    setDisplayTrack((nowPlaying?.track ?? currentTrack) || null);
  }, [backgroundMode, nowPlaying?.track, currentTrack]);

  // Fetch Spotify audio features whenever active track changes
  useEffect(() => {
    const track = (nowPlaying?.track ?? currentTrack);
    setAudioFeatures(null);
    const uri = track?.spotifyUri || null;
    if (!uri) return;
    let base = API_BASE || '';
    if (!base) base = 'https://vinyl-records.onrender.com';
    const id = uri.split(':').pop() || '';
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`${base}/api/spotify/audio-features?track_id=${encodeURIComponent(id)}`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data && typeof data === 'object') {
          setAudioFeatures({
            tempo: data.tempo ?? 0,
            energy: data.energy ?? 0,
            valence: data.valence ?? 0,
            danceability: data.danceability ?? 0,
            key: data.key ?? -1,
            mode: data.mode ?? 1,
          });
        }
      } catch (e) {
        // ignore
      }
    })();
  }, [nowPlaying?.track?.spotifyUri, currentTrack?.spotifyUri]);

  const handleSeekRatio = useCallback((ratio: number) => {
    const durationMs = nowPlaying?.durationMs ?? ((currentTrack?.duration || 0) * 1000);
    if (!durationMs || durationMs <= 0 || !isFinite(ratio)) return;
    const targetMs = Math.max(0, Math.min(durationMs, Math.floor(ratio * durationMs)));

    // Prefer Spotify Web Playback seek when available
    if (currentTrack?.spotifyUri && spotifyDeviceId && spotifyPlayerRef.current) {
      try {
        spotifyPlayerRef.current.seek(targetMs);
      } catch (e) {
        console.warn('Spotify seek error', e);
      }
      // Update local animated clock immediately for responsive UI
      spotifyProgressRef.current = { baseMs: targetMs, durationMs, ts: Date.now() };
      setProgressRatio(Math.max(0, Math.min(1, targetMs / durationMs)));
      return;
    }

    // Fallback: local audio element seek if available
    const audio = audioRef.current;
    if (audio && audio.duration > 0) {
      audio.currentTime = (ratio * audio.duration);
      setProgressRatio(Math.max(0, Math.min(1, ratio)));
    }
  }, [nowPlaying?.durationMs, currentTrack, spotifyDeviceId]);

  // Keep a ref of the playQueue for matching Spotify state to our list
  useEffect(() => {
    playQueueRef.current = playQueue;
  }, [playQueue]);

  // Centralized song fetcher; pulls from backend and maps
  const fetchSongs = useCallback(async () => {
    try {
      const base = API_BASE || '';
      const url = `${base}/api/songs`;
      const response = await fetch(url, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data: Song[] = await response.json();
      setLibrary(data);
      setPlayQueue(data);
    } catch (error) {
      console.error('Could not fetch songs:', error);
    }
  }, []);

  // Queue feature removed: no longer fetch Spotify queue

  const setVolumeClamped = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    setVolume(clamped);
    const audio = audioRef.current;
    if (audio) {
      audio.volume = clamped;
    }
    // Prefer SDK volume when using browser device
    if (spotifyPlayerRef.current && spotifyDeviceId && selectedDeviceId === spotifyDeviceId) {
      try { spotifyPlayerRef.current.setVolume(clamped); } catch (e) { console.warn('Spotify setVolume error', e); }
    } else if (selectedDeviceId && selectedDeviceId !== spotifyDeviceId) {
      // Attempt remote device volume via backend API if available
      const base = API_BASE || '';
      fetch(`${base}/api/spotify/volume`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ device_id: selectedDeviceId, volume_percent: Math.round(clamped * 100) })
      }).catch(() => {});
    }
  }, [spotifyDeviceId, selectedDeviceId]);

  const fetchPlaylists = useCallback(async () => {
    try {
      const base = API_BASE || '';
      const res = await fetch(`${base}/api/spotify/playlists`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (!res.ok) return;
      const body = await res.json();
      const items = Array.isArray(body.items) ? body.items : [];
      const pls: SpotifyPlaylist[] = items.map((p: any) => ({
        id: p.id,
        name: p.name,
        imageUrl: (p.images && p.images[0]?.url) || undefined,
      }));
      setPlaylists(pls);
    } catch (e) {
      console.error('Failed to fetch playlists', e);
    }
  }, []);

  const fetchPlaylistSongs = useCallback(async (playlistId: string) => {
    try {
      const base = API_BASE || '';
      const res = await fetch(`${base}/api/spotify/playlists/${playlistId}/songs`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data: Song[] = await res.json();
      setLibrary(data);
      setPlayQueue(data);
    } catch (e) {
      console.error('Failed to fetch playlist songs', e);
    }
  }, []);

  // Fetch song library from the backend on initial load
  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // Request fullscreen on first user interaction when not installed
  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: fullscreen)').matches || window.matchMedia('(display-mode: standalone)').matches;
    if (isStandalone || document.fullscreenElement) return;
    const onFirstInteract = () => {
      const el = document.documentElement as any;
      if (el?.requestFullscreen) {
        try {
          el.requestFullscreen();
        } catch {}
      }
      window.removeEventListener('pointerdown', onFirstInteract);
    };
    window.addEventListener('pointerdown', onFirstInteract, { once: true } as any);
  }, []);

  

  // Initialize Spotify Web Playback SDK after auth
  useEffect(() => {
    const initSpotify = async () => {
      try {
        const base = API_BASE || '';
        const statusRes = await fetch(`${base}/api/auth/status`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
        const status = await statusRes.json();
        if (!status?.authenticated) {
          setIsAuthenticated(false);
          return;
        }
        setIsAuthenticated(true);

        // Detect account changes and clear any stale device selection
        try {
          const meRes = await fetch(`${base}/api/spotify/me`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
          if (meRes.ok) {
            const me = await meRes.json();
            const newUserId = me?.id || '';
            const prevUserId = localStorage.getItem('spotifyUserId') || '';
            if (newUserId && newUserId !== prevUserId) {
              // Account changed: clear selected device to avoid cross-account stale IDs
              try { localStorage.removeItem('selectedDeviceId'); } catch {}
              setSelectedDeviceId(null);
            }
            try { localStorage.setItem('spotifyUserId', newUserId); } catch {}
          }
        } catch {}

        const createPlayer = () => {
          // @ts-ignore
          const Player = window.Spotify?.Player;
          if (!Player) return;
          // @ts-ignore
          const player = new window.Spotify.Player({
            name: 'Vinyl Records',
            getOAuthToken: async (cb: (token: string) => void) => {
              try {
                const res = await fetch(`${base}/api/spotify/token`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
                const json = await res.json();
                cb(json.access_token);
              } catch (e) {
                console.error('Failed to obtain token for Spotify Player', e);
              }
            },
            volume: 0.8,
          });

          spotifyPlayerRef.current = player;

          player.addListener('ready', ({ device_id }: any) => {
            setSpotifyDeviceId(device_id);
            setSpotifyReady(true);
            // Default to browser Web Playback device; prefer this on fresh sessions
            setSelectedDeviceId(device_id);
            console.log('Spotify Web Player ready with device_id', device_id);
            // Transfer playback to this Web Playback device so controls and now playing sync
            fetch(`${base}/api/spotify/transfer`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify({ device_id, play: false })
            }).catch(console.error);
            // Apply persisted volume to SDK
            try { player.setVolume(Math.max(0, Math.min(1, volume))); } catch {}
          });

          player.addListener('not_ready', ({ device_id }: any) => {
            console.warn('Spotify Web Player not ready', device_id);
            setSpotifyReady(false);
          });
          player.addListener('initialization_error', ({ message }: any) => console.error(message));
          player.addListener('authentication_error', ({ message }: any) => console.error(message));
          player.addListener('account_error', ({ message }: any) => console.error(message));
          player.addListener('playback_error', ({ message }: any) => console.error(message));

          // Keep UI in sync with player state
          player.addListener('player_state_changed', (state: any) => {
            if (!state) return;
            setIsPlaying(!state.paused);
            const ct = state.track_window?.current_track;
            // Update progress from Spotify state
            if (state.duration > 0) {
              setProgressRatio(Math.max(0, Math.min(1, state.position / state.duration)));
              spotifyProgressRef.current = { baseMs: state.position || 0, durationMs: state.duration || 0, ts: Date.now() };
            }
            // Auto-advance when the SDK reaches the end of the track
            try {
              const nearEnd = (state.duration || 0) > 0 && (state.position || 0) >= (state.duration || 0) - 800;
              if (state.paused && nearEnd) {
                const uri = ct?.uri || currentTrack?.spotifyUri || nowPlaying?.track?.spotifyUri || null;
                const now = Date.now();
                const guard = autoNextGuardRef.current;
                if (!(guard.lastUri === uri && now - guard.lastTs < 1000)) {
                  autoNextGuardRef.current = { lastUri: uri, lastTs: now };
                  playNextSong();
                }
              }
            } catch {}
            // Immediately update nowPlaying song info and background
            if (ct) {
              const artists = (ct.artists || []).map((a: any) => a?.name).filter(Boolean).join(', ');
              const art = (ct.album?.images?.[0]?.url) || '';
              const durMs = state.duration || ct.duration_ms || 0;
              const song: Song = {
                id: 0,
                title: ct.name || 'Unknown',
                artist: artists || 'Unknown',
                album: ct.album?.name || '',
                albumArt: art,
                duration: Math.floor(durMs / 1000),
                audioUrl: null,
                spotifyUri: ct.uri,
              };
              setNowPlaying({ isPlaying: !state.paused, progressMs: state.position || 0, durationMs: durMs, track: song });
              if (art) {
                if (isBg1Active) {
                  setBg2Url(art);
                  setIsBg1Active(false);
                } else {
                  setBg1Url(art);
                  setIsBg1Active(true);
                }
              }
            }
            // Update currentTrackIndex by matching spotify URI if found
            const uri = ct?.uri ?? (ct?.id ? `spotify:track:${ct.id}` : undefined);
            if (uri) {
              const idx = playQueueRef.current.findIndex(s => s.spotifyUri === uri);
              if (idx !== -1) {
                setCurrentTrackIndex(idx);
              }
            }

          });

          // @ts-ignore
          player.connect();
        };

        // If SDK already loaded, create immediately
        // @ts-ignore
        if (window.Spotify?.Player) {
          createPlayer();
          return;
        }

        // Otherwise, load the SDK script and attach ready handler
        const scriptId = 'spotify-player';
        if (!document.getElementById(scriptId)) {
          const script = document.createElement('script');
          script.id = scriptId;
          script.type = 'text/javascript';
          script.async = true;
          script.src = 'https://sdk.scdn.co/spotify-player.js';
          document.body.appendChild(script);
        }
        // @ts-ignore
        window.onSpotifyWebPlaybackSDKReady = () => createPlayer();
      } catch (err) {
        console.error('Error initializing Spotify Web Playback', err);
      }
    };

    initSpotify();
  }, []);

  // Listen for popup-based auth success and re-check status without manual refresh
  useEffect(() => {
    const recheckAuth = async () => {
      try {
        const base = API_BASE || '';
        const res = await fetch(`${base}/api/auth/status`, { credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
        const json = await res.json();
        const authed = !!json?.authenticated;
        setIsAuthenticated(authed);
        if (authed) {
          // Refresh data when auth becomes true
          try { await fetchSongs(); } catch {}
          try { await fetchPlaylists(); } catch {}
        } else {
          // Clear Spotify state on logout
          try { localStorage.removeItem('selectedDeviceId'); } catch {}
          setSelectedDeviceId(null);
          setSpotifyReady(false);
          setSpotifyDeviceId(null);
        }
      } catch {}
    };
    const onMessage = (ev: MessageEvent) => {
      const data: any = ev?.data || {};
      if (data && (data.type === 'spotify-auth-success' || data.type === 'spotify-auth-logout')) {
        recheckAuth();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [fetchSongs, fetchPlaylists]);

  // Refresh songs and playlists when authentication state changes to true
  useEffect(() => {
    if (isAuthenticated) {
      fetchSongs();
      fetchPlaylists();
    }
  }, [isAuthenticated, fetchSongs, fetchPlaylists]);

  // Queue feature removed: no periodic queue polling

  // Smooth progress animation via requestAnimationFrame
  const progressRafIdRef = useRef<number | null>(null);
  // Fallback timer to advance track if end events are missed
  const trackEndTimerRef = useRef<any>(null);
  // Poll Spotify current playback to reflect remote device state
  useEffect(() => {
    if (!isAuthenticated) return;
    const base = API_BASE || '';
    let stopped = false;
    let id: any = null;

    const poll = async () => {
      try {
        const res = await fetch(`${base}/api/spotify/current`, {
          credentials: 'include',
          headers: { 'ngrok-skip-browser-warning': 'true' }
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setSpotifyLimited(true);
            if (id) clearInterval(id);
            stopped = true;
          }
          return;
        }
        const body = await res.json();
        if (stopped) return;

        if (body?.error === 'premium_required') {
          setSpotifyLimited(true);
          if (id) clearInterval(id);
          stopped = true;
          return;
        }

        const isPlayingRemote: boolean = !!body?.isPlaying;
        const progressMs: number = Number(body?.progressMs || 0);
        const durationMs: number = Number(body?.durationMs || 0);
        const song: Song | null = body?.track || null;

        // Update nowPlaying snapshot and progress
        setNowPlaying({ isPlaying: isPlayingRemote, progressMs, durationMs, track: song });
        if (durationMs > 0) {
          setProgressRatio(Math.max(0, Math.min(1, progressMs / durationMs)));
          spotifyProgressRef.current = { baseMs: progressMs, durationMs, ts: Date.now() };
        }

        // Auto-advance for remote devices when playback stops at track end
        try {
          const nearEnd = durationMs > 0 && progressMs >= (durationMs - 800);
          if (!isPlayingRemote && nearEnd) {
            const uri = song?.spotifyUri || currentTrack?.spotifyUri || nowPlaying?.track?.spotifyUri || null;
            const now = Date.now();
            const guard = autoNextGuardRef.current;
            if (!(guard.lastUri === uri && now - guard.lastTs < 1000)) {
              autoNextGuardRef.current = { lastUri: uri, lastTs: now };
              playNextSong();
            }
          }
        } catch {}

        // Only drive vinyl play/pause when browser Web Playback isn't active
        try {
          const state = await spotifyPlayerRef.current?.getCurrentState?.();
          if (!state) {
            setIsPlaying(isPlayingRemote);
          }
        } catch {}

        // If remote track changed, update background and index
        const uri = song?.spotifyUri;
        if (uri && uri !== lastExternalUriRef.current) {
          lastExternalUriRef.current = uri;
          const art = song?.albumArt || '';
          if (art) {
            setIsBg1Active(prev => {
              if (prev) setBg2Url(art); else setBg1Url(art);
              return !prev;
            });
          }
        }

        if (uri) {
          const idx = playQueueRef.current.findIndex(s => s.spotifyUri === uri);
          if (idx !== -1) setCurrentTrackIndex(idx);
        }
      } catch (e) {
        // ignore errors
      }
    };

    id = setInterval(poll, 1200);
    poll();
    return () => { stopped = true; if (id) clearInterval(id); };
  }, [isAuthenticated]);

  // Reset auto-advance guard whenever the current track changes
  useEffect(() => {
    const uri = currentTrack?.spotifyUri || nowPlaying?.track?.spotifyUri || null;
    autoNextGuardRef.current = { lastUri: uri, lastTs: 0 };
  }, [currentTrack?.spotifyUri, nowPlaying?.track?.spotifyUri]);

  // Fallback: schedule a timer to move to next track based on duration
  useEffect(() => {
    const uri = currentTrack?.spotifyUri || nowPlaying?.track?.spotifyUri || null;
    const durationMs = nowPlaying?.durationMs ?? ((currentTrack?.duration || 0) * 1000);
    if (trackEndTimerRef.current) { clearTimeout(trackEndTimerRef.current); trackEndTimerRef.current = null; }
    if (!uri || !durationMs || durationMs <= 0) return;
    // Estimate elapsed using spotifyProgressRef for better accuracy
    const sp = spotifyProgressRef.current;
    const elapsedMs = sp && sp.durationMs ? Math.max(0, Math.min(sp.durationMs, (sp.baseMs || 0) + (Date.now() - (sp.ts || Date.now())))) : 0;
    const remaining = Math.max(800, durationMs - elapsedMs - 200);
    trackEndTimerRef.current = setTimeout(() => {
      const now = Date.now();
      const guard = autoNextGuardRef.current;
      if (!(guard.lastUri === uri && now - guard.lastTs < 1000)) {
        autoNextGuardRef.current = { lastUri: uri, lastTs: now };
        try { playNextSongRef.current?.(); } catch {}
      }
    }, remaining);
    return () => { if (trackEndTimerRef.current) { clearTimeout(trackEndTimerRef.current); trackEndTimerRef.current = null; } };
  }, [currentTrack?.spotifyUri, nowPlaying?.track?.spotifyUri, nowPlaying?.durationMs]);

  // Auto-advance when local preview audio finishes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      // Guard against accidental multiple fires
      const uri = currentTrack?.spotifyUri || nowPlaying?.track?.spotifyUri || null;
      const now = Date.now();
      const guard = autoNextGuardRef.current;
      if (guard.lastUri === uri && now - guard.lastTs < 1000) return;
      autoNextGuardRef.current = { lastUri: uri, lastTs: now };
      try { playNextSongRef.current?.(); } catch {}
    };
    audio.addEventListener('ended', onEnded);
    return () => { audio.removeEventListener('ended', onEnded); };
  }, [currentTrack?.spotifyUri, nowPlaying?.track?.spotifyUri]);

  const playNextSong = useCallback(() => {
    if (playQueue.length > 0) {
      const nextIndex = (currentTrackIndex + 1) % playQueue.length;
      const next = playQueue[nextIndex];
      (async () => {
        const base = API_BASE || '';
        // Resolve target device: selected -> active -> browser SDK
        let targetDeviceId: string | null = selectedDeviceId || null;
        if (!targetDeviceId) {
          try {
            const res = await fetch(`${base}/api/spotify/devices`, {
              credentials: 'include',
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const json = await res.json();
            const activeId = (json.devices || []).find((d: any) => d?.is_active)?.id || null;
            if (activeId) targetDeviceId = activeId;
          } catch {}
        }
        targetDeviceId = targetDeviceId || spotifyDeviceId || null;

        // Update local now-playing and background immediately
        setCurrentTrackIndex(nextIndex);
        setIsPlaying(true);
        setNowPlaying({ isPlaying: true, progressMs: 0, durationMs: (next.duration || 0) * 1000, track: next });
        if (next.albumArt) {
          if (isBg1Active) {
            setBg2Url(next.albumArt);
            setIsBg1Active(false);
          } else {
            setBg1Url(next.albumArt);
            setIsBg1Active(true);
          }
        }

        if (next?.spotifyUri && targetDeviceId && !spotifyLimited) {
          try {
            // Always transfer playback to the target device to make it active
            await fetch(`${base}/api/spotify/transfer`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify({ device_id: targetDeviceId, play: true }),
            });

            // Play this track on the target device (replaces current track)
            const playBody = { device_id: targetDeviceId, uris: [next.spotifyUri] };
            let playRes = await fetch(`${base}/api/spotify/play`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify(playBody),
            });

            // If Spotify rejects initially, retry after a short delay
            if (!playRes.ok) {
              await new Promise(r => setTimeout(r, 300));
              await fetch(`${base}/api/spotify/transfer`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ device_id: targetDeviceId, play: true }),
              });
              playRes = await fetch(`${base}/api/spotify/play`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify(playBody),
              });
            }

            if (targetDeviceId === spotifyDeviceId) { try { spotifyPlayerRef.current?.resume?.(); } catch {} }
          } catch (e) {
            console.error('Failed to play next on target device', e);
          }
        }
      })();
    }
  }, [playQueue.length, currentTrackIndex, spotifyDeviceId, selectedDeviceId]);

  // Keep ref in sync with latest playNextSong implementation
  useEffect(() => {
    playNextSongRef.current = playNextSong;
  }, [playNextSong]);

  const playPrevSong = useCallback(() => {
    if (playQueue.length > 0) {
      const prevIndex = (currentTrackIndex - 1 + playQueue.length) % playQueue.length;
      const prev = playQueue[prevIndex];
      (async () => {
        const base = API_BASE || '';
        // Resolve target device: selected -> active -> browser SDK
        let targetDeviceId: string | null = selectedDeviceId || null;
        if (!targetDeviceId) {
          try {
            const res = await fetch(`${base}/api/spotify/devices`, {
              credentials: 'include',
              headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const json = await res.json();
            const activeId = (json.devices || []).find((d: any) => d?.is_active)?.id || null;
            if (activeId) targetDeviceId = activeId;
          } catch {}
        }
        targetDeviceId = targetDeviceId || spotifyDeviceId || null;

        // Update local now-playing and background immediately
        setCurrentTrackIndex(prevIndex);
        setIsPlaying(true);
        setNowPlaying({ isPlaying: true, progressMs: 0, durationMs: (prev.duration || 0) * 1000, track: prev });
        if (prev.albumArt) {
          if (isBg1Active) {
            setBg2Url(prev.albumArt);
            setIsBg1Active(false);
          } else {
            setBg1Url(prev.albumArt);
            setIsBg1Active(true);
          }
        }

        if (prev?.spotifyUri && targetDeviceId && !spotifyLimited) {
          try {
            // Always transfer playback to the target device to make it active
            await fetch(`${base}/api/spotify/transfer`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify({ device_id: targetDeviceId, play: true }),
            });

            // Play this track on the target device (replaces current track)
            const playBody = { device_id: targetDeviceId, uris: [prev.spotifyUri] };
            let playRes = await fetch(`${base}/api/spotify/play`, {
              method: 'PUT',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
              body: JSON.stringify(playBody),
            });

            // If Spotify rejects initially, retry after a short delay
            if (!playRes.ok) {
              await new Promise(r => setTimeout(r, 300));
              await fetch(`${base}/api/spotify/transfer`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ device_id: targetDeviceId, play: true }),
              });
              playRes = await fetch(`${base}/api/spotify/play`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify(playBody),
              });
            }

            if (targetDeviceId === spotifyDeviceId) { try { spotifyPlayerRef.current?.resume?.(); } catch {} }
          } catch (e) {
            console.error('Failed to play previous on target device', e);
          }
        }
      })();
    }
  }, [playQueue.length, currentTrackIndex, spotifyDeviceId, selectedDeviceId]);
  
  const handlePlayPause = useCallback(() => {
    const targetDeviceId = selectedDeviceId || spotifyDeviceId;
    // Prefer Spotify full-track playback when available
    if (currentTrack?.spotifyUri && targetDeviceId && !spotifyLimited) {
      const base = API_BASE || '';
      if (targetDeviceId === spotifyDeviceId) {
        // Ensure browser Web Playback device is active, then toggle via SDK for instant feedback
        fetch(`${base}/api/spotify/transfer`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
          body: JSON.stringify({ device_id: targetDeviceId, play: !isPlaying })
        }).catch(console.error);
        try {
          if (isPlaying) {
            spotifyPlayerRef.current?.pause?.();
          } else {
            spotifyPlayerRef.current?.resume?.();
          }
        } catch {}
      } else {
        // Control the selected remote device via backend
        if (isPlaying) {
          // Pause current playback on the remote device
          fetch(`${base}/api/spotify/pause`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
            body: JSON.stringify({ device_id: targetDeviceId })
          }).catch(console.error);
        } else {
          // Starting playback: explicitly load the currently selected track on the remote device
          (async () => {
            try {
              await fetch(`${base}/api/spotify/transfer`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ device_id: targetDeviceId, play: true })
              });
              await fetch(`${base}/api/spotify/play`, {
                method: 'PUT',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
                body: JSON.stringify({ device_id: targetDeviceId, uris: [currentTrack.spotifyUri] })
              });
            } catch (e) {
              console.error('Remote play failed', e);
            }
          })();
        }
      }
      setIsPlaying(!isPlaying);
      return;
    }

    // Fallback: toggle browser audio element for 30s preview
    const audio = audioRef.current;
    if (audio) {
      if (isPlaying) audio.pause(); else audio.play().catch(() => {});
      setIsPlaying(!isPlaying);
    }
  }, [currentTrack, isPlaying, spotifyDeviceId, selectedDeviceId]);

  const handlePlayNow = useCallback((song: Song) => {
    // Prefer Spotify full-track playback when available
    if (song.spotifyUri && !spotifyLimited) {
      (async () => {
        const base = API_BASE || '';
        // Unified helper: transfer then play, with brief retries
        const startPlayback = async (deviceId: string, uri: string) => {
          const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } as const;
          // Try up to 3 times with small delays to handle device activation latency
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              await fetch(`${base}/api/spotify/transfer`, {
                method: 'PUT', credentials: 'include', headers, body: JSON.stringify({ device_id: deviceId, play: true })
              });
              const res = await fetch(`${base}/api/spotify/play`, {
                method: 'PUT', credentials: 'include', headers, body: JSON.stringify({ device_id: deviceId, uris: [uri] })
              });
              if (res.ok) return true;
            } catch {}
            await new Promise(r => setTimeout(r, 300));
          }
          return false;
        };
        // Resolve target device: selected -> active -> browser SDK
        let targetDeviceId: string | null = selectedDeviceId || null;
        try {
          const res = await fetch(`${base}/api/spotify/devices`, {
            credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          const json = await res.json();
          const list: any[] = json.devices || [];
          const hasSelected = targetDeviceId ? list.some(d => d?.id === targetDeviceId) : false;
          const activeId = (list.find(d => d?.is_active)?.id) || null;
          // If selected is stale, prefer active; else keep selected
          targetDeviceId = hasSelected ? targetDeviceId : (activeId || targetDeviceId);
        } catch {}
        targetDeviceId = targetDeviceId || spotifyDeviceId || null;

        if (targetDeviceId) {
          // Update local now-playing and background immediately
          const idx = playQueue.findIndex(s => s.id === song.id);
          if (idx !== -1) setCurrentTrackIndex(idx);
          setIsPlaying(true);
          setNowPlaying({ isPlaying: true, progressMs: 0, durationMs: (song.duration || 0) * 1000, track: song });
          if (song.albumArt) {
            if (isBg1Active) {
              setBg2Url(song.albumArt);
              setIsBg1Active(false);
            } else {
              setBg1Url(song.albumArt);
              setIsBg1Active(true);
            }
          }
          const ok = await startPlayback(targetDeviceId, song.spotifyUri);
          if (!ok) {
            console.error('Failed to start playback on target device');
          }
          if (targetDeviceId === spotifyDeviceId) {
            try { spotifyPlayerRef.current?.resume?.(); } catch {}
          }
          return;
        }

        // No device yet: defer playback until a device becomes available
        pendingPlayRef.current = song;
        const idx = playQueue.findIndex(s => s.id === song.id);
        if (idx !== -1) setCurrentTrackIndex(idx);
        setIsPlaying(true);
        setNowPlaying({ isPlaying: true, progressMs: 0, durationMs: (song.duration || 0) * 1000, track: song });
        if (song.albumArt) {
          if (isBg1Active) {
            setBg2Url(song.albumArt);
            setIsBg1Active(false);
          } else {
            setBg1Url(song.albumArt);
            setIsBg1Active(true);
          }
        }
        return;
      })();
      return;
    }

    // Fallback: 30s preview playback if available
    const audio = audioRef.current;
    if (audio && song.audioUrl) {
      audio.src = song.audioUrl;
      audio.play().catch(() => {});
      setIsPlaying(true);
      const idx = playQueue.findIndex(s => s.id === song.id);
      if (idx !== -1) setCurrentTrackIndex(idx);
      setNowPlaying({ isPlaying: true, progressMs: 0, durationMs: (song.duration || 0) * 1000, track: song });
      if (song.albumArt) {
        if (isBg1Active) {
          setBg2Url(song.albumArt);
          setIsBg1Active(false);
        } else {
          setBg1Url(song.albumArt);
          setIsBg1Active(true);
        }
      }
    }
  }, [playQueue, spotifyDeviceId, selectedDeviceId, isBg1Active]);

  // When a device becomes available and there is a pending play, start it
  useEffect(() => {
    const song = pendingPlayRef.current;
    const deviceId = selectedDeviceId || spotifyDeviceId || null;
    if (!song || !song.spotifyUri || !deviceId || spotifyLimited) return;
    (async () => {
      const base = API_BASE || '';
      const headers = { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' } as const;
      try {
        // retry a few times to ensure device activation
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await fetch(`${base}/api/spotify/transfer`, {
              method: 'PUT', credentials: 'include', headers, body: JSON.stringify({ device_id: deviceId, play: true })
            });
            const res = await fetch(`${base}/api/spotify/play`, {
              method: 'PUT', credentials: 'include', headers, body: JSON.stringify({ device_id: deviceId, uris: [song.spotifyUri] })
            });
            if (res.ok) break;
          } catch {}
          await new Promise(r => setTimeout(r, 300));
        }
        if (deviceId === spotifyDeviceId) {
          try { spotifyPlayerRef.current?.resume?.(); } catch {}
        }
      } catch (e) {
        console.error('Deferred play failed', e);
      } finally {
        pendingPlayRef.current = null;
      }
    })();
  }, [spotifyDeviceId, selectedDeviceId, spotifyLimited]);

  // Queue feature removed: no add-to-queue handling

  const handleSelectPlaylist = useCallback((playlistId: string | null) => {
    setSelectedPlaylistId(playlistId);
    if (!playlistId) {
      fetchSongs();
    } else {
      fetchPlaylistSongs(playlistId);
    }
  }, [fetchSongs, fetchPlaylistSongs]);

  // Global keyboard shortcuts for player controls (placed after handler declarations)
  useEffect(() => {
    const SEEK_DELTA_MS = 10000; // 10 seconds
    const VOL_STEP = 0.05; // 5%
    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = (el.tagName || '').toUpperCase();
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as any).isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return; // ignore with modifiers
      if (isTypingTarget(e.target)) return; // don't steal focus from inputs

      const key = e.key.toLowerCase();

      // Play/Pause: Space or 'k'
      if (key === ' ' || key === 'spacebar' || key === 'k') {
        e.preventDefault();
        handlePlayPause();
        return;
      }

      // Volume: ArrowUp/ArrowDown
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setVolumeClamped(volume + VOL_STEP);
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setVolumeClamped(volume - VOL_STEP);
        return;
      }

      // Next / Previous track
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        playNextSong();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        playPrevSong();
        return;
      }

      // Seek: 'j' = -10s, 'l' = +10s (YouTube-style)
      if ((key === 'j' || key === 'l') && displayedDurationMs && displayedDurationMs > 0) {
        e.preventDefault();
        const delta = key === 'j' ? -SEEK_DELTA_MS : SEEK_DELTA_MS;
        const newMs = Math.max(0, Math.min(displayedDurationMs, (displayedElapsedMs || 0) + delta));
        const newRatio = newMs / displayedDurationMs;
        handleSeekRatio(newRatio);
        return;
      }

      // Toggle shelf visibility: 's'
      if (key === 's') {
        e.preventDefault();
        setShowShelf(prev => !prev);
        return;
      }

      // Toggle library: 'q' (queue)
      if (key === 'q') {
        e.preventDefault();
        setLibraryOpen(prev => !prev);
        return;
      }

      // Close library: Escape
      if (e.key === 'Escape' && libraryOpen) {
        e.preventDefault();
        setLibraryOpen(false);
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handlePlayPause,
    playNextSong,
    playPrevSong,
    handleSeekRatio,
    displayedDurationMs,
    displayedElapsedMs,
    libraryOpen,
    volume,
    setVolumeClamped,
  ]);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Background selectable modes */}
      <div className="absolute inset-0 z-0">
        {backgroundMode === 'starry' && <StarryBackground />}
        {backgroundMode === 'gradient' && (
          <div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(120% 80% at 20% 10%, rgba(24,35,82,0.8) 0%, rgba(24,35,82,0.2) 40%, transparent 65%), radial-gradient(120% 80% at 80% 90%, rgba(55,84,125,0.7) 0%, rgba(55,84,125,0.2) 42%, transparent 70%), linear-gradient(180deg, #0b1120 0%, #111827 55%, #020617 100%)' }}
          />
        )}
        {backgroundMode === 'dynamic' && <DynamicBackground features={audioFeatures} />}

        {backgroundMode === 'minimal' && <MinimalGradientBackground features={audioFeatures} />}

        {(backgroundMode === 'album' || backgroundMode === 'blur') && (
          <>
            {bg1Url && (
              <img
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${isBg1Active ? 'opacity-100' : 'opacity-0'} ${backgroundMode === 'blur' ? 'blur-xl scale-105' : ''}`}
                src={bg1Url}
                alt=""
                onError={() => setBg1Url('')}
              />
            )}
            {bg2Url && (
              <img
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${!isBg1Active ? 'opacity-100' : 'opacity-0'} ${backgroundMode === 'blur' ? 'blur-xl scale-105' : ''}`}
                src={bg2Url}
                alt=""
                onError={() => setBg2Url('')}
              />
            )}
            <AmbientGradient imageUrl={isBg1Active ? bg1Url : bg2Url} />
          </>
        )}

        {backgroundMode === 'custom' && (
          <div className="absolute inset-0" style={{ background: customBgColor }} />
        )}

        <div 
  className="absolute inset-0"
  style={{ background: 'radial-gradient(circle at 50% 45%, rgba(255,255,255,0.02) 0%, rgba(0,0,0,0.65) 60%, rgba(0,0,0,0.85) 100%)' }}
/>
<GrainOverlay />
      </div>

      <main
        className={`relative z-10 w-full h-full transition-all duration-500 ${screensaverActive ? 'opacity-0' : 'opacity-100'}`}
        style={{ zoom: 0.67 }}
      >
        <TopBar
            screensaverActive={screensaverActive}
            onToggleScreensaver={() => setScreensaverActive(!screensaverActive)}
            isAuthenticated={isAuthenticated}
            selectedDeviceId={selectedDeviceId}
            onSelectDevice={(id) => setSelectedDeviceId(id)}
          />
        <SongTitle title={displayTrack?.title} />


        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <VinylPlayer 
                currentTrack={displayTrack}
                isPlaying={isPlaying}
                progressRatio={progressRatio}
                theme={vinylTheme}
                colorOverride={vinylCustomColor || undefined}
            />
        </div>

        {/* Record shelf above progress bar (moved slightly down) */}
        {showShelf && (
          <div className="absolute left-1/2 bottom-16 -translate-x-1/2">
            <RecordShelf songs={playQueue} currentIndex={currentTrackIndex} onSelect={handlePlayNow} />
          </div>
        )}

        {/* Progress bar positioned above controls */}
        <div className="absolute left-1/2 bottom-12 -translate-x-1/2 w-[72vw] max-w-3xl px-6">
          <ProgressBar progressRatio={progressRatio} elapsedMs={displayedElapsedMs} durationMs={displayedDurationMs} onSeekRatio={handleSeekRatio} />
        </div>
          
         <ControlHub 
             isPlaying={isPlaying}
             onPlayPause={handlePlayPause}
             onNext={playNextSong}
             onPrev={playPrevSong}
             onToggleLibrary={() => setLibraryOpen(true)}
             isPlayerActive={!!currentTrack}
             onOpenAppearance={() => setAppearanceOpen(true)}
             appearanceAnchorRef={appearanceAnchorRef}
             onToggleShelf={() => setShowShelf(prev => !prev)}
          />
      </main>
      
      <SongLibrary
        isOpen={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPlayNow={handlePlayNow}
        currentTrack={currentTrack}
        library={library}
        playlists={playlists}
        selectedPlaylistId={selectedPlaylistId}
        onSelectPlaylist={handleSelectPlaylist}
        isAuthenticated={isAuthenticated}
      />

      <AppearanceModal
        open={appearanceOpen}
        onClose={() => setAppearanceOpen(false)}
        backgroundMode={backgroundMode}
        customBgColor={customBgColor}
        onChangeBackgroundMode={(m) => setBackgroundMode(m)}
        onChangeCustomBgColor={(c) => setCustomBgColor(c)}
        vinylTheme={vinylTheme}
        vinylColorOverride={vinylCustomColor}
        onChangeVinylColorOverride={(c) => setVinylCustomColor(c)}
        anchorRef={appearanceAnchorRef}
      />

      {/* Hidden audio element for preview playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />

      {screensaverActive && (
        <div className="absolute inset-0 z-20 bg-black/70 flex items-center justify-center">
          <div className="text-white text-center">
            <p className="font-signature text-6xl">VINYL RECORDS</p>
            <p className="text-sm tracking-wide text-white/70">Press any key or move mouse to return</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;


