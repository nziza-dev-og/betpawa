
"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the R3F heavy component with ssr: false
const GameCanvasComponentInternalWithNoSSR = dynamic(
  () => import('@/components/game/GameCanvasInternal'), 
  { 
    ssr: false,
    loading: () => (
      <Skeleton className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading 3D Experience...</p>
      </Skeleton>
    )
  }
);

// This component acts as the wrapper that is statically imported by page.tsx
const GameCanvas = () => {
  return <GameCanvasComponentInternalWithNoSSR />;
};

export default GameCanvas;

    