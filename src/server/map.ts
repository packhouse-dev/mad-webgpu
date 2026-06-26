import { MatchConfig, Obstacle } from '../types';

export const spawnPoints = [
  { x: -0.7, y: -0.7 },
  { x: 0.7, y: 0.7 },
  { x: -0.7, y: 0.7 },
  { x: 0.7, y: -0.7 }
];

function generateBorderWalls(): Obstacle[] {
  const wallThickness = 0.08;
  return [
    { x: 0, y: 1.0 - wallThickness / 2, width: 2.0, height: wallThickness, color: { r: 0.2, g: 0.2, b: 0.25 } },
    { x: 0, y: -1.0 + wallThickness / 2, width: 2.0, height: wallThickness, color: { r: 0.2, g: 0.2, b: 0.25 } },
    { x: -1.0 + wallThickness / 2, y: 0, width: wallThickness, height: 2.0, color: { r: 0.2, g: 0.2, b: 0.25 } },
    { x: 1.0 - wallThickness / 2, y: 0, width: wallThickness, height: 2.0, color: { r: 0.2, g: 0.2, b: 0.25 } }
  ];
}

function generateRandomObstacles(count: number, minSize: number, maxSize: number): Obstacle[] {
  const obstacles: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    const w = Math.random() * (maxSize - minSize) + minSize;
    const h = Math.random() * (maxSize - minSize) + minSize;
    const x = Math.random() * 1.6 - 0.8;
    const y = Math.random() * 1.6 - 0.8;
    
    const overlapsSpawn = spawnPoints.some(spawn => 
      Math.abs(x - spawn.x) < (w / 2 + 0.15) && Math.abs(y - spawn.y) < (h / 2 + 0.15)
    );

    if (overlapsSpawn) continue;

    obstacles.push({
      x, y, width: w, height: h,
      color: {
        r: Math.random() * 0.2 + 0.1,
        g: Math.random() * 0.3 + 0.1,
        b: Math.random() * 0.4 + 0.4
      }
    });
  }
  return obstacles;
}

function generateMazeGrid(): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const gridSize = 5;
  const cellSize = 2.0 / gridSize;
  
  for (let r = 1; r < gridSize; r++) {
    for (let c = 1; c < gridSize; c++) {
      const px = -1.0 + c * cellSize;
      const py = -1.0 + r * cellSize;
      
      const overlapsSpawn = spawnPoints.some(spawn => 
        Math.abs(px - spawn.x) < 0.25 && Math.abs(py - spawn.y) < 0.25
      );
      if (overlapsSpawn) continue;

      const rand = Math.random();
      const thickness = 0.08;
      const len = cellSize * 0.9;

      if (rand < 0.38) {
        obstacles.push({
          x: px + (Math.random() * 0.1 - 0.05), y: py,
          width: len, height: thickness, color: { r: 0.1, g: 0.4, b: 0.3 }
        });
      } else if (rand < 0.76) {
        obstacles.push({
          x: px, y: py + (Math.random() * 0.1 - 0.05),
          width: thickness, height: len, color: { r: 0.1, g: 0.4, b: 0.3 }
        });
      }
    }
  }
  return obstacles;
}

export function generateMap(config: MatchConfig): Obstacle[] {
  return config.map.rules.flatMap(rule => {
    switch (rule.type) {
      case 'border_walls': return generateBorderWalls();
      case 'random_obstacles': return generateRandomObstacles(rule.count || 10, rule.minSize || 0.1, rule.maxSize || 0.3);
      case 'maze_grid': return generateMazeGrid();
      default: return [];
    }
  });
}
