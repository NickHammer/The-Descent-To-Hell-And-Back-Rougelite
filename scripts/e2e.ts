/**
 * End-to-end test: drives the real server over WebSocket as a human client
 * playing against a bot, through all 19 hands.
 */
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080/ws');
const send = (msg: object) => ws.send(JSON.stringify({ ...msg, token: 'e2e-human' }));

let handsSeen = new Set<number>();
let lastPhase = '';
let acted = ''; // dedupe key so we don't double-act on rebroadcasts

const timeout = setTimeout(() => {
  console.error('TIMEOUT: game did not finish. Last phase: ' + lastPhase);
  process.exit(1);
}, 120000);

ws.on('open', () => {
  send({ type: 'create', name: 'E2E', seatCount: 2, hookRule: true, takeSeat: true });
});

ws.on('message', (raw) => {
  const msg = JSON.parse(String(raw));
  if (msg.type === 'error') {
    console.error('SERVER ERROR: ' + msg.message);
    process.exit(1);
  }
  if (msg.type === 'joined') {
    send({ type: 'addBot' });
    setTimeout(() => send({ type: 'start' }), 50);
    return;
  }
  if (msg.type !== 'state') return;
  lastPhase = msg.phase;

  if (msg.phase === 'gameEnd') {
    clearTimeout(timeout);
    const scores = msg.players.map((p: any) => `${p.name}: ${p.score}`).join(', ');
    console.log(`GAME COMPLETE — ${handsSeen.size} hands played. Final: ${scores}`);
    if (handsSeen.size !== 19) {
      console.error('FAIL: expected 19 hands');
      process.exit(1);
    }
    // sanity: history covers all hands, trick counts consistent
    for (const h of msg.history) {
      const taken = h.taken.reduce((a: number, b: number) => a + b, 0);
      if (taken !== h.handSize) {
        console.error(`FAIL: hand ${h.handIndex} tricks ${taken} != ${h.handSize}`);
        process.exit(1);
      }
    }
    console.log('All hands consistent. E2E PASS');
    process.exit(0);
  }

  if (msg.handIndex !== undefined) handsSeen.add(msg.handIndex);

  if (msg.phase === 'handEnd') {
    const key = `continue-${msg.handIndex}`;
    if (acted !== key) {
      acted = key;
      send({ type: 'continue' });
    }
    return;
  }

  if (msg.seat === null || msg.turn !== msg.seat) return;

  if (msg.phase === 'bidding' && msg.legalBids.length > 0) {
    const key = `bid-${msg.handIndex}`;
    if (acted !== key) {
      acted = key;
      send({ type: 'bid', bid: msg.legalBids[0] });
    }
  } else if (msg.phase === 'playing' && msg.legalPlays.length > 0) {
    const key = `play-${msg.handIndex}-${msg.hand.length}-${msg.trick.length}`;
    if (acted !== key) {
      acted = key;
      send({ type: 'play', cardId: msg.legalPlays[0] });
    }
  }
});

ws.on('error', (e) => {
  console.error('WS ERROR: ' + e.message);
  process.exit(1);
});
