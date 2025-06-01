
"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, CheckCircle, Loader2, MinusCircle, PlusCircle, Percent, Zap, Target } from 'lucide-react';
import { useToast } from "@/hooks/use-toast"; 
import type { GamePhase } from '@/contexts/GameContext'; 

interface BetControlsProps {
  gamePhase: GamePhase; 
  onBet: (amount: number) => Promise<void>;
  onCashout: () => Promise<void>;
  currentBetAmount: number | null;
  currentMultiplier: number;
  walletBalance: number | null;
  timeRemaining?: number; 
  isAutoBetEnabled: boolean;
  onAutoBetToggle: (enable: boolean, betAmount?: number) => void;
  currentAutoBetAmount: number;
  isAutoCashoutEnabled: boolean;
  onAutoCashoutToggle: (enable: boolean) => void;
  autoCashoutTarget: number;
  onAutoCashoutTargetChange: (target: number) => void;
}

const QUICK_BET_AMOUNTS = [10, 25, 50, 100];

export function BetControls({ 
  gamePhase, 
  onBet, 
  onCashout, 
  currentBetAmount,
  currentMultiplier,
  walletBalance,
  timeRemaining,
  isAutoBetEnabled,
  onAutoBetToggle,
  currentAutoBetAmount,
  isAutoCashoutEnabled,
  onAutoCashoutToggle,
  autoCashoutTarget,
  onAutoCashoutTargetChange
}: BetControlsProps) {
  const [betAmountInput, setBetAmountInput] = useState<string>(currentAutoBetAmount.toString() || "10");
  const [autoCashoutInput, setAutoCashoutInput] = useState<string>(autoCashoutTarget.toString());
  const [isBetting, setIsBetting] = useState(false);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const { toast } = useToast();

  const canBet = gamePhase === 'betting' && currentBetAmount === null && !isAutoBetEnabled;
  const canCashout = gamePhase === 'playing' && currentBetAmount !== null && !isAutoCashoutEnabled;
  
  useEffect(() => {
    setBetAmountInput(currentAutoBetAmount.toString());
  }, [currentAutoBetAmount]);

  useEffect(() => {
    setAutoCashoutInput(autoCashoutTarget.toString());
  }, [autoCashoutTarget]);

  const handleBetAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value)) { 
      setBetAmountInput(value);
    }
  };

  const handleAutoCashoutTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
     if (/^\d*\.?\d{0,2}$/.test(value)) { 
      setAutoCashoutInput(value);
      const numericValue = parseFloat(value);
      if (!isNaN(numericValue) && numericValue >= 1.01) {
        onAutoCashoutTargetChange(numericValue);
      } else if (value === "" || value === "0" || value === "1" || value === "1."){
        // Allow intermediate states but don't call onAutoCashoutTargetChange yet
      } else if (value !== "" && numericValue < 1.01) {
        toast({title: "Invalid Target", description: "Auto cashout must be 1.01x or higher.", variant: "destructive"});
      }
    }
  };
  
  const handleAutoCashoutTargetBlur = () => {
    const numericValue = parseFloat(autoCashoutInput);
    if (isNaN(numericValue) || numericValue < 1.01) {
      setAutoCashoutInput(autoCashoutTarget.toString()); // Reset to last valid or default
      toast({title: "Auto Cashout Reseet", description: "Target must be 1.01x or higher. Reset to previous value.", variant: "destructive"});
    } else {
        onAutoCashoutTargetChange(numericValue); // Ensure context is updated on blur if valid
    }
  }


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

  const handleAutoBetToggle = (checked: boolean) => {
    const currentBet = parseFloat(betAmountInput);
    if (checked && (isNaN(currentBet) || currentBet <= 0)) {
      toast({ title: "Invalid Auto Bet Amount", description: "Set a valid amount before enabling auto bet.", variant: "destructive" });
      onAutoBetToggle(false); // Ensure it's off
      return;
    }
    if (checked && walletBalance !== null && currentBet > walletBalance) {
        toast({ title: "Insufficient Funds", description: "Not enough for this auto bet amount.", variant: "destructive"});
        onAutoBetToggle(false); // Ensure it's off
        return;
    }
    onAutoBetToggle(checked, checked ? currentBet : undefined);
  };

  useEffect(() => {
    if (gamePhase === 'idle' || gamePhase === 'betting') {
      setIsCashingOut(false); 
    }
    if (gamePhase === 'idle') {
      setIsBetting(false); 
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
                disabled={isAutoBetEnabled || !canBet || isBetting}
                pattern="\d*\.?\d{0,2}"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
                <Button variant="outline" size="sm" onClick={() => modifyBetAmount('half')} disabled={isAutoBetEnabled || !canBet || isBetting}> <MinusCircle className="mr-1 h-3 w-3"/> Half</Button>
                <Button variant="outline" size="sm" onClick={() => modifyBetAmount('double')} disabled={isAutoBetEnabled || !canBet || isBetting}><PlusCircle className="mr-1 h-3 w-3"/>Double</Button>
            </div>
            <div className="flex justify-around space-x-1">
              {QUICK_BET_AMOUNTS.map(amount => (
                <Button 
                  key={amount}
                  variant="secondary" 
                  size="sm"
                  className="flex-1 text-xs px-1"
                  onClick={() => setBetAmount(amount)}
                  disabled={isAutoBetEnabled || !canBet || isBetting || (walletBalance !== null && amount > walletBalance)}
                >
                  {amount}
                </Button>
              ))}
               <Button variant="outline" size="sm" className="flex-1 text-xs px-1" onClick={() => modifyBetAmount('max')} disabled={isAutoBetEnabled || !canBet || isBetting || walletBalance === null || walletBalance <=0 }>Max</Button>
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

        <div className="space-y-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className={`h-5 w-5 ${isAutoBetEnabled ? 'text-accent' : 'text-muted-foreground'}`} />
              <Label htmlFor="auto-bet-switch" className={`${isAutoBetEnabled ? 'text-accent' : 'text-muted-foreground'}`}>Auto Bet {isAutoBetEnabled ? `(${parseFloat(betAmountInput).toFixed(2)} COINS)` : ''}</Label>
            </div>
            <Switch
              id="auto-bet-switch"
              checked={isAutoBetEnabled}
              onCheckedChange={handleAutoBetToggle}
              disabled={currentBetAmount !== null || gamePhase === 'playing' || gamePhase === 'crashed'}
            />
          </div>
          <div className="flex items-center justify-between">
             <div className="flex items-center space-x-2">
                <Target className={`h-5 w-5 ${isAutoCashoutEnabled ? 'text-accent' : 'text-muted-foreground'}`} />
                <Label htmlFor="auto-cashout-switch" className={`${isAutoCashoutEnabled ? 'text-accent' : 'text-muted-foreground'}`}>Auto Cashout</Label>
            </div>
            <Switch
              id="auto-cashout-switch"
              checked={isAutoCashoutEnabled}
              onCheckedChange={onAutoCashoutToggle}
            />
          </div>
          {isAutoCashoutEnabled && (
            <div className="flex items-center space-x-2 pl-1">
              <Input
                type="text"
                id="auto-cashout-target"
                value={autoCashoutInput}
                onChange={handleAutoCashoutTargetChange}
                onBlur={handleAutoCashoutTargetBlur}
                placeholder="e.g. 2.00"
                className="h-10 text-sm"
                pattern="\d*\.?\d{0,2}"
              />
              <Label htmlFor="auto-cashout-target" className="text-sm text-muted-foreground">x Multiplier</Label>
            </div>
          )}
        </div>

      </CardContent>
      <CardFooter className="flex flex-col space-y-2 p-3 pt-0">
        {canBet && !isAutoBetEnabled && (
          <Button 
            onClick={handleBet} 
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 text-md py-5 shadow-md"
            disabled={isBetting || !betAmountInput || parseFloat(betAmountInput) <=0 || (walletBalance !== null && parseFloat(betAmountInput) > walletBalance) }
          >
            {isBetting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Percent className="mr-2 h-5 w-5"/>}
            Bet {betAmountInput && parseFloat(betAmountInput) > 0 ? `${parseFloat(betAmountInput).toFixed(2)} COINS` : ''}
          </Button>
        )}
        {canCashout && !isAutoCashoutEnabled && (
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

        {(isAutoBetEnabled || isAutoCashoutEnabled) && currentBetAmount === null && (
           <p className="text-accent text-center text-sm py-3 font-medium">
                {isAutoBetEnabled && "Auto Bet is active. "}
                {isAutoCashoutEnabled && "Auto Cashout is active. "}
                Waiting for next round...
            </p>
        )}

        {!canBet && !canCashout && currentBetAmount === null && !isAutoBetEnabled && !isAutoCashoutEnabled && (
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

