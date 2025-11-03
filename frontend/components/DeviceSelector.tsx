import React, { useEffect, useMemo, useState, useRef } from 'react';
import { API_BASE } from '../constants';

// Minimal Spotify device shape from GET /me/player/devices
interface SpotifyDevice {
  id: string;
  is_active: boolean;
  is_restricted?: boolean;
  name: string;
  type: string; // e.g., "Computer", "Smartphone", "Speaker"
  volume_percent?: number;
}

interface DeviceSelectorProps {
  isAuthenticated?: boolean;
  selectedDeviceId?: string | null;
  onSelectDevice?: (deviceId: string) => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = ({ isAuthenticated, selectedDeviceId: selectedDeviceIdProp, onSelectDevice }) => {
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeviceIdLocal, setSelectedDeviceIdLocal] = useState<string | ''>('');
  const [open, setOpen] = useState(false);

  // Auto-refresh coordination refs
  const autoRefreshAttemptsRef = useRef(0);
  const autoRefreshTimerRef = useRef<number | null>(null);
  const needsVinylSelectionRef = useRef(true);

  const base = API_BASE || '';

  const activeDeviceId = useMemo(() => {
    const active = devices.find(d => d.is_active);
    return active?.id || '';
  }, [devices]);

  const fetchDevices = async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${base}/api/spotify/devices`, {
        credentials: 'include',
        headers: { 'ngrok-skip-browser-warning': 'true' }
      });
      const json = await res.json();
      const list: SpotifyDevice[] = json.devices || [];
      setDevices(list);
      // Default selection: prefer Vinyl Records (browser) if present, else active device
      const browserId = (list.find(d => d.name === 'Vinyl Records')?.id || '');
      const activeId = (list.find(d => d.is_active)?.id || '');
      const defaultId = browserId || activeId || '';
      // If the current selection is not found in the device list, treat it as stale
      const hasProp = selectedDeviceIdProp ? list.some(d => d.id === selectedDeviceIdProp) : false;
      const hasLocal = selectedDeviceIdLocal ? list.some(d => d.id === selectedDeviceIdLocal) : false;
      const shouldDefault = (!hasProp && !hasLocal && !!defaultId);
      if (shouldDefault) {
        onSelectDevice?.(defaultId);
      }
      setSelectedDeviceIdLocal(prev => {
        if (prev && list.some(d => d.id === prev)) return prev;
        return defaultId;
      });
    } catch (e: any) {
      console.error('Failed to fetch Spotify devices', e);
      setError('Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Keep local selection in sync with prop for correct button label
    if (selectedDeviceIdProp) setSelectedDeviceIdLocal(selectedDeviceIdProp);
  }, [selectedDeviceIdProp]);

  useEffect(() => {
    // Load devices initially when authenticated
    if (isAuthenticated) {
      fetchDevices();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    // Auto-refresh devices for a short period until Vinyl Records appears,
    // so user doesn't need to click Refresh manually.
    if (!isAuthenticated) return;
    needsVinylSelectionRef.current = true;
    autoRefreshAttemptsRef.current = 0;
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
      autoRefreshTimerRef.current = null;
    }
    // Kick off an immediate fetch, then poll a few times.
    fetchDevices();
    autoRefreshTimerRef.current = window.setInterval(() => {
      autoRefreshAttemptsRef.current += 1;
      const maxAttempts = 15; // ~18 seconds at 1200ms
      if (!needsVinylSelectionRef.current || autoRefreshAttemptsRef.current > maxAttempts) {
        if (autoRefreshTimerRef.current) {
          clearInterval(autoRefreshTimerRef.current);
          autoRefreshTimerRef.current = null;
        }
        return;
      }
      fetchDevices();
    }, 1200);

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    // When Vinyl Records shows up, auto-select it once and stop polling
    if (!isAuthenticated) return;
    const browserDevice = devices.find(d => d.name === 'Vinyl Records');
    if (browserDevice) {
      needsVinylSelectionRef.current = false;
      if (!selectedDeviceIdProp && !selectedDeviceIdLocal) {
        onSelectDevice?.(browserDevice.id);
        setSelectedDeviceIdLocal(browserDevice.id);
      }
    }
  }, [devices, isAuthenticated, selectedDeviceIdProp, selectedDeviceIdLocal, onSelectDevice]);

  const handleSelectDevice = async (deviceId: string) => {
    setSelectedDeviceIdLocal(deviceId);
    onSelectDevice?.(deviceId);
    setError(null);
    setOpen(false);
    // Optimistically mark the chosen device active for immediate UI feedback
    setDevices(prev => prev.map(d => ({ ...d, is_active: d.id === deviceId })));
    try {
      // Transfer playback to the chosen device; play: true to make it active immediately
      await fetch(`${base}/api/spotify/transfer`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ device_id: deviceId, play: true })
      });
      // Follow with a play request on that device to minimize switching latency
      await fetch(`${base}/api/spotify/play`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': 'true' },
        body: JSON.stringify({ device_id: deviceId })
      });
      // Refresh the device list shortly after to reflect authoritative active state
      setTimeout(() => { fetchDevices(); }, 500);
    } catch (e) {
      console.error('Failed to transfer playback', e);
      setError('Failed to switch device');
      // Roll back optimistic update if needed
      setDevices(prev => prev.map(d => ({ ...d, is_active: d.id === activeDeviceId })));
    }
  };

  const formatLabel = (d: SpotifyDevice) => {
    const isBrowser = d.name === 'Vinyl Records';
    const star = d.is_active ? ' ★' : '';
    return `${d.name}${isBrowser ? ' (This Browser)' : ''}${star}`;
  };

  const selectedId = (selectedDeviceIdProp ?? selectedDeviceIdLocal) || '';
  const selectedName = (devices.find(d => d.id === selectedId)?.name) || 'Select device';

  return (
    <div className="relative flex items-center space-x-2">
      <label className="text-white/70 text-sm hidden sm:block" htmlFor="device-select">Device</label>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={!isAuthenticated || loading || devices.length === 0}
        className="bg-neutral-800/70 text-white/90 border border-neutral-600/50 rounded-md px-3 py-1.5 text-sm hover:bg-neutral-700/70 disabled:opacity-40"
        title={!isAuthenticated ? 'Connect Spotify to manage devices' : 'Select Spotify device'}
      >
        {loading ? 'Loading…' : selectedName}
      </button>
      <button
        onClick={fetchDevices}
        className="text-white/70 bg-neutral-800/70 hover:bg-neutral-700/70 border border-neutral-600/50 rounded-md px-2 py-1 text-xs"
        title="Refresh devices"
        disabled={!isAuthenticated || loading}
      >
        Refresh
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 max-h-60 overflow-y-auto styled-scrollbar bg-neutral-900/90 border border-neutral-700/50 rounded-md shadow-xl z-50">
          {devices.map((d) => (
            <button
              key={d.id}
              onClick={() => handleSelectDevice(d.id)}
              className={`w-full text-left px-3 py-2 text-sm transition-colors ${d.id === selectedId ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/10 hover:text-white'}`}
            >
              {formatLabel(d)}
            </button>
          ))}
          {devices.length === 0 && (
            <div className="px-3 py-2 text-sm text-white/60">No devices found</div>
          )}
        </div>
      )}

      <style>{`
        .styled-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.35) transparent; }
        .styled-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .styled-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .styled-scrollbar::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,.35); border-radius: 12px; border: 2px solid rgba(0,0,0,.2); }
        .styled-scrollbar::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,.55); }
      `}</style>
    </div>
  );
};

export default DeviceSelector;