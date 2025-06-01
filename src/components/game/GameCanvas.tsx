
"use client";
import { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import type { ActiveBetContext } from '../../contexts/GameContext';
import { ActiveBet } from './ActiveBet';
import { TopBarHistory } from '../history/TopBarHistory'; // New component for history

const GameCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>();
  const particlesRef = useRef<Particle[]>([]);
  const trailRef = useRef<Particle[]>([]);
  
  const { gameState, activeBets, timeRemaining } = useGame();
  
  const [smoothMultiplier, setSmoothMultiplier] = useState(1.00);

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
      
      const animateMultiplier = () => {
        setSmoothMultiplier(prev => {
          const diff = target - prev;
          if (Math.abs(diff) < 0.01) {
             if (animationRef.current && gameState.status !== 'playing') cancelAnimationFrame(animationRef.current);
            return target;
          }
          const newMultiplier = prev + diff * 0.1; // Adjust for animation speed
          return newMultiplier;
        });
        if (gameState.status === 'playing') { // Continue animation only if still playing
             animationRef.current = requestAnimationFrame(animateMultiplier);
        }
      };
      
      if (gameState.status === 'playing') {
        animationRef.current = requestAnimationFrame(animateMultiplier);
      }
      
      return () => {
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
      };
    } else {
      setSmoothMultiplier(gameState.multiplier); // Snap to current multiplier if not playing
      if (animationRef.current) { 
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
    }
  }, [gameState.multiplier, gameState.status]);


  interface Particle {
    x: number; y: number; vx: number; vy: number;
    life: number; decay: number; size: number; color: string;
  }

  const createParticles = useCallback((x: number, y: number, type: 'trail' | 'explosion' = 'trail'): Particle[] => {
    const newParticles: Particle[] = [];
    const count = type === 'explosion' ? 30 : 3; // More for explosion, fewer for trail
    for (let i = 0; i < count; i++) {
      newParticles.push({
        x: x + (Math.random() - 0.5) * (type === 'explosion' ? 30 : 10),
        y: y + (Math.random() - 0.5) * (type === 'explosion' ? 30 : 10),
        vx: (Math.random() - 0.5) * (type === 'explosion' ? 8 : 1),
        vy: (Math.random() - 0.5) * (type === 'explosion' ? 8 : 1) - (type === 'explosion' ? 2: 0), // Explosion goes up more
        life: 1,
        decay: type === 'explosion' ? 0.015 : 0.04,
        size: Math.random() * (type === 'explosion' ? 4 : 2) + 1,
        color: type === 'explosion' ? `hsl(${Math.random() * 40 + 10}, 100%, ${60 + Math.random() * 20}%)` : `rgba(255, 255, 255, ${0.2 + Math.random() * 0.3})`,
      });
    }
    return newParticles;
  }, []);
  
  const drawBackground = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#0D1117'; // Very dark blue-gray
    ctx.fillRect(0, 0, width, height);

    const rays = 30;
    const centerX = width * 0.1; // Emanate from bottom-leftish
    const centerY = height * 0.9; 
    
    for (let i = 0; i < rays; i++) {
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const angle = (i / rays) * Math.PI * 0.8 - Math.PI * 0.9; // Angle range for upward rays
      const length = width * 1.5;
      ctx.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length);
      
      const opacity = 0.02 + Math.random() * 0.03;
      ctx.strokeStyle = `rgba(56, 139, 253, ${opacity})`; // Light blueish rays
      ctx.lineWidth = Math.random() * 30 + 20; // Varied thickness
      ctx.stroke();
    }
  }, []);

  const calculateYPosition = useCallback((multiplier: number, graphCanvasHeight: number, graphStartY: number): number => {
    const visualMultiplier = Math.min(multiplier, 1000); // Cap visual representation
    const logBase = 1000; 
    const progressY = visualMultiplier > 1 ? Math.log10(visualMultiplier) / Math.log10(logBase) : 0;
    return graphStartY - progressY * graphCanvasHeight;
  }, []);

  const calculateNewPosition = useCallback((currentMultiplier: number, canvas: HTMLCanvasElement | null): { x: number, y: number } => {
    if (!canvas) return { x: 50, y: window.innerHeight - 50 };
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    const startX = logicalWidth * 0.1; // Start further in
    const startY = logicalHeight * 0.9; // Start lower
    const maxX = logicalWidth * 0.95;   // End further in
    const graphDrawingHeight = logicalHeight * 0.7; // Use 70% of height for graph

    const visualMultiplier = Math.min(currentMultiplier, 1000);
    let progressX;

    if (visualMultiplier <= 1) progressX = 0;
    else if (visualMultiplier <= 10) progressX = (Math.log10(visualMultiplier) / Math.log10(10)) * 0.6; // 60% of width for up to 10x
    else progressX = 0.6 + (Math.log10(visualMultiplier / 10) / Math.log10(1000 / 10)) * 0.4; // Remaining 40% for 10x to 1000x
    
    progressX = Math.max(0, Math.min(1, progressX));
    const x = startX + progressX * (maxX - startX);
    const yVal = calculateYPosition(visualMultiplier, graphDrawingHeight, startY);
    
    return { x: Math.max(startX, x), y: Math.min(startY, Math.max(logicalHeight * 0.1, yVal)) };
  }, [calculateYPosition]);
  
  const pathHistory = useRef<{x:number, y:number}[]>([]);

  const drawMultiplierPath = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, currentMultiplier: number, status: string) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalHeight = canvas.height / dpr;
    const startX = (canvas.width / dpr) * 0.1;
    const startY = logicalHeight * 0.9;

    if (status === 'waiting' || status === 'betting' || currentMultiplier <= 1) {
      pathHistory.current = [{x: startX, y: startY}]; // Reset path
    } else {
       const currentPos = calculateNewPosition(currentMultiplier, canvas);
       if (pathHistory.current.length === 0 || pathHistory.current[pathHistory.current.length-1].x < currentPos.x) {
           pathHistory.current.push(currentPos);
       }
    }
    
    if (pathHistory.current.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(pathHistory.current[0].x, pathHistory.current[0].y);

    for (let i = 0; i < pathHistory.current.length - 1; i++) {
      const p1 = pathHistory.current[i];
      const p2 = pathHistory.current[i+1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    ctx.lineTo(pathHistory.current[pathHistory.current.length-1].x, pathHistory.current[pathHistory.current.length-1].y); // Ensure line to the last point

    // Create the fill
    ctx.lineTo(pathHistory.current[pathHistory.current.length-1].x, startY); // Line down to baseline
    ctx.lineTo(pathHistory.current[0].x, startY); // Line to start X on baseline
    ctx.closePath();

    const fillStyle = status === 'crashed' ? 'rgba(220, 38, 38, 0.6)' : 'rgba(220, 38, 38, 0.7)'; // Red for path
    ctx.fillStyle = fillStyle;
    ctx.fill();

    // Draw line on top of path
    ctx.beginPath();
    ctx.moveTo(pathHistory.current[0].x, pathHistory.current[0].y);
     for (let i = 0; i < pathHistory.current.length - 1; i++) {
      const p1 = pathHistory.current[i];
      const p2 = pathHistory.current[i+1];
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
    }
    ctx.lineTo(pathHistory.current[pathHistory.current.length-1].x, pathHistory.current[pathHistory.current.length-1].y);

    ctx.strokeStyle = status === 'crashed' ? 'rgba(255, 100, 100, 0.8)' : 'rgba(255, 80, 80, 1)'; // Brighter red line
    ctx.lineWidth = 3;
    ctx.stroke();

    if (status === 'flying' && pathHistory.current.length > 0) {
        const lastPoint = pathHistory.current[pathHistory.current.length -1];
        trailRef.current.push(...createParticles(lastPoint.x, lastPoint.y, 'trail'));
    }

  }, [calculateNewPosition, createParticles]);

  const drawPlane = useCallback((ctx: CanvasRenderingContext2D, x: number, y: number, status: string, currentMultiplier: number) => {
    ctx.save();
    const planeSize = 18; // Adjusted size

    const prevPos = pathHistory.current.length > 1 ? pathHistory.current[pathHistory.current.length - 2] : {x: x - 1, y:y};
    let angle = Math.atan2(y - prevPos.y, x - prevPos.x);
    
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Plane Body (Red)
    ctx.fillStyle = '#DC2626'; // Tailwind red-600
    ctx.beginPath();
    // Fuselage
    ctx.moveTo(-planeSize * 0.8, 0); // Tail center
    ctx.lineTo(-planeSize * 0.7, -planeSize * 0.15);
    ctx.lineTo(planeSize * 0.9, -planeSize * 0.1); // Nose top
    ctx.ellipse(planeSize*0.9, 0, planeSize*0.2, planeSize*0.25, 0, -Math.PI/2, Math.PI/2); // Nose curve
    ctx.lineTo(planeSize * 0.9, planeSize * 0.1); // Nose bottom
    ctx.lineTo(-planeSize * 0.7, planeSize * 0.15);
    ctx.closePath();
    ctx.fill();

    // Wings
    ctx.beginPath();
    ctx.moveTo(0, -planeSize * 0.1); // Wing root top
    ctx.lineTo(planeSize * 0.2, -planeSize * 0.6); // Wing tip top-front
    ctx.lineTo(planeSize * 0.05, -planeSize * 0.65); // Wing tip top-back
    ctx.lineTo(-planeSize * 0.3, -planeSize * 0.15); // Wing root bottom
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, planeSize * 0.1); // Wing root top
    ctx.lineTo(planeSize * 0.2, planeSize * 0.6); // Wing tip top-front
    ctx.lineTo(planeSize * 0.05, planeSize * 0.65); // Wing tip top-back
    ctx.lineTo(-planeSize * 0.3, planeSize * 0.15); // Wing root bottom
    ctx.closePath();
    ctx.fill();
    
    // Tail Fin
    ctx.beginPath();
    ctx.moveTo(-planeSize * 0.7, 0);
    ctx.lineTo(-planeSize * 0.9, -planeSize * 0.35);
    ctx.lineTo(-planeSize * 0.6, 0);
    ctx.closePath();
    ctx.fill();

    // Propeller (darker gray, spinning effect if flying)
    ctx.fillStyle = '#4B5563'; // Tailwind gray-600
    if (status === 'flying' && Math.random() > 0.3) { // Spinning effect
        const blurAngle = Math.random() * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(planeSize * 1.1, 0, planeSize*0.05, planeSize*0.3, blurAngle, 0, Math.PI*2);
        ctx.fill();
    } else { // Static propeller
        ctx.fillRect(planeSize*1.05, -planeSize*0.3, planeSize*0.1, planeSize*0.6);
    }


    if (status === 'crashed') {
        ctx.restore(); // Restore before drawing explosion particles relative to canvas
        particlesRef.current.push(...createParticles(x, y, 'explosion'));
    } else {
       ctx.restore();
    }
  }, [createParticles]);

  const drawParticles = useCallback((ctx: CanvasRenderingContext2D) => {
    [trailRef, particlesRef].forEach(ref => {
      ref.current = ref.current.filter(p => {
        p.x += p.vx; p.y += p.vy;
        if (ref === particlesRef) { p.vx *= 0.97; p.vy = p.vy * 0.97 + 0.1; } // Add slight gravity to explosion
        p.life -= p.decay;
        if (p.life <= 0) return false;
        ctx.save(); 
        ctx.globalAlpha = p.life; ctx.fillStyle = p.color; 
        if (ref === particlesRef) {ctx.shadowColor = p.color; ctx.shadowBlur = 5;}
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return true;
      });
    });
    if (trailRef.current.length > 80) trailRef.current.splice(0, trailRef.current.length - 80);
    if (particlesRef.current.length > 150) particlesRef.current.splice(0, particlesRef.current.length - 150);
  }, []);

  const drawMultiplierText = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, multiplier: number, status: string) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const fontSize = Math.min(logicalWidth / 7, logicalHeight / 4, 100); // Responsive font size
    ctx.font = `bold ${fontSize}px Inter, sans-serif`;
    
    const textColor = status === 'crashed' ? 'rgba(255, 100, 100, 1)' : 'rgba(255, 255, 255, 1)';
    ctx.fillStyle = textColor;
    
    // Subtle shadow for depth
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
    
    ctx.fillText(`${multiplier.toFixed(2)}x`, logicalWidth / 2, logicalHeight / 2.2); // Centered
    ctx.restore();
  }, []);

  const drawBottomTicks = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const logicalWidth = canvas.width / dpr;
    const logicalHeight = canvas.height / dpr;
    const startX = logicalWidth * 0.1;
    const endX = logicalWidth * 0.95;
    const yPos = logicalHeight * 0.91; // Slightly above bottom edge
    const numTicks = 12;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i <= numTicks; i++) {
        const x = startX + (i / numTicks) * (endX - startX);
        ctx.beginPath();
        ctx.moveTo(x, yPos);
        ctx.lineTo(x, yPos + 5);
        ctx.stroke();
    }
  }, []);

  const mainDrawGame = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1; // Ensure DPR is respected
    const logicalWidth = canvas.width / dpr; // Use logical dimensions for drawing calculations
    const logicalHeight = canvas.height / dpr;

    ctx.save(); // Save context state
    ctx.scale(dpr, dpr); // Scale context for HDPI displays

    drawBackground(ctx, logicalWidth, logicalHeight); // Pass logical dimensions
    
    if (canvasGameStatus !== 'waiting' && canvasGameStatus !== 'betting') {
        drawMultiplierPath(ctx, canvas, smoothMultiplier, canvasGameStatus);
    }
    drawParticles(ctx); // Particles drawn relative to logical canvas

    const { x, y } = calculateNewPosition(smoothMultiplier, canvas);
    if (canvasGameStatus !== 'waiting' && canvasGameStatus !== 'betting') {
      drawPlane(ctx, x, y, canvasGameStatus, smoothMultiplier);
      drawMultiplierText(ctx, canvas, smoothMultiplier, canvasGameStatus);
    }
    
    drawBottomTicks(ctx, canvas);

    ctx.restore(); // Restore context state
  }, [
      canvasGameStatus, smoothMultiplier, drawBackground, 
      drawMultiplierPath, drawParticles, calculateNewPosition, 
      drawPlane, drawMultiplierText, drawBottomTicks
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
      // No ctx.scale(dpr,dpr) here, handled in mainDrawGame
      mainDrawGame(ctx, canvas); 
    };
    
    handleResize(); // Initial draw
    window.addEventListener('resize', handleResize);
    
    let localAnimationId: number | undefined;
    const renderLoop = () => {
      mainDrawGame(ctx, canvas);
      localAnimationId = requestAnimationFrame(renderLoop);
    };

    if (animationRef.current) cancelAnimationFrame(animationRef.current); // Clear previous multiplier anim
    localAnimationId = requestAnimationFrame(renderLoop); // Start main render loop
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (localAnimationId) cancelAnimationFrame(localAnimationId);
      if (animationRef.current) cancelAnimationFrame(animationRef.current); // Cleanup multiplier anim
    };
  }, [mainDrawGame]);
  
   useEffect(() => {
    if (canvasGameStatus === 'idle' || canvasGameStatus === 'betting') {
      pathHistory.current = [];
    }
  }, [canvasGameStatus]);

  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-lg shadow-xl bg-[#0D1117]">
      <TopBarHistory />
      <canvas 
        ref={canvasRef}
        className="w-full h-full"
      />
      
      {/* Overlay UI elements */}
      {canvasGameStatus === 'flying' && activeBets.length > 0 && (
         <div className="absolute right-2 top-12 md:right-4 md:top-16 max-w-[150px] md:max-w-xs w-full space-y-1 md:space-y-2 z-10">
          {activeBets.slice(0, 3).map((bet: ActiveBetContext) => (
            <ActiveBet key={bet.id} betId={bet.id} amount={bet.amount} />
          ))}
          {activeBets.length > 3 && (
            <div className="text-center text-xs text-emerald-300 bg-black/40 p-1 rounded-lg backdrop-blur-sm">
              +{activeBets.length - 3} more
            </div>
          )}
        </div>
      )}
      
      {(canvasGameStatus === 'waiting' || canvasGameStatus === 'betting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm z-10">
          <div className="text-center p-6 rounded-xl bg-black/50 border border-gray-700/50 shadow-2xl">
            <div className="text-xl md:text-2xl font-bold mb-2 text-white">
              {canvasGameStatus === 'betting' ? "Place Your Bets!" : "Next Round Starting"}
            </div>
            <div className="text-5xl md:text-6xl font-bold text-yellow-400 animate-pulse">
              {timeRemaining}s
            </div>
          </div>
        </div>
      )}
      
      {canvasGameStatus === 'crashed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/30 backdrop-blur-sm z-10">
          <div className="text-center p-6 rounded-xl bg-black/50 border border-red-700/50 shadow-xl">
            <div className="text-3xl md:text-4xl font-bold text-red-400 mb-2 animate-pulse">
              CRASHED @ {gameState.multiplier.toFixed(2)}x
            </div>
            <div className="text-sm text-gray-300">
              Next round in {timeRemaining}s...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;

    