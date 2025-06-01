"use client";

import { useGame } from '@/contexts/GameContext';
import { GameDisplay } from '@/components/game/GameDisplay';
import { Skeleton } from "@/components/ui/skeleton";

const GameCanvas = () => {
  const gameContext = useGame();

  if (!gameContext) {
    // This can happen briefly while GameProvider is initializing
    return (
      <Skeleton className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading Game Display...</p>
      </Skeleton>
    );
  }

  const { gameState, timeRemaining } = gameContext;

  return (
    <GameDisplay
      multiplier={gameState.multiplier}
      gamePhase={gameState.status}
      timeRemaining={timeRemaining}
    />
  );
};

export default GameCanvas;
