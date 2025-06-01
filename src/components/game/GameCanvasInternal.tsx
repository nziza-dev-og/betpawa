
"use client";
import { useRef, Suspense } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import { Text, Stars, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useGame, type ActiveBetContext, type GamePhase } from '../../contexts/GameContext'; // Ensure GamePhase is imported
import { ActiveBet } from './ActiveBet'; // Ensure this path is correct

// Define a type for the props of FlyingObject
interface FlyingObjectProps {
  multiplier: number;
  gamePhase: GamePhase;
}

function FlyingObject({ multiplier, gamePhase }: FlyingObjectProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const trailRef = useRef<THREE.Group>(null!);
  const lastPosition = useRef(new THREE.Vector3());
  const _axis = new THREE.Vector3(0, 1, 0); // Re-usable axis for quaternion

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    const t = state.clock.getElapsedTime();
    let targetX, targetY, targetZ;

    const visualMultiplier = Math.min(multiplier, 1000); // Cap visual progression

    // X: Logarithmic scale for time/progress, then linear
    if (visualMultiplier <= 1) {
      targetX = 0;
    } else if (visualMultiplier <= 10) {
      targetX = (visualMultiplier - 1) * 2; // More initial movement
    } else {
      targetX = 18 + Math.log10(visualMultiplier / 10) * 30; // Slower progression for higher multipliers
    }

    // Y: Logarithmic scale for multiplier value, emphasizing initial climb
    if (visualMultiplier <= 1) {
      targetY = 0;
    } else if (visualMultiplier <= 5) {
        targetY = Math.log2(visualMultiplier) * 2.5;
    } else {
        targetY = Math.log2(5) * 2.5 + Math.log10(visualMultiplier / 5) * 5;
    }
    
    targetZ = 0; // Keep Z fixed for now, or add slight depth if needed

    const newPosition = new THREE.Vector3(targetX, targetY, targetZ);

    // Smoothly interpolate position
    groupRef.current.position.lerp(newPosition, 0.1);

    // Orientation: Make the plane look towards its direction of movement
    if (lastPosition.current && !groupRef.current.position.equals(lastPosition.current) && multiplier > 1.01) {
      const direction = new THREE.Vector3().subVectors(groupRef.current.position, lastPosition.current).normalize();
      if (direction.lengthSq() > 0.0001) { // Ensure direction is not zero vector
        const targetQuaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction);
         // Add a slight banking effect based on turn sharpness (simplified)
        const bankingStrength = Math.min(Math.abs(direction.y) * 0.5, 0.4); // Bank up to ~22 degrees
        const bankQuaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -direction.y * bankingStrength);
        targetQuaternion.multiply(bankQuaternion);
        groupRef.current.quaternion.slerp(targetQuaternion, 0.15);
      }
    } else if (multiplier <= 1.01) {
       // Reset to default orientation if not moving
      groupRef.current.quaternion.slerp(new THREE.Quaternion(), 0.1);
    }
    lastPosition.current.copy(groupRef.current.position);

    // Crash animation (simple shake or fall)
    if (gamePhase === 'crashed') {
      groupRef.current.rotation.z += Math.sin(t * 50) * 0.05;
      groupRef.current.position.y -= delta * 5; // Fall down
    }
  });

  const planeBodyColor = "#778899"; // Darker, metallic slate gray
  const planeWingColor = "#A9A9A9"; // Lighter gray for wings
  const engineGlowColor = "#FFA500"; // Orange glow

  return (
    <group ref={groupRef}>
      {/* Plane Body (Cone) */}
      <mesh castShadow receiveShadow>
        <coneGeometry args={[0.3, 1.2, 8]} /> {/* radius, height, radialSegments */}
        <meshStandardMaterial color={planeBodyColor} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Wings (Boxes) - Main Wings */}
      <mesh position={[0, -0.1, 0.7]} castShadow receiveShadow> {/* Adjusted y and z for better wing placement */}
        <boxGeometry args={[0.2, 2, 0.15]} /> {/* width, height (span), depth */}
        <meshStandardMaterial color={planeWingColor} metalness={0.6} roughness={0.4} />
      </mesh>
       {/* Tail Wings (Horizontal Stabilizers) */}
      <mesh position={[-0.45, -0.1, 0.3]} castShadow receiveShadow>
        <boxGeometry args={[0.15, 0.8, 0.1]} />
        <meshStandardMaterial color={planeWingColor} metalness={0.6} roughness={0.4} />
      </mesh>
       {/* Tail Fin (Vertical Stabilizer) */}
      <mesh position={[-0.5, 0.15, 0]} rotation={[0,0, -Math.PI / 18]} castShadow receiveShadow> {/* Slight angle for fin */}
        <boxGeometry args={[0.1, 0.4, 0.3]} /> {/* width, height, depth */}
        <meshStandardMaterial color={planeWingColor} metalness={0.6} roughness={0.4}/>
      </mesh>

      {/* Engine Glow - only visible when playing and multiplier > 1 */}
      {gamePhase === 'playing' && multiplier > 1.01 && (
        <mesh position={[-0.6, 0, 0]}> {/* Positioned at the back of the cone */}
          <sphereGeometry args={[0.12, 16, 8]} />
          <meshStandardMaterial emissive={engineGlowColor} emissiveIntensity={2} color={engineGlowColor} toneMapped={false}/>
        </mesh>
      )}
      
      {/* Multiplier Text */}
      {(gamePhase === 'playing' || gamePhase === 'crashed') && multiplier > 0 && (
        <Text
          position={[1, 0.5, 0]} // Position relative to the plane
          fontSize={0.25}
          color={gamePhase === 'crashed' ? "#FF6347" : "#FFFFFF"} // Tomato for crashed, white otherwise
          anchorX="left"
          anchorY="middle"
          outlineWidth={0.01}
          outlineColor="#000000"
        >
          {multiplier.toFixed(2)}x
        </Text>
      )}
      {gamePhase === 'playing' && multiplier > 1.05 && (
          <Sparkles
            ref={trailRef}
            count={30}
            scale={[1,1,1]}
            size={1 + Math.random()*2}
            speed={0.3}
            noise={0.1}
            color={engineGlowColor}
            position={[-0.8,0,0]} // Behind the plane
          />
      )}
    </group>
  );
}


const GameCanvasComponent = () => {
  const { gameState, activeBets, timeRemaining } = useGame();
  const canvasGameStatus = gameState.status; // Directly use context status

  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-lg shadow-xl bg-gray-900">
      <Canvas 
        shadows 
        camera={{ position: [2, 2, 8], fov: 50 }} // Adjusted camera
        dpr={[1, 2]} // Optimize for device pixel ratio
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.2} />
          <hemisphereLight skyColor={"#87CEEB"} groundColor={"#4A4A4A"} intensity={0.6} />
          <directionalLight 
            position={[5, 8, 5]} 
            intensity={1.5} 
            castShadow 
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
            shadow-camera-far={50}
            shadow-camera-left={-10}
            shadow-camera-right={10}
            shadow-camera-top={10}
            shadow-camera-bottom={-10}
          />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <FlyingObject multiplier={gameState.multiplier} gamePhase={canvasGameStatus} />
        </Suspense>
      </Canvas>
      
      {canvasGameStatus === 'playing' && activeBets.length > 0 && (
        <div className="absolute right-2 top-2 md:right-4 md:top-4 max-w-[150px] md:max-w-xs w-full space-y-1 md:space-y-2">
          {activeBets.slice(0, 3).map((bet: ActiveBetContext) => (
            <ActiveBet key={bet.id} betId={bet.id} amount={bet.amount} />
          ))}
          {activeBets.length > 3 && (
            <div className="text-center text-xs text-gray-300 bg-black/30 p-1 rounded">
              +{activeBets.length - 3} more
            </div>
          )}
        </div>
      )}
      
      {(canvasGameStatus === 'idle' || canvasGameStatus === 'starting' || canvasGameStatus === 'betting') && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="text-center p-4 rounded-lg bg-background/30">
            <div className="text-lg md:text-xl font-bold mb-1 md:mb-2 text-white">
              {canvasGameStatus === 'betting' ? "Place Your Bets!" : 
               canvasGameStatus === 'starting' ? "Get Ready!" : 
               "Next Round In..."}
            </div>
            <div className="text-4xl md:text-5xl font-bold text-accent animate-pulse">
              {timeRemaining}s
            </div>
          </div>
        </div>
      )}
      
      {canvasGameStatus === 'crashed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/40 backdrop-blur-sm">
          <div className="text-center p-4 rounded-lg bg-background/30">
            <div className="text-2xl md:text-3xl font-bold text-red-400 mb-2 animate-pulse">
              CRASHED @ {gameState.multiplier.toFixed(2)}x
            </div>
            <div className="text-sm text-gray-200">Next round starting soon...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvasComponent;

