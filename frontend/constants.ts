export const API_BASE = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

export const proxiedImage = (src: string | null | undefined): string => {
  const s = src || '';
  if (!s) return '';
  try {
    const u = new URL(s);
    if (u.hostname === 'i.scdn.co' && API_BASE) {
      return `${API_BASE}/api/proxy/image?src=${encodeURIComponent(s)}`;
    }
  } catch {}
  return s;
};

// This data is now fetched from the backend API.