export enum MusicService {
  Spotify = 'Spotify',
  AppleMusic = 'Apple Music',
}

export interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  albumArt: string;
  duration: number; // in seconds
  audioUrl?: string | null; // optional preview URL for playback
  spotifyUri?: string | null; // optional full-track URI for Spotify playback
}

// Minimal playlist info for selection UI
export interface SpotifyPlaylist {
  id: string;
  name: string;
  imageUrl?: string;
}

// Background aesthetic modes
export type BackgroundMode = 'album' | 'blur' | 'custom' | 'starry' | 'gradient' | 'dynamic' | 'minimal';

// Simple RGB hex string (e.g., "#ff00aa") or CSS rgb() string
export type CSSColor = string;

export interface AudioFeatures {
  tempo: number;
  energy: number;
  valence: number;
  danceability: number;
  key: number; // pitch class 0-11
  mode: number; // major=1, minor=0
}

// Vinyl color themes for the player disc aesthetics
export type VinylTheme =
  | 'classic'      // deep black disc
  | 'sunflower'    // warm golden/yellow disc
  | 'warm'         // cream/orange retro disc
  | 'mint'         // soft mint/teal disc
  | 'clear';       // translucent acrylic disc with subtle accents