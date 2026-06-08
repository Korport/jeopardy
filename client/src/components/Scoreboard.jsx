import { useState } from 'react';

export default function Scoreboard({ players = [], onAwardPoints, currentQuestion }) {
  const [customAmounts, setCustomAmounts] = useState({});
  const sorted = [...players].sort((a, b) => b.score - a.score);

  function handleCustomAward(playerId, sign) {
    const amt = parseInt(customAmounts[playerId] || '0', 10);
    if (isNaN(amt) || amt === 0) return;
    onAwardPoints(playerId, sign * amt);
    setCustomAmounts(prev => ({ ...prev, [playerId]: '' }));
  }

  return (
    <div className="bg-blue-900 rounded-xl p-4 flex flex-col gap-2 flex-1 overflow-y-auto">
      <h3 className="text-yellow-400 font-bold uppercase tracking-widest text-xs mb-1">
        Scoreboard
      </h3>

      {sorted.length === 0 ? (
        <p className="text-blue-400 text-sm italic">No players connected</p>
      ) : (
        sorted.map((player, idx) => (
          <div key={player.socketId} className="border-b border-blue-700 pb-2 last:border-0">
            <div className="flex justify-between items-center">
              <span className="text-white text-sm font-semibold truncate max-w-[120px]">
                {idx + 1}. {player.name}
              </span>
              <span className={`font-black text-sm tabular-nums ${player.score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                {player.score < 0 ? '-' : ''}${Math.abs(player.score).toLocaleString()}
              </span>
            </div>

            {currentQuestion && (
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => onAwardPoints(player.socketId, currentQuestion.value)}
                  className="flex-1 text-xs bg-green-700 hover:bg-green-600 active:bg-green-800 px-1 py-0.5 rounded font-bold"
                >
                  +${currentQuestion.value}
                </button>
                <button
                  onClick={() => onAwardPoints(player.socketId, -currentQuestion.value)}
                  className="flex-1 text-xs bg-red-700 hover:bg-red-600 active:bg-red-800 px-1 py-0.5 rounded font-bold"
                >
                  -${currentQuestion.value}
                </button>
              </div>
            )}

            <div className="flex gap-1 mt-1">
              <input
                type="number"
                placeholder="Custom"
                value={customAmounts[player.socketId] || ''}
                onChange={e => setCustomAmounts(prev => ({ ...prev, [player.socketId]: e.target.value }))}
                className="w-full text-xs bg-blue-800 border border-blue-600 rounded px-1 py-0.5 text-white"
              />
              <button onClick={() => handleCustomAward(player.socketId, 1)} className="text-xs bg-green-800 hover:bg-green-700 px-1.5 py-0.5 rounded font-bold">+</button>
              <button onClick={() => handleCustomAward(player.socketId, -1)} className="text-xs bg-red-800 hover:bg-red-700 px-1.5 py-0.5 rounded font-bold">-</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
