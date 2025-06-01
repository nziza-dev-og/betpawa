
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CheckCircle, Loader2, MinusCircle, PlusCircle, Percent } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; // Corrected import
import type { GamePhase } from '@/contexts/GameContext'; // Import GamePhase type

interface BetControlsProps {
  gamePhase: GamePhase; // Use GamePhase type from context
  onBet: (amount: number) => Promise<void>;
  onCashout: () => Promise<void>;
  currentBetAmount: number | null;
  currentMultiplier: number;
  walletBalance: number | null;
  timeRemaining?: number; // For displaying countdown in betting phase
}

const QUICK_BET_AMOUNTS = [10, 25, 50, 100];

export function BetControls({ 
  gamePhase, 
  onBet, 
  onCashout, 
  currentBetAmount,
  currentMultiplier,
  walletBalance,
  timeRemaining
}: BetControlsProps) {
  const [betAmountInput, setBetAmountInput] = useState<string>("10");
  const [isBetting, setIsBetting] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const { toast } = useToast();

  const canBet = gamePhase === 'betting' && currentBetAmount === null;
  const canCashout = gamePhase === 'playing' && currentBetAmount !== null;
  
  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value)) { // Allow decimals up to 2 places
      setBetAmountInput(value);
    }
  };

  const setBetAmount = (amount: number) => {
    setBetAmountInput(amount.toString());
  };

  const modifyBetAmount = (modifier: 'double' | 'half' | 'max') => {
    let currentVal = parseFloat(betAmountInput);
    if (isNaN(currentVal)) currentVal = 0;

    if (modifier === 'double') {
      setBetAmountInput(Math.min(walletBalance ?? 0, currentVal * 2).toFixed(0));
    } else if (modifier === 'half') {
      setBetAmountInput(Math.max(1, currentVal / 2).toFixed(0));
    } else if (modifier === 'max' && walletBalance !== null) {
      setBetAmountInput(walletBalance.toFixed(0));
    }
  }

  const handleBet = async () => {
    const amount = parseFloat(betAmountInput);
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
    if (gamePhase === 'idle' || gamePhase === 'betting') {
      setIsCashingOut(false); // Reset cashing out state
    }
    if (gamePhase === 'idle') {
      setIsBetting(false); // Reset betting state
    }
  }, [gamePhase]);

  const potentialWinnings = currentBetAmount !== null ? (currentBetAmount * currentMultiplier).toFixed(2) : "0.00";

  return (
    <Card className="w-full max-w-md mx-auto shadow-lg border-border">
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-lg font-semibold text-center text-foreground">
          {currentBetAmount === null ? "Place Your Bet" : "Your Active Bet"}
        </CardTitle>
        {gamePhase === 'betting' && timeRemaining !== undefined && (
          <p className="text-center text-sm text-accent font-medium">
            Time to bet: {timeRemaining}s
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3 pt-2 pb-4">
        {currentBetAmount === null && (gamePhase === 'betting' || gamePhase === 'idle' || gamePhase === 'starting') && (
          <>
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                type="text" 
                value={betAmountInput}
                onChange={handleBetAmountChange}
                placeholder="Bet Amount"
                className="text-lg h-12 text-center"
                disabled={!canBet || isBetting}
                pattern="\d*\.?\d{0,2}"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <Button variant="outline" size="sm" onClick={() => modifyBetAmount('half')} disabled={!canBet || isBetting}> <MinusCircle className="mr-1 h-3 w-3"/> Half</Button>
                <Button variant="outline" size="sm" onClick={() => modifyBetAmount('double')} disabled={!canBet || isBetting}><PlusCircle className="mr-1 h-3 w-3"/>Double</Button>
            </div>
            <div className="flex justify-around space-x-1">
              {QUICK_BET_AMOUNTS.map(amount => (
                <Button 
                  key={amount}
                  variant="secondary" 
                  size="sm"
                  className="flex-1 text-xs px-1"
                  onClick={() => setBetAmount(amount)}
                  disabled={!canBet || isBetting || (walletBalance !== null && amount > walletBalance)}
                >
                  {amount}
                </Button>
              ))}
               <Button variant="outline" size="sm" className="flex-1 text-xs px-1" onClick={() => modifyBetAmount('max')} disabled={!canBet || isBetting || walletBalance === null || walletBalance <=0 }>Max</Button>
            </div>
          </>
        )}

        {currentBetAmount !== null && (
          <div className="text-center p-3 bg-secondary rounded-md shadow-inner">
            <p className="text-xs text-secondary-foreground uppercase tracking-wider">Your Bet</p>
            <p className="text-2xl font-bold text-primary">{currentBetAmount.toFixed(2)} <span className="text-sm opacity-80">COINS</span></p>
            {gamePhase === 'playing' && (
              <p className="text-sm text-accent mt-1 font-medium">
                Potential Win: {potentialWinnings} COINS <span className="text-xs">({currentMultiplier.toFixed(2)}x)</span>
              </p>
            )}
             {gamePhase === 'crashed' && (
                <p className="text-sm text-destructive mt-1 font-medium">
                    Round Over. Bet Lost.
                </p>
            )}
            { (gamePhase === 'idle' || gamePhase === 'starting' || gamePhase === 'betting') && (
                 <p className="text-sm text-muted-foreground mt-1">Waiting for round to start...</p>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col space-y-2 p-3 pt-0">
        {canBet && (
          <Button 
            onClick={handleBet} 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-md py-5 shadow-md"
            disabled={isBetting || !betAmountInput || parseFloat(betAmountInput) <=0 || (walletBalance !== null && parseFloat(betAmountInput) > walletBalance) }
          >
            {isBetting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Percent className="mr-2 h-5 w-5"/>}
            Bet {betAmountInput && parseFloat(betAmountInput) > 0 ? `${parseFloat(betAmountInput).toFixed(2)} COINS` : ''}
          </Button>
        )}
        {canCashout && (
          <Button 
            onClick={handleCashout} 
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90 text-md py-5 shadow-md"
            disabled={isCashingOut}
          >
            {isCashingOut && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
            Cashout @ {currentMultiplier.toFixed(2)}x
            <CheckCircle className="ml-2 h-5 w-5" />
          </Button>
        )}
        {!canBet && !canCashout && currentBetAmount === null && (
            <p className="text-muted-foreground text-center text-sm py-3">
                {gamePhase === 'playing' ? "Wait for next round to bet." : 
                 gamePhase === 'crashed' ? "Round over. Preparing next round." :
                 gamePhase === 'starting' ? "Round starting soon..." :
                 gamePhase === 'idle' ? "Waiting for next round..." :
                 "Betting closed."}
            </p>
        )}
      </CardFooter>
    </Card>
  );
}

