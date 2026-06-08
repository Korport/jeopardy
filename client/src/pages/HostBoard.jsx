import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import QRCodeDisplay from '../components/QRCodeDisplay.jsx';
import Scoreboard from '../components/Scoreboard.jsx';

// Dev (.env.development): hits :3001. Production (Railway): same origin as the page.
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

export default function HostBoard() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);

  // Daily Double local state
  const [ddPhase, setDdPhase] = useState('wager'); // 'wager' | 'question'
  const [ddPlayerId, setDdPlayerId] = useState('');
  const [ddWager, setDdWager] = useState('');

  useEffect(() => {
    const s = io(SERVER_URL);
    setSocket(s);
    s.on('game-state', setGameState);
    return () => s.disconnect();
  }, []);

  // Reset DD state whenever a question opens or closes
  useEffect(() => {
    setDdPhase('wager');
    setDdPlayerId('');
    setDdWager('');
  }, [gameState?.currentQuestion?.category, gameState?.currentQuestion?.value]);

  const emit = useCallback((event, data) => socket?.emit(event, data), [socket]);

  const selectQuestion = useCallback(
    (category, value) => emit('question-selected', { category, value }),
    [emit]
  );

  const dismissQuestion = useCallback(() => emit('question-dismissed'), [emit]);
  const revealAnswer = useCallback(() => emit('reveal-answer'), [emit]);
  const unlockBuzzers = useCallback(() => emit('unlock-buzzers'), [emit]);
  const awardPoints = useCallback(
    (playerId, points) => emit('award-points', { playerId, points }),
    [emit]
  );

  // Regular (non-DD) correct/wrong — uses buzzer player + question face value
  const handleCorrect = useCallback(() => {
    if (!gameState?.buzzedPlayer || !gameState?.currentQuestion) return;
    awardPoints(gameState.buzzedPlayer.socketId, gameState.currentQuestion.value);
    dismissQuestion();
  }, [gameState, awardPoints, dismissQuestion]);

  const handleWrong = useCallback(() => {
    if (!gameState?.buzzedPlayer || !gameState?.currentQuestion) return;
    awardPoints(gameState.buzzedPlayer.socketId, -gameState.currentQuestion.value);
    unlockBuzzers();
  }, [gameState, awardPoints, unlockBuzzers]);

  // Daily Double correct/wrong — uses chosen player + entered wager
  const ddWagerAmount = parseInt(ddWager, 10) || 0;

  const handleDdLockIn = useCallback(() => {
    if (!ddPlayerId || ddWagerAmount <= 0) return;
    setDdPhase('question');
  }, [ddPlayerId, ddWagerAmount]);

  const handleDdCorrect = useCallback(() => {
    awardPoints(ddPlayerId, ddWagerAmount);
    dismissQuestion();
  }, [ddPlayerId, ddWagerAmount, awardPoints, dismissQuestion]);

  const handleDdWrong = useCallback(() => {
    awardPoints(ddPlayerId, -ddWagerAmount);
    dismissQuestion();
  }, [ddPlayerId, ddWagerAmount, awardPoints, dismissQuestion]);

  const resetGame = useCallback(() => {
    if (window.confirm('Reset entire game? This clears all scores and creates a new session ID.')) {
      emit('game-reset');
    }
  }, [emit]);

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-blue-950">
        <div className="text-blue-300 text-xl animate-pulse">Connecting to server...</div>
      </div>
    );
  }

  const categories = [...new Set(gameState.questions.map(q => q.category))];
  const values = [...new Set(gameState.questions.map(q => Number(q.value)))].sort((a, b) => a - b);
  const q = gameState.currentQuestion;

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
          {gameState.questions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-blue-700 rounded-xl">
              <div className="text-center">
                <div className="text-5xl mb-4">🎯</div>
                <p className="text-xl text-blue-300 mb-2">No questions loaded</p>
                <Link to="/settings" className="text-yellow-400 underline hover:text-yellow-300">
                  Upload questions in Settings →
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="grid gap-1"
              style={{ gridTemplateColumns: `repeat(${categories.length}, 1fr)` }}
            >
              {categories.map(cat => (
                <div
                  key={cat}
                  className="bg-blue-800 text-yellow-300 font-black text-center px-2 py-3 rounded-lg text-sm uppercase tracking-wide leading-tight cell-shadow"
                >
                  {cat}
                </div>
              ))}

              {values.map(value =>
                categories.map(cat => {
                  const question = gameState.questions.find(
                    qst => qst.category === cat && Number(qst.value) === value
                  );
                  const cellKey = `${cat}-${value}`;
                  const played = gameState.playedCells.includes(cellKey);
                  const isDD = question?.dailyDouble;

                  if (!question) {
                    return <div key={cellKey} className="bg-blue-900 rounded-lg p-6 opacity-30" />;
                  }

                  return (
                    <button
                      key={cellKey}
                      onClick={() => !played && selectQuestion(cat, value)}
                      disabled={played}
                      className={`
                        rounded-lg p-4 text-center font-black text-2xl transition-all duration-150
                        cell-shadow select-none
                        ${played
                          ? 'bg-blue-900 text-blue-900 cursor-default'
                          : 'bg-blue-700 text-yellow-400 hover:bg-blue-600 active:scale-95 cursor-pointer hover:text-yellow-300'
                        }
                        ${isDD && !played ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-blue-950' : ''}
                      `}
                    >
                      {played ? '' : `$${value}`}
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-56 flex flex-col gap-3">
          <QRCodeDisplay url={joinUrl} sessionId={gameState.sessionId} />
          <Scoreboard
            players={gameState.players}
            onAwardPoints={awardPoints}
            currentQuestion={q}
          />
        </div>
      </div>

      {/* Question overlay */}
      {q && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-blue-900 border border-blue-600 rounded-2xl p-8 max-w-2xl w-full shadow-2xl">

            {/* ── DAILY DOUBLE: Wager phase ── */}
            {q.dailyDouble && ddPhase === 'wager' ? (
              <>
                <div className="text-center mb-6">
                  <span className="bg-yellow-400 text-blue-900 font-black px-6 py-1.5 rounded-full text-xl tracking-widest animate-pulse">
                    ⭐ DAILY DOUBLE ⭐
                  </span>
                </div>

                <div className="text-blue-300 text-center text-sm uppercase tracking-widest mb-6">
                  {q.category} &mdash; ${q.value}
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-blue-300 text-sm font-semibold uppercase tracking-wide mb-1.5">
                      Wagering Player
                    </label>
                    <select
                      value={ddPlayerId}
                      onChange={e => setDdPlayerId(e.target.value)}
                      className="w-full bg-blue-800 border border-blue-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">— Select a player —</option>
                      {gameState.players.map(p => (
                        <option key={p.socketId} value={p.socketId}>
                          {p.name} (${p.score.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-blue-300 text-sm font-semibold uppercase tracking-wide mb-1.5">
                      Wager Amount
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 1000"
                      value={ddWager}
                      onChange={e => setDdWager(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleDdLockIn()}
                      className="w-full bg-blue-800 border border-blue-600 text-white rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-yellow-400 placeholder-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={handleDdLockIn}
                    disabled={!ddPlayerId || ddWagerAmount <= 0}
                    className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-black px-6 py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Lock In Wager &amp; Reveal Question
                  </button>
                  <button
                    onClick={dismissQuestion}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-5 py-3 rounded-xl transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            ) : (
              /* ── Regular question OR Daily Double question phase ── */
              <>
                {q.dailyDouble && (
                  <div className="text-center mb-4 space-y-2">
                    <span className="bg-yellow-400 text-blue-900 font-black px-6 py-1 rounded-full text-lg tracking-widest">
                      ⭐ DAILY DOUBLE ⭐
                    </span>
                    <div className="bg-blue-800 border border-yellow-500/40 rounded-xl px-4 py-2 flex justify-center gap-6 text-sm">
                      <span className="text-blue-300">
                        Player:{' '}
                        <span className="text-yellow-300 font-bold">
                          {gameState.players.find(p => p.socketId === ddPlayerId)?.name ?? '—'}
                        </span>
                      </span>
                      <span className="text-blue-300">
                        Wager:{' '}
                        <span className="text-yellow-300 font-bold">
                          ${ddWagerAmount.toLocaleString()}
                        </span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="text-blue-300 text-center text-sm uppercase tracking-widest mb-3">
                  {q.category} &mdash; ${q.value}
                </div>

                <div className="text-white text-center text-2xl font-semibold leading-snug min-h-20 flex items-center justify-center mb-6">
                  {q.question}
                </div>

                {q.answerRevealed && (
                  <div className="bg-blue-800 border border-blue-600 rounded-xl p-4 mb-5 text-center">
                    <div className="text-blue-400 text-xs uppercase tracking-widest mb-1">Answer</div>
                    <div className="text-yellow-300 text-xl font-bold">{q.answer}</div>
                  </div>
                )}

                {!q.dailyDouble && gameState.buzzedPlayer && (
                  <div className="bg-yellow-400 text-blue-900 rounded-xl p-3 mb-4 text-center font-black text-xl">
                    🔔 {gameState.buzzedPlayer.name} buzzed in!
                  </div>
                )}

                <div className="flex flex-wrap gap-3 justify-center">
                  {!q.answerRevealed && (
                    <button
                      onClick={revealAnswer}
                      className="bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-black px-5 py-2.5 rounded-xl transition-colors"
                    >
                      Reveal Answer
                    </button>
                  )}

                  {q.dailyDouble ? (
                    <>
                      <button
                        onClick={handleDdCorrect}
                        className="bg-green-600 hover:bg-green-500 text-white font-black px-5 py-2.5 rounded-xl transition-colors"
                      >
                        ✓ Correct (+${ddWagerAmount.toLocaleString()})
                      </button>
                      <button
                        onClick={handleDdWrong}
                        className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2.5 rounded-xl transition-colors"
                      >
                        ✗ Wrong (−${ddWagerAmount.toLocaleString()})
                      </button>
                    </>
                  ) : gameState.buzzedPlayer ? (
                    <>
                      <button
                        onClick={handleCorrect}
                        className="bg-green-600 hover:bg-green-500 text-white font-black px-5 py-2.5 rounded-xl transition-colors"
                      >
                        ✓ Correct (+${q.value})
                      </button>
                      <button
                        onClick={handleWrong}
                        className="bg-red-600 hover:bg-red-500 text-white font-black px-5 py-2.5 rounded-xl transition-colors"
                      >
                        ✗ Wrong (−${q.value})
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={unlockBuzzers}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
                    >
                      Reset Buzzers
                    </button>
                  )}

                  <button
                    onClick={dismissQuestion}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
