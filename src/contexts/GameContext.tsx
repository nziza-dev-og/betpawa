
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
  1.00, 1.00, 1.00, 1.00, 1.00, // Increase frequency of very low crashes
  1.50, 1.75, 2.25, 2.50, 2.75, 3.00, 3.25, 3.50, 3.75, 4.00, 4.25, 4.50, 4.75, // Spread for 1x-5x
  5.50, 6.00, 7.00, 8.00, 9.00, 10.00, // Fewer occurrences for 5x-10x
  12.00, 15.00, // Even fewer for 10x-15x
  20.00 // Rare high crash
];


const BETTING_DURATION = 10;
const IDLE_DURATION = 5;
const STARTING_DURATION = 3;
const CRASHED_DURATION = 5;
const MAX_RECENT_BETS = 10;
const MAX_CRASH_POINTS_HISTORY = 15;


export type GamePhase = 'idle' | 'starting' | 'betting' | 'playing' | 'crashed';

export interface GameStateContext {
  multiplier: number;
  status: GamePhase;
  lastCrashPoints: number[];
}

export interface ActiveBetContext {
  id: string;
  amount: number;
  userId: string;
}

// Internal representation of a bet
export interface BetRecord {
  id?: string;
  userId: string;
  amount: number;
  status: 'placed' | 'cashed_out' | 'lost';
  cashOutMultiplier?: number;
  winnings?: number;
  createdAt: any; // Firebase ServerTimestamp or Date after fetch
  roundId: string;
  // crashMultiplier?: number; // Stored when bet is lost
}

// Representation for the RecentBets UI component
export interface DisplayableBetRecord {
  id: string;
  amount: number;
  timestamp: number; // Epoch time
  status: 'won' | 'lost';
  profit: number;
  cashoutAt?: number; // Multiplier if won
  crashMultiplier?: number; // Multiplier if lost at game crash
}


interface GameContextValue {
  gameState: GameStateContext;
  activeBets: ActiveBetContext[];
  timeRemaining: number;
  placeBet: (betAmount: number) => Promise<void>;
  cashOut: () => Promise<void>;
  currentLocalBet: BetRecord | null;
  recentBets: DisplayableBetRecord[];
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
  const [recentBets, setRecentBets] = useState<DisplayableBetRecord[]>([]);
  const [lastCrashPoints, setLastCrashPoints] = useState<number[]>([]);


  const gameLoopTimer = useRef<NodeJS.Timeout | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const gameStartTime = useRef<number>(0);
  const currentRoundId = useRef<string>('');
  const lostBetToastShownRef = useRef<string | null>(null);
  const betProcessedForHistory = useRef<string | null>(null);


  const resetGameState = useCallback(() => {
    setMultiplier(1.00);
    setTargetMultiplier(0);
  }, []);

  const startNewRound = useCallback(() => {
    resetGameState();
    currentRoundId.current = doc(collection(db, 'gameRounds')).id; // Generate a unique ID for the round
    setGamePhase('idle');
    setTimeRemaining(IDLE_DURATION);
    if (currentLocalBet?.status === 'placed' || currentLocalBet?.status === 'lost' || currentLocalBet?.status === 'cashed_out') {
      setCurrentLocalBet(null);
    }
    lostBetToastShownRef.current = null;
    betProcessedForHistory.current = null;
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
        setMultiplier(1.00);
        gameStartTime.current = Date.now();
      } else if (gamePhase === 'crashed') {
        startNewRound();
      }
    }
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
    };
  }, [gamePhase, timeRemaining, startNewRound]);


  useEffect(() => {
    if (gamePhase !== 'playing') {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      return;
    }

    let lastFrameTime = Date.now();
    const animateMultiplierLoop = () => {
      const now = Date.now();
      const deltaTime = (now - lastFrameTime) / 1000; // time in seconds
      lastFrameTime = now;

      setMultiplier(prevDisplayMultiplier => {
        if (gamePhase !== 'playing' || targetMultiplier <= 0) {
          return prevDisplayMultiplier;
        }

        const elapsedSinceStart = (Date.now() - gameStartTime.current) / 1000;
        let newCalculatedMultiplier = 1 + 0.1 * elapsedSinceStart + 0.05 * Math.pow(elapsedSinceStart, 1.5);
        newCalculatedMultiplier = parseFloat(Math.max(prevDisplayMultiplier, newCalculatedMultiplier).toFixed(2));
        
        if (newCalculatedMultiplier >= targetMultiplier) {
          return targetMultiplier;
        }
        // Smooth increment, avoid large jumps if tab was inactive
        const incrementFactor = Math.min(0.01 + elapsedSinceStart * 0.001, 0.05); // Dynamic increment
        let smoothMultiplier = prevDisplayMultiplier + incrementFactor * (60 * deltaTime); // Assuming 60fps target for deltaTime usage
        smoothMultiplier = parseFloat(smoothMultiplier.toFixed(2));
        
        return Math.min(smoothMultiplier, newCalculatedMultiplier, targetMultiplier);
      });
      animationFrameId.current = requestAnimationFrame(animateMultiplierLoop);
    };
    animationFrameId.current = requestAnimationFrame(animateMultiplierLoop);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [gamePhase, targetMultiplier]);


  useEffect(() => {
    if (gamePhase === 'playing' && targetMultiplier > 0 && multiplier >= targetMultiplier) {
      setGamePhase('crashed');
      setTimeRemaining(CRASHED_DURATION);
      setLastCrashPoints(prev => [targetMultiplier, ...prev.slice(0, MAX_CRASH_POINTS_HISTORY - 1)]);
      if (currentLocalBet && currentLocalBet.status === 'placed') {
        setCurrentLocalBet(prev => prev ? { ...prev, status: 'lost' } : null);
      }
    }
  }, [multiplier, targetMultiplier, gamePhase, currentLocalBet, setGamePhase, setTimeRemaining, setCurrentLocalBet]);


  useEffect(() => {
    if (
      gamePhase === 'crashed' &&
      currentLocalBet?.status === 'lost' &&
      currentLocalBet.amount > 0 &&
      currentLocalBet.roundId &&
      lostBetToastShownRef.current !== currentLocalBet.roundId &&
      targetMultiplier > 0 // Ensure crash has a defined point
    ) {
      const lostAmount = currentLocalBet.amount;
      const finalMultiplier = targetMultiplier;

      toast({
        title: "Bet Lost!",
        description: `Crashed at ${finalMultiplier.toFixed(2)}x. You lost ${lostAmount.toFixed(2)} COINS.`,
        variant: "destructive",
      });
      lostBetToastShownRef.current = currentLocalBet.roundId;

      if (betProcessedForHistory.current !== currentLocalBet.id) {
          const lostBetRecord: DisplayableBetRecord = {
            id: currentLocalBet.id || `lost-${Date.now()}-${Math.random()}`,
            amount: currentLocalBet.amount,
            timestamp: (currentLocalBet.createdAt?.toDate?.() || new Date()).getTime(),
            status: 'lost',
            profit: -currentLocalBet.amount,
            crashMultiplier: finalMultiplier,
          };
          setRecentBets(prev => [lostBetRecord, ...prev.slice(0, MAX_RECENT_BETS - 1)]);
          betProcessedForHistory.current = lostBetRecord.id;
      }
    }
  }, [gamePhase, currentLocalBet, multiplier, toast, targetMultiplier]);


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
    if (currentLocalBet && currentLocalBet.status === 'placed') {
      toast({ title: "Bet Already Placed", description: "You already have an active bet for this round.", variant: "destructive" });
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
      betProcessedForHistory.current = null; // Reset for new bet
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

      const cashedOutBetData: BetRecord = {
        ...currentLocalBet,
        status: 'cashed_out',
        cashOutMultiplier: multiplier,
        winnings,
      };

      setCurrentLocalBet(cashedOutBetData);

      if (betProcessedForHistory.current !== cashedOutBetData.id) {
        const wonBetRecord: DisplayableBetRecord = {
            id: cashedOutBetData.id || `won-${Date.now()}-${Math.random()}`,
            amount: cashedOutBetData.amount,
            timestamp: (cashedOutBetData.createdAt?.toDate?.() || new Date()).getTime(),
            status: 'won',
            profit: cashedOutBetData.winnings!,
            cashoutAt: cashedOutBetData.cashOutMultiplier!,
        };
        setRecentBets(prev => [wonBetRecord, ...prev.slice(0, MAX_RECENT_BETS - 1)]);
        betProcessedForHistory.current = wonBetRecord.id;
      }
      
      if (setUserProfile) {
        setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance + winnings } : null);
      }
      toast({ title: "Cashed Out!", description: `You won ${winnings.toFixed(2)} COINS at ${multiplier.toFixed(2)}x!`, variant: "default" });
    } catch (error) {
      console.error("Cashout error:", error);
      toast({ title: "Cashout Failed", description: "Could not process your cashout.", variant: "destructive" });
    }
  };

  const gameStateForContext: GameStateContext = {
    multiplier: gamePhase === 'crashed' && targetMultiplier > 0 ? targetMultiplier : multiplier,
    status: gamePhase,
    lastCrashPoints: lastCrashPoints,
  };

  return (
    <GameContext.Provider value={{
      gameState: gameStateForContext,
      activeBets: activeBetsForCanvas,
      timeRemaining,
      placeBet,
      cashOut,
      currentLocalBet,
      recentBets
    }}>
      {children}
    </GameContext.Provider>
  );
};

