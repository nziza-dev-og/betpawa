
'use client';

import type { UserProfile } from '@/hooks/use-auth';
import type { User as FirebaseUser } from 'firebase/auth';
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast"; // Corrected import path
import { db, doc, updateDoc, increment, serverTimestamp, collection } from '@/lib/firebase';

const CRASH_POINTS = [1.00, 1.01, 1.05, 1.10, 1.15, 1.20, 1.30, 1.40, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 4.00, 5.00, 7.50, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 500, 1000];
const BETTING_DURATION = 10; 
const IDLE_DURATION = 5;
const STARTING_DURATION = 3;
const CRASHED_DURATION = 5;

export type GamePhase = 'idle' | 'starting' | 'betting' | 'playing' | 'crashed';

export interface GameStateContext {
  multiplier: number;
  status: GamePhase;
  // targetMultiplier is used internally for crash line, not directly exposed if not needed by Canvas externally
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
  const [targetMultiplier, setTargetMultiplier] = useState(0); // For canvas crash line
  const [timeRemaining, setTimeRemaining] = useState(IDLE_DURATION);
  const [currentLocalBet, setCurrentLocalBet] = useState<BetRecord | null>(null);
  const [activeBetsForCanvas, setActiveBetsForCanvas] = useState<ActiveBetContext[]>([]);

  const gameLoopTimer = useRef<NodeJS.Timeout | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const gameStartTime = useRef<number>(0);
  const currentRoundId = useRef<string>('');

  const resetGameState = useCallback(() => {
    setMultiplier(1.00);
    setTargetMultiplier(0);
  }, []);

  const startNewRound = useCallback(() => {
    console.log("Context: Starting new round (idle phase)");
    resetGameState();
    currentRoundId.current = doc(collection(db, 'gameRounds')).id;
    setGamePhase('idle');
    setTimeRemaining(IDLE_DURATION);
    
    // If a bet was 'placed' but the round ended before 'playing' (e.g. user places bet then betting ends, then server/client desync), mark as lost.
    // Or simply clear it. For now, clearing seems fine as it wouldn't have been processed.
    if (currentLocalBet?.status === 'placed' || currentLocalBet?.status === 'lost' || currentLocalBet?.status === 'cashed_out') {
      setCurrentLocalBet(null); 
    }
  }, [resetGameState, currentLocalBet]);

  useEffect(() => {
    startNewRound();
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Initial mount

  useEffect(() => {
    if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);

    if (timeRemaining > 0) {
      gameLoopTimer.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else {
      if (gamePhase === 'idle') {
        console.log("Context: Transitioning from idle to starting");
        setGamePhase('starting');
        setTimeRemaining(STARTING_DURATION);
      } else if (gamePhase === 'starting') {
        console.log("Context: Transitioning from starting to betting");
        setGamePhase('betting');
        setTimeRemaining(BETTING_DURATION);
      } else if (gamePhase === 'betting') {
        console.log("Context: Transitioning from betting to playing");
        setGamePhase('playing');
        const randomCrashPoint = CRASH_POINTS[Math.floor(Math.random() * CRASH_POINTS.length)];
        setTargetMultiplier(randomCrashPoint);
        setMultiplier(1.00);
        gameStartTime.current = Date.now();
      } else if (gamePhase === 'crashed') {
        console.log("Context: Transitioning from crashed to idle (new round)");
        startNewRound();
      }
    }
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
    };
  }, [gamePhase, timeRemaining, startNewRound]);

  useEffect(() => {
    if (gamePhase === 'playing') {
      const animateMultiplier = () => {
        setMultiplier(prevMultiplier => {
          if (prevMultiplier >= targetMultiplier && targetMultiplier > 0) {
            setMultiplier(targetMultiplier);
            setGamePhase('crashed');
            setTimeRemaining(CRASHED_DURATION);
            if (currentLocalBet && currentLocalBet.status === 'placed') {
              setCurrentLocalBet(prev => prev ? { ...prev, status: 'lost' } : null);
              toast({ title: "Too Late!", description: `Crashed at ${targetMultiplier.toFixed(2)}x. Better luck next time!`, variant: "destructive" });
            }
            return targetMultiplier;
          }
          const now = Date.now();
          const elapsed = (now - gameStartTime.current) / 1000;
          let newMultiplier = 1 + 0.1 * elapsed + 0.05 * Math.pow(elapsed, 1.5);
          newMultiplier = Math.max(prevMultiplier, newMultiplier);
          newMultiplier = parseFloat(newMultiplier.toFixed(2));
          if (newMultiplier >= targetMultiplier && targetMultiplier > 0) {
             return targetMultiplier;
          }
          return newMultiplier;
        });
        animationFrameId.current = requestAnimationFrame(animateMultiplier);
      };
      animationFrameId.current = requestAnimationFrame(animateMultiplier);
    } else {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gamePhase, targetMultiplier, currentLocalBet, toast]);

  useEffect(() => {
    if (currentLocalBet && currentLocalBet.status === 'placed' && currentLocalBet.id) {
      setActiveBetsForCanvas([{ id: currentLocalBet.id , amount: currentLocalBet.amount, userId: currentLocalBet.userId }]);
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
        id: doc(collection(db, 'userBets')).id, // Generate an ID for the bet record
        userId: user.uid,
        amount,
        status: 'placed',
        createdAt: serverTimestamp(),
        roundId: currentRoundId.current,
      };
      
      setCurrentLocalBet(newBet);
      if(setUserProfile) {
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
      if(setUserProfile) {
        setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance + winnings } : null);
      }
      toast({ title: "Cashed Out!", description: `You won ${winnings.toFixed(2)} COINS at ${multiplier.toFixed(2)}x!` , variant: "default"});
    } catch (error) {
      console.error("Cashout error:", error);
      toast({ title: "Cashout Failed", description: "Could not process your cashout.", variant: "destructive" });
    }
  };

  // This gameState is what GameCanvas will consume via useGame()
  const gameStateForCanvasContext: GameStateContext = {
    multiplier: gamePhase === 'crashed' && targetMultiplier > 0 ? targetMultiplier : multiplier,
    status: gamePhase,
    // The canvas code has its own crash line logic using targetMultiplier
    // and its own waiting countdown logic.
    // If canvas needs explicit targetMultiplier, add it here.
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

