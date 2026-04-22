// Centralized API base URL handling.
// In dev (Vite proxy) VITE_API_URL is empty so we use relative paths.
// In production (Vercel) set VITE_API_URL=https://your-backend.onrender.com
const RAW = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export function apiUrl(path: string): string {
  if (!RAW) return path;
  return `${RAW}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function wsUrl(path = '/ws'): string {
  if (RAW) {
    const u = new URL(RAW);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${u.host}${path}`;
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}${path}`;
}
