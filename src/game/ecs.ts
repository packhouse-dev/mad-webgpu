import { createWorld, addEntity, addComponent } from 'bitecs';

export const MAX_ENTITIES = 10000;

// --- World ---
export const world = createWorld();

// --- Components ---
export const Position = {
  x: new Float32Array(MAX_ENTITIES),
  y: new Float32Array(MAX_ENTITIES),
};

export const Velocity = {
  x: new Float32Array(MAX_ENTITIES),
  y: new Float32Array(MAX_ENTITIES),
};

export const Color = {
  r: new Float32Array(MAX_ENTITIES),
  g: new Float32Array(MAX_ENTITIES),
  b: new Float32Array(MAX_ENTITIES),
};

// --- Setup ---
// Create some initial entities
for (let i = 0; i < 1000; i++) {
  const eid = addEntity(world);
  addComponent(world, eid, Position);
  Position.x[eid] = Math.random() * 2 - 1; // -1 to 1
  Position.y[eid] = Math.random() * 2 - 1; // -1 to 1

  addComponent(world, eid, Velocity);
  Velocity.x[eid] = (Math.random() - 0.5) * 0.005;
  Velocity.y[eid] = (Math.random() - 0.5) * 0.005;

  addComponent(world, eid, Color);
  Color.r[eid] = Math.random();
  Color.g[eid] = Math.random();
  Color.b[eid] = Math.random();
}

