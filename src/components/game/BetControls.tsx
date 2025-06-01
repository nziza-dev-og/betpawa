"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

interface BetControlsProps {
  gamePhase: 'idle' | 'betting' | 'playing' | 'crashed' | 'starting';
  onBet: (amount: number) => Promise<void>;
  onCashout: () => Promise<void>;
  currentBetAmount: number | null;
  currentMultiplier: number;
  walletBalance: number | null;
}

export function BetControls({ 
  gamePhase, 
  onBet, 
  onCashout, 
  currentBetAmount,
  currentMultiplier,
  walletBalance
}: BetControlsProps) {
  const [betAmountInput, setBetAmountInput] = useState<string>("10");
  const [isBetting, setIsBetting] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const { toast } = useToast();

  const canBet = gamePhase === 'betting' && currentBetAmount === null;
  const canCashout = gamePhase === 'playing' && currentBetAmount !== null;
  
  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*$/.test(value)) { // Allow only numbers
      setBetAmountInput(value);
    }
  };

  const handleBet = async () => {
    const amount = parseInt(betAmountInput, 10);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid Bet", description: "Please enter a valid bet amount.", variant: "destructive" });
      return;
    }
    if (walletBalance === null || amount > walletBalance) {
      toast({ title: "Insufficient Funds", description: "You don't have enough coins to place this bet.", variant: "destructive" });
      return;
    }
    setIsBetting(true);
    try {
      await onBet(amount);
    } finally {
      setIsBetting(false);
    }
  };

  const handleCashout = async () => {
    setIsCashingOut(true);
    try {
      await onCashout();
    } finally {
      setIsCashingOut(false);
    }
  };

  useEffect(() => {
    // Reset input or states if needed when gamePhase changes
    if (gamePhase === 'idle' || gamePhase === 'betting') {
      setIsCashingOut(false);
    }
    if (gamePhase === 'idle') {
      setIsBetting(false);
    }
  }, [gamePhase]);

  const potentialWinnings = currentBetAmount !== null ? (currentBetAmount * currentMultiplier).toFixed(2) : "0.00";

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-center text-foreground">
          Place Your Bet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentBetAmount === null && (gamePhase === 'betting' || gamePhase === 'idle' || gamePhase === 'starting') && (
          <div className="flex items-center space-x-2">
            <DollarSign className="h-6 w-6 text-muted-foreground" />
            <Input
              type="text" // Use text to control input via regex
              value={betAmountInput}
              onChange={handleBetAmountChange}
              placeholder="Bet Amount"
              className="text-lg"
              disabled={!canBet || isBetting}
              pattern="\d*"
            />
          </div>
        )}

        {currentBetAmount !== null && (
          <div className="text-center p-4 bg-secondary rounded-md">
            <p className="text-sm text-secondary-foreground">Your Bet:</p>
            <p className="text-2xl font-bold text-primary">{currentBetAmount} <span className="text-sm">COINS</span></p>
            {gamePhase === 'playing' && (
              <p className="text-sm text-accent mt-1">Potential Win: {potentialWinnings} COINS</p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-3">
        {canBet && (
          <Button 
            onClick={handleBet} 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-lg py-6"
            disabled={isBetting || !betAmountInput || parseInt(betAmountInput) <=0 }
          >
            {isBetting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Bet {betAmountInput && parseInt(betAmountInput) > 0 ? `${betAmountInput} COINS` : ''}
          </Button>
        )}
        {canCashout && (
          <Button 
            onClick={handleCashout} 
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-lg py-6"
            disabled={isCashingOut}
          >
            {isCashingOut && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Cashout @ {currentMultiplier.toFixed(2)}x ({potentialWinnings} COINS)
            <CheckCircle className="ml-2 h-5 w-5" />
          </Button>
        )}
        {!canBet && !canCashout && currentBetAmount === null && (
            <p className="text-muted-foreground text-center">
                {gamePhase === 'playing' ? "Wait for next round to bet." : 
                 gamePhase === 'crashed' ? "Round over. Wait for next round." :
                 gamePhase === 'starting' ? "Round starting soon..." :
                 "Betting closed."}
            </p>
        )}
         {!canBet && !canCashout && currentBetAmount !== null && gamePhase !== 'playing' && (
            <p className="text-muted-foreground text-center">
                {gamePhase === 'crashed' ? `Round Over. You bet ${currentBetAmount} COINS.` : `Waiting for round to start...`}
            </p>
        )}
      </CardFooter>
    </Card>
  );
}
