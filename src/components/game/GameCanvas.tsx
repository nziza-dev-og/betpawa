
"use client";
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { ActiveBet } from './ActiveBet';
import type { ActiveBetContext as ActiveBetContextType } from '../../contexts/GameContext';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  decay: number;
  size: number;
  color: string;
}

type CanvasGameStatus = 'waiting' | 'betting' | 'flying' | 'crashed';

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationLoopRef = useRef<number | undefined>(); // For the main render loop
  const smoothMultiplierAnimationRef = useRef<number | undefined>(); // For multiplier animation specifically
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<Particle[]>([]);
  const { gameState, activeBets, timeRemaining } = useGame();
  
  const canvasGameStatus: CanvasGameStatus = useMemo(() => {
    switch (gameState.status) {
      case 'idle': case 'starting': return 'waiting';
      case 'betting': return 'betting';
      case 'playing': return 'flying';
      case 'crashed': return 'crashed';
      default: return 'waiting';
    }
  }, [gameState.status]);

  const [smoothMultiplier, setSmoothMultiplier] = useState(1);

  useEffect(() => {
    if (gameState.status === 'playing') {
      const target = gameState.multiplier;
      
      const animate = () => {
        setSmoothMultiplier(prev => {
          const diff = target - prev;
          if (Math.abs(diff) < 0.01) { // Snap to target if very close
            if (smoothMultiplierAnimationRef.current) cancelAnimationFrame(smoothMultiplierAnimationRef.current);
            return target;
          }
          const newValue = prev + diff * 0.1; // Adjust for animation speed
          return newValue;
        });
        smoothMultiplierAnimationRef.current = requestAnimationFrame(animate);
      };
      
      smoothMultiplierAnimationRef.current = requestAnimationFrame(animate);
      
      return () => {
        if (smoothMultiplierAnimationRef.current) cancelAnimationFrame(smoothMultiplierAnimationRef.current);
      };
    } else {
      setSmoothMultiplier(gameState.multiplier); // Snap to current multiplier if not playing
      if (smoothMultiplierAnimationRef.current) { // Cancel any ongoing animation
        cancelAnimationFrame(smoothMultiplierAnimationRef.current);
        smoothMultiplierAnimationRef.current = undefined;
      }
    }
  }, [gameState.multiplier, gameState.status]);

  const createParticles = useCallback((x: number, y: number, type: 'trail' | 'explosion' = 'trail'): Particle[] => {
    const newParticles: Particle[] = [];
    const count = type === 'explosion' ? 20 : 5;
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * (type === 'explosion' ? 10 : 2),
        vy: (Math.random() - 0.5) * (type === 'explosion' ? 10 : 2),
        life: 1,
        decay: type === 'explosion' ? 0.02 : 0.05,
        size: Math.random() * (type === 'explosion' ? 6 : 3) + 2,
        color: type === 'explosion' ? `hsl(${Math.random() * 60}, 100%, 50%)` : `hsl(${200 + Math.random() * 60}, 70%, 60%)`
      });
    }
    return newParticles;
  }, []);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y <= height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  }, []);

  const drawAxes = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number, startX: number, startY: number) => {
    ctx.shadowColor = 'rgba(0, 255, 255, 0.5)'; ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.8)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(startX, 0); ctx.lineTo(startX, startY); ctx.lineTo(width, startY); ctx.stroke();
    ctx.shadowBlur = 0;
  }, []);
  
  const calculateYPosition = useCallback((multiplier: number, logicalGraphHeight: number, graphStartY: number): number => {
    const visualMultiplier = Math.min(multiplier, 1000);
    const progressY = visualMultiplier > 1 ? Math.log10(visualMultiplier) / Math.log10(1000) : 0;
    return graphStartY - progressY * logicalGraphHeight;
  }, []);

  const calculateNewPosition = useCallback((currentMultiplier: number, canvas: HTMLCanvasElement | null): { x: number, y: number } => {
    if (!canvas) return { x: 50, y: window.innerHeight - 50 };
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = 50;
    const startY = logicalHeight - 50; // Graph's 0,0 for multiplier path
    const maxX = logicalWidth - 50;   // Right edge for graph
    const graphDrawingHeight = startY - 50; // Max Y extent for graph from startY up to margin

    const visualMultiplier = Math.min(currentMultiplier, 1000);
    let progressX;
    if (visualMultiplier <= 10) {
      progressX = (visualMultiplier - 1) / 9 * 0.5;
    } else {
      progressX = 0.5 + (Math.log10(visualMultiplier / 10) / Math.log10(100)) * 0.5; // log10(1000/10) = log10(100) = 2
    }
    progressX = Math.max(0, Math.min(1, progressX)); // Clamp progressX
    const x = startX + progressX * (maxX - startX);
    
    const yVal = calculateYPosition(visualMultiplier, graphDrawingHeight, startY);
    return { x: Math.max(startX, x), y: Math.min(startY, Math.max(50, yVal)) }; // Clamp Y within bounds
  }, [calculateYPosition]);

  const drawPlanePath = useCallback((ctx: CanvasRenderingContext2D, startX: number, startY: number, multiplier: number, status: CanvasGameStatus, canvas: HTMLCanvasElement | null) => {
    if (multiplier <= 1 || !canvas) return;
    const points: {x: number, y: number}[] = [];
    const steps = Math.max(20, Math.floor((multiplier -1) * 10)); // Dynamic steps for smoother curve
    for (let i = 0; i <= steps; i++) {
      const progress = i / steps;
      const currentMult = 1 + (multiplier - 1) * progress;
      points.push(calculateNewPosition(currentMult, canvas));
    }
    if (points.length < 2) return;

    const lastPoint = points[points.length - 1];
    const gradient = ctx.createLinearGradient(startX, startY, lastPoint.x, lastPoint.y);
    gradient.addColorStop(0, 'rgba(0, 255, 0, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.5)');
    gradient.addColorStop(1, status === 'crashed' ? 'rgba(255, 0, 0, 0.7)' : 'rgba(0, 255, 255, 0.7)');
    
    ctx.shadowColor = status === 'crashed' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 255, 0.8)';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(startX, startY); // Path should start from axes origin
    
    // Quadratic curve for smoother path
    for (let i = 0; i < points.length -1; i++) {
        const p1 = points[i];
        const p2 = points[i+1];
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        if (i === 0) { // First point uses control point from startX, startY
             ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        } else {
             ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
        }
    }
    // Ensure path reaches the last point
    if(points.length > 0) ctx.lineTo(points[points.length-1].x, points[points.length-1].y);

    ctx.stroke();
    ctx.shadowBlur = 0;

    if (status === 'flying' && lastPoint) {
      trailRef.current.push(...createParticles(lastPoint.x, lastPoint.y, 'trail'));
    }
  }, [calculateNewPosition, createParticles]);

  const drawPlane = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, status: CanvasGameStatus, multiplier: number) => {
    ctx.save();
    if (multiplier > 5 && status === 'flying') {
      const shakeIntensity = Math.min((multiplier - 5) / 10, 1) * 3;
      x += (Math.random() - 0.5) * shakeIntensity;
      y += (Math.random() - 0.5) * shakeIntensity;
    }
    
    // Determine angle based on previous point if available for smoother rotation
    const path = trailRef.current; // Or use a dedicated path history for angle calculation
    const prevX = path.length > 5 ? path[path.length - 5].x : x - 1; // Look back a bit
    const prevY = path.length > 5 ? path[path.length - 5].y : y - 0.1; // Slight upward default
    let angle = Math.atan2(y - prevY, x - prevX);
    if (x === prevX && y === prevY) angle = -Math.PI / 4; // Default initial angle

    ctx.translate(x, y);
    ctx.rotate(angle);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
    if (status === 'crashed') {
      gradient.addColorStop(0, 'rgba(255, 100, 100, 1)'); gradient.addColorStop(1, 'rgba(255, 0, 0, 0.3)');
      ctx.shadowColor = 'rgba(255, 0, 0, 1)';
    } else {
      gradient.addColorStop(0, 'rgba(100, 200, 255, 1)'); gradient.addColorStop(1, 'rgba(0, 150, 255, 0.3)');
      ctx.shadowColor = 'rgba(0, 150, 255, 1)';
    }
    ctx.shadowBlur = 20; ctx.fillStyle = gradient;
    ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(15, -5); ctx.lineTo(10, 0); ctx.lineTo(15, 5); ctx.closePath(); ctx.fill();
    
    ctx.shadowBlur = 15; ctx.fillStyle = status === 'crashed' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(0, 255, 255, 0.8)';
    ctx.beginPath(); ctx.arc(-12, 0, 3, 0, Math.PI * 2); ctx.fill(); // Engine
    ctx.restore();

    if (status === 'crashed' && Math.random() < 0.3) {
      particlesRef.current.push(...createParticles(x, y, 'explosion'));
    }
  }, [createParticles]);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    [trailRef, particlesRef].forEach(ref => {
      ref.current = ref.current.filter(p => {
        p.x += p.vx; p.y += p.vy;
        if (ref === particlesRef) { p.vx *= 0.98; p.vy *= 0.98; }
        p.life -= p.decay;
        if (p.life <= 0) return false;
        ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.shadowColor = p.color;
        ctx.shadowBlur = ref === trailRef ? 5 : 8;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return true;
      });
    });
    if (trailRef.current.length > 150) trailRef.current.splice(0, trailRef.current.length - 150);
    if (particlesRef.current.length > 100) particlesRef.current.splice(0, particlesRef.current.length - 100);
  }, []);
  
  const drawMultiplierDisplay = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement | null, multiplier: number, status: CanvasGameStatus) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const baseFontSize = Math.min(logicalWidth / 15, 60);
    const fontSize = baseFontSize + Math.min((multiplier - 1) * 5, 40);
    ctx.font = `bold ${fontSize}px 'Segoe UI', Arial, sans-serif`;
    const textColor = status === 'crashed' ? `hsl(0, 100%, ${50 + Math.sin(Date.now() / 100) * 20}%)` : `hsl(${120 + Math.min((multiplier - 1) * 15, 120)}, 100%, ${60 + Math.sin(Date.now() / 200) * 20}%)`;
    ctx.shadowColor = textColor; ctx.shadowBlur = status === 'crashed' ? 30 : 20; ctx.fillStyle = textColor;
    
    const textX = logicalWidth / 2;
    const textY = 30 / dpr; // Position adjusted for DPR
    
    if (multiplier > 10 && status === 'flying') {
      const pulse = 1 + Math.sin(Date.now() / 100) * 0.05; // Subtle pulse
      ctx.translate(textX, textY);
      ctx.scale(pulse, pulse);
      ctx.fillText(`${multiplier.toFixed(2)}x`, 0, 0);
    } else {
      ctx.fillText(`${multiplier.toFixed(2)}x`, textX, textY);
    }
    ctx.restore();
  }, []);

  const drawCrashLine = useCallback((ctx: CanvasRenderingContext2D, logicalWidth: number, crashLineY: number, startX: number) => {
    const dpr = window.devicePixelRatio || 1;
    const dashOffset = Date.now() / 10;
    ctx.beginPath(); ctx.strokeStyle = `hsl(0, 100%, ${50 + Math.sin(Date.now() / 100) * 30}%)`;
    ctx.lineWidth = 3 / dpr; ctx.setLineDash([10 / dpr, 10 / dpr]); ctx.lineDashOffset = (dashOffset % (20 / dpr));
    ctx.shadowColor = 'rgba(255, 0, 0, 0.8)'; ctx.shadowBlur = 10 / dpr;
    ctx.moveTo(startX, crashLineY); ctx.lineTo(logicalWidth - (20 / dpr) , crashLineY); // Draw up to near edge
    ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
  }, []);

  const mainDrawGame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = 50 / dpr; // Use scaled startX/Y if ctx is scaled. Or draw in logical coords.
    const startY = logicalHeight - (50 / dpr);
    
    // Apply DPR scaling to context IF drawing functions expect logical coords
    // For this version, assuming drawing functions get logical coords and canvas is correctly sized.
    // No ctx.scale(dpr, dpr) here means all drawing functions must be DPR aware or canvas width/height are physical pixels.
    // Let's assume drawing functions will handle DPR for now.

    const bgGradient = ctx.createLinearGradient(0, 0, 0, logicalHeight);
    bgGradient.addColorStop(0, 'rgba(10, 10, 30, 1)'); bgGradient.addColorStop(1, 'rgba(5, 5, 15, 1)');
    ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, logicalWidth, logicalHeight);
    
    drawGrid(ctx, logicalWidth, logicalHeight);
    drawAxes(ctx, logicalWidth, logicalHeight, startX, startY);
    
    drawPlanePath(ctx, startX, startY, smoothMultiplier, canvasGameStatus, canvas);
    drawParticles(ctx);
    const { x, y } = calculateNewPosition(smoothMultiplier, canvas);
    drawPlane(ctx, x, y, canvasGameStatus, smoothMultiplier);
    
    if (canvasGameStatus === 'flying' || canvasGameStatus === 'crashed') {
      drawMultiplierDisplay(ctx, canvas, smoothMultiplier, canvasGameStatus);
    }
    if (canvasGameStatus === 'crashed') {
      const crashDisplayY = calculateYPosition(gameState.multiplier, logicalHeight - (100/dpr), startY); // Use actual crash multiplier
      drawCrashLine(ctx, logicalWidth, crashDisplayY, startX);
    }
  }, [
      canvasGameStatus, gameState.multiplier, smoothMultiplier, 
      calculateNewPosition, calculateYPosition, drawGrid, drawAxes, 
      drawPlanePath, drawParticles, drawPlane, drawMultiplierDisplay, drawCrashLine
  ]);

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
      // If you scale the context, all draw operations need to be in logical pixels
      // ctx.scale(dpr, dpr); 
      // If not scaling context, drawing functions must adjust sizes/coords by dpr.
      // The provided code seems to mostly adjust for dpr in drawing functions.
      mainDrawGame(ctx, canvas); 
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    let localAnimationId: number | undefined;
    const renderLoop = () => {
      mainDrawGame(ctx, canvas);
      localAnimationId = requestAnimationFrame(renderLoop);
    };

    localAnimationId = requestAnimationFrame(renderLoop);
    animationLoopRef.current = localAnimationId;
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationLoopRef.current) cancelAnimationFrame(animationLoopRef.current);
      if (localAnimationId && localAnimationId !== animationLoopRef.current) cancelAnimationFrame(localAnimationId);
    };
  }, [mainDrawGame]);

  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-900 via-purple-900/80 to-gray-800 shadow-2xl border border-purple-500/30">
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
      />
      {canvasGameStatus === 'flying' && activeBets.length > 0 && (
        <div className="absolute right-2 top-2 md:right-4 md:top-4 max-w-[150px] md:max-w-xs w-full space-y-1 md:space-y-2 z-10">
          {activeBets.slice(0, 3).map((bet: ActiveBetContextType) => (
            <ActiveBet key={bet.id} betId={bet.id} amount={bet.amount} />
          ))}
          {activeBets.length > 3 && (
            <div className="text-center text-xs text-emerald-300 bg-gradient-to-r from-emerald-600/40 to-green-600/40 backdrop-blur-sm border border-emerald-500/40 p-1 rounded-lg shadow-lg animate-pulse">
              +{activeBets.length - 3} more
            </div>
          )}
        </div>
      )}
      {(canvasGameStatus === 'waiting' || canvasGameStatus === 'betting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-md z-10">
          <div className="text-center p-6 rounded-xl bg-gradient-to-br from-gray-900/85 to-purple-900/85 border border-purple-500/40 shadow-2xl backdrop-blur-sm">
            <div className="text-xl md:text-2xl font-bold mb-4 text-white drop-shadow-md">
              {canvasGameStatus === 'betting' ? "🎯 Place Your Bets!" : "🚀 Next Round Starting"}
            </div>
            <div className="text-6xl md:text-7xl font-bold text-yellow-400 animate-bounce drop-shadow-lg">
              {timeRemaining}
            </div>
            <div className="mt-3 text-sm text-gray-300 animate-pulse">
              {canvasGameStatus === 'betting' ? "Betting closes soon..." : "Get ready to fly!"}
            </div>
          </div>
        </div>
      )}
      {canvasGameStatus === 'crashed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-md z-10">
          <div className="text-center p-8 rounded-xl bg-gradient-to-br from-gray-900/85 to-red-900/85 border border-red-500/60 shadow-2xl backdrop-blur-sm">
            <div className="text-4xl md:text-5xl font-bold text-red-400 mb-4 animate-pulse drop-shadow-lg">
              💥 CRASHED @ {gameState.multiplier.toFixed(2)}x
            </div>
            <div className="text-lg text-gray-300 mb-3">
              Better luck next time!
            </div>
            <div className="text-sm text-gray-400 animate-pulse">
              Next round in {timeRemaining}s...
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-purple-600/10 rounded-full blur-3xl animate-[pulse_5s_ease-in-out_infinite]"></div>
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-600/10 rounded-full blur-3xl animate-[pulse_6s_ease-in-out_infinite_0.5s]"></div>
      </div>
    </div>
  );
};
export default GameCanvas;

    