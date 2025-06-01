
"use client";

import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function GameHistory() {
  const { gameState } = useGame();
  
  const getMultiplierColor = (point: number) => {
    if (point < 1.2) return 'bg-destructive/30 text-destructive';
    if (point < 2) return 'bg-accent/30 text-accent'; // Orange-like
    if (point < 10) return 'bg-primary/30 text-primary'; // Sky blue for medium
    return 'bg-primary/50 text-primary-foreground'; // Stronger primary for high success
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground">Crash History</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {gameState.lastCrashPoints.length === 0 ? (
          <div className="text-muted-foreground text-sm italic py-4 text-center">No previous rounds yet</div>
        ) : (
          <ScrollArea className="h-[80px] w-full">
            <div className="flex flex-wrap gap-2">
              {gameState.lastCrashPoints.map((point, index) => (
                <div 
                  key={index}
                  className={`px-2 py-1 rounded-md text-xs font-medium ${getMultiplierColor(point)}`}
                >
                  {point.toFixed(2)}x
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        <CardDescription className="mt-4 text-sm text-muted-foreground space-y-1 pt-3 border-t border-border">
          <p>
            Skytrax is a multiplier game where the multiplier increases from 1.00x until the plane "flies away" (crashes).
          </p>
          <p>
            The goal is to cash out before the crash to win! The longer you wait, the higher the potential multiplier.
          </p>
        </CardDescription>
      </CardContent>
    </Card>
  );
};
