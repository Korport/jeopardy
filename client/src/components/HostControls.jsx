// Board grid + question overlay + Daily Double flow, shared by the main
// HostBoard screen and a designated player's phone (private host controls).
//
// `compact` shrinks sizing for a phone screen. `privateAnswer` is true only
// on the phone view: the answer is shown to the host at all times so they
// can judge a spoken response, without ever revealing it on the shared board
// (that still only happens once `revealAnswer` is emitted).
export default function HostControls({ gameState, actions, compact = false, privateAnswer = false }) {
  const {
    selectQuestion, dismissQuestion, revealAnswer, unlockBuzzers, emit,
    handleCorrect, handleWrong,
    ddPhase, ddPlayerId, setDdPlayerId, ddWager, setDdWager, ddWagerAmount,
    handleDdLockIn, handleDdCorrect, handleDdWrong,
  } = actions;

  const categories = [...new Set(gameState.questions.map(q => q.category))];
  const values = [...new Set(gameState.questions.map(q => Number(q.value)))].sort((a, b) => a - b);
  const q = gameState.currentQuestion;

  const cellText = compact ? 'text-base p-2' : 'text-2xl p-4';
  const catText = compact ? 'text-xs px-1 py-2' : 'text-sm px-2 py-3';

  return (
    <>
      {gameState.questions.length === 0 ? (
        <div className="flex-1 flex items-center justify-center border-2 border-dashed border-blue-700 rounded-xl p-8">
          <div className="text-center">
            <div className="text-5xl mb-4">🎯</div>
            <p className="text-blue-300">No questions loaded yet</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div
            className="grid gap-1 min-w-full"
            style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(${compact ? '72px' : '0'}, 1fr))` }}
          >
            {categories.map(cat => (
              <div
                key={cat}
                className={`bg-blue-800 text-yellow-300 font-black text-center rounded-lg uppercase tracking-wide leading-tight cell-shadow ${catText}`}
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
                  return <div key={cellKey} className="bg-blue-900 rounded-lg opacity-30" style={{ padding: compact ? '0.5rem' : '1.5rem' }} />;
                }

                return (
                  <button
                    key={cellKey}
                    onClick={() => !played && selectQuestion(cat, value)}
                    disabled={played}
                    className={`
                      rounded-lg text-center font-black transition-all duration-150
                      cell-shadow select-none ${cellText}
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
        </div>
      )}

      {/* Question overlay */}
      {q && (
        <div className={compact ? 'mt-3' : 'fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4'}>
          <div className={compact
            ? 'bg-blue-900 border border-blue-600 rounded-2xl p-4'
            : 'bg-blue-900 border border-blue-600 rounded-2xl p-8 max-w-2xl w-full shadow-2xl'
          }>

            {/* ── DAILY DOUBLE: Wager phase ── */}
            {q.dailyDouble && ddPhase === 'wager' ? (
              <>
                <div className="text-center mb-4">
                  <span className="bg-yellow-400 text-blue-900 font-black px-4 py-1 rounded-full text-sm tracking-widest animate-pulse">
                    ⭐ DAILY DOUBLE ⭐
                  </span>
                </div>

                <div className="text-blue-300 text-center text-xs uppercase tracking-widest mb-4">
                  {q.category} &mdash; ${q.value}
                </div>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">
                      Wagering Player
                    </label>
                    <select
                      value={ddPlayerId}
                      onChange={e => setDdPlayerId(e.target.value)}
                      className="w-full bg-blue-800 border border-blue-600 text-white rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-yellow-400"
                    >
                      <option value="">— Select a player —</option>
                      {gameState.players.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (${p.score.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-blue-300 text-xs font-semibold uppercase tracking-wide mb-1">
                      Wager Amount
                    </label>
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 1000"
                      value={ddWager}
                      onChange={e => setDdWager(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleDdLockIn()}
                      className="w-full bg-blue-800 border border-blue-600 text-white rounded-xl px-3 py-2.5 text-base focus:outline-none focus:border-yellow-400 placeholder-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={handleDdLockIn}
                    disabled={!ddPlayerId || ddWagerAmount <= 0}
                    className="bg-yellow-400 hover:bg-yellow-300 text-blue-900 font-black px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
                  >
                    Lock In Wager &amp; Reveal Question
                  </button>
                  <button
                    onClick={dismissQuestion}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2.5 rounded-xl transition-colors text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            ) : (
              /* ── Regular question OR Daily Double question phase ── */
              <>
                {q.dailyDouble && (
                  <div className="text-center mb-3 space-y-2">
                    <span className="bg-yellow-400 text-blue-900 font-black px-4 py-1 rounded-full text-xs tracking-widest">
                      ⭐ DAILY DOUBLE ⭐
                    </span>
                    <div className="bg-blue-800 border border-yellow-500/40 rounded-xl px-3 py-2 flex justify-center gap-4 text-xs">
                      <span className="text-blue-300">
                        Player:{' '}
                        <span className="text-yellow-300 font-bold">
                          {gameState.players.find(p => p.id === ddPlayerId)?.name ?? '—'}
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

                <div className="text-blue-300 text-center text-xs uppercase tracking-widest mb-2">
                  {q.category} &mdash; ${q.value}
                </div>

                <div className={`text-white text-center font-semibold leading-snug flex items-center justify-center mb-4 ${compact ? 'text-lg min-h-14' : 'text-2xl min-h-20'}`}>
                  {q.question}
                </div>

                {(q.answerRevealed || privateAnswer) && (
                  <div className={`bg-blue-800 border rounded-xl p-3 mb-4 text-center ${privateAnswer && !q.answerRevealed ? 'border-yellow-500/50' : 'border-blue-600'}`}>
                    <div className="text-blue-400 text-xs uppercase tracking-widest mb-1">
                      {privateAnswer && !q.answerRevealed ? 'Answer (only you see this)' : 'Answer'}
                    </div>
                    <div className="text-yellow-300 text-lg font-bold">{q.answer}</div>
                  </div>
                )}

                {!q.dailyDouble && gameState.buzzedPlayer && (
                  <div className="bg-yellow-400 text-blue-900 rounded-xl p-2.5 mb-3 text-center font-black text-base">
                    🔔 {gameState.buzzedPlayer.name} buzzed in!
                  </div>
                )}

                <div className="flex flex-wrap gap-2 justify-center">
                  {!q.answerRevealed && (
                    <button
                      onClick={revealAnswer}
                      className="bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-black px-4 py-2 rounded-xl transition-colors text-sm"
                    >
                      Reveal Answer{privateAnswer ? ' (on board)' : ''}
                    </button>
                  )}

                  {q.dailyDouble ? (
                    <>
                      <button
                        onClick={handleDdCorrect}
                        className="bg-green-600 hover:bg-green-500 text-white font-black px-4 py-2 rounded-xl transition-colors text-sm"
                      >
                        ✓ Correct (+${ddWagerAmount.toLocaleString()})
                      </button>
                      <button
                        onClick={handleDdWrong}
                        className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl transition-colors text-sm"
                      >
                        ✗ Wrong (−${ddWagerAmount.toLocaleString()})
                      </button>
                    </>
                  ) : gameState.buzzedPlayer ? (
                    <>
                      <button
                        onClick={handleCorrect}
                        className="bg-green-600 hover:bg-green-500 text-white font-black px-4 py-2 rounded-xl transition-colors text-sm"
                      >
                        ✓ Correct (+${q.value})
                      </button>
                      <button
                        onClick={handleWrong}
                        className="bg-red-600 hover:bg-red-500 text-white font-black px-4 py-2 rounded-xl transition-colors text-sm"
                      >
                        ✗ Wrong (−${q.value})
                      </button>
                    </>
                  ) : gameState.buzzersLocked ? (
                    <button
                      onClick={unlockBuzzers}
                      className="bg-green-600 hover:bg-green-500 text-white font-black px-6 py-2.5 rounded-xl transition-colors text-base animate-pulse"
                    >
                      🔓 Open Buzzers
                    </button>
                  ) : (
                    <button
                      onClick={() => emit('lock-buzzers')}
                      className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-xl transition-colors text-sm"
                    >
                      🔒 Lock Buzzers
                    </button>
                  )}

                  <button
                    onClick={dismissQuestion}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-bold px-4 py-2 rounded-xl transition-colors text-sm"
                  >
                    Dismiss
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
