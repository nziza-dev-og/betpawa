
"use client";

import { Card, CardContent } from "@/components/ui/card";

interface ActiveBetProps {
  betId: string; // Or however you identify bets
  amount: number;
  // You can add other props like userName if needed
}

export function ActiveBet({ betId, amount }: ActiveBetProps) {
  // Truncate betId for display if it's too long
  const displayId = betId.length > 10 ? `...${betId.slice(-6)}` : betId;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-primary/60 shadow-md">
      <CardContent className="p-2 text-xs">
        <div className="flex justify-between items-center">
          <span className="text-muted-foreground">ID: {displayId}</span>
          <span className="font-semibold text-primary">{amount.toFixed(2)} <span className="text-xs opacity-80">COINS</span></span>
        </div>
      </CardContent>
    </Card>
  );
}
