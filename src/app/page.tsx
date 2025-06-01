
"use client";

import { useState, useEffect } from 'react';
import GameCanvas from '@/components/game/GameCanvas'; // Updated import
import { BetControls } from '@/components/game/BetControls';
import { WalletDisplay } from '@/components/wallet/WalletDisplay';
import { DepositModal } from '@/components/wallet/DepositModal';
import { useAuth, type UserProfile } from '@/hooks/use-auth';
import { useToast } from "@/hooks/use-toast";
import { db, doc, updateDoc, increment } from '@/lib/firebase'; // Removed unused imports
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GameProvider, useGame } from '@/contexts/GameContext'; // Import GameProvider and useGame

// BetRecord definition is now in GameContext.tsx, ensure consistency or import if needed elsewhere
// For SkytraxPage, we might not need BetRecord directly if GameContext handles it all.

function SkytraxPageContent() {
  const { user, userProfile, loadingAuth, authError, setUserProfile } = useAuth();
  const { toast } = useToast();
  const gameContext = useGame(); // Access game state and actions

  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);

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
      // userProfile state update is now handled by GameProvider if bet/cashout involves it,
      // or still here for direct deposits.
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

  // Loading and error states from useAuth
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
  
  if (!user || !userProfile) { // Fallback if somehow auth is done but profile not set (should be handled by useAuth/GameProvider init)
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

  // If gameContext is not yet available (e.g., GameProvider is still initializing)
  if (!gameContext) {
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
         <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Loading game engine...</CardDescription>
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

  const { gameState, timeRemaining, placeBet, cashOut, currentLocalBet } = gameContext;

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-background p-4 md:p-8 space-y-6 md:space-y-8">
      <header className="w-full max-w-4xl flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-4xl font-headline font-bold text-primary">Skytrax</h1>
        <WalletDisplay 
          balance={userProfile?.walletBalance ?? 0} 
          onDepositClick={() => setIsDepositModalOpen(true)}
          isLoading={loadingAuth} 
          userName={userProfile?.displayName}
        />
      </header>

      <main className="w-full max-w-2xl flex flex-col items-center space-y-6"> {/* Increased max-width for canvas */}
        <GameCanvas /> {/* GameCanvas reads from context */}
        <BetControls 
          gamePhase={gameState.status} // From context
          onBet={placeBet} // From context
          onCashout={cashOut} // From context
          currentBetAmount={currentLocalBet?.amount ?? null} // From context
          currentMultiplier={gameState.multiplier} // From context
          walletBalance={userProfile?.walletBalance ?? 0}
          timeRemaining={timeRemaining} // From context, for betting phase display in BetControls
        />
      </main>

      <DepositModal 
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onDeposit={handleDeposit} // Remains in SkytraxPage
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
  
  // Render GameProvider only when auth is resolved and user/profile are available (or auth error occurs)
  // This ensures GameProvider gets valid initial props.
  if (loadingAuth && !authError) { // Show loading screen until auth is resolved
     return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="p-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl font-headline text-center text-primary">Skytrax</CardTitle>
            <CardDescription className="text-center">Authenticating...</CardDescription>
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
  // If auth error, SkytraxPageContent will handle displaying it.
  // If !user or !userProfile after loading and no error, SkytraxPageContent handles it.
  // This ensures GameProvider always receives non-null user & userProfile if auth is successful.
  return (
    <GameProvider user={user} userProfile={userProfile} setUserProfile={setUserProfile}>
      <SkytraxPageContent />
    </GameProvider>
  );
}
