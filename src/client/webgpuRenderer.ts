import { Obstacle } from '../types';

export interface PlayerData {
  id: string;
  x: number;
  y: number;
  color: { r: number; g: number; b: number };
}

export interface WebGPUContextData {
  device: any;
  context: any;
  pipeline: any;
  instanceBuffer: any;
  obstacleInstanceBuffer: any;
}

export const shaderCode = `
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
`;

export async function initWebGPURenderer(canvas: HTMLCanvasElement, obstacles: Obstacle[]): Promise<WebGPUContextData | null> {
  try {
    const navGpu = (navigator as any).gpu;
    if (!navGpu) return null;

    const adapter = await navGpu.requestAdapter();
    if (!adapter) return null;

    const device = await adapter.requestDevice();
    const context = canvas.getContext("webgpu") as any;
    if (!context) return null;

    const presentationFormat = navGpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format: presentationFormat,
      alphaMode: "premultiplied",
    });

    const shaderModule = device.createShaderModule({ code: shaderCode });

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
      primitive: { topology: "triangle-list" },
    });

    const maxEntities = 10;
    // VERTEX = 32 (0x0020), COPY_DST = 8 (0x0008)
    const bufferUsage = 32 | 8;

    const instanceBuffer = device.createBuffer({
      size: maxEntities * 28,
      usage: bufferUsage,
    });

    const obstacleInstanceBuffer = device.createBuffer({
      size: Math.max(obstacles.length, 1) * 28,
      usage: bufferUsage,
    });

    if (obstacles.length > 0) {
      const obsData = new Float32Array(obstacles.length * 7);
      for (let i = 0; i < obstacles.length; i++) {
        const obs = obstacles[i];
        obsData[i * 7 + 0] = obs.x;
        obsData[i * 7 + 1] = obs.y;
        obsData[i * 7 + 2] = obs.color.r;
        obsData[i * 7 + 3] = obs.color.g;
        obsData[i * 7 + 4] = obs.color.b;
        obsData[i * 7 + 5] = obs.width / 0.06;
        obsData[i * 7 + 6] = obs.height / 0.06;
      }
      device.queue.writeBuffer(obstacleInstanceBuffer, 0, obsData);
    }

    return { device, context, pipeline, instanceBuffer, obstacleInstanceBuffer };
  } catch (err) {
    console.error("WebGPU Init Error:", err);
    return null;
  }
}

export function renderWebGPUFrame(ctx: WebGPUContextData, players: PlayerData[], myId: string | undefined, obstaclesLength: number) {
  const { device, context, pipeline, instanceBuffer, obstacleInstanceBuffer } = ctx;

  const instanceData = new Float32Array(players.length * 7);
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    instanceData[i * 7 + 0] = p.x;
    instanceData[i * 7 + 1] = p.y;
    instanceData[i * 7 + 2] = p.color.r;
    instanceData[i * 7 + 3] = p.color.g;
    instanceData[i * 7 + 4] = p.color.b;
    const scaleVal = p.id === myId ? 1.5 : 1.0;
    instanceData[i * 7 + 5] = scaleVal;
    instanceData[i * 7 + 6] = scaleVal;
  }

  if (players.length > 0) {
    device.queue.writeBuffer(instanceBuffer, 0, instanceData);
  }

  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor: any = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: { r: 0.05, g: 0.05, b: 0.08, a: 1.0 },
        loadOp: "clear",
        storeOp: "store",
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);

  if (obstaclesLength > 0) {
    passEncoder.setVertexBuffer(0, obstacleInstanceBuffer);
    passEncoder.draw(6, obstaclesLength, 0, 0);
  }

  if (players.length > 0) {
    passEncoder.setVertexBuffer(0, instanceBuffer);
    passEncoder.draw(6, players.length, 0, 0);
  }

  passEncoder.end();
  device.queue.submit([commandEncoder.finish()]);
}
