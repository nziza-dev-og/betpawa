
"use client";
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useGame, type GameStateContext as GameContextStateType, type ActiveBetContext } from '@/contexts/GameContext';
import { ActiveBet } from './ActiveBet';

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const { gameState, activeBets, timeRemaining } = useGame();
  
  const canvasGameStatus = useMemo(() => {
    switch (gameState.status) {
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
  }, [gameState.status]);

  const [smoothMultiplier, setSmoothMultiplier] = useState(1.00);
  
  useEffect(() => {
    if (gameState.status === 'playing') {
      // For playing state, we want a smooth interpolation
      // This effect will handle the RAF loop for smoothing
      let currentAnimationId: number;
      const animate = () => {
        setSmoothMultiplier(prevSmooth => {
          const target = gameState.multiplier;
          if (Math.abs(target - prevSmooth) < 0.01) {
            cancelAnimationFrame(currentAnimationId);
            return target; // Snap to target if very close
          }
          // Interpolate (adjust 0.1 for speed, smaller means slower)
          return prevSmooth + (target - prevSmooth) * 0.05; 
        });
        currentAnimationId = requestAnimationFrame(animate);
      };
      currentAnimationId = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(currentAnimationId);
    } else {
      // For other states, snap directly to the game state multiplier
      setSmoothMultiplier(gameState.multiplier);
      if (animationRef.current) { // Ensure any previous flying animation is cancelled
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [gameState.multiplier, gameState.status]);


  // Helper function for Y position calculation (used by multiple drawing functions)
  const calculateYPositionOnGraph = useCallback((multiplierValue: number, logicalCanvasHeight: number, graphStartY: number) => {
    const visualMultiplier = Math.min(multiplierValue, 1000); // Cap at 1000x for visual scaling
    const graphHeight = graphStartY - 50; // Deduct top margin
    let progressY = 0;
    if (visualMultiplier > 1) {
      progressY = Math.log10(visualMultiplier) / Math.log10(1000); // Logarithmic scale up to 1000x
    }
    return graphStartY - progressY * graphHeight;
  }, []);

  // New calculateNewPosition based on user's provided logic
  const calculateNewPosition = useCallback((currentMultiplier: number, canvas: HTMLCanvasElement) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = 50;
    const startY = logicalHeight - 50; // This is graph's baseline Y
    const maxX = logicalWidth - 50;
    
    const visualMultiplier = Math.min(currentMultiplier, 1000);
    
    let progressX;
    if (visualMultiplier <= 10) {
      progressX = (visualMultiplier - 1) / (10 - 1) * 0.5; // (multiplier-1)/(10-1) normalizes 1-10 to 0-1
    } else {
      // For multipliers > 10, use log scale for the remaining half
      progressX = 0.5 + (Math.log10(visualMultiplier / 10) / Math.log10(1000 / 10)) * 0.5;
    }
    progressX = Math.min(1, Math.max(0, progressX)); // Clamp progressX between 0 and 1
    
    const x = startX + progressX * (maxX - startX);
    const y = calculateYPositionOnGraph(visualMultiplier, logicalHeight, startY);
    
    return { x: Math.max(startX, x), y: Math.min(startY, Math.max(50, y)) };
  }, [calculateYPositionOnGraph]);


  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, logicalWidth: number, logicalHeight: number) => {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.15)';
    ctx.lineWidth = 0.5;
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
  
  const drawAxes = useCallback((ctx: CanvasRenderingContext2D, logicalWidth: number, logicalHeight: number, startX: number, startY: number) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
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
    multipliers.forEach(mult => {
      const yPos = calculateYPositionOnGraph(mult, logicalHeight, startY);
      if (yPos >= 20) {
        ctx.fillText(`${mult}x`, startX - 5, yPos + (3 / dpr));
        ctx.beginPath();
        ctx.moveTo(startX - 2, yPos);
        ctx.lineTo(startX + 2, yPos);
        ctx.stroke();
      }
    });

    ctx.textAlign = 'center';
    const timePoints = [0, 2, 5, 10, 20]; 
    const graphUsableWidth = logicalWidth - startX - 20;
    timePoints.forEach((sec, index) => {
        const xPos = startX + (index / (timePoints.length -1)) * graphUsableWidth * 0.8; 
        if(xPos < logicalWidth - 20) {
            ctx.fillText(`${sec}s`, xPos, startY + (15/dpr));
        }
    });
  }, [calculateYPositionOnGraph]);

  const drawPlanePath = useCallback((ctx: CanvasRenderingContext2D, startX: number, startY: number, currentMultiplierValue: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', canvas: HTMLCanvasElement) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    ctx.beginPath();
    ctx.strokeStyle = gameStatus === 'crashed' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 200, 0, 0.9)';
    ctx.lineWidth = 2 / dpr ;
    ctx.moveTo(startX, startY);
    
    const { x, y } = calculateNewPosition(currentMultiplierValue, canvas);
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
  
  const drawPlane = useCallback((ctx: CanvasRenderingContext2D, currentPlaneX: number, currentPlaneY: number, gameStatus: 'waiting' | 'flying' | 'crashed' | 'betting', currentMultiplierValue: number) => {
    ctx.save();
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const planeSize = 10 / dpr;

    const prevPos = calculateNewPosition(Math.max(1,currentMultiplierValue-0.015), canvasRef.current!); // Slightly behind for angle
    let angle = Math.atan2(currentPlaneY - prevPos.y, currentPlaneX - prevPos.x);
    if (currentPlaneX === prevPos.x && currentPlaneY === prevPos.y && currentMultiplierValue <= 1.01) angle = -Math.PI / 4;

    ctx.translate(currentPlaneX, currentPlaneY);
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
      if (gameStatus === 'flying' && currentMultiplierValue > 1.01) {
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
    
    ctx.beginPath(); ctx.moveTo(planeSize, 0); ctx.lineTo(-planeSize, -planeSize * 0.5); ctx.lineTo(-planeSize * 0.7, 0); ctx.lineTo(-planeSize, planeSize * 0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-planeSize*0.3, -planeSize*1.2); ctx.lineTo(-planeSize*0.6, -planeSize*1.2); ctx.lineTo(-planeSize*0.3, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-planeSize*0.3, planeSize*1.2); ctx.lineTo(-planeSize*0.6, planeSize*1.2); ctx.lineTo(-planeSize*0.3, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    
    if (gameStatus !== 'waiting' && gameStatus !== 'betting' ) {
        ctx.font = `bold ${12/dpr}px Inter`;
        ctx.fillStyle = gameStatus === 'crashed' ? 'rgba(255, 50, 50, 0.9)' : 'rgba(255, 255, 255, 0.95)';
        ctx.textAlign = 'left';
        ctx.shadowColor = "black";
        ctx.shadowBlur = 2 / dpr;
        ctx.fillText(`${currentMultiplierValue.toFixed(2)}x`, currentPlaneX + (15 / dpr), currentPlaneY + (5 / dpr));
        ctx.shadowBlur = 0;
    }
  }, [calculateNewPosition]);

  const drawCrashLine = useCallback((ctx: CanvasRenderingContext2D, logicalWidth: number, crashY: number, startX: number) => {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.moveTo(startX, crashY);
    ctx.lineTo(logicalWidth, crashY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const mainDrawGameRender = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = 50;
    const startY = logicalHeight - 50; // Graph baseline Y
    
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Use physical dimensions for clearing
    
    drawGrid(ctx, logicalWidth, logicalHeight);
    drawAxes(ctx, logicalWidth, logicalHeight, startX, startY);
    
    const currentDisplayMultiplier = canvasGameStatus === 'crashed' ? gameState.multiplier : smoothMultiplier;

    if (canvasGameStatus === 'crashed') {
      const crashLinePlotY = calculateYPositionOnGraph(gameState.multiplier, logicalHeight, startY);
      drawCrashLine(ctx, logicalWidth, crashLinePlotY, startX);
    }
    
    drawPlanePath(ctx, startX, startY, currentDisplayMultiplier, canvasGameStatus, canvas);
    
    const { x, y } = calculateNewPosition(currentDisplayMultiplier, canvas);
    drawPlane(ctx, x, y, canvasGameStatus, currentDisplayMultiplier);
  }, [canvasGameStatus, gameState.multiplier, smoothMultiplier, drawGrid, drawAxes, drawPlanePath, drawPlane, calculateNewPosition, calculateYPositionOnGraph, drawCrashLine]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Apply scaling for DPR
      mainDrawGameRender(ctx, canvas); // Redraw after resize
    };

    handleResize(); // Initial setup
    window.addEventListener('resize', handleResize);

    let localAnimationId: number;
    const renderLoop = () => {
      mainDrawGameRender(ctx, canvas);
      localAnimationId = requestAnimationFrame(renderLoop);
    };

    if (gameState.status === 'playing' || (gameState.status === 'crashed' && smoothMultiplier !== gameState.multiplier)) {
       // Start RAF loop if playing, or if crashed and smoothMultiplier hasn't reached target yet
      localAnimationId = requestAnimationFrame(renderLoop);
    } else {
      mainDrawGameRender(ctx, canvas); // Draw once for non-playing states or if already snapped
    }
    
    animationRef.current = localAnimationId; // Store for cleanup

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
       if (localAnimationId) { // Also cancel the loop-specific ID
        cancelAnimationFrame(localAnimationId);
      }
    };
  }, [mainDrawGameRender, gameState.status, smoothMultiplier, gameState.multiplier]);


  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl">
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
            <div className="text-center text-xs text-gray-300 bg-black/40 p-1 rounded-lg backdrop-blur-sm">
              +{activeBets.length - 3} more
            </div>
          )}
        </div>
      )}
      
      {(canvasGameStatus === 'waiting' || canvasGameStatus === 'betting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-md z-10">
          <div className="text-center p-6 rounded-xl bg-gray-900/80 border border-gray-700 shadow-lg">
            <div className="text-xl md:text-2xl font-bold mb-2 text-white">
              {canvasGameStatus === 'betting' ? "Place Your Bets!" : "Next Round Starting"}
            </div>
            <div className="text-5xl md:text-6xl font-bold text-yellow-400 animate-pulse">
              {timeRemaining}
            </div>
          </div>
        </div>
      )}
      
      {canvasGameStatus === 'crashed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-sm z-10">
          <div className="text-center p-6 rounded-xl bg-gray-900/80 border border-red-700/50 shadow-lg">
            <div className="text-3xl md:text-4xl font-bold text-red-400 mb-2 animate-bounce">
              CRASHED @ {gameState.multiplier.toFixed(2)}x
            </div>
            <div className="text-sm text-gray-300">
              Next round in {timeRemaining}...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;

    