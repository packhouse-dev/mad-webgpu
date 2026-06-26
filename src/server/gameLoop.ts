import { Room, Player } from '../types';
import { movePlayerWithCollision } from './physics';

export function updateGameState(rooms: Map<string, Room>, players: Map<string, Player>): Array<{roomId: string, players: Player[]}> {
  const updates: Array<{roomId: string, players: Player[]}> = [];

  for (const room of rooms.values()) {
    if (room.status !== 'playing') continue;

    const roomPlayers = room.players.map(pid => players.get(pid)).filter((p): p is Player => p !== undefined);
    let stateChanged = false;
    
    for (let i = 0; i < roomPlayers.length; i++) {
      const p = roomPlayers[i];
      const dx = p.targetX - p.x;
      const dy = p.targetY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > 0.005) {
        const speed = 0.025;
        const ratio = Math.min(speed / dist, 1);
        const stepX = dx * ratio;
        const stepY = dy * ratio;
        
        const updatedPlayer = movePlayerWithCollision(p, stepX, stepY, room.obstacles);
        
        // Mutating map intentionally to update global state here, 
        // ideally we would return new maps, but for Socket.io it's simpler to update in place for now
        // while keeping the movement calculation pure.
        players.set(p.id, updatedPlayer);
        roomPlayers[i] = updatedPlayer;
      }
    }

    // Always push updates so clients see the players immediately upon game start
    updates.push({ roomId: room.id, players: roomPlayers });
  }

  return updates;
}
