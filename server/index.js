import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import os from 'os';
import { randomBytes } from 'crypto';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = join(__dirname, '../client/dist');

const app = express();
const httpServer = createServer(app);
const SERVER_PORT = process.env.PORT || 3001;

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors({ origin: '*' }));
app.use(express.json());

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function generateSessionId() {
  return randomBytes(3).toString('hex').toUpperCase();
}

const state = {
  sessionId: generateSessionId(),
  localIP: getLocalIP(),
  port: Number(SERVER_PORT),
  questions: [],
  players: new Map(), // keyed by persistent playerId (survives reconnects/refreshes)
  socketToPlayer: new Map(), // socket.id -> playerId, for events that only carry a socket id
  playedCells: new Set(),
  currentQuestion: null,
  buzzedPlayer: null,
  buzzersLocked: false,
  hostPlayerId: null, // player designated to run the game from their own phone
};

function serialized() {
  return {
    sessionId: state.sessionId,
    localIP: state.localIP,
    port: state.port,
    questions: state.questions,
    players: Array.from(state.players.values()),
    playedCells: Array.from(state.playedCells),
    currentQuestion: state.currentQuestion,
    buzzedPlayer: state.buzzedPlayer,
    buzzersLocked: state.buzzersLocked,
    hostPlayerId: state.hostPlayerId,
  };
}

function broadcast() {
  io.emit('game-state', serialized());
}

app.get('/health', (_req, res) => res.json({ ok: true, sessionId: state.sessionId }));

// Serve built React client (production — Railway)
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback: let React Router handle all non-API routes
  app.get('*', (_req, res) => res.sendFile(join(CLIENT_DIST, 'index.html')));
}

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);
  socket.emit('game-state', serialized());

  socket.on('join-session', ({ sessionId, name, playerId }) => {
    if (sessionId !== state.sessionId) {
      socket.emit('error', { message: 'Invalid session ID' });
      return;
    }

    const trimmedName = (name || '').trim() || `Player ${state.players.size + 1}`;
    let id = playerId || null;
    let player = id ? state.players.get(id) : null;

    // No record under this id (first-ever join, or localStorage was cleared) —
    // fall back to matching a disconnected player by name so we don't orphan their score.
    if (!player) {
      for (const existing of state.players.values()) {
        if (!existing.connected && existing.name.toLowerCase() === trimmedName.toLowerCase()) {
          player = existing;
          break;
        }
      }
      if (player) {
        if (id && id !== player.id) {
          state.players.delete(player.id);
          player.id = id;
        } else {
          id = player.id;
        }
      }
    }

    if (!id) id = randomBytes(8).toString('hex');

    if (player) {
      player.name = trimmedName;
      player.socketId = socket.id;
      player.connected = true;
      console.log(`Player rejoined: ${trimmedName} (score restored: ${player.score})`);
    } else {
      player = { id, socketId: socket.id, name: trimmedName, score: 0, connected: true };
      console.log(`Player joined: ${trimmedName}`);
    }

    state.players.set(id, player);
    state.socketToPlayer.set(socket.id, id);
    broadcast();
  });

  socket.on('buzz-in', ({ sessionId }) => {
    if (sessionId !== state.sessionId) return;
    if (state.buzzersLocked) return;
    if (!state.currentQuestion) return;
    const playerId = state.socketToPlayer.get(socket.id);
    const player = playerId && state.players.get(playerId);
    if (!player) return;

    state.buzzedPlayer = { playerId: player.id, name: player.name };
    state.buzzersLocked = true;
    broadcast();
    io.emit('buzz-event', { player: state.buzzedPlayer });
  });

  socket.on('unlock-buzzers', () => {
    state.buzzedPlayer = null;
    state.buzzersLocked = false;
    broadcast();
  });

  socket.on('lock-buzzers', () => {
    state.buzzersLocked = true;
    broadcast();
  });

  socket.on('reveal-answer', () => {
    if (state.currentQuestion) {
      state.currentQuestion = { ...state.currentQuestion, answerRevealed: true };
      broadcast();
    }
  });

  socket.on('question-selected', ({ category, value }) => {
    const question = state.questions.find(
      q => q.category === category && Number(q.value) === Number(value)
    );
    if (!question) return;
    state.currentQuestion = { ...question, answerRevealed: false };
    state.buzzedPlayer = null;
    state.buzzersLocked = true; // host must explicitly open buzzers
    broadcast();
  });

  socket.on('question-dismissed', () => {
    if (state.currentQuestion) {
      const key = `${state.currentQuestion.category}-${state.currentQuestion.value}`;
      state.playedCells.add(key);
    }
    state.currentQuestion = null;
    state.buzzedPlayer = null;
    state.buzzersLocked = false;
    broadcast();
  });

  socket.on('award-points', ({ playerId, points }) => {
    const player = state.players.get(playerId);
    if (player) {
      player.score += Number(points);
      broadcast();
    }
  });

  socket.on('set-host-player', ({ playerId }) => {
    if (playerId && !state.players.has(playerId)) return;
    state.hostPlayerId = playerId || null;
    broadcast();
  });

  socket.on('upload-questions', ({ questions }) => {
    state.questions = questions;
    state.playedCells = new Set();
    state.currentQuestion = null;
    state.buzzedPlayer = null;
    state.buzzersLocked = false;
    broadcast();
  });

  socket.on('reset-scores', () => {
    for (const p of state.players.values()) p.score = 0;
    broadcast();
  });

  socket.on('game-reset', () => {
    state.sessionId = generateSessionId();
    state.players = new Map();
    state.socketToPlayer = new Map();
    state.playedCells = new Set();
    state.currentQuestion = null;
    state.buzzedPlayer = null;
    state.buzzersLocked = false;
    state.hostPlayerId = null;
    broadcast();
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    const playerId = state.socketToPlayer.get(socket.id);
    state.socketToPlayer.delete(socket.id);
    if (!playerId) return;

    const p = state.players.get(playerId);
    // Guard against a stale disconnect firing after the player already
    // reconnected on a new socket (e.g. a quick wifi blip or a second tab).
    if (!p || p.socketId !== socket.id) return;

    console.log(`Player disconnected: ${p.name} (score preserved: ${p.score})`);
    p.connected = false;
    p.socketId = null;
    if (state.buzzedPlayer?.playerId === playerId) {
      state.buzzedPlayer = null;
      state.buzzersLocked = false;
    }
    broadcast();
  });
});

httpServer.listen(SERVER_PORT, '0.0.0.0', () => {
  console.log(`\n🎯 Jeopardy Server`);
  console.log(`   Port:    ${SERVER_PORT}`);
  console.log(`   Session: ${state.sessionId}`);
  console.log(`   Client:  ${existsSync(CLIENT_DIST) ? 'served from dist/' : 'NOT BUILT'}\n`);
});
