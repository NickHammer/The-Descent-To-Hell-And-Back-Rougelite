import { useEffect, useRef, useState } from 'react';
import { ServerMsg } from './view.js';

function randomToken(): string {
  // crypto.randomUUID is unavailable on insecure origins (plain http over the
  // LAN, which is exactly how phones join) — fall back to getRandomValues.
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getToken(): string {
  try {
    let token = localStorage.getItem('thab_token');
    if (!token) {
      token = randomToken();
      localStorage.setItem('thab_token', token);
    }
    return token;
  } catch {
    return randomToken(); // storage blocked (private mode): still playable
  }
}

export const TOKEN = getToken();

export interface Socket {
  send: (msg: object) => void;
  status: 'connecting' | 'open' | 'closed';
}

/**
 * Auto-reconnecting WebSocket. `onOpen` fires on every (re)connect so the
 * app can re-join its room; `onMessage` receives parsed server messages.
 */
export function useSocket(
  onMessage: (msg: ServerMsg) => void,
  onOpen: () => void
): Socket {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<Socket['status']>('connecting');
  const handlers = useRef({ onMessage, onOpen });
  handlers.current = { onMessage, onOpen };

  useEffect(() => {
    let closed = false;
    let retryMs = 500;

    function connect() {
      if (closed) return;
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws`);
      wsRef.current = ws;
      setStatus('connecting');

      ws.onopen = () => {
        retryMs = 500;
        setStatus('open');
        handlers.current.onOpen();
      };
      ws.onmessage = (ev) => {
        try {
          handlers.current.onMessage(JSON.parse(ev.data));
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        setStatus('closed');
        if (!closed) {
          setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, 5000);
        }
      };
    }

    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, []);

  return {
    status,
    send: (msg: object) =>
      wsRef.current?.readyState === WebSocket.OPEN &&
      wsRef.current.send(JSON.stringify({ ...msg, token: TOKEN }))
  };
}
