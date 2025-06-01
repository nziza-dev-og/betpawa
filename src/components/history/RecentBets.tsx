
"use client";

import { useGame } from '@/contexts/GameContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';

export function RecentBets() {
  const { recentBets } = useGame();
  const [isHovered, setIsHovered] = useState(false);
  const [highlightedBet, setHighlightedBet] = useState<string | null>(null);

  // Auto-scroll to top when new bets are added
  useEffect(() => {
    const scrollArea = document.querySelector('.recent-bets-scroll');
    if (scrollArea) {
      scrollArea.scrollTop = 0;
    }
  }, [recentBets]);

  return (
    <Card 
      className="shadow-lg border-border/50 bg-background/80 backdrop-blur-sm relative overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Animated background gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br transition-all duration-1000 ${
        isHovered ? 'from-primary/5 via-transparent to-secondary/5' : 'from-transparent via-transparent to-transparent'
      }`} />
      
      {/* Pulsing border effect */}
      <div className={`absolute inset-0 rounded-lg pointer-events-none border ${
        isHovered ? 'border-primary/30' : 'border-border/20'
      } transition-all duration-300`} />
      
      <CardHeader className="pb-2 pt-4 relative">
        <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
          <span className="relative">
            Your Recent Bets
            {/* Animated underline */}
            <motion.span 
              initial={{ width: 0 }}
              animate={{ width: isHovered ? '100%' : '0%' }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-0 left-0 h-0.5 bg-primary"
            />
          </span>
          {recentBets.length > 0 && (
            <Badge variant="outline" className="px-2 py-0.5 text-xs font-medium">
              {recentBets.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="pt-2 pb-4 relative">
        <AnimatePresence>
          {recentBets.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-muted-foreground/80 text-sm italic py-6 text-center"
            >
              No recent bets
              <div className="text-xs mt-1">Place a bet to see it here</div>
            </motion.div>
          ) : (
            <ScrollArea className="recent-bets-scroll h-[200px] w-full pr-3">
              <div className="space-y-2">
                <AnimatePresence>
                  {recentBets.map((bet) => (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ 
                        opacity: 1, 
                        y: 0,
                        scale: highlightedBet === bet.id ? 1.02 : 1
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      whileHover={{ scale: 1.02 }}
                      onHoverStart={() => setHighlightedBet(bet.id)}
                      onHoverEnd={() => setHighlightedBet(null)}
                      className={`p-3 rounded-lg border relative overflow-hidden transition-all ${
                        bet.status === 'won' 
                          ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' 
                          : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                      }`}
                    >
                      {/* Status indicator bar */}
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        bet.status === 'won' ? 'bg-primary' : 'bg-destructive'
                      }`} />
                      
                      {/* Glow effect on hover */}
                      {highlightedBet === bet.id && (
                        <div className={`absolute inset-0 rounded-lg pointer-events-none ${
                          bet.status === 'won' 
                            ? 'bg-primary/10' 
                            : 'bg-destructive/10'
                        }`} />
                      )}
                      
                      <div className="flex justify-between items-center">
                        <div className="space-y-1">
                          <div className="font-medium text-foreground flex items-center gap-1">
                            <span>{bet.amount.toFixed(2)}</span>
                            <span className="text-xs opacity-80">COINS</span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="opacity-70">
                              {new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span className="opacity-50">•</span>
                            <span className="opacity-70">
                              {new Date(bet.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right space-y-1">
                          <div className={`font-semibold flex items-center justify-end gap-1 ${
                            bet.status === 'won' ? 'text-primary' : 'text-destructive'
                          }`}>
                            {bet.status === 'won' ? (
                              <span className="text-xs">+</span>
                            ) : null}
                            <span>{bet.profit?.toFixed(2)}</span>
                             <span className="text-xs opacity-80">COINS</span>
                          </div>
                          
                          <div className="text-xs text-muted-foreground">
                            {bet.status === 'won' && bet.cashoutAt ? (
                              <span className="flex items-center gap-1 justify-end">
                                <span className="text-primary/80">Cashed out</span>
                                <span className="font-medium">{bet.cashoutAt.toFixed(2)}x</span>
                              </span>
                            ) : bet.status === 'lost' && bet.crashMultiplier ? (
                              <span className="flex items-center gap-1 justify-end">
                                <span className="text-destructive/80">Crashed at</span>
                                <span className="font-medium">{bet.crashMultiplier.toFixed(2)}x</span>
                              </span>
                            ) : (
                              <span className="opacity-70">Multiplier: {(bet.cashoutAt || bet.crashMultiplier || 0).toFixed(2)}x</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}
        </AnimatePresence>
      </CardContent>
      
      {/* Footer with subtle animation */}
      <div className="px-4 pb-3 pt-1 border-t border-border/20">
        <motion.div 
          animate={{ opacity: isHovered ? 1 : 0.7 }}
          className="text-xs text-muted-foreground/80 text-center"
        >
          {recentBets.length > 0 ? (
            <span>Showing {recentBets.length} most recent bets</span>
          ) : (
            <span>Your bets will appear here</span>
          )}
        </motion.div>
      </div>
    </Card>
  );
}
