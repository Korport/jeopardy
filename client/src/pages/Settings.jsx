import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Papa from 'papaparse';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? window.location.origin;

export default function Settings() {
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [parsedQuestions, setParsedQuestions] = useState([]);
  const [parseError, setParseError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const s = io(SERVER_URL);
    setSocket(s);
    s.on('game-state', setGameState);
    return () => s.disconnect();
  }, []);

  function parseFile(file) {
    if (!file) return;
    setParseError(null);
    setSaved(false);
    setParsedQuestions([]);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim(),
      complete: ({ data }) => {
        try {
          const questions = data.map((row, i) => {
            const cat = (row.Category ?? row.category ?? '').trim();
            const val = parseInt(row.Value ?? row.value ?? '', 10);
            const question = (row.Question ?? row.question ?? '').trim();
            const answer = (row.Answer ?? row.answer ?? '').trim();
            const ddRaw = (
              row.DailyDouble ?? row.dailydouble ?? row['Daily Double'] ?? 'false'
            ).toString().toLowerCase().trim();

            if (!cat) throw new Error(`Row ${i + 1}: Missing Category`);
            if (isNaN(val)) throw new Error(`Row ${i + 1}: Invalid Value "${row.Value ?? row.value}"`);
            if (!question) throw new Error(`Row ${i + 1}: Missing Question`);

            return { category: cat, value: val, question, answer, dailyDouble: ddRaw === 'true' };
          });
          setParsedQuestions(questions);
        } catch (err) {
          setParseError(err.message);
        }
      },
      error: err => setParseError(err.message),
    });
  }

  function handleFilePick(e) { parseFile(e.target.files[0]); }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    parseFile(e.dataTransfer.files[0]);
  }

  function saveQuestions() {
    socket?.emit('upload-questions', { questions: parsedQuestions });
    setSaved(true);
  }

  function resetScores() {
    if (window.confirm('Reset all player scores to $0?')) socket?.emit('reset-scores');
  }

  function resetGame() {
    if (window.confirm('Full reset: clear all scores, kick all players, generate a new session ID?')) {
      socket?.emit('game-reset');
    }
  }

  const joinUrl = gameState
    ? import.meta.env.DEV
      ? `http://${gameState.localIP}:5173/join/${gameState.sessionId}`
      : `${window.location.origin}/join/${gameState.sessionId}`
    : '';

  return (
    <div className="min-h-screen bg-blue-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black text-yellow-400 tracking-wide">Settings</h1>
          <Link to="/" className="bg-blue-700 hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold transition-colors">
            ← Host Board
          </Link>
        </div>

        {gameState && (
          <div className="bg-blue-900 rounded-xl p-5 border border-blue-700">
            <h2 className="text-lg font-bold mb-3 text-yellow-300">Session Info</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <dt className="text-blue-400">Session ID</dt>
              <dd className="font-mono font-bold text-yellow-300">{gameState.sessionId}</dd>
              <dt className="text-blue-400">Players connected</dt>
              <dd>{gameState.players?.length ?? 0}</dd>
              <dt className="text-blue-400">Questions loaded</dt>
              <dd>{gameState.questions?.length ?? 0}</dd>
              <dt className="text-blue-400">Join URL</dt>
              <dd className="text-xs text-blue-300 break-all">{joinUrl}</dd>
            </dl>
          </div>
        )}

        <div className="bg-blue-900 rounded-xl p-6 border border-blue-700 space-y-4">
          <h2 className="text-xl font-bold">Upload Questions (CSV)</h2>

          <div className="bg-blue-800 rounded-lg p-4 text-sm text-blue-200">
            <p className="font-semibold mb-1 text-blue-100">Expected CSV columns:</p>
            <code className="block font-mono text-xs whitespace-pre text-green-300">
{`Category,Value,Question,Answer,DailyDouble
Science,200,"What element has atomic number 79?","Gold",false
History,400,"This war ended in 1945","World War II",true`}
            </code>
          </div>

          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              dragging ? 'border-yellow-400 bg-blue-800' : 'border-blue-600 hover:border-blue-400'
            }`}
          >
            <p className="text-blue-300 mb-3">Drag &amp; drop a CSV file here, or</p>
            <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2 rounded-lg transition-colors">
              Browse File
              <input type="file" accept=".csv,text/csv" onChange={handleFilePick} className="hidden" />
            </label>
          </div>

          {parseError && (
            <div className="bg-red-900 border border-red-600 rounded-lg p-3 text-red-200 text-sm">
              <strong>Parse error:</strong> {parseError}
            </div>
          )}

          {parsedQuestions.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-green-400 font-semibold">{parsedQuestions.length} questions parsed</span>
                <button
                  onClick={saveQuestions}
                  className={`font-bold px-6 py-2 rounded-lg transition-colors ${
                    saved ? 'bg-green-700 text-green-200 cursor-default' : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                >
                  {saved ? '✓ Saved to Game!' : 'Save to Game'}
                </button>
              </div>

              <div className="overflow-x-auto rounded-lg border border-blue-700 max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-blue-800 text-blue-200">
                    <tr>
                      <th className="text-left p-2 font-semibold">Category</th>
                      <th className="text-left p-2 font-semibold">Value</th>
                      <th className="text-left p-2 font-semibold">Question</th>
                      <th className="text-left p-2 font-semibold">Answer</th>
                      <th className="text-left p-2 font-semibold">DD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedQuestions.map((q, i) => (
                      <tr key={i} className="border-t border-blue-800 hover:bg-blue-800">
                        <td className="p-2 text-yellow-300 font-medium">{q.category}</td>
                        <td className="p-2 font-mono">${q.value}</td>
                        <td className="p-2 text-blue-200 max-w-xs truncate">{q.question}</td>
                        <td className="p-2 text-green-300">{q.answer}</td>
                        <td className="p-2">{q.dailyDouble ? '⭐' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-900 rounded-xl p-6 border border-blue-700 space-y-4">
          <h2 className="text-xl font-bold">Game Controls</h2>
          <div className="flex gap-4 flex-wrap">
            <button onClick={resetScores} className="bg-yellow-700 hover:bg-yellow-600 font-bold px-6 py-3 rounded-xl transition-colors">
              Reset Scores
            </button>
            <button onClick={resetGame} className="bg-red-800 hover:bg-red-700 font-bold px-6 py-3 rounded-xl transition-colors">
              Full Game Reset
            </button>
          </div>
          <p className="text-blue-400 text-sm">
            <strong>Reset Scores</strong> sets all scores to $0 but keeps players connected.
            <br />
            <strong>Full Reset</strong> also disconnects players and generates a new session ID.
          </p>
        </div>
      </div>
    </div>
  );
}
