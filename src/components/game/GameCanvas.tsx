
"use client";
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useGame, type GameStateContext as GameContextStateType, type ActiveBetContext } from '@/contexts/GameContext'; // Corrected import path
import { ActiveBet } from './ActiveBet';

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const pathPointsRef = useRef<{x: number, y: number}[]>([]);
  const { gameState, activeBets, timeRemaining } = useGame();
  
  const [smoothMultiplier, setSmoothMultiplier] = useState(1);

  const canvasGameStatus = useMemo(() => {
    switch (gameState.status) {
      case 'idle': case 'starting': return 'waiting';
      case 'betting': return 'betting';
      case 'playing': return 'flying';
      case 'crashed': return 'crashed';
      default: return 'waiting';
    }
  }, [gameState.status]);

  useEffect(() => {
    if (gameState.status === 'playing') {
      const target = gameState.multiplier;
      const animate = () => {
        setSmoothMultiplier(prev => {
          const diff = target - prev;
          const newValue = prev + diff * 0.15; 
          if (Math.abs(diff) < 0.01 || prev >= target) { // Ensure it doesn't overshoot and stops
             cancelAnimationFrame(animationRef.current!);
             return target;
          }
          return newValue;
        });
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
      };
    } else {
      setSmoothMultiplier(gameState.multiplier);
      if (animationRef.current) { // Ensure any playing animation is cancelled
        cancelAnimationFrame(animationRef.current);
      }
      if (gameState.status !== 'playing') { // Reset path on non-playing states
        pathPointsRef.current = [];
      }
    }
  }, [gameState.multiplier, gameState.status]);


  const calculateYPosition = useCallback((multiplierValue: number, logicalCanvasHeight: number, graphStartY: number) => {
    const visualMultiplier = Math.min(multiplierValue, 1000); 
    const graphHeight = graphStartY - 50; 
    let progressY = 0;
    if (visualMultiplier > 1) {
      progressY = Math.log10(visualMultiplier) / Math.log10(1000); 
    }
    return graphStartY - progressY * graphHeight;
  }, []);

  const calculateNewPosition = useCallback((currentMultiplier: number, canvas: HTMLCanvasElement) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = 50;
    const startY = logicalHeight - 50; 
    const maxX = logicalWidth - 50;
    
    const visualMultiplier = Math.min(currentMultiplier, 1000);
    
    let progressX;
    if (visualMultiplier <= 10) {
      progressX = (visualMultiplier - 1) / (10 - 1) * 0.5; 
    } else {
      progressX = 0.5 + (Math.log10(visualMultiplier / 10) / Math.log10(1000 / 10)) * 0.5;
    }
    progressX = Math.min(1, Math.max(0, progressX)); 
    
    const x = startX + progressX * (maxX - startX);
    const y = calculateYPosition(visualMultiplier, logicalHeight, startY);
    
    return { x: Math.max(startX, x), y: Math.min(startY, Math.max(50, y)) };
  }, [calculateYPosition]);

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
      const yPos = calculateYPosition(mult, logicalHeight, startY);
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
  }, [calculateYPosition]);

  const drawCurvedPath = useCallback((
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    points: {x: number, y: number}[],
    status: string
  ) => {
    if (points.length === 0 && status !== 'flying' && status !== 'crashed') { // Don't draw if no points and not in a relevant state
        ctx.beginPath();
        ctx.moveTo(startX, startY); // Keep a starting dot
        ctx.lineTo(startX + 0.1, startY); // Tiny line to make it "visible" if needed or just a point
        ctx.strokeStyle = 'rgba(255, 200, 0, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
    }
    if (points.length < 1 && (status === 'flying' || status === 'crashed') ) return; // Needs at least one point for flying/crashed drawing
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    
    if (points.length === 1) {
      ctx.lineTo(points[0].x, points[0].y);
    } else if (points.length > 1) {
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = (i === 0) ? {x: startX, y: startY} : points[i-1];
        const p1 = points[i];
        const p2 = points[i+1];
        const p3 = (i === points.length - 2) ? p2 : points[i+2];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        
        if (i === 0) ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x)/2, (p1.y + p2.y)/2); // Start with quad for smoothness
        else ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
       // Ensure path reaches the last point if not fully covered by loop
      if(points.length > 0) ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
    }
    
    ctx.strokeStyle = status === 'crashed' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 200, 0, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    if (status === 'flying' && points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      if (points.length === 1) {
        ctx.lineTo(points[0].x, points[0].y);
      } else {
        for (let i = 0; i < points.length - 1; i++) {
         const p0 = (i === 0) ? {x: startX, y: startY} : points[i-1];
         const p1 = points[i];
         const p2 = points[i+1];
         const p3 = (i === points.length - 2) ? p2 : points[i+2];

         const cp1x = p1.x + (p2.x - p0.x) / 6;
         const cp1y = p1.y + (p2.y - p0.y) / 6;
         const cp2x = p2.x - (p3.x - p1.x) / 6;
         const cp2y = p2.y - (p3.y - p1.y) / 6;

         if (i === 0) ctx.quadraticCurveTo(p1.x, p1.y, (p1.x + p2.x)/2, (p1.y + p2.y)/2);
         else ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
         if(points.length > 0) ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
      }
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.2)';
      ctx.lineWidth = 6;
      ctx.stroke();
    }
  }, []);

  const drawPlane = useCallback((
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    status: string,
    currentMultiplier: number
  ) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const planeSize = 12 / dpr;
    
    const path = pathPointsRef.current;
    const prevPos = path.length > 1 ? path[path.length - 2] : (path.length === 1 ? {x: 50, y: (canvasRef.current?.height ?? 0)/(dpr*2) - 50} : {x, y: y + 0.1}); // Avoid y being same as current y for angle
    const dx = x - prevPos.x;
    const dy = y - prevPos.y;
    let angle = Math.atan2(dy, dx);
    if(dx === 0 && dy === 0 && currentMultiplier <= 1.01) angle = -Math.PI / 4;


    const turnIntensity = Math.min(1, Math.max(-1, dx * 0.05)); 
    const bankAngle = turnIntensity * (Math.PI / 7); 
    
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    ctx.save();
    ctx.rotate(bankAngle);
    
    if (status === 'crashed') {
      for (let i = 0; i < 8; i++) {
        const radius = (2 + Math.random() * 4) / dpr;
        const smokeX = (-planeSize * 1.5 - Math.random() * planeSize * 1.5); 
        const smokeY = (Math.random() * planeSize * 1.5 - planeSize * 0.75);
        ctx.beginPath();
        ctx.arc(smokeX, smokeY, radius, 0, Math.PI * 2);
        ctx.fillStyle = i < 4 
          ? `rgba(255, ${60 + Math.random() * 60}, 0, ${0.5 + Math.random() * 0.3})` 
          : `rgba(80, 80, 80, ${0.4 + Math.random() * 0.3})`;
        ctx.fill();
      }
    } else if (status === 'flying' && currentMultiplier > 1.02) {
      for (let i = 0; i < 5; i++) {
        const length = (planeSize * 0.8 + Math.random() * planeSize * 1.2);
        const width = (0.8 + Math.random() * 1.2) / dpr;
        const offsetY = (Math.random() * planeSize * 0.8 - planeSize * 0.4);
        
        ctx.beginPath();
        ctx.moveTo(-planeSize*0.8, offsetY); 
        ctx.lineTo(-planeSize*0.8 - length, offsetY);
        ctx.strokeStyle = `rgba(255, ${120 + Math.random() * 80}, 0, ${0.4 + Math.random() * 0.4})`;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }
    
    ctx.fillStyle = status === 'crashed' ? 'rgba(200, 50, 50, 0.9)' : 'rgba(255, 200, 0, 1)';
    ctx.beginPath();
    ctx.moveTo(planeSize * 0.8, 0);
    ctx.lineTo(-planeSize * 0.8, -planeSize * 0.4);
    ctx.lineTo(-planeSize * 0.6, 0);
    ctx.lineTo(-planeSize * 0.8, planeSize * 0.4);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = status === 'crashed' ? 'rgba(180, 40, 40, 0.9)' : 'rgba(240, 170, 0, 1)'; // Slightly different wing color
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-planeSize * 0.3, -planeSize * 1.3);
    ctx.lineTo(-planeSize * 0.7, -planeSize * 1.1);
    ctx.lineTo(-planeSize * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-planeSize * 0.3, planeSize * 1.3);
    ctx.lineTo(-planeSize * 0.7, planeSize * 1.1);
    ctx.lineTo(-planeSize * 0.3, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.beginPath(); // Tail Fin
    ctx.moveTo(-planeSize * 0.7, 0);
    ctx.lineTo(-planeSize, -planeSize * 0.6);
    ctx.lineTo(-planeSize * 1.1, -planeSize * 0.5);
    ctx.lineTo(-planeSize * 0.8, 0);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore(); 
    
    ctx.fillStyle = 'rgba(100, 200, 255, 0.7)';
    ctx.beginPath();
    ctx.ellipse(planeSize * 0.4, 0, planeSize*0.3, planeSize*0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore(); 
    
    if (status !== 'waiting' && status !== 'betting') {
      ctx.font = `bold ${14/dpr}px Inter`;
      ctx.fillStyle = status === 'crashed' ? 'rgba(255, 80, 80, 1)' : 'rgba(255, 255, 255, 1)';
      ctx.textAlign = 'left';
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 5 / dpr;
      ctx.fillText(`${currentMultiplier.toFixed(2)}x`, x + (20 / dpr), y + (7 / dpr));
      ctx.shadowBlur = 0;
    }
  }, []);

  const drawCrashLine = useCallback((ctx: CanvasRenderingContext2D, logicalWidth: number, crashPlaneY: number, startX: number) => {
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.moveTo(startX, crashPlaneY);
    ctx.lineTo(logicalWidth - 20, crashPlaneY); // Draw up to the edge of graph area
    ctx.stroke();
    ctx.setLineDash([]);
  }, []);

  const drawGame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = 50;
    const startY = logicalHeight - 50;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawGrid(ctx, logicalWidth, logicalHeight);
    drawAxes(ctx, logicalWidth, logicalHeight, startX, startY);
    
    const { x, y } = calculateNewPosition(smoothMultiplier, canvas);
    
    if (canvasGameStatus === 'flying' || (canvasGameStatus === 'crashed' && pathPointsRef.current.length > 0)) {
       if (canvasGameStatus === 'flying' && (pathPointsRef.current.length === 0 || pathPointsRef.current[pathPointsRef.current.length -1].x < x )) {
          pathPointsRef.current.push({x, y});
          if (pathPointsRef.current.length > 150) { // Limit path points
            pathPointsRef.current.shift();
          }
       }
    } else if (canvasGameStatus !== 'flying' && canvasGameStatus !== 'crashed') {
        pathPointsRef.current = []; // Clear path if not flying or just crashed
    }
    
    drawCurvedPath(ctx, startX, startY, pathPointsRef.current, canvasGameStatus);
    
    const planeDrawX = (canvasGameStatus === 'crashed' && pathPointsRef.current.length > 0) ? pathPointsRef.current[pathPointsRef.current.length -1].x : x;
    const planeDrawY = (canvasGameStatus === 'crashed' && pathPointsRef.current.length > 0) ? pathPointsRef.current[pathPointsRef.current.length -1].y : y;
    drawPlane(ctx, planeDrawX, planeDrawY, canvasGameStatus, gameState.multiplier); // Use actual gameState.multiplier for text on crash
    
    if (canvasGameStatus === 'crashed') {
        const crashYPos = (pathPointsRef.current.length > 0) ? pathPointsRef.current[pathPointsRef.current.length-1].y : calculateYPosition(gameState.multiplier, logicalHeight, startY) ;
        drawCrashLine(ctx, logicalWidth, crashYPos, startX);
    }
  }, [canvasGameStatus, smoothMultiplier, gameState.multiplier, calculateNewPosition, calculateYPosition, drawGrid, drawAxes, drawCurvedPath, drawPlane, drawCrashLine ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const handleResize = () => {
      const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Apply scaling for DPR
      drawGame(ctx, canvas);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    let localAnimationId: number;
    const renderLoop = () => {
      drawGame(ctx, canvas);
      localAnimationId = requestAnimationFrame(renderLoop);
    };

    if (canvasGameStatus === 'flying' || (canvasGameStatus === 'crashed' && smoothMultiplier !== gameState.multiplier)) {
      localAnimationId = requestAnimationFrame(renderLoop);
    } else {
      drawGame(ctx, canvas); 
    }
    
    animationRef.current = localAnimationId;

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (localAnimationId) {
        cancelAnimationFrame(localAnimationId);
      }
    };
  }, [drawGame, canvasGameStatus, smoothMultiplier, gameState.multiplier]);


  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 to-gray-800 shadow-2xl">
      <canvas ref={canvasRef} className="w-full h-full" 
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