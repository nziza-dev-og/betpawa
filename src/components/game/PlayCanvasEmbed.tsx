
"use client";

import { useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext'; // For potential future communication

// Placeholder HTML for the iframe to indicate where PlayCanvas content would go.
// In a real scenario, the src of the iframe would point to your PlayCanvas build URL.
const placeholderPlayCanvasHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover">
    <style>
        body { margin: 0; overflow: hidden; background-color: #282828; display: flex; align-items: center; justify-content: center; height: 100vh; color: white; font-family: sans-serif; }
        .container { text-align: center; padding: 20px; }
        h1 { font-size: 1.5em; margin-bottom: 0.5em; }
        p { font-size: 1em; margin-top: 0; }
    </style>
    <title>PlayCanvas Placeholder</title>
</head>
<body>
    <div class="container">
        <h1>PlayCanvas Application Area</h1>
        <p>Your PlayCanvas game/visualization would be embedded here.</p>
        <p>Replace this iframe's content or src with your PlayCanvas build.</p>
    </div>
</body>
</html>
`;

const PlayCanvasEmbed = () => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // const { gameState } = useGame(); // Example: if you need to send game state to PlayCanvas

  // Example of how you might communicate with PlayCanvas via postMessage
  // useEffect(() => {
  //   if (iframeRef.current && iframeRef.current.contentWindow) {
  //     iframeRef.current.contentWindow.postMessage({
  //       type: 'SKYTRAX_GAME_STATE_UPDATE',
  //       payload: {
  //         multiplier: gameState.multiplier,
  //         status: gameState.status,
  //       }
  //     }, '*'); // Be more specific with the targetOrigin in production
  //   }
  // }, [gameState.multiplier, gameState.status]);

  const iframeSrcDoc = placeholderPlayCanvasHTML;

  return (
    <div className="w-full aspect-video relative overflow-hidden rounded-lg shadow-xl bg-gray-900">
      <iframe
        ref={iframeRef}
        title="PlayCanvas Embed"
        srcDoc={iframeSrcDoc} // For a real PlayCanvas build, you'd use: src="URL_TO_YOUR_PLAYCANVAS_BUILD/index.html"
        className="w-full h-full border-0"
        // sandbox="allow-scripts allow-same-origin" // Adjust sandbox attributes as needed for your PlayCanvas build
        allowFullScreen
      ></iframe>
      {/* 
        You might want to overlay React-based UI elements here if needed,
        for example, the current multiplier if not handled within PlayCanvas.
        However, the primary 3D visualization is now delegated to PlayCanvas.
      */}
       <div
        className="absolute inset-0 flex flex-col items-center justify-center p-4 pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {/* 
          Example of overlaying multiplier text from React, if not handled inside PlayCanvas
          You would need to uncomment useGame and related logic if you use this.
        */}
        {/* {gameState.status === 'playing' && (
          <div className="text-6xl font-bold text-white" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
            {gameState.multiplier.toFixed(2)}x
          </div>
        )}
        {gameState.status === 'crashed' && (
          <div className="text-6xl font-bold text-red-500" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}>
            Crashed @ {gameState.multiplier.toFixed(2)}x
          </div>
        )} */}
      </div>
    </div>
  );
};

export default PlayCanvasEmbed;
