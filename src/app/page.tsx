
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { GameDisplay } from '@/components/game/GameDisplay';
import { BetControls } from '@/components/game/BetControls';
import { WalletDisplay } from '@/components/wallet/WalletDisplay';
import { DepositModal } from '@/components/wallet/DepositModal';
import { useAuth, type UserProfile } from '@/hooks/use-auth';
import { useToast } from "@/hooks/use-toast";
import { db, doc, updateDoc, increment, addDoc, collection, serverTimestamp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

// Updated list of possible crash multipliers for more variety
const CRASH_POINTS = [1.00, 1.01, 1.05, 1.10, 1.15, 1.20, 1.30, 1.40, 1.50, 1.75, 2.00, 2.25, 2.50, 3.00, 4.00, 5.00, 7.50, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 500, 1000];
const BETTING_DURATION = 10; // seconds
const IDLE_DURATION = 5; // seconds
const STARTING_DURATION = 3; // seconds
const CRASHED_DURATION = 5; // seconds

type GamePhase = 'idle' | 'starting' | 'betting' | 'playing' | 'crashed';

interface BetRecord {
  id?: string;
  userId: string;
  amount: number;
  status: 'placed' | 'cashed_out' | 'lost';
  cashOutMultiplier?: number;
  winnings?: number;
  createdAt: any; // Firestore serverTimestamp
  roundId: string; // To identify the game round
}

export default function SkytraxPage() {
  const { user, userProfile, loadingAuth, authError, setUserProfile } = useAuth();
  const { toast } = useToast();

  const [gamePhase, setGamePhase] = useState<GamePhase>('idle');
  const [multiplier, setMultiplier] = useState(1.00);
  const [targetMultiplier, setTargetMultiplier] = useState(0);
  
  const [currentBet, setCurrentBet] = useState<BetRecord | null>(null);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const gameLoopTimer = useRef<NodeJS.Timeout | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const gameStartTime = useRef<number>(0);
  const currentRoundId = useRef<string>('');


  const resetGameState = useCallback(() => {
    setMultiplier(1.00);
    // currentBet is reset per user action or round end
    // targetMultiplier is set at start of 'playing'
  }, []);

  const startNewRound = useCallback(() => {
    console.log("Starting new round (idle phase)");
    resetGameState();
    currentRoundId.current = doc(collection(db, 'gameRounds')).id; // Generate a new round ID
    setGamePhase('idle');
    setTimeRemaining(IDLE_DURATION);
  }, [resetGameState]);

  useEffect(() => {
    startNewRound(); // Initialize first round
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [startNewRound]);


  // Game Phase Timer Logic
  useEffect(() => {
    if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);

    if (timeRemaining > 0) {
      gameLoopTimer.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    } else {
      // Time's up, transition to next phase
      if (gamePhase === 'idle') {
        console.log("Transitioning from idle to starting");
        setGamePhase('starting');
        setTimeRemaining(STARTING_DURATION);
      } else if (gamePhase === 'starting') {
        console.log("Transitioning from starting to betting");
        setGamePhase('betting');
        setTimeRemaining(BETTING_DURATION);
      } else if (gamePhase === 'betting') {
        console.log("Transitioning from betting to playing");
        setGamePhase('playing');
        const randomCrashPoint = CRASH_POINTS[Math.floor(Math.random() * CRASH_POINTS.length)];
        setTargetMultiplier(randomCrashPoint);
        setMultiplier(1.00); // Ensure multiplier starts at 1.00 for playing phase
        gameStartTime.current = Date.now();
      } else if (gamePhase === 'crashed') {
        console.log("Transitioning from crashed to idle (new round)");
        startNewRound();
      }
    }
    return () => {
      if (gameLoopTimer.current) clearTimeout(gameLoopTimer.current);
    };
  }, [gamePhase, timeRemaining, startNewRound]);


  // Multiplier Animation Logic
  useEffect(() => {
    if (gamePhase === 'playing') {
      const animateMultiplier = () => {
        setMultiplier(prevMultiplier => {
          if (prevMultiplier >= targetMultiplier) {
            // CRASH!
            setMultiplier(targetMultiplier); // Ensure UI shows exact crash point
            setGamePhase('crashed');
            setTimeRemaining(CRASHED_DURATION);
            if (currentBet && currentBet.status === 'placed') {
              // Bet lost
              setCurrentBet(prev => prev ? { ...prev, status: 'lost' } : null);
              // Update bet in Firestore (optional, or do it when bet is placed)
              toast({ title: "Too Late!", description: `Crashed at ${targetMultiplier.toFixed(2)}x. Better luck next time!`, variant: "destructive" });
            }
            return targetMultiplier; 
          }
          
          const now = Date.now();
          const elapsed = (now - gameStartTime.current) / 1000; // seconds
          let newMultiplier = 1 + 0.1 * elapsed + 0.05 * Math.pow(elapsed, 1.5);
          newMultiplier = Math.max(prevMultiplier, newMultiplier); 
          newMultiplier = parseFloat(newMultiplier.toFixed(2));


          if (newMultiplier >= targetMultiplier) {
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
  }, [gamePhase, targetMultiplier, currentBet, toast]);


  const handleDeposit = async (amount: number) => {
    if (!user || !userProfile) {
      toast({ title: "Error", description: "User not found.", variant: "destructive" });
      return;
    }
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        walletBalance: increment(amount)
      });
      setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance + amount } : null);
      toast({ title: "Deposit Successful", description: `${amount} COINS added to your wallet.` });
    } catch (error) {
      console.error("Deposit error:", error);
      toast({ title: "Deposit Failed", description: "Could not process your deposit.", variant: "destructive" });
      throw error; 
    }
  };

  const handleBet = async (amount: number) => {
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
        userId: user.uid,
        amount,
        status: 'placed',
        createdAt: serverTimestamp(),
        roundId: currentRoundId.current,
      };
      
      setCurrentBet(newBet);
      setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance - amount } : null);
      toast({ title: "Bet Placed!", description: `Your bet of ${amount} COINS is active.` });
    } catch (error) {
      console.error("Bet placement error:", error);
      toast({ title: "Bet Failed", description: "Could not place your bet.", variant: "destructive" });
    }
  };

  const handleCashout = async () => {
    if (!user || !userProfile || !currentBet || currentBet.status !== 'placed') {
      toast({ title: "Cashout Error", description: "No active bet to cash out.", variant: "destructive" });
      return;
    }
    if (gamePhase !== 'playing') {
        toast({ title: "Cashout Error", description: "Can only cash out while the game is playing.", variant: "destructive" });
        return;
    }

    const winnings = parseFloat((currentBet.amount * multiplier).toFixed(2));
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        walletBalance: increment(winnings)
      });

      const cashedOutBet: BetRecord = {
        ...currentBet,
        status: 'cashed_out',
        cashOutMultiplier: multiplier,
        winnings,
      };
      
      setCurrentBet(null); 
      setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance + winnings } : null);
      toast({ title: "Cashed Out!", description: `You won ${winnings.toFixed(2)} COINS at ${multiplier.toFixed(2)}x!` , variant: "default"});
    } catch (error) {
      console.error("Cashout error:", error);
      toast({ title: "Cashout Failed", description: "Could not process your cashout.", variant: "destructive" });
    }
  };


  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Loading your game...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (authError && (!user || !userProfile)) {
    return (
     <div className="flex items-center justify-center min-h-screen bg-background p-4">
       <Card className="p-6 md:p-8 shadow-xl max-w-lg w-full">
         <CardHeader>
           <CardTitle className="text-2xl font-headline text-center text-destructive">Authentication Error</CardTitle>
         </CardHeader>
         <CardContent className="space-y-4">
           <p className="text-center text-card-foreground bg-destructive/10 border border-destructive p-3 rounded-md">{authError}</p>
           {authError.includes("Anonymous sign-in is not enabled") && (
                <p className="text-sm text-muted-foreground text-center">
                   To fix this, go to your <strong className="text-foreground">Firebase Console</strong>, navigate to Authentication, then the <strong className="text-foreground">Sign-in method</strong> tab, and enable the <strong className="text-foreground">Anonymous</strong> provider.
                </p>
           )}
            <p className="text-sm text-muted-foreground mt-2 text-center">
               After making the change in Firebase, please refresh this page.
            </p>
            <Button onClick={() => window.location.reload()} className="w-full mt-4">Refresh Page</Button>
         </CardContent>
       </Card>
     </div>
   );
 }
  
  if (!user || !userProfile) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Initializing session... If this problem persists, please refresh.</CardDescription>
          </CardHeader>
           <CardContent className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-4 md:p-8 space-y-6 md:space-y-8">
      <header className="w-full max-w-4xl flex justify-between items-center">
        <h1 className="text-4xl font-headline font-bold text-primary">Skytrax</h1>
        <WalletDisplay 
          balance={userProfile?.walletBalance ?? 0} 
          onDepositClick={() => setIsDepositModalOpen(true)}
          isLoading={loadingAuth} // Should be false here, but kept for safety
          userName={userProfile?.displayName}
        />
      </header>

      <main className="w-full max-w-md flex flex-col items-center space-y-6">
        <GameDisplay multiplier={multiplier} gamePhase={gamePhase} timeRemaining={gamePhase === 'betting' || gamePhase === 'idle' || gamePhase === 'starting' ? timeRemaining : undefined} />
        <BetControls 
          gamePhase={gamePhase}
          onBet={handleBet}
          onCashout={handleCashout}
          currentBetAmount={currentBet?.amount ?? null}
          currentMultiplier={multiplier}
          walletBalance={userProfile?.walletBalance ?? 0}
        />
      </main>

      <DepositModal 
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onDeposit={handleDeposit}
      />
      
      <footer className="text-center text-muted-foreground text-sm mt-auto pt-8">
        <p>&copy; {new Date().getFullYear()} Skytrax. Play responsibly.</p>
        <p className="text-xs">All monetary values are in-game COINS and have no real world value.</p>
      </footer>
    </div>
  );
}

