import { useState, useCallback, useEffect } from 'react';

// Shared host-control logic: question selection, buzzers, scoring, and the
// Daily Double wager flow. Used by the main HostBoard screen and by a
// designated player's phone (see HostControls + PlayerView).
//
// The Daily Double wager (which player, how much) is server-authoritative
// (gameState.dd) once locked in, so the board and the host phone always
// agree on it even though they're separate devices with separate instances
// of this hook. `ddPlayerId`/`ddWager` here are just the local, in-progress
// selection for the wager *input form* — they only matter on whichever
// screen is actively being used to lock the wager in.
export function useHostActions(socket, gameState) {
  const [ddPlayerId, setDdPlayerId] = useState('');
  const [ddWager, setDdWager] = useState('');

  // Reset the local wager form whenever a question opens or closes
  useEffect(() => {
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

  // Daily Double: local input state for the wager form...
  const ddWagerAmount = parseInt(ddWager, 10) || 0;

  const handleDdLockIn = useCallback(() => {
    if (!ddPlayerId || ddWagerAmount <= 0) return;
    emit('dd-lock-in', { playerId: ddPlayerId, wager: ddWagerAmount });
  }, [ddPlayerId, ddWagerAmount, emit]);

  // ...but correct/wrong always use the server-confirmed wager, since the
  // lock-in may have happened on the other screen.
  const ddPhase = gameState?.dd?.phase ?? 'wager';
  const ddLockedPlayerId = gameState?.dd?.playerId ?? '';
  const ddLockedWager = gameState?.dd?.wager ?? 0;

  const handleDdCorrect = useCallback(() => {
    awardPoints(ddLockedPlayerId, ddLockedWager);
    dismissQuestion();
  }, [ddLockedPlayerId, ddLockedWager, awardPoints, dismissQuestion]);

  const handleDdWrong = useCallback(() => {
    awardPoints(ddLockedPlayerId, -ddLockedWager);
    dismissQuestion();
  }, [ddLockedPlayerId, ddLockedWager, awardPoints, dismissQuestion]);

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
    ddLockedPlayerId,
    ddLockedWager,
    handleDdLockIn,
    handleDdCorrect,
    handleDdWrong,
  };
}
