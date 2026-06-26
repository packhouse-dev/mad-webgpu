import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Obstacle } from "../types";
import { initWebGPURenderer, renderWebGPUFrame, PlayerData, WebGPUContextData } from "../client/webgpuRenderer";

interface WebGPUCanvasProps {
  socket: Socket;
  myId?: string;
  obstacles: Obstacle[];
}

export default function WebGPUCanvas({ socket, myId, obstacles }: WebGPUCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererType, setRendererType] = useState<"initializing" | "webgpu" | "2d">("initializing");
  const playersRef = useRef<Map<string, PlayerData>>(new Map());

  useEffect(() => {
    socket.on("game_state", (players: PlayerData[]) => {
      const map = new Map<string, PlayerData>();
      players.forEach((p) => map.set(p.id, p));
      playersRef.current = map;
    });

    return () => {
      socket.off("game_state");
    };
  }, [socket]);

  useEffect(() => {
    let animationFrameId: number;
    let webgpuCtx: WebGPUContextData | null = null;
    let is2D = false;

    async function initialize() {
      if (!canvasRef.current) return;
      
      const ctx = await initWebGPURenderer(canvasRef.current, obstacles);
      if (ctx) {
        webgpuCtx = ctx;
        setRendererType("webgpu");
      } else {
        is2D = true;
        setRendererType("2d");
        console.warn("WebGPU not available, falling back to Canvas2D");
      }
      
      const canvas2dCtx = is2D ? canvasRef.current.getContext("2d") : null;

      function renderLoop(now: number) {
        const players = Array.from(playersRef.current.values()) as PlayerData[];
        
        if (!is2D && webgpuCtx) {
          try {
            renderWebGPUFrame(webgpuCtx, players, myId, obstacles.length);
          } catch(e) {
            console.error("WebGPU render error:", e);
          }
        } else if (is2D && canvas2dCtx && canvasRef.current) {
          const width = canvasRef.current.width;
          const height = canvasRef.current.height;
          
          canvas2dCtx.fillStyle = "rgb(13, 13, 20)";
          canvas2dCtx.fillRect(0, 0, width, height);
          
          const toScreenX = (ndcX: number) => ((ndcX + 1) / 2) * width;
          const toScreenY = (ndcY: number) => ((-ndcY + 1) / 2) * height;
          
          // Draw obstacles
          obstacles.forEach(obs => {
            const pixelW = (obs.width / 2) * width;
            const pixelH = (obs.height / 2) * height;
            const px = toScreenX(obs.x) - pixelW / 2;
            const py = toScreenY(obs.y) - pixelH / 2;
            canvas2dCtx.fillStyle = `rgb(${obs.color.r * 255}, ${obs.color.g * 255}, ${obs.color.b * 255})`;
            canvas2dCtx.fillRect(px, py, pixelW, pixelH);
          });
          
          // Draw players
          players.forEach(p => {
            const isMe = p.id === myId;
            const baseSize = 0.06;
            const scale = isMe ? 1.5 : 1.0;
            const sizeW = (baseSize * scale / 2) * width;
            const sizeH = (baseSize * scale / 2) * height;
            
            const px = toScreenX(p.x) - sizeW / 2;
            const py = toScreenY(p.y) - sizeH / 2;
            
            canvas2dCtx.fillStyle = `rgb(${p.color.r * 255}, ${p.color.g * 255}, ${p.color.b * 255})`;
            canvas2dCtx.fillRect(px, py, sizeW, sizeH);
          });
        }
        
        animationFrameId = requestAnimationFrame(renderLoop);
      }

      renderLoop(performance.now());
    }

    initialize();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [myId, obstacles]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ndcX = (x / rect.width) * 2 - 1;
    const ndcY = -((y / rect.height) * 2 - 1);

    socket.emit("move", { targetX: ndcX, targetY: ndcY });
  };

  return (
    <div className="relative w-full aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 shadow-inner">
      <canvas
        ref={canvasRef}
        width={800}
        height={450}
        className="w-full h-full block object-contain cursor-crosshair"
        onClick={handleCanvasClick}
      />
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-xs px-3 py-1.5 rounded-md text-white font-mono pointer-events-none border border-white/10 shadow-sm flex flex-col gap-1">
        <span className="font-bold text-indigo-400">
          Arena Engine: {rendererType === "initializing" ? "..." : rendererType.toUpperCase()}
        </span>
        <span className="text-neutral-400">Click to navigate your node</span>
      </div>
    </div>
  );
}

