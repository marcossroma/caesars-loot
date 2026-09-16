import assert from 'node:assert/strict';
import { io } from 'socket.io-client';

const base = process.env.SMOKE_API_URL ?? 'http://localhost:3000';
const origin = process.env.SMOKE_FRONTEND_ORIGIN ?? 'http://localhost:5173';
async function request(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json();
  assert(!JSON.stringify(data).includes('trapTileIds'), 'Hidden trap data leaked');
  return { response, data };
}
const health = await request('/health');
assert.equal(health.data.database, 'connected');
const denied = await fetch(`${base}/health`, {
  headers: { Origin: 'https://unauthorized.invalid' },
  signal: AbortSignal.timeout(15_000),
});
assert.equal(denied.status, 403);
const { data: session } = await request('/api/session', {});
const socket = io(`${base}/game`, {
  transports: ['websocket'],
  reconnection: false,
  extraHeaders: { Origin: origin },
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Socket connect timeout')), 15_000);
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
  const starts = await Promise.all(
    [0, 1].map(() =>
      request('/api/game/start', {
        sessionId: session.sessionId,
        bet: 5,
        trapCount: 1,
      }),
    ),
  );
  assert.equal(starts.filter(({ response }) => response.ok).length, 1, 'Double start protection');
  const round = starts.find(({ response }) => response.ok).data;
  const input = { sessionId: session.sessionId, roundId: round.roundId };
  const revealed = await request('/api/game/reveal', { ...input, tileId: 0 });
  assert(revealed.response.ok);
  if (revealed.data.result === 'safe') {
    const cashouts = await Promise.all([0, 1].map(() => request('/api/game/cashout', input)));
    assert.equal(
      cashouts.filter(({ response }) => response.ok).length,
      1,
      'Double cashout protection',
    );
    console.log('Double cashout verified');
  } else {
    console.log('Trap encountered: cashout concurrency not verified in this run');
  }
  const state = await request(`/api/session/${session.sessionId}/state`);
  assert.equal(state.data.activeRound, null);
  const history = await request(`/api/game/history?sessionId=${session.sessionId}`);
  assert.equal(history.data[0].roundId, round.roundId);
  console.log(
    'PASS: database health, CORS, hidden-trap protection, WebSocket join, double start, reveal, history',
  );
  console.log('Smoke session retained; no data was deleted');
} finally {
  socket.disconnect();
}
