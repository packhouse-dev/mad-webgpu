import { query } from 'bitecs';
import { world, Position, Velocity } from './ecs';

export function movementSystem(time: number) {
  const ents = query(world, [Position, Velocity]);
  for (let i = 0; i < ents.length; i++) {
    const eid = ents[i];
    Position.x[eid] += Velocity.x[eid];
    Position.y[eid] += Velocity.y[eid];

    // Bounce off edges (-1 to 1)
    if (Position.x[eid] > 1 || Position.x[eid] < -1) {
      Velocity.x[eid] *= -1;
    }
    if (Position.y[eid] > 1 || Position.y[eid] < -1) {
      Velocity.y[eid] *= -1;
    }
  }
  return world;
}
