import { Obstacle, Player } from '../types';

const PLAYER_HALF_SIZE = 0.03;

export function checkOverlap(px: number, py: number, pHalf: number, obs: Obstacle): boolean {
  const pMinX = px - pHalf;
  const pMaxX = px + pHalf;
  const pMinY = py - pHalf;
  const pMaxY = py + pHalf;

  const oMinX = obs.x - obs.width / 2;
  const oMaxX = obs.x + obs.width / 2;
  const oMinY = obs.y - obs.height / 2;
  const oMaxY = obs.y + obs.height / 2;

  return pMaxX > oMinX && pMinX < oMaxX && pMaxY > oMinY && pMinY < oMaxY;
}

export function movePlayerWithCollision(player: Player, dx: number, dy: number, obstacles: Obstacle[]): Player {
  // Pure-like function: avoid mutation by returning a new player object if we wanted,
  // but to prevent large refactors on references, we'll return the updated coordinates.
  let newX = player.x + dx;
  let newY = player.y;

  for (const obs of obstacles) {
    if (checkOverlap(newX, newY, PLAYER_HALF_SIZE, obs)) {
      if (dx > 0) {
        newX = obs.x - obs.width / 2 - PLAYER_HALF_SIZE;
      } else if (dx < 0) {
        newX = obs.x + obs.width / 2 + PLAYER_HALF_SIZE;
      }
    }
  }

  newY = player.y + dy;
  for (const obs of obstacles) {
    if (checkOverlap(newX, newY, PLAYER_HALF_SIZE, obs)) {
      if (dy > 0) {
        newY = obs.y - obs.height / 2 - PLAYER_HALF_SIZE;
      } else if (dy < 0) {
        newY = obs.y + obs.height / 2 + PLAYER_HALF_SIZE;
      }
    }
  }

  return { ...player, x: newX, y: newY };
}
