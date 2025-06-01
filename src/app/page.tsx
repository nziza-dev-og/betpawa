
"use client";

import { useState, useEffect, Suspense, useRef } from 'react';
// Import GameCanvas directly as it handles its own dynamic loading of R3F part.
import GameCanvas from '@/components/game/GameCanvas'; 
import { BetControls } from '@/components/game/BetControls';
import { WalletDisplay } from '@/components/wallet/WalletDisplay';
import { DepositModal } from '@/components/wallet/DepositModal';
import { useAuth, type UserProfile } from '@/hooks/use-auth';
import { useToast } from "@/hooks/use-toast";
import { db, doc, updateDoc, increment } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GameProvider, useGame } from '@/contexts/GameContext';
import type { User as FirebaseUser } from 'firebase/auth';
import { RecentBets } from '@/components/history/RecentBets';
import { GameHistory } from '@/components/history/GameHistory';
import { ThemeToggleButton } from '@/components/ThemeToggleButton';
import { Volume2, VolumeX } from 'lucide-react';

interface SkytraxPageContentProps {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loadingAuth: boolean;
  authError: string | null;
  setUserProfile: React.Dispatch<React.SetStateAction<UserProfile | null>>;
}

function SkytraxPageContent({ user, userProfile, loadingAuth, authError, setUserProfile }: SkytraxPageContentProps) {
  const { toast } = useToast();
  const gameContext = useGame();

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isMuted, setIsMuted] = useState(true); // Start muted

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.muted = isMuted;
      if (!isMuted && audioRef.current.paused) {
        audioRef.current.play().catch(error => {
          console.warn("Audio autoplay prevented:", error);
          toast({
            title: "Audio Paused",
            description: "Click the sound icon to play background music.",
            variant: "default",
          });
        });
      }
    }
  }, [isMuted, toast]);

  const toggleMute = () => {
    setIsMuted(prev => !prev);
  };

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
      if (setUserProfile) {
          setUserProfile(prev => prev ? { ...prev, walletBalance: prev.walletBalance + amount } : null);
      }
      toast({ title: "Deposit Successful", description: `${amount} COINS added to your wallet.` });
    } catch (error) {
      console.error("Deposit error:", error);
      toast({ title: "Deposit Failed", description: "Could not process your deposit.", variant: "destructive" });
      throw error;
    }
  };

  if (loadingAuth && !userProfile && !authError) { 
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Loading your game...</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <svg className="animate-spin h-10 w-10 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-live="polite">
              <title>Loading game</title>
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
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-live="polite">
              <title>Initializing session</title>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameContext) { 
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
         <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Loading game engine...</CardDescription>
          </CardHeader>
           <CardContent className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-live="polite">
              <title>Loading game engine</title>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { 
    gameState, 
    timeRemaining, 
    placeBet, 
    cashOut, 
    currentLocalBet
  } = gameContext;

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-4 md:p-8 space-y-6 md:space-y-8">
      <audio ref={audioRef} src="/audio/background-beat.mp3" loop />
      <header className="w-full max-w-4xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-4xl font-headline font-bold text-primary">Skytrax</h1>
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="outline" size="icon" onClick={toggleMute} className="rounded-full w-9 h-9">
            {isMuted ? <VolumeX className="h-[1.1rem] w-[1.1rem]" /> : <Volume2 className="h-[1.1rem] w-[1.1rem]" />}
            <span className="sr-only">{isMuted ? "Unmute" : "Mute"}</span>
          </Button>
          <ThemeToggleButton />
          <WalletDisplay
            balance={userProfile?.walletBalance ?? 0}
            onDepositClick={() => setIsDepositModalOpen(true)}
            isLoading={loadingAuth && !userProfile} 
            userName={userProfile?.displayName}
          />
        </div>
      </header>

      <main className="w-full max-w-2xl flex flex-col items-center space-y-6">
        <GameCanvas />
        <BetControls
          gamePhase={gameState.status}
          onBet={placeBet}
          onCashout={cashOut}
          currentBetAmount={currentLocalBet?.amount ?? null}
          currentMultiplier={gameState.multiplier}
          walletBalance={userProfile?.walletBalance ?? 0}
          timeRemaining={timeRemaining}
        />
         <div className="w-full space-y-4 mt-6">
          <RecentBets />
          <GameHistory />
        </div>
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

export default function SkytraxPage() {
  const { user, userProfile, setUserProfile, loadingAuth, authError } = useAuth();

  if (loadingAuth && !userProfile && !authError) { 
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Authenticating & Loading Profile...</CardDescription>
          </CardHeader>
           <CardContent className="flex justify-center">
            <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" role="status" aria-live="polite">
              <title>Authenticating and loading profile</title>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <GameProvider user={user} userProfile={userProfile} setUserProfile={setUserProfile}>
      <SkytraxPageContent
        user={user}
        userProfile={userProfile}
        loadingAuth={loadingAuth} 
        authError={authError}
        setUserProfile={setUserProfile}
      />
    </GameProvider>
  );
}

    

    