import { useMemo } from 'react';

export function useSession(): string {
  return useMemo(() => {
    const key = 'algotrader_session_id';
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, sid);
    }
    return sid;
  }, []);
}

export function apiHeaders(sessionId: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-session-id': sessionId };
}
