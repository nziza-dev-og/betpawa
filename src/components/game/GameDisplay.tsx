
import { Plane, XCircle, Timer } from 'lucide-react'; // CheckCircle removed as it's not used.
import { Card, CardContent } from '@/components/ui/card';
import type { GamePhase } from '@/contexts/GameContext'; // Import GamePhase type

interface GameDisplayProps {
  multiplier: number;
  gamePhase: GamePhase; // Use GamePhase type
  timeRemaining?: number; 
}

export function GameDisplay({ multiplier, gamePhase, timeRemaining }: GameDisplayProps) {
  let statusText = "";
  let textColorClass = "text-foreground";
  let IconComponent: React.ElementType | null = null;

  switch (gamePhase) {
    case 'idle':
      statusText = `Next round in ${timeRemaining}s`;
      textColorClass = "text-muted-foreground";
      IconComponent = Timer;
      break;
    case 'starting':
      statusText = `Get Ready! ${timeRemaining}s`;
      textColorClass = "text-primary";
      IconComponent = Timer;
      break;
    case 'betting':
      statusText = `Place bets! ${timeRemaining}s left`;
      textColorClass = "text-accent";
      IconComponent = Timer;
      break;
    case 'playing':
      statusText = "Flying!"; // This text is usually overlaid by the large multiplier
      textColorClass = "text-primary";
      IconComponent = Plane;
      break;
    case 'crashed':
      statusText = `Crashed @ ${multiplier.toFixed(2)}x`;
      textColorClass = "text-destructive";
      IconComponent = XCircle;
      break;
    default:
      statusText = "Loading...";
      IconComponent = Timer;
  }

  const showMultiplier = gamePhase === 'playing' || gamePhase === 'crashed';

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl overflow-hidden">
      <CardContent className="p-6 flex flex-col items-center justify-center min-h-[250px] bg-card relative">
        {/* Icon display logic */}
        {IconComponent && gamePhase !== 'playing' && (
          <IconComponent className={`h-16 w-16 mb-4 ${textColorClass} opacity-80`} />
        )}
        {gamePhase === 'playing' && IconComponent && (
           <IconComponent className={`h-20 w-20 mb-6 text-primary animate-fly`} data-ai-hint="plane sky" />
        )}
        
        {/* Multiplier or Status Text */}
        {showMultiplier ? (
          <div className={`font-headline text-7xl font-bold ${gamePhase === 'crashed' ? 'text-destructive' : 'text-primary'}`}>
            {multiplier.toFixed(2)}x
          </div>
        ) : (
          // For non-playing/crashed states, show status text prominently
          <div className={`font-headline text-4xl font-bold ${textColorClass}`}>
            {statusText}
          </div>
        )}
        
        {/* Additional descriptive text for non-playing/crashed states if statusText is used above */}
        { (gamePhase !== 'playing' && gamePhase !== 'crashed' && !showMultiplier) && (
            <p className={`mt-2 text-center text-lg ${textColorClass}`}>{/* Redundant if statusText already shown above, kept for structure */}</p>
        )}
         { gamePhase === 'crashed' && !showMultiplier && ( // Should not happen as showMultiplier is true for crashed
            <p className={`mt-2 text-center text-lg ${textColorClass}`}>Round Over</p>
        )}
         { gamePhase === 'crashed' && showMultiplier && (
             <p className={`mt-2 text-center text-lg ${textColorClass}`}>Round Over</p>
         )}


      </CardContent>
    </Card>
  );
}

