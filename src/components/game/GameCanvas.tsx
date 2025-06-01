
"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Dynamically import the PlayCanvas embed component with ssr: false
const PlayCanvasEmbedWithNoSSR = dynamic(
  () => import('@/components/game/PlayCanvasEmbed'),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="w-full aspect-video rounded-lg bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading 3D Experience...</p>
      </Skeleton>
    )
  }
);

const GameCanvas = () => {
  return <PlayCanvasEmbedWithNoSSR />;
};

export default GameCanvas;
