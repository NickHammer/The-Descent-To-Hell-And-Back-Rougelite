import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { StateMsg } from './view.js';

/** QR code pointing phones at this room's join URL over the LAN. */
function JoinQR({ roomCode }: { roomCode: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    // On a public deployment the page's own address is already reachable by
    // phones — only swap in the server's LAN IP when we're on localhost or a
    // private network (i.e., running at home).
    const h = location.hostname;
    const isPrivate =
      h === 'localhost' ||
      /^127\./.test(h) ||
      /^192\.168\./.test(h) ||
      /^10\./.test(h) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h);
    if (!isPrivate) {
      setJoinUrl(`${location.protocol}//${location.host}/join/${roomCode}`);
      return;
    }
    let cancelled = false;
    fetch('/api/netinfo')
      .then((r) => r.json())
      .then(({ addresses }: { addresses: string[] }) => {
        if (cancelled) return;
        const host = addresses[0] ? `${addresses[0]}:${location.port || 80}` : location.host;
        setJoinUrl(`${location.protocol}//${host}/join/${roomCode}`);
      })
      .catch(() => setJoinUrl(`${location.protocol}//${location.host}/join/${roomCode}`));
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  useEffect(() => {
    if (joinUrl && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, joinUrl, { width: 200, margin: 1 });
    }
  }, [joinUrl]);

  return (
    <div className="qr-box">
      <canvas ref={canvasRef} />
      {joinUrl && <div className="qr-url">{joinUrl}</div>}
      <div className="hint">Scan with a phone on the same Wi-Fi to join with a private hand</div>
    </div>
  );
}

export function Lobby({
  state,
  send
}: {
  state: StateMsg;
  send: (msg: object) => void;
}) {
  const openSeats = state.seats.filter((s) => s === null).length;
  const full = openSeats === 0;

  return (
    <div className="lobby">
      <h1 className="title">To Hell and Back</h1>
      <div className="room-code-box">
        Game code: <span className="room-code">{state.roomCode}</span>
      </div>

      <div className="seat-list">
        {state.seats.map((seat, i) => (
          <div key={i} className={`seat ${seat ? 'seat-filled' : ''}`}>
            {seat ? (
              <>
                <span>
                  {seat.isBot ? '🤖 ' : ''}
                  {seat.name}
                  {i === state.seat && ' (you)'}
                </span>
                {!seat.connected && !seat.isBot && <span className="muted"> — disconnected</span>}
              </>
            ) : (
              <span className="muted">Open seat…</span>
            )}
          </div>
        ))}
      </div>

      {state.isHost && (
        <div className="lobby-actions">
          {!full && (
            <button className="btn" onClick={() => send({ type: 'addBot' })}>
              Add a bot
            </button>
          )}
          {state.seats.some((s) => s?.isBot) && (
            <button className="btn" onClick={() => send({ type: 'removeBot' })}>
              Remove a bot
            </button>
          )}
          <button className="btn btn-primary" disabled={!full} onClick={() => send({ type: 'start' })}>
            {full ? 'Deal the first hand' : `Waiting for ${openSeats} more…`}
          </button>
        </div>
      )}
      {!state.isHost && <p className="muted">Waiting for the host to start the game…</p>}

      {openSeats > 0 && <JoinQR roomCode={state.roomCode} />}

      <p className="rules-note">
        {state.config.maxHandSize * 2 - 1} hands: 1 card up to {state.config.maxHandSize} and back
        down to 1. Bid how many tricks you'll take — make your bid exactly for bid + 5 points, miss
        it and you lose bid + 5.
        {state.config.hookRule
          ? ` Hook rule is on for the back half (${state.config.maxHandSize} down to 1).`
          : ''}
      </p>
    </div>
  );
}
