import React, { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { Obstacle } from "../types";

interface PlayerData {
  id: string;
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
}

interface WebGPUCanvasProps {
  socket: Socket;
  myId?: string;
  obstacles: Obstacle[];
}

export default function WebGPUCanvas({ socket, myId, obstacles }: WebGPUCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // We keep track of players locally to render them
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

    async function initWebGPU() {
      const navGpu = (navigator as any).gpu;
      if (!navGpu) {
        setError(
          "WebGPU is not supported in this browser. Please use Chrome/Edge or enable WebGPU.",
        );
        return;
      }

      const adapter = await navGpu.requestAdapter();
      if (!adapter) {
        setError("Failed to get WebGPU adapter.");
        return;
      }

      const device = await adapter.requestDevice();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("webgpu") as any;
      if (!context) {
        setError("Failed to get WebGPU context.");
        return;
      }

      const presentationFormat = navGpu.getPreferredCanvasFormat();
      context.configure({
        device,
        format: presentationFormat,
        alphaMode: "premultiplied",
      });

      // Shaders supporting vec2f scale for flexible rectangles and squares
      const shaderModule = device.createShaderModule({
        code: `
          struct VertexInput {
            @location(0) position: vec2f,
            @location(1) color: vec3f,
            @location(2) scale: vec2f,
          };

          struct VertexOutput {
            @builtin(position) position: vec4f,
            @location(0) color: vec3f,
          };

          @vertex
          fn vs_main(
            @builtin(vertex_index) vertexIndex : u32,
            @builtin(instance_index) instanceIdx : u32,
            input: VertexInput
          ) -> VertexOutput {
            var pos = array<vec2f, 6>(
              vec2f(-0.03, -0.03),
              vec2f( 0.03, -0.03),
              vec2f(-0.03,  0.03),
              vec2f(-0.03,  0.03),
              vec2f( 0.03, -0.03),
              vec2f( 0.03,  0.03)
            );

            var output: VertexOutput;
            var scaled_pos = pos[vertexIndex] * input.scale;
            output.position = vec4f(scaled_pos + input.position, 0.0, 1.0);
            output.color = input.color;
            return output;
          }

          @fragment
          fn fs_main(input: VertexOutput) -> @location(0) vec4f {
            return vec4f(input.color, 1.0);
          }
        `,
      });

      // Pipeline
      const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
          module: shaderModule,
          entryPoint: "vs_main",
          buffers: [
            {
              arrayStride: 28, // 2 floats pos, 3 floats color, 2 floats scale = 7 * 4
              stepMode: "instance",
              attributes: [
                { shaderLocation: 0, offset: 0, format: "float32x2" },
                { shaderLocation: 1, offset: 8, format: "float32x3" },
                { shaderLocation: 2, offset: 20, format: "float32x2" },
              ],
            },
          ],
        },
        fragment: {
          module: shaderModule,
          entryPoint: "fs_main",
          targets: [{ format: presentationFormat }],
        },
        primitive: {
          topology: "triangle-list",
        },
      });

      // Buffer for player instances
      const maxEntities = 10;
      const instanceBuffer = device.createBuffer({
        size: maxEntities * 28,
        usage: 0x0010 | 0x0008, // Vertex | Copy_Dst
      });

      // Buffer for obstacle instances
      const obstacleInstanceBuffer = device.createBuffer({
        size: Math.max(obstacles.length, 1) * 28,
        usage: 0x0010 | 0x0008, // Vertex | Copy_Dst
      });

      // Write static obstacle instance data to GPU once!
      if (obstacles.length > 0) {
        const obsData = new Float32Array(obstacles.length * 7);
        for (let i = 0; i < obstacles.length; i++) {
          const obs = obstacles[i];
          obsData[i * 7 + 0] = obs.x;
          obsData[i * 7 + 1] = obs.y;
          obsData[i * 7 + 2] = obs.color.r;
          obsData[i * 7 + 3] = obs.color.g;
          obsData[i * 7 + 4] = obs.color.b;
          // Base quad is 0.06 x 0.06. Scale appropriately:
          obsData[i * 7 + 5] = obs.width / 0.06;
          obsData[i * 7 + 6] = obs.height / 0.06;
        }
        device.queue.writeBuffer(obstacleInstanceBuffer, 0, obsData);
      }

      function render(now: number) {
        if (!context || !device) return;

        const players = Array.from(playersRef.current.values()) as PlayerData[];

        // Prepare player rendering data
        const instanceData = new Float32Array(players.length * 7);
        for (let i = 0; i < players.length; i++) {
          const p = players[i];
          instanceData[i * 7 + 0] = p.x;
          instanceData[i * 7 + 1] = p.y;
          instanceData[i * 7 + 2] = p.color.r;
          instanceData[i * 7 + 3] = p.color.g;
          instanceData[i * 7 + 4] = p.color.b;
          // Determine scale (slightly larger for local player)
          const scaleVal = p.id === myId ? 1.5 : 1.0;
          instanceData[i * 7 + 5] = scaleVal;
          instanceData[i * 7 + 6] = scaleVal;
        }

        if (players.length > 0) {
          device.queue.writeBuffer(instanceBuffer, 0, instanceData);
        }

        // WebGPU render pass
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor: any = {
          colorAttachments: [
            {
              view: textureView,
              clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 }, // Dark grid space
              loadOp: "clear",
              storeOp: "store",
            },
          ],
        };

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);

        // 1. Draw Static Map Obstacles
        if (obstacles.length > 0) {
          passEncoder.setVertexBuffer(0, obstacleInstanceBuffer);
          passEncoder.draw(6, obstacles.length, 0, 0);
        }

        // 2. Draw Players
        if (players.length > 0) {
          passEncoder.setVertexBuffer(0, instanceBuffer);
          passEncoder.draw(6, players.length, 0, 0);
        }

        passEncoder.end();
        device.queue.submit([commandEncoder.finish()]);

        animationFrameId = requestAnimationFrame(render);
      }

      render(performance.now());
    }

    initWebGPU();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [myId, obstacles]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert pixel coordinates to WebGPU Normalized Device Coordinates (-1 to 1)
    // In WebGPU, +Y is up, -Y is down
    const ndcX = (x / rect.width) * 2 - 1;
    const ndcY = -((y / rect.height) * 2 - 1);

    socket.emit("move", { targetX: ndcX, targetY: ndcY });
  };

  return (
    <div className="relative w-full aspect-video bg-neutral-950 rounded-xl overflow-hidden border border-neutral-800 shadow-inner">
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-red-400 font-medium">
          {error}
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full block object-contain cursor-crosshair"
          onClick={handleCanvasClick}
        />
      )}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm text-xs px-3 py-1.5 rounded-md text-white font-mono pointer-events-none border border-white/10 shadow-sm flex flex-col gap-1">
        <span className="font-bold text-indigo-400">WebGPU Arena</span>
        <span className="text-neutral-400">Click to navigate your node</span>
      </div>
    </div>
  );
}
