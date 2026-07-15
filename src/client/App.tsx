import { useCallback, useRef, useState } from 'react';
import { Game } from './Game.js';
import { Home } from './Home.js';
import { Lobby } from './Lobby.js';
import { useSocket } from './socket.js';
import { ServerMsg, StateMsg } from './view.js';

function joinCodeFromUrl(): string | null {
  const m = location.pathname.match(/^\/join\/([A-Za-z]{4})$/);
  return m ? m[1].toUpperCase() : null;
}

export function App() {
  const [state, setState] = useState<StateMsg | null>(null);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<string | null>(sessionStorage.getItem('thab_room'));
  const errorTimer = useRef<number>(0);

  const showError = useCallback((message: string) => {
    setError(message);
    clearTimeout(errorTimer.current);
    errorTimer.current = window.setTimeout(() => setError(null), 4000);
  }, []);

  const onMessage = useCallback(
    (msg: ServerMsg) => {
      if (msg.type === 'state') {
        // Ignore stragglers from a room we've already left.
        if (!roomRef.current || msg.roomCode !== roomRef.current) return;
        setState(msg);
      } else if (msg.type === 'joined') {
        roomRef.current = msg.roomCode;
        sessionStorage.setItem('thab_room', msg.roomCode);
      } else if (msg.type === 'error') {
        if (msg.message.startsWith('No game found')) {
          // Stale room from a previous session — go home.
          roomRef.current = null;
          sessionStorage.removeItem('thab_room');
          setState(null);
        }
        showError(msg.message);
      }
    },
    [showError]
  );

  // On every (re)connect, silently re-join our room; the token reclaims our seat.
  const onOpen = useCallback(() => {
    if (roomRef.current) {
      socket.send({ type: 'join', roomCode: roomRef.current, takeSeat: false });
    }
  }, []);

  const socket = useSocket(onMessage, onOpen);

  const create = (
    name: string,
    seatCount: number,
    maxHandSize: number,
    hookRule: boolean,
    takeSeat: boolean
  ) => {
    localStorage.setItem('thab_name', name);
    socket.send({ type: 'create', name, seatCount, maxHandSize, hookRule, takeSeat });
  };

  const join = (name: string, roomCode: string) => {
    localStorage.setItem('thab_name', name);
    socket.send({ type: 'join', name, roomCode, takeSeat: true });
    history.replaceState(null, '', '/');
  };

  const leave = () => {
    socket.send({ type: 'leave' });
    roomRef.current = null;
    sessionStorage.removeItem('thab_room');
    setState(null);
  };

  let screen;
  if (!state) {
    screen = (
      <Home
        initialName={localStorage.getItem('thab_name') ?? ''}
        joinCode={joinCodeFromUrl()}
        onCreate={create}
        onJoin={join}
      />
    );
  } else if (state.phase === 'lobby') {
    screen = <Lobby state={state} send={socket.send} />;
  } else {
    screen = <Game state={state} send={socket.send} onLeave={leave} />;
  }

  return (
    <div className="app">
      {screen}
      {error && <div className="toast">{error}</div>}
      {socket.status !== 'open' && state && <div className="toast toast-conn">Reconnecting…</div>}
    </div>
  );
}
