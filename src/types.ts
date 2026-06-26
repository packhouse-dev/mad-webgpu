export interface MapRule {
  type: 'random_obstacles' | 'border_walls' | 'maze_grid';
  count?: number;
  minSize?: number;
  maxSize?: number;
}

export interface MatchConfig {
  match: {
    time: number;
    maxPlayers: number;
  };
  map: {
    rules: MapRule[];
    size: [number, number];
  };
}

export interface MatchCategory {
  id: string;
  name: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  color: 'indigo' | 'emerald' | 'amber';
  config: MatchConfig;
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: { r: number; g: number; b: number };
}

export interface Player {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: { r: number; g: number; b: number };
  status: 'lobby' | 'matching' | 'in-game';
  roomId: string | null;
  categoryId: string | null;
}

export interface Room {
  id: string;
  players: string[];
  status: 'waiting' | 'countdown' | 'playing';
  countdown: number;
  config: MatchConfig;
  obstacles: Obstacle[];
}


