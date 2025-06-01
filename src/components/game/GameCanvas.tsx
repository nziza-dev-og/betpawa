
"use client";
import { useRef, useEffect, useCallback } from 'react';
import { useGame, type GameStateContext as GameContextStateType, type ActiveBetContext } from '@/contexts/GameContext'; // Adjusted import
import { ActiveBet } from './ActiveBet';

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, activeBets, timeRemaining } = useGame();
  
  const mapContextStatusToCanvasStatus = (status: GameContextStateType['status']): 'waiting' | 'flying' | 'crashed' | 'betting' => {
    switch (status) {
      case 'idle':
      case 'starting':
        return 'waiting';
      case 'betting':
        return 'betting';
      case 'playing':
        return 'flying';
      case 'crashed':
        return 'crashed';
      default:
        return 'waiting';
    }
  };

  const canvasGameStatus = mapContextStatusToCanvasStatus(gameState.status);

  const calculateNewPosition = useCallback((currentMultiplier: number, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return { x: 50, y: (typeof window !== "undefined" ? window.innerHeight : 300) - 50}; // Fallback
    
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalCanvasHeight = canvas.height / dpr;
    const logicalCanvasWidth = canvas.width / dpr;

    const startX = 50;
    const startY = logicalCanvasHeight - 50;
    const maxX = logicalCanvasWidth - 50;
    const graphHeight = logicalCanvasHeight - 100; 
      
    const visualMultiplier = Math.min(currentMultiplier, 1000); 
    
    let progressX;
    if (visualMultiplier <= 10) {
        progressX = (visualMultiplier - 1) / (10 - 1) * 0.5; 
    } else {
        progressX = 0.5 + ((Math.log10(visualMultiplier / 10)) / (Math.log10(1000 / 10))) * 0.5;
    }
    progressX = Math.min(1, Math.max(0, progressX));
    const x = startX + progressX * (maxX - startX);
      
    let progressY = 0;
    if (visualMultiplier > 1) {
      progressY = Math.log10(visualMultiplier) / Math.log10(1000);
    }
    const y = startY - progressY * graphHeight;
      
    return { x: Math.max(startX, x), y: Math.min(startY, Math.max(50, y)) };
  }, []);
  
  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)';
    ctx.lineWidth = 0.5;
    
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = width / dpr;
    const logicalHeight = height / dpr;

    for (let x = 50; x < logicalWidth; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, logicalHeight);
      ctx.stroke();
    }
    
    for (let y = 50; y < logicalHeight; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, logicalHeight - y);
      ctx.lineTo(logicalWidth, logicalHeight - y);
      ctx.stroke();
    }
  }, []);
  
  const drawAxes = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = width / dpr;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(startX, startY); 
    ctx.lineTo(logicalWidth - 20, startY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX, 20);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.font = `${10 / dpr}px Inter`;
    ctx.textAlign = 'right';
    
    const multipliers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const graphHeight = startY - 20;

    multipliers.forEach(mult => {
      let progressY = 0;
      if (mult > 1) {
        progressY = Math.log10(mult) / Math.log10(1000);
      }
      const yPos = startY - progressY * graphHeight;
      if (yPos >= 20) {
        ctx.fillText(`${mult}x`, startX - 5, yPos + 3/dpr );
        
        ctx.beginPath();
        ctx.moveTo(startX - 2, yPos);
        ctx.lineTo(startX + 2, yPos);
        ctx.stroke();
      }
    });

    ctx.textAlign = 'center';
    const timePoints = [0, 2, 5, 10, 20]; 
    const maxX = logicalWidth - startX -20;
    timePoints.forEach((sec, index) => {
        const xPos = startX + (index / (timePoints.length -1)) * maxX * 0.8; 
        if(xPos < logicalWidth - 20) {
            ctx.fillText(`${sec}s`, xPos, startY + 15/dpr);
        }
    });
  }, []);
  
  const drawPlanePath = useCallback((ctx: CanvasRenderingContext2D, startX: number, startY: number, currentMultiplier: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    ctx.beginPath();
    ctx.strokeStyle = gameStatus === 'crashed' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 200, 0, 0.9)';
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    ctx.lineWidth = 2 / dpr ;
    ctx.moveTo(startX, startY);
    
    const { x, y } = calculateNewPosition(currentMultiplier, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    if (gameStatus === 'flying') {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.2)';
      ctx.lineWidth = 6 / dpr;
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }, [calculateNewPosition]);
  
  const drawPlane = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', currentMultiplier: number) => {
    ctx.save();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    
    const planeSize = 10 / dpr;

    const prevPos = calculateNewPosition(Math.max(1,currentMultiplier-0.01), canvasRef.current!);
    let angle = Math.atan2(y - prevPos.y, x - prevPos.x);
    if (x === prevPos.x && y === prevPos.y) angle = -Math.PI / 4;


    ctx.translate(x, y);
    ctx.rotate(angle);
    
    if (gameStatus === 'crashed') {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.9)';
      for (let i = 0; i < 5; i++) {
        const radius = (2 + Math.random() * 3) / dpr;
        const smokeX = (-planeSize * 1.5 - Math.random() * planeSize) ;
        const smokeY = (-planeSize * 0.5 + Math.random() * planeSize - planeSize * 0.5) ;
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(100, 100, 100, ${0.5 + Math.random() * 0.3})`;
        ctx.fill();
      }
    } else {
      ctx.fillStyle = 'rgba(255, 200, 0, 1)';
      if (gameStatus === 'flying' && currentMultiplier > 1.01) {
        for (let i = 0; i < 3; i++) {
          const lineLength = (planeSize*0.5 + Math.random() * planeSize) ;
          const lineY = (-planeSize*0.3 + Math.random() * planeSize*0.6) ;
          ctx.beginPath();
          ctx.moveTo(-planeSize*0.8, lineY);
          ctx.lineTo(-planeSize*0.8 - lineLength, lineY);
          ctx.strokeStyle = `rgba(255, 100, 0, ${0.4 + Math.random() * 0.4})`;
          ctx.lineWidth = (1 + Math.random()) / dpr;
          ctx.stroke();
        }
      }
    }
    
    ctx.beginPath();
    ctx.moveTo(planeSize, 0);
    ctx.lineTo(-planeSize, -planeSize * 0.5);
    ctx.lineTo(-planeSize * 0.7, 0);
    ctx.lineTo(-planeSize, planeSize * 0.5);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-planeSize*0.3, -planeSize*1.2);
    ctx.lineTo(-planeSize*0.6, -planeSize*1.2);
    ctx.lineTo(-planeSize*0.3, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(0,0);
    ctx.lineTo(-planeSize*0.3, planeSize*1.2);
    ctx.lineTo(-planeSize*0.6, planeSize*1.2);
    ctx.lineTo(-planeSize*0.3, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    if (gameStatus !== 'waiting' && gameStatus !== 'betting' ) {
        ctx.font = `bold ${12/dpr}px Inter`;
        ctx.fillStyle = gameStatus === 'crashed' ? 'rgba(255, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        ctx.textAlign = 'left';
        ctx.shadowColor = "black";
        ctx.shadowBlur = 2 / dpr;
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, x + (15 / dpr), y + (5 / dpr));
        ctx.shadowBlur = 0;
    }
  }, [calculateNewPosition]);


  const drawGame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentMultiplier: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', crashedAtMultiplier?: number) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const width = canvas.width / dpr; // Use logical width/height for drawing calculations
    const height = canvas.height / dpr;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear with physical width/height
    
    const startX = 50;
    const startY = height - 50;
    
    drawGrid(ctx, canvas.width, canvas.height);
    drawAxes(ctx, canvas.width, canvas.height, startX, startY);
    
    if (gameStatus === 'crashed' && crashedAtMultiplier) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const crashLineY = startY - ((Math.min(crashedAtMultiplier, 1000) - 1) / (1000-1)) * (height - 100 - 20);
      ctx.moveTo(startX, crashLineY);
      ctx.lineTo(width, crashLineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    drawPlanePath(ctx, startX, startY, currentMultiplier, gameStatus, canvas);
    
    const { x, y } = calculateNewPosition(currentMultiplier, canvas);
    drawPlane(ctx, x, y, gameStatus, currentMultiplier);
  }, [drawGrid, drawAxes, drawPlanePath, calculateNewPosition, drawPlane]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let animationFrameId: number;

    const renderLoop = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Apply scaling for DPR
      }
      
      drawGame(ctx, canvas, gameState.multiplier, canvasGameStatus, gameState.status === 'crashed' ? gameState.multiplier : undefined);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    
    renderLoop(); // Start the animation loop

    const handleResize = () => {
        // The loop itself handles resizing by checking boundingRect
        // No explicit redraw needed here as the loop will pick it up.
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [drawGame, gameState.multiplier, canvasGameStatus, gameState.status]);

  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-lg shadow-xl bg-gray-800 dark:bg-gray-900">
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
        aria-label="Skytrax game animation" 
      />
      
      {canvasGameStatus === 'flying' && activeBets.length > 0 && (
        <div className="absolute right-2 top-2 md:right-4 md:top-4 max-w-[150px] md:max-w-xs w-full space-y-1 md:space-y-2 z-10">
          {activeBets.slice(0, 3).map((bet: ActiveBetContext) => (
            <ActiveBet key={bet.id} betId={bet.id} amount={bet.amount} />
          ))}
          {activeBets.length > 3 && (
            <div className="text-center text-xs text-gray-300 bg-black/50 p-1 rounded">
              +{activeBets.length - 3} more
            </div>
          )}
        </div>
      )}
      
      {(canvasGameStatus === 'waiting' || canvasGameStatus === 'betting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <div className="text-center p-4 rounded-lg bg-background/20">
            <div className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-white">
              {canvasGameStatus === 'betting' ? "Place Your Bets!" : "Next Round In..."}
            </div>
            <div className="text-4xl md:text-5xl font-bold text-accent animate-pulse">
              {timeRemaining}
            </div>
          </div>
        </div>
      )}
      
      {canvasGameStatus === 'crashed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-700/30 backdrop-blur-sm z-10">
          <div className="text-center p-4 rounded-lg bg-background/20">
            <div className="text-2xl md:text-3xl font-bold text-red-400 mb-2 animate-pulse">
              CRASHED @ {gameState.multiplier.toFixed(2)}x
            </div>
            <div className="text-sm text-gray-300">Next round starting soon...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;

    