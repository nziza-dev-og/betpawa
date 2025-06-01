
"use client";
import { useRef, useEffect, useCallback } from 'react';
import { useGame, type GameStateContext as GameContextStateType, type ActiveBetContext } from '../../contexts/GameContext'; // Adjusted import
import { ActiveBet } from './ActiveBet'; // Adjusted import

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { gameState, activeBets, timeRemaining } = useGame(); // gameState from context
  
  // Map context status to canvas gameStatus string
  const mapContextStatusToCanvasStatus = (status: GameContextStateType['status']): 'waiting' | 'flying' | 'crashed' | 'betting' => {
    switch (status) {
      case 'idle':
      case 'starting':
        return 'waiting';
      case 'betting':
        return 'betting'; // Added betting status for canvas if needed by original logic
      case 'playing':
        return 'flying';
      case 'crashed':
        return 'crashed';
      default:
        return 'waiting';
    }
  };

  const canvasGameStatus = mapContextStatusToCanvasStatus(gameState.status);

  // Memoize drawGame to prevent re-creation on every render unless dependencies change
  const drawGame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentMultiplier: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', crashedAtMultiplier?: number) => {
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const startX = 50;
    const startY = height - 50;
    
    drawGrid(ctx, width, height);
    drawAxes(ctx, width, height, startX, startY);
    
    if (gameStatus === 'crashed' && crashedAtMultiplier) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      // Calculate Y position for crash line based on crashedAtMultiplier
      const crashLineY = startY - ((Math.min(crashedAtMultiplier, 1000) - 1) / (1000-1)) * (height - 100 - 20); // Adjusted scale
      ctx.moveTo(startX, crashLineY); // Start from axis
      ctx.lineTo(width, crashLineY);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    
    drawPlanePath(ctx, startX, startY, currentMultiplier, gameStatus, canvas);
    
    const { x, y } = calculateNewPosition(currentMultiplier, canvasRef.current!);
    drawPlane(ctx, x, y, gameStatus, currentMultiplier);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Dependencies for drawGame. Add any state/prop it closes over if not from args.
           // For calculateNewPosition, it uses canvasRef.current which is stable.

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
       // Redraw with current state after resize
      drawGame(ctx, canvas, gameState.multiplier, canvasGameStatus, gameState.status === 'crashed' ? gameState.multiplier : undefined);
    };
    
    resizeCanvas(); // Initial size and draw
    
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawGame, gameState.multiplier, canvasGameStatus, gameState.status]); // Redraw when these change


  // Main drawing effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.getContext('2d')) return;
    const ctx = canvas.getContext('2d')!;
    
    // The resize effect already calls drawGame, so this might be redundant
    // if resize effect's dependencies cover all draw scenarios.
    // However, explicit redraw on gameState change is safer.
    drawGame(ctx, canvas, gameState.multiplier, canvasGameStatus, gameState.status === 'crashed' ? gameState.multiplier : undefined);

  }, [gameState.multiplier, canvasGameStatus, drawGame, gameState.status]);


  const calculateNewPosition = (currentMultiplier: number, canvas: HTMLCanvasElement) => {
    if (!canvas) return { x: 50, y: window.innerHeight - 50}; // Fallback, should not happen
    const startX = 50;
    const startY = canvas.height / (window.devicePixelRatio || 1) - 50; // Adjust for DPR
    const maxX = canvas.width / (window.devicePixelRatio || 1) - 50;
    const graphHeight = canvas.height / (window.devicePixelRatio || 1) - 100; // Usable graph height
      
    const visualMultiplier = Math.min(currentMultiplier, 1000); 
    
    // X: Logarithmic scale for time/progress, up to a point, then linear
    let progressX;
    if (visualMultiplier <= 10) {
        progressX = (visualMultiplier - 1) / (10 - 1) * 0.5; // First 50% of width for up to 10x
    } else {
        progressX = 0.5 + ((Math.log10(visualMultiplier / 10)) / (Math.log10(1000 / 10))) * 0.5; // Remaining 50% for 10x to 1000x
    }
    progressX = Math.min(1, Math.max(0, progressX));
    const x = startX + progressX * (maxX - startX);
      
    // Y: Logarithmic scale for multiplier value
    let progressY = 0;
    if (visualMultiplier > 1) {
      // Normalize based on log of (max_visual_multiplier / min_visual_multiplier)
      progressY = Math.log10(visualMultiplier) / Math.log10(1000);
    }
    const y = startY - progressY * graphHeight;
      
    return { x: Math.max(startX, x), y: Math.min(startY, Math.max(50, y)) }; // Clamp values
  };
  
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)'; // Lighter grid
    ctx.lineWidth = 0.5; // Thinner lines
    
    const dpr = window.devicePixelRatio || 1;
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
      ctx.moveTo(0, logicalHeight - y); // Origin bottom-left for grid y
      ctx.lineTo(logicalWidth, logicalHeight - y);
      ctx.stroke();
    }
  };
  
  const drawAxes = (ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number) => {
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = width / dpr;
    // const logicalHeight = height / dpr;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.3)';
    ctx.lineWidth = 1;
    ctx.moveTo(startX, startY); // X-axis (time/progress)
    ctx.lineTo(logicalWidth - 20, startY);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(startX, startY); // Y-axis (multiplier)
    ctx.lineTo(startX, 20);
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(200, 200, 200, 0.7)';
    ctx.font = `${10 / dpr}px Inter`; // Adjust font size for DPR
    ctx.textAlign = 'right';
    
    const multipliers = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
    const graphHeight = startY - 20; // Max Y point for labels

    multipliers.forEach(mult => {
      let progressY = 0;
      if (mult > 1) {
        progressY = Math.log10(mult) / Math.log10(1000);
      }
      const yPos = startY - progressY * graphHeight;
      if (yPos >= 20) {
        ctx.fillText(`${mult}x`, startX - 5, yPos + 3/dpr );
        
        // Tick mark
        ctx.beginPath();
        ctx.moveTo(startX - 2, yPos);
        ctx.lineTo(startX + 2, yPos);
        ctx.stroke();
      }
    });

    // X-axis labels (time/progress, illustrative)
    ctx.textAlign = 'center';
    const timePoints = [0, 2, 5, 10, 20]; // seconds (illustrative)
    const maxX = logicalWidth - startX -20;
    timePoints.forEach((sec, index) => {
        const xPos = startX + (index / (timePoints.length -1)) * maxX * 0.8; // Distribute along 80% of axis
        if(xPos < logicalWidth - 20) {
            ctx.fillText(`${sec}s`, xPos, startY + 15/dpr);
        }
    });
  };
  
  const drawPlanePath = (ctx: CanvasRenderingContext2D, startX: number, startY: number, currentMultiplier: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', canvas: HTMLCanvasElement) => {
    if (!canvas) return;
    ctx.beginPath();
    ctx.strokeStyle = gameStatus === 'crashed' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 200, 0, 0.9)'; // Orange-yellow
    ctx.lineWidth = 2 / (window.devicePixelRatio || 1) ;
    ctx.moveTo(startX, startY);
    
    const { x, y } = calculateNewPosition(currentMultiplier, canvas);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    if (gameStatus === 'flying') {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.2)';
      ctx.lineWidth = 6 / (window.devicePixelRatio || 1);
      ctx.moveTo(startX, startY);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };
  
  const drawPlane = (ctx: CanvasRenderingContext2D, x: number, y: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', currentMultiplier: number) => {
    ctx.save();
    const dpr = window.devicePixelRatio || 1;
    
    const planeSize = 10 / dpr;

    const prevPos = calculateNewPosition(Math.max(1,currentMultiplier-0.01), canvasRef.current!);
    let angle = Math.atan2(y - prevPos.y, x - prevPos.x);
    if (x === prevPos.x && y === prevPos.y) angle = -Math.PI / 4; // Default angle if no movement (e.g. at 1x)


    ctx.translate(x, y);
    ctx.rotate(angle);
    
    if (gameStatus === 'crashed') {
      ctx.fillStyle = 'rgba(255, 50, 50, 0.9)'; // Darker red
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
      ctx.fillStyle = 'rgba(255, 200, 0, 1)'; // Solid yellow-orange
      if (gameStatus === 'flying' && currentMultiplier > 1.01) { // Only show thrust if actually moving
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
    
    // Plane body
    ctx.beginPath();
    ctx.moveTo(planeSize, 0); // Nose
    ctx.lineTo(-planeSize, -planeSize * 0.5); // Tail top
    ctx.lineTo(-planeSize * 0.7, 0); // Fuselage mid bottom
    ctx.lineTo(-planeSize, planeSize * 0.5); // Tail bottom
    ctx.closePath();
    ctx.fill();
    
    // Wings
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
    
    // Draw multiplier text near plane
    if (gameStatus !== 'waiting' && gameStatus !== 'betting' ) {
        ctx.font = `bold ${12/dpr}px Inter`;
        ctx.fillStyle = gameStatus === 'crashed' ? 'rgba(255, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        ctx.textAlign = 'left';
        ctx.shadowColor = "black";
        ctx.shadowBlur = 2 / dpr;
        ctx.fillText(`${currentMultiplier.toFixed(2)}x`, x + (15 / dpr), y + (5 / dpr));
        ctx.shadowBlur = 0;
    }
  };
  
  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-lg shadow-xl bg-gray-800"> {/* Changed background */}
      <canvas 
        ref={canvasRef}
        className="w-full h-full" 
        // Removed bg-primary, parent div handles background
      />
      
      {canvasGameStatus === 'flying' && activeBets.length > 0 && (
        <div className="absolute right-2 top-2 md:right-4 md:top-4 max-w-[150px] md:max-w-xs w-full space-y-1 md:space-y-2">
          {activeBets.slice(0, 3).map((bet: ActiveBetContext) => ( // Added type for bet
            <ActiveBet key={bet.id} betId={bet.id} amount={bet.amount} />
          ))}
          {activeBets.length > 3 && (
            <div className="text-center text-xs text-gray-300 bg-black/30 p-1 rounded">
              +{activeBets.length - 3} more
            </div>
          )}
        </div>
      )}
      
      {(canvasGameStatus === 'waiting' || canvasGameStatus === 'betting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
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
        <div className="absolute inset-0 flex items-center justify-center bg-red-700/20 backdrop-blur-sm">
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
