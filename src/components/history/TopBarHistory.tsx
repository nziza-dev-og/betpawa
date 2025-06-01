
"use client";

import { useGame } from '@/contexts/GameContext';

export function TopBarHistory() {
  const { gameState } = useGame();
  
  const getMultiplierColorClass = (point: number): string => {
    if (point < 1.5) return 'text-blue-400'; // Blue for low multipliers
    if (point < 3) return 'text-purple-400'; // Purple for medium
    if (point < 10) return 'text-orange-400'; // Orange for high
    return 'text-pink-500'; // Pink for very high (or a specific color for >10x)
  };

  return (
    <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center z-20">
      <div className="flex items-center space-x-2 overflow-x-auto scrollbar-hide">
        {gameState.lastCrashPoints.slice(0, 12).map((point, index) => (
          <span 
            key={index}
            className={`text-xs font-semibold px-2 py-0.5 rounded-sm bg-black/20 backdrop-blur-sm ${getMultiplierColorClass(point)}`}
          >
            {point.toFixed(2)}x
          </span>
        ))}
      </div>
      <div className="text-sm font-semibold text-gray-300 bg-black/30 px-3 py-1 rounded-md backdrop-blur-sm">
        FUN MODE
      </div>
    </div>
  );
}

    