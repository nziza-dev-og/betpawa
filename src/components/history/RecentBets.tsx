
"use client";

import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

export function RecentBets() {
  const { recentBets } = useGame();
  
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg font-semibold text-foreground">Your Recent Bets</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 pb-4">
        {recentBets.length === 0 ? (
          <div className="text-muted-foreground text-sm italic py-4 text-center">No recent bets</div>
        ) : (
          <ScrollArea className="h-[200px] w-full pr-3">
            <div className="space-y-2">
              {recentBets.map((bet) => (
                <div 
                  key={bet.id}
                  className={`p-3 rounded-md border text-sm ${
                    bet.status === 'won' 
                      ? 'border-primary/50 bg-primary/10' 
                      : 'border-destructive/50 bg-destructive/10'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-card-foreground">
                        {bet.amount.toFixed(2)} <span className="text-xs opacity-80">COINS</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(bet.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${
                        bet.status === 'won' ? 'text-primary' : 'text-destructive'
                      }`}>
                        {bet.status === 'won' ? '+' : ''}{bet.profit?.toFixed(2)} <span className="text-xs opacity-80">COINS</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {bet.status === 'won' && bet.cashoutAt ? `Cashed at ${bet.cashoutAt.toFixed(2)}x` : 
                         bet.status === 'lost' && bet.crashMultiplier ? `Crashed at ${bet.crashMultiplier.toFixed(2)}x` :
                         `Multiplier: ${(bet.cashoutAt || bet.crashMultiplier || 0).toFixed(2)}x`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
