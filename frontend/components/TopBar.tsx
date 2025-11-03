import React, { useEffect, useState, useRef } from 'react';
import { TriangleIcon, SpotifyIcon } from './Icons';
import { API_BASE } from '../constants';
import DeviceSelector from './DeviceSelector';

interface TopBarProps {
    screensaverActive: boolean;
    onToggleScreensaver: () => void;
    isAuthenticated?: boolean;
    selectedDeviceId?: string | null;
    onSelectDevice?: (id: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ screensaverActive, onToggleScreensaver, isAuthenticated, selectedDeviceId, onSelectDevice }) => {
  const handleConnectSpotify = () => {
    let base = API_BASE || '';
    if (!base) {
      // Default to local backend in dev when env var is not set
      base = 'http://localhost:8000';
    }
    const url = `${base}/auth/spotify/login?ngrok-skip-browser-warning=true`;
    window.location.assign(url);
  };

  const handleLogout = async () => {
    try {
      const base = API_BASE || 'http://localhost:8000';
      const url = `${base}/api/auth/logout`;
      await fetch(url, { method: 'POST', credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
      // Reload to reset app state and re-check auth
      window.location.reload();
    } catch (e) {
      console.error('Logout failed', e);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      const base = API_BASE || 'http://localhost:8000';
      await fetch(`${base}/api/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'ngrok-skip-browser-warning': 'true' } });
      // Redirect to login with show_dialog=true to force account chooser
      const url = `${base}/auth/spotify/login?show_dialog=true&ngrok-skip-browser-warning=true`;
      window.location.assign(url);
    } catch (e) {
      console.error('Switch account failed', e);
    }
  };

  // Window Controls Overlay support: place TopBar into titlebar area when available
  const [wcoVisible, setWcoVisible] = useState<boolean>(false);
  useEffect(() => {
    const wco = (navigator as any).windowControlsOverlay;
    if (!wco) return;
    const update = () => setWcoVisible(!!wco.visible);
    update();
    const handler = () => update();
    wco.addEventListener?.('geometrychange', handler);
    return () => {
      wco.removeEventListener?.('geometrychange', handler);
    };
  }, []);

  const overlayStyle = wcoVisible
    ? {
        position: 'fixed' as const,
        left: 'env(titlebar-area-x)',
        top: 'env(titlebar-area-y)',
        width: 'env(titlebar-area-width)',
        height: 'env(titlebar-area-height)',
        zIndex: 40,
        paddingLeft: '12px',
        paddingRight: '12px',
      }
    : undefined;

  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(menuRef.current as any).contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  return (
    <header
      className={`fixed ${wcoVisible ? '' : 'top-0 left-0 right-0'} p-3 z-30 flex justify-between items-center bg-transparent`}
      style={overlayStyle}
    >
      <div className="flex items-center space-x-3 text-white">
        <img src="/logo-192.png" alt="Logo" className="w-6 h-6" />
        <span className="font-bold text-sm tracking-wider">VINYL RECORDS</span>
      </div>
      <div className="flex items-center space-x-4">
        <button
          onClick={handleConnectSpotify}
          className="flex items-center space-x-2 text-white/90 bg-green-600/30 hover:bg-green-600/40 border border-green-500/30 px-3 py-1.5 rounded-full transition-colors"
          title={isAuthenticated ? 'Spotify Connected' : 'Connect your Spotify account'}
        >
          <SpotifyIcon className="w-5 h-5" />
          <span className="text-sm">{isAuthenticated ? 'Spotify Connected' : 'Connect Spotify'}</span>
        </button>
        {isAuthenticated && (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setProfileOpen(v => !v)}
              className="text-white/90 bg-white/10 hover:bg-white/20 border border-white/20 px-3 py-1.5 rounded-full transition-colors text-sm"
              title="Profile"
            >
              Profile
            </button>
            {profileOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-black/60 backdrop-blur-md border border-white/10 rounded-lg shadow-lg z-50">
                <button
                  onClick={handleSwitchAccount}
                  className="w-full text-left text-white/90 hover:text-white hover:bg-white/10 px-3 py-2 text-sm"
                >
                  Switch account
                </button>
                <div className="border-t border-white/10" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left text-red-300 hover:text-red-200 hover:bg-red-600/20 px-3 py-2 text-sm"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
        <DeviceSelector isAuthenticated={isAuthenticated} selectedDeviceId={selectedDeviceId} onSelectDevice={onSelectDevice} />
      </div>
    </header>
  );
};

export default TopBar;