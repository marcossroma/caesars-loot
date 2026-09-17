import assert from 'node:assert/strict';
import { io } from 'socket.io-client';
import { createInterface } from 'node:readline/promises';

const base = process.env.SMOKE_API_URL;
const origin = process.env.SMOKE_FRONTEND_ORIGIN;
assert(base && new URL(base).protocol === 'https:', 'Hosted HTTPS API required');
assert(origin && new URL(origin).protocol === 'https:', 'Hosted HTTPS frontend origin required');
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  assert(response.ok, `Unexpected HTTP status: ${response.status}`);
  assert(!JSON.stringify(data).includes('trapTileIds'), 'Hidden trap data leaked');
  return data;
}
const session = await request('/api/session', {});
let before;
for (let attempt = 0; attempt < 3; attempt++) {
  const round = await request('/api/game/start', {
    sessionId: session.sessionId,
    bet: 5,
    trapCount: 1,
  });
  const reveal = await request('/api/game/reveal', {
    sessionId: session.sessionId,
    roundId: round.roundId,
    tileId: 0,
  });
  if (reveal.result === 'safe') {
    before = await request(`/api/session/${session.sessionId}/state`);
    break;
  }
}
assert(before?.activeRound, 'No safe active round prepared within three attempts');
console.log('Active fictional-credit round prepared. Confirm a new Railway deployment is Active.');
const prompt = createInterface({ input: process.stdin, output: process.stdout });
try {
  await prompt.question('Press Enter only AFTER the backend redeploy is verified: ', {
    signal: AbortSignal.timeout(15 * 60_000),
  });
} finally {
  prompt.close();
}
assert.equal((await request('/health')).database, 'connected');
const after = await request(`/api/session/${session.sessionId}/state`);
assert.equal(after.demoCredits, before.demoCredits);
assert.deepEqual(after.activeRound, before.activeRound);
const socket = io(`${base}/game`, {
  transports: ['websocket'],
  reconnection: false,
  extraHeaders: { Origin: origin },
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('WSS reconnect timed out')), 15_000);
    socket.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
    socket.once('connect_error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  const joined = await socket
    .timeout(15_000)
    .emitWithAck('JOIN_SESSION', { sessionId: session.sessionId });
  assert.equal(joined.ok, true);
  await request('/api/game/cashout', {
    sessionId: session.sessionId,
    roundId: after.activeRound.roundId,
  });
  assert.equal((await request(`/api/session/${session.sessionId}/state`)).activeRound, null);
  console.log(
    'PASS: hosted redeploy preserved credits/revealed round, WSS room rejoin and settlement',
  );
  console.log('Fictional smoke session retained; no user data deleted');
} finally {
  socket.disconnect();
}
