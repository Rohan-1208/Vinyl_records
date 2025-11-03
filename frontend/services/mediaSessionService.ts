import { Song } from '../types';

/**
 * A service to interact with the browser's Media Session API.
 * This allows the web app to show information about the currently playing media
 * in the operating system's UI and to handle media-related events, such as
 * hardware media keys.
 */
class MediaSessionService {
  /**
   * Updates the media session metadata with the current track's information.
   * This is what the OS displays in its media notifications.
   * @param track The current song to display metadata for.
   */
  public updateMetadata(track: Song): void {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [
          { src: track.albumArt, sizes: '96x96', type: 'image/png' },
          { src: track.albumArt, sizes: '128x128', type: 'image/png' },
          { src: track.albumArt, sizes: '192x192', type: 'image/png' },
          { src: track.albumArt, sizes: '256x256', type: 'image/png' },
          { src: track.albumArt, sizes: '384x384', type: 'image/png' },
          { src: track.albumArt, sizes: '512x512', type: 'image/png' },
        ],
      });
    }
  }

  /**
   * Sets a handler for a specific media session action.
   * These handlers are called when the user interacts with OS media controls
   * (e.g., hardware media keys).
   * @param action The media session action to handle.
   * @param handler The callback function to execute for the action.
   */
  public setActionHandler(action: MediaSessionAction, handler: () => void): void {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        console.warn(`The media session action "${action}" is not supported.`);
      }
    }
  }

  /**
   * Updates the playback state of the media session.
   * This tells the OS whether the media is currently playing or paused.
   * @param state The current playback state.
   */
  public updatePlaybackState(state: 'playing' | 'paused' | 'none'): void {
      if ('mediaSession' in navigator) {
          navigator.mediaSession.playbackState = state;
      }
  }
}

// Export a singleton instance of the service
export const mediaSessionService = new MediaSessionService();