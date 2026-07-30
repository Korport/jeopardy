import { useState, useCallback, useEffect } from 'react';

// Shared host-control logic: question selection, buzzers, scoring, and the
// Daily Double wager flow. Used by the main HostBoard screen and by a
// designated player's phone (see HostControls + PlayerView).
export function useHostActions(socket, gameState) {
  const [ddPhase, setDdPhase] = useState('wager'); // 'wager' | 'question'
  const [ddPlayerId, setDdPlayerId] = useState('');
  const [ddWager, setDdWager] = useState('');

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
  const lockBuzzers = useCallback(() => emit('lock-buzzers'), [emit]);
  const awardPoints = useCallback(
    (playerId, points) => emit('award-points', { playerId, points }),
    [emit]
  );

  // Regular (non-DD) correct/wrong — uses buzzer player + question face value
  const handleCorrect = useCallback(() => {
    if (!gameState?.buzzedPlayer || !gameState?.currentQuestion) return;
    awardPoints(gameState.buzzedPlayer.playerId, gameState.currentQuestion.value);
    dismissQuestion();
  }, [gameState, awardPoints, dismissQuestion]);

  const handleWrong = useCallback(() => {
    if (!gameState?.buzzedPlayer || !gameState?.currentQuestion) return;
    awardPoints(gameState.buzzedPlayer.playerId, -gameState.currentQuestion.value);
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

  const resetGame = useCallback(() => emit('game-reset'), [emit]);

  return {
    emit,
    selectQuestion,
    dismissQuestion,
    revealAnswer,
    unlockBuzzers,
    lockBuzzers,
    awardPoints,
    handleCorrect,
    handleWrong,
    resetGame,
    ddPhase,
    ddPlayerId,
    setDdPlayerId,
    ddWager,
    setDdWager,
    ddWagerAmount,
    handleDdLockIn,
    handleDdCorrect,
    handleDdWrong,
  };
}
