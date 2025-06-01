
import { Plane, XCircle, CheckCircle, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface GameDisplayProps {
  multiplier: number;
  gamePhase: 'idle' | 'betting' | 'playing' | 'crashed' | 'starting';
  timeRemaining?: number; // Optional: for betting phase countdown
}

export function GameDisplay({ multiplier, gamePhase, timeRemaining }: GameDisplayProps) {
  let statusText = "";
  let textColorClass = "text-foreground";
  let IconComponent: React.ElementType | null = null;

  switch (gamePhase) {
    case 'idle':
      statusText = "Next round starting soon...";
      textColorClass = "text-muted-foreground";
      IconComponent = Timer;
      break;
    case 'starting':
      statusText = "Get Ready!";
      textColorClass = "text-primary";
      IconComponent = Timer;
      break;
    case 'betting':
      statusText = `Place your bets! ${timeRemaining !== undefined ? `(${timeRemaining}s)` : ''}`;
      textColorClass = "text-accent";
      IconComponent = Timer;
      break;
    case 'playing':
      statusText = "Flying!";
      textColorClass = "text-primary";
      IconComponent = Plane; // Changed from Rocket
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
        {IconComponent && gamePhase !== 'playing' && (
          <IconComponent className={`h-16 w-16 mb-4 ${textColorClass} opacity-80`} />
        )}
        {gamePhase === 'playing' && IconComponent && ( // Ensure IconComponent is defined for playing phase
           <IconComponent className={`h-20 w-20 mb-6 text-primary animate-fly`} data-ai-hint="plane sky" />
        )}
        
        {showMultiplier ? (
          <div className={`font-headline text-7xl font-bold ${gamePhase === 'crashed' ? 'text-destructive' : 'text-primary'}`}>
            {multiplier.toFixed(2)}x
          </div>
        ) : (
          <div className={`font-headline text-4xl font-bold ${textColorClass}`}>
            {statusText}
          </div>
        )}
        
        { (gamePhase !== 'playing' && gamePhase !== 'crashed') && (
            <p className={`mt-2 text-center text-lg ${textColorClass}`}>{statusText}</p>
        )}
         { gamePhase === 'crashed' && (
            <p className={`mt-2 text-center text-lg ${textColorClass}`}>Round Over</p>
        )}

      </CardContent>
    </Card>
  );
}
