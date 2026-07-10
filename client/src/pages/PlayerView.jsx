import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? window.location.origin;
const STORAGE_KEY = 'jeopardy-player';

function playBuzz() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch (_) {}
}

export default function PlayerView() {
  const { sessionId } = useParams();
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState('');
  const [gameState, setGameState] = useState(null);
  const [socketId, setSocketId] = useState(null);
  const [buzzing, setBuzzing] = useState(false);
  const [rejoining, setRejoining] = useState(false);

  const socketRef = useRef(null);
  const wakeLockRef = useRef(null);
  const keepAwakeCtxRef = useRef(null);
  const autoJoinRef = useRef(null); // saved name to auto-join once socket connects

  // On mount: check localStorage for a saved session matching this URL
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved?.sessionId === sessionId && saved?.name) {
        autoJoinRef.current = saved.name;
        setName(saved.name);
        setRejoining(true);
      }
    } catch (_) {}
  }, [sessionId]);

  // Socket connection
  useEffect(() => {
    const s = io(SERVER_URL);
    socketRef.current = s;

    s.on('connect', () => {
      setSocketId(s.id);
      // Auto-rejoin if we found saved data
      if (autoJoinRef.current) {
        s.emit('join-session', { sessionId, name: autoJoinRef.current });
        setJoined(true);
        setRejoining(false);
        autoJoinRef.current = null;
      }
    });

    s.on('reconnect', () => setSocketId(s.id));
    s.on('game-state', setGameState);
    s.on('buzz-event', ({ player }) => {
      if (player.socketId !== s.id) playBuzz();
    });

    return () => s.disconnect();
  }, [sessionId]);

  // Keep screen awake — tries Wake Lock API first, then falls back to a silent
  // Web Audio loop. The audio approach must be started from a user gesture
  // (the Join button tap) so we expose startKeepAwake() for that.
  function startKeepAwake() {
    // 1. Wake Lock API (needs HTTPS)
    if ('wakeLock' in navigator) {
      navigator.wakeLock.request('screen')
        .then(lock => { wakeLockRef.current = lock; })
        .catch(() => {});

      function onVisibilityChange() {
        if (document.visibilityState === 'visible' && 'wakeLock' in navigator) {
          navigator.wakeLock.request('screen')
            .then(lock => { wakeLockRef.current = lock; })
            .catch(() => {});
        }
      }
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    // 2. Silent audio loop fallback — works on HTTP and older browsers.
    // Running an AudioContext at zero gain keeps many mobile browsers
    // from sleeping even without Wake Lock API.
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const source = ctx.createConstantSource();
      const gain = ctx.createGain();
      gain.gain.value = 0; // completely silent
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
      keepAwakeCtxRef.current = ctx;
    } catch (_) {}
  }

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      keepAwakeCtxRef.current?.close();
      wakeLockRef.current?.release();
    };
  }, []);

  const joinSession = useCallback(() => {
    if (!name.trim()) return;
    const trimmed = name.trim();

    // Save to localStorage so we can rejoin on refresh
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, name: trimmed }));
    } catch (_) {}

    socketRef.current?.emit('join-session', { sessionId, name: trimmed });
    setJoined(true);

    // Start keep-awake from within the user gesture (button tap)
    startKeepAwake();
  }, [sessionId, name]);

  const buzzIn = useCallback(() => {
    if (!gameState?.currentQuestion || gameState?.buzzersLocked) return;
    setBuzzing(true);
    playBuzz();
    socketRef.current?.emit('buzz-in', { sessionId });
    setTimeout(() => setBuzzing(false), 400);
  }, [sessionId, gameState]);

  const myPlayer = gameState?.players?.find(p => p.socketId === socketId);
  const q = gameState?.currentQuestion;
  const isBuzzedIn = gameState?.buzzedPlayer?.socketId === socketId;
  const someoneElseBuzzed = gameState?.buzzedPlayer && !isBuzzedIn;
  const canBuzz = q && !gameState?.buzzersLocked;

  // ── Auto-rejoin splash ──
  if (rejoining) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-5xl mb-4 animate-spin">⟳</div>
          <p className="text-blue-300 text-xl">Rejoining as <span className="text-yellow-400 font-bold">{name}</span>…</p>
        </div>
      </div>
    );
  }

  // ── Join screen ──
  if (!joined) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center p-6">
        <div className="bg-blue-900 rounded-2xl p-8 w-full max-w-sm shadow-2xl border border-blue-700">
          <h1 className="text-4xl font-black text-yellow-400 text-center mb-1 font-serif tracking-widest">
            JEOPARDY!
          </h1>
          <p className="text-blue-400 text-center text-sm mb-8">
            Session <span className="font-mono text-yellow-300">{sessionId}</span>
          </p>
          <input
            type="text"
            placeholder="Your name or team name"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && joinSession()}
            className="w-full bg-blue-800 text-white border border-blue-600 rounded-xl px-4 py-3 text-lg mb-4 placeholder-blue-500 focus:outline-none focus:border-yellow-400"
            autoFocus
            maxLength={32}
          />
          <button
            onClick={joinSession}
            disabled={!name.trim()}
            className="w-full bg-yellow-400 hover:bg-yellow-300 active:bg-yellow-500 text-blue-900 font-black py-4 rounded-xl text-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  // ── In-game screen ──
  return (
    <div className="min-h-screen bg-blue-950 flex flex-col">
      {/* Header */}
      <div className="bg-blue-900 border-b border-blue-700 px-6 py-4 flex justify-between items-center">
        <div className="text-white font-bold text-lg truncate">
          {myPlayer?.name ?? name}
        </div>
        <div className={`font-black text-2xl tabular-nums ${(myPlayer?.score ?? 0) < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
          {(myPlayer?.score ?? 0) < 0 ? '-' : ''}${Math.abs(myPlayer?.score ?? 0).toLocaleString()}
        </div>
      </div>

      {/* Buzz area */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
        {!q ? (
          <div className="text-center">
            <div className="text-5xl mb-4">⏳</div>
            <p className="text-blue-400 text-xl">Waiting for next question…</p>
          </div>
        ) : isBuzzedIn ? (
          <div className="text-center animate-pulse">
            <div className="text-7xl mb-4">🎤</div>
            <p className="text-green-400 text-3xl font-black mb-2">YOU'RE UP!</p>
            <p className="text-blue-300 text-lg">Answer the question!</p>
          </div>
        ) : someoneElseBuzzed ? (
          <div className="text-center">
            <div className="text-5xl mb-4">🔔</div>
            <p className="text-yellow-400 text-2xl font-black mb-1">
              {gameState.buzzedPlayer.name}
            </p>
            <p className="text-blue-400 text-lg">buzzed in first</p>
            <p className="text-blue-500 text-sm mt-3">Wait for the next opportunity…</p>
          </div>
        ) : gameState?.buzzersLocked ? (
          <div className="text-center">
            <div className="text-7xl mb-4 animate-pulse">🔒</div>
            <p className="text-blue-400 text-2xl font-bold mb-1">Stand by…</p>
            <p className="text-blue-500 text-sm">Waiting for host to open buzzers</p>
          </div>
        ) : (
          <button
            onClick={buzzIn}
            disabled={!canBuzz}
            className={`
              w-64 h-64 rounded-full font-black text-5xl transition-all duration-100 select-none
              shadow-2xl active:scale-95
              ${canBuzz
                ? buzzing
                  ? 'bg-red-400 scale-105 shadow-red-500/60'
                  : 'bg-red-600 hover:bg-red-500 shadow-red-900/80 cursor-pointer'
                : 'bg-blue-800 text-blue-600 cursor-not-allowed'
              }
              text-white
            `}
          >
            BUZZ!
          </button>
        )}

        {q && (
          <div className="text-blue-400 text-sm text-center">
            {q.category} — ${q.value}
            {q.dailyDouble && <span className="ml-2 text-yellow-400">⭐ Daily Double</span>}
          </div>
        )}
      </div>

      {/* Leaderboard footer */}
      {gameState?.players && gameState.players.length > 1 && (
        <div className="bg-blue-900 border-t border-blue-700 px-6 py-3">
          <div className="text-blue-500 text-xs uppercase tracking-widest mb-2">Leaderboard</div>
          <div className="space-y-1">
            {[...gameState.players]
              .sort((a, b) => b.score - a.score)
              .slice(0, 5)
              .map((p, i) => (
                <div
                  key={p.socketId}
                  className={`flex justify-between text-sm ${
                    p.socketId === socketId ? 'text-yellow-400 font-bold' : 'text-blue-300'
                  }`}
                >
                  <span>{i + 1}. {p.name}</span>
                  <span className="tabular-nums">
                    {p.score < 0 ? '-' : ''}${Math.abs(p.score).toLocaleString()}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
