import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import QRCodeDisplay from '../components/QRCodeDisplay.jsx';
import Scoreboard from '../components/Scoreboard.jsx';
import HostControls from '../components/HostControls.jsx';
import { useHostActions } from '../hooks/useHostActions.js';

// Dev (.env.development): hits :3001. Production (Railway): same origin as the page.
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

export default function HostBoard() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  useEffect(() => {
    const s = io(SERVER_URL);
    setSocket(s);
    s.on('game-state', setGameState);
    return () => s.disconnect();
  }, []);

  const actions = useHostActions(socket, gameState);

  const resetGame = () => {
    if (window.confirm('Reset entire game? This clears all scores and creates a new session ID.')) {
      actions.resetGame();
    }
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-blue-950">
        <div className="text-blue-300 text-xl animate-pulse">Connecting to server...</div>
      </div>
    );
  }

  // Production: use the same public URL for the QR code so internet players can join.
  // Dev: use the local network IP so phones on the same wifi can connect.
  const joinUrl = import.meta.env.DEV
    ? `http://${gameState.localIP}:5173/join/${gameState.sessionId}`
    : `${window.location.origin}/join/${gameState.sessionId}`;

  return (
    <div className="min-h-screen bg-blue-950 p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-black text-yellow-400 tracking-widest font-serif drop-shadow-lg">
          JEOPARDY!
        </h1>
        <div className="flex gap-2">
          <Link
            to="/settings"
            className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Settings
          </Link>
          <button
            onClick={resetGame}
            className="bg-red-800 hover:bg-red-700 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
          >
            Reset Game
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex gap-3 flex-1">
        {/* Board */}
        <div className="flex-1 flex flex-col">
          <HostControls gameState={gameState} actions={actions} />
        </div>

        {/* Right sidebar */}
        <div className="w-56 flex flex-col gap-3">
          <QRCodeDisplay url={joinUrl} sessionId={gameState.sessionId} />
          <Scoreboard
            players={gameState.players}
            onAwardPoints={actions.awardPoints}
            currentQuestion={gameState.currentQuestion}
          />
        </div>
      </div>
    </div>
  );
}
