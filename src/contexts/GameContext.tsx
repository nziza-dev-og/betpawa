
'use client';

import type { UserProfile } from '@/hooks/use-auth';
import type { User as FirebaseUser } from 'firebase/auth';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { db, doc, updateDoc, increment, serverTimestamp, collection } from '@/lib/firebase';

const CRASH_POINTS = [
  1.00, 1.02, 1.05, 1.08, 1.10, 1.13, 1.16, 1.19, 1.22, 1.25, 1.30, 1.35, 1.40, 1.45, 1.50,
  1.60, 1.70, 1.80, 1.90, 2.00, 2.15, 2.30, 2.45, 2.60, 2.75, 2.90, 3.10, 3.30, 3.50, 3.75,
  4.00, 4.25, 4.50, 4.75, 5.00,
  1.00, 1.03, 1.06, 1.09, 1.11, 1.14, 1.17, 1.20, 1.23, 1.26, 1.31, 1.36, 1.41, 1.46, 1.51,
  1.65, 1.75, 1.85, 1.95, 2.05, 2.20, 2.35, 2.50, 2.65, 2.80, 2.95, 3.15, 3.35, 3.55, 3.80,
  4.05, 4.30, 4.55, 4.80, 5.00,
  5.50, 6.00, 6.50, 7.00, 7.50, 8.00, 9.00, 10.00, 11.00, 12.50, 15.00,
  5.25, 5.75, 6.25, 6.75, 7.25,
  20.00, 25.00, 35.00, 50.00
];

const BETTING_DURATION = 10;
const IDLE_DURATION = 5;
const STARTING_DURATION = 3;
const CRASHED_DURATION = 5;

export type GamePhase = 'idle' | 'starting' | 'betting' | 'playing' | 'crashed';

export interface GameStateContext {
  multiplier: number;
  status: GamePhase;
}

export interface ActiveBetContext {
  id: string;
  amount: number;
  userId: string;
}

export interface BetRecord {
  id?: string;
  userId: string;
  amount: number;
  status: 'placed' | 'cashed_out' | 'lost';
  cashOutMultiplier?: number;
  winnings?: number;
  createdAt: any;
  roundId: string;
}

interface GameContextValue {
  gameState: GameStateContext;
  activeBets: ActiveBetContext[];
  timeRemaining: number;
  placeBet: (betAmount: number) => Promise<void>;
  cashOut: () => Promise<void>;
  currentLocalBet: BetRecord | null;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: React.ReactNode;
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

export const GameProvider = ({ children, user, userProfile, setUserProfile }: GameProviderProps) => {
  const { toast } = useToast();
  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [multiplier, setMultiplier] = useState(1.00);
  const [targetMultiplier, setTargetMultiplier] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(IDLE_DURATION);
  const [currentLocalBet, setCurrentLocalBet] = useState<BetRecord | null>(null);
  const [activeBetsForCanvas, setActiveBetsForCanvas] = useState<ActiveBetContext[]>([]);

  const gameLoopTimer = useRef<NodeJS.Timeout | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const gameStartTime = useRef<number>(0);
  const currentRoundId = useRef<string>('');
  const lostBetToastShownRef = useRef<string | null>(null);

  const resetGameState = useCallback(() => {
    setMultiplier(1.00);
    setTargetMultiplier(0);
  }, []);

  const startNewRound = useCallback(() => {
    resetGameState();
    currentRoundId.current = doc(collection(db, 'gameRounds')).id;
    setGamePhase('idle');
    setTimeRemaining(IDLE_DURATION);
    if (currentLocalBet?.status === 'placed' || currentLocalBet?.status === 'lost' || currentLocalBet?.status === 'cashed_out') {
      setCurrentLocalBet(null);
    }
    lostBetToastShownRef.current = null; // Reset toast shown tracker
  }, [resetGameState, currentLocalBet]);

  useEffect(() => {
    startNewRound();
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);

    if (timeRemaining > 0) {
      gameLoopTimer.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else {
      if (gamePhase === 'idle') {
        setGamePhase('starting');
        setTimeRemaining(STARTING_DURATION);
      } else if (gamePhase === 'starting') {
        setGamePhase('betting');
        setTimeRemaining(BETTING_DURATION);
      } else if (gamePhase === 'betting') {
        setGamePhase('playing');
        const randomCrashPoint = CRASH_POINTS[Math.floor(Math.random() * CRASH_POINTS.length)];
        setTargetMultiplier(randomCrashPoint);
        setMultiplier(1.00); // Reset multiplier for the new round
        gameStartTime.current = Date.now();
      } else if (gamePhase === 'crashed') {
        startNewRound();
      }
    }
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
    };
  }, [gamePhase, timeRemaining, startNewRound]);

  // Effect for multiplier animation during 'playing' phase
  useEffect(() => {
    if (gamePhase === 'playing') {
      const animateMultiplierLoop = () => {
        setMultiplier(prevDisplayMultiplier => {
          if (gamePhase !== 'playing' || targetMultiplier <= 0) { // Check phase and target again
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            return prevDisplayMultiplier;
          }

          const now = Date.now();
          const elapsed = (now - gameStartTime.current) / 1000;
          let newCalculatedMultiplier = 1 + 0.1 * elapsed + 0.05 * Math.pow(elapsed, 1.5);
          newCalculatedMultiplier = parseFloat(Math.max(prevDisplayMultiplier, newCalculatedMultiplier).toFixed(2));

          if (newCalculatedMultiplier >= targetMultiplier) {
            return targetMultiplier; // Set to target, crash logic handled by another effect
          }
          return newCalculatedMultiplier;
        });
        animationFrameId.current = requestAnimationFrame(animateMultiplierLoop);
      };
      animationFrameId.current = requestAnimationFrame(animateMultiplierLoop);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gamePhase, targetMultiplier, setMultiplier]); // gameStartTime is a ref

  // Effect to handle game state transitions when crash occurs (multiplier reaches target)
  useEffect(() => {
    if (gamePhase === 'playing' && targetMultiplier > 0 && multiplier >= targetMultiplier) {
      setGamePhase('crashed');
      setTimeRemaining(CRASHED_DURATION);
      if (currentLocalBet && currentLocalBet.status === 'placed') {
        setCurrentLocalBet(prev => prev ? { ...prev, status: 'lost' } : null);
      }
    }
  }, [multiplier, targetMultiplier, gamePhase, currentLocalBet, setGamePhase, setTimeRemaining, setCurrentLocalBet]);

  // Effect to show toast for lost bet
  useEffect(() => {
    if (
      gamePhase === 'crashed' &&
      currentLocalBet?.status === 'lost' &&
      currentLocalBet.amount > 0 &&
      currentLocalBet.roundId &&
      lostBetToastShownRef.current !== currentLocalBet.roundId
    ) {
      const lostAmount = currentLocalBet.amount;
      const finalMultiplier = multiplier; // This should be the targetMultiplier set on crash

      toast({
        title: "Bet Lost!",
        description: `Crashed at ${finalMultiplier.toFixed(2)}x. You lost ${lostAmount.toFixed(2)} COINS.`,
        variant: "destructive",
      });
      lostBetToastShownRef.current = currentLocalBet.roundId;
    }
  }, [gamePhase, currentLocalBet, multiplier, toast]);


  useEffect(() => {
    if (currentLocalBet && currentLocalBet.status === 'placed' && currentLocalBet.id) {
      setActiveBetsForCanvas([{ id: currentLocalBet.id, amount: currentLocalBet.amount, userId: currentLocalBet.userId }]);
    } else {
      setActiveBetsForCanvas([]);
    }
  }, [currentLocalBet]);

  const placeBet = async (amount: number) => {
    if (!user || !userProfile) {
      toast({ title: "Login Required", description: "Please log in to place a bet.", variant: "destructive" });
      return;
    }
    if (userProfile.walletBalance < amount) {
      toast({ title: "Insufficient Funds", description: "Not enough balance to place this bet.", variant: "destructive" });
      return;
    }
    if (gamePhase !== 'betting') {
      toast({ title: "Betting Closed", description: "You can only bet during the betting phase.", variant: "destructive" });
      return;
    }

    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        walletBalance: increment(-amount)
      });

      const newBet: BetRecord = {
        id: doc(collection(db, 'userBets')).id,
        userId: user.uid,
        amount,
        status: 'placed',
        createdAt: serverTimestamp(),
        roundId: currentRoundId.current,
      };

      setCurrentLocalBet(newBet);
      if (setUserProfile) {
        setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance - amount } : null);
      }
      toast({ title: "Bet Placed!", description: `Your bet of ${amount} COINS is active.` });
    } catch (error) {
      console.error("Bet placement error:", error);
      setCurrentLocalBet(null);
      toast({ title: "Bet Failed", description: "Could not place your bet.", variant: "destructive" });
    }
  };

  const cashOut = async () => {
    if (!user || !userProfile || !currentLocalBet || currentLocalBet.status !== 'placed') {
      toast({ title: "Cashout Error", description: "No active bet to cash out.", variant: "destructive" });
      return;
    }
    if (gamePhase !== 'playing') {
      toast({ title: "Cashout Error", description: "Can only cash out while the game is playing.", variant: "destructive" });
      return;
    }

    const winnings = parseFloat((currentLocalBet.amount * multiplier).toFixed(2));
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        walletBalance: increment(winnings)
      });

      const cashedOutBet: BetRecord = {
        ...currentLocalBet,
        status: 'cashed_out',
        cashOutMultiplier: multiplier,
        winnings,
      };

      setCurrentLocalBet(cashedOutBet);
      if (setUserProfile) {
        setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance + winnings } : null);
      }
      toast({ title: "Cashed Out!", description: `You won ${winnings.toFixed(2)} COINS at ${multiplier.toFixed(2)}x!`, variant: "default" });
    } catch (error) {
      console.error("Cashout error:", error);
      toast({ title: "Cashout Failed", description: "Could not process your cashout.", variant: "destructive" });
    }
  };

  const gameStateForCanvasContext: GameStateContext = {
    multiplier: gamePhase === 'crashed' && targetMultiplier > 0 ? targetMultiplier : multiplier,
    status: gamePhase,
  };

  return (
    <GameContext.Provider value={{
      gameState: gameStateForCanvasContext,
      activeBets: activeBetsForCanvas,
      timeRemaining,
      placeBet,
      cashOut,
      currentLocalBet
    }}>
      {children}
    </GameContext.Provider>
  );
};
