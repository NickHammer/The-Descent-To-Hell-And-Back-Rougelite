import express from 'express';
import { createServer } from 'http';
import { randomBytes } from 'crypto';
import { networkInterfaces } from 'os';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { Room } from './room.js';

const PORT = Number(process.env.PORT) || 8080;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../dist');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map<string, Room>();

/** LAN IPv4 addresses, so phones on the same Wi-Fi can reach us via QR code. */
app.get('/api/netinfo', (_req, res) => {
  const addresses: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) addresses.push(iface.address);
    }
  }
  res.json({ addresses });
});

if (existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

function newRoomCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I/O to avoid confusion
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  } while (rooms.has(code));
  return code;
}

interface ClientMessage {
  type: string;
  token?: string;
  name?: string;
  roomCode?: string;
  seatCount?: number;
  hookRule?: boolean;
  takeSeat?: boolean;
  bid?: number;
  cardId?: string;
}

// Keepalive: proxies and mobile radios kill idle sockets; ping every 30s and
// drop peers that never pong (their reconnect logic will bring them back).
interface AliveSocket extends WebSocket {
  isAlive?: boolean;
}

setInterval(() => {
  for (const client of wss.clients as Set<AliveSocket>) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30_000);

wss.on('connection', (ws: AliveSocket) => {
  ws.isAlive = true;
  ws.on('pong', () => (ws.isAlive = true));
  let room: Room | null = null;
  let conn: ReturnType<Room['addConnection']> | null = null;

  const fail = (message: string) => ws.send(JSON.stringify({ type: 'error', message }));

  ws.on('message', (raw) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return fail('Bad message');
    }
    const token = msg.token || randomBytes(12).toString('hex');

    try {
      switch (msg.type) {
        case 'create': {
          const seatCount = Math.min(4, Math.max(2, msg.seatCount ?? 2));
          const code = newRoomCode();
          room = new Room(code, { seatCount, hookRule: msg.hookRule ?? false }, token);
          rooms.set(code, room);
          conn = room.addConnection(ws, token);
          if (msg.takeSeat) room.takeSeat(conn, msg.name ?? 'Host');
          ws.send(JSON.stringify({ type: 'joined', roomCode: code, token }));
          room.broadcast();
          break;
        }
        case 'join': {
          const code = (msg.roomCode ?? '').toUpperCase().trim();
          const target = rooms.get(code);
          if (!target) return fail(`No game found with code ${code}`);
          room = target;
          conn = room.addConnection(ws, token);
          // Spectate (table display) or take a seat.
          if (msg.takeSeat && conn.seat === null) room.takeSeat(conn, msg.name ?? 'Player');
          ws.send(JSON.stringify({ type: 'joined', roomCode: code, token }));
          room.broadcast();
          break;
        }
        case 'addBot':
          requireHost(room, conn);
          room!.addBot();
          room!.broadcast();
          break;
        case 'removeBot':
          requireHost(room, conn);
          room!.removeBot();
          room!.broadcast();
          break;
        case 'start':
          requireHost(room, conn);
          room!.start();
          break;
        case 'continue':
          requireHost(room, conn);
          room!.continueGame();
          break;
        case 'bid':
          if (!room || conn?.seat == null) return fail('Not seated');
          room.bid(conn.seat, msg.bid ?? -1);
          break;
        case 'play':
          if (!room || conn?.seat == null) return fail('Not seated');
          room.play(conn.seat, msg.cardId ?? '');
          break;
        default:
          fail(`Unknown message type: ${msg.type}`);
      }
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Something went wrong');
    }
  });

  ws.on('close', () => {
    if (room && conn) room.dropConnection(conn);
  });

  function requireHost(r: Room | null, c: { token: string } | null): void {
    if (!r || !c || c.token !== r.hostToken) throw new Error('Only the host can do that');
  }
});

// Evict rooms idle for 2+ hours.
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastActivity < cutoff && room.connections.size === 0) rooms.delete(code);
  }
}, 10 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`To Hell and Back server listening on http://localhost:${PORT}`);
  if (!existsSync(distDir)) {
    console.log('(dev mode: run the Vite client on :5173, or `npm run build` to serve it here)');
  }
});
