
"use client";

import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function GameHistory() {
  const { gameState } = useGame();
  
  const getMultiplierColor = (point: number) => {
    if (point < 1.2) return 'bg-red-500/70 text-white'; // More vibrant red for very low
    if (point < 2) return 'bg-orange-500/70 text-white'; // Orange for low
    if (point < 5) return 'bg-sky-500/70 text-white'; // Sky blue for medium
    if (point < 10) return 'bg-purple-500/70 text-white'; // Purple for high
    return 'bg-pink-500/80 text-white'; // Pink for very high
  };

  return (
    <Card className="shadow-md border-border/30">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground">Round History</CardTitle>
         <CardDescription className="text-sm text-muted-foreground">
            Recent crash points from previous rounds.
          </CardDescription>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {gameState.lastCrashPoints.length === 0 ? (
          <div className="text-muted-foreground text-sm italic py-4 text-center">No previous rounds yet. Play a game!</div>
        ) : (
          <ScrollArea className="h-[80px] w-full pr-2">
            <div className="flex flex-row flex-wrap gap-2">
              {gameState.lastCrashPoints.map((point, index) => (
                <div 
                  key={index}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium shadow-sm ${getMultiplierColor(point)}`}
                >
                  {point.toFixed(2)}x
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

    