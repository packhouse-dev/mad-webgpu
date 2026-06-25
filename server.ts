import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { MatchConfig, MatchCategory, Obstacle } from './src/types';

const PORT = 3000;

// Load match categories and configuration
const categoriesPath = path.join(process.cwd(), 'src', 'config', 'matchCategories.json');
const categories: MatchCategory[] = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

const defaultMatchConfigPath = path.join(process.cwd(), 'src', 'config', 'defaultMatchConfig.json');
const defaultMatchConfig: MatchConfig = JSON.parse(fs.readFileSync(defaultMatchConfigPath, 'utf8'));

interface Player {
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

interface Room {
  id: string;
  players: string[];
  status: 'waiting' | 'countdown' | 'playing';
  countdown: number;
  config: MatchConfig;
  obstacles: Obstacle[];
}

const players = new Map<string, Player>();
const rooms = new Map<string, Room>();

const spawnPoints = [
  { x: -0.7, y: -0.7 },
  { x: 0.7, y: 0.7 },
  { x: -0.7, y: 0.7 },
  { x: 0.7, y: -0.7 }
];

function generateMap(config: MatchConfig): Obstacle[] {
  const obstacles: Obstacle[] = [];
  const rules = config.map.rules;

  for (const rule of rules) {
    if (rule.type === 'border_walls') {
      const wallThickness = 0.08;
      
      // Top wall
      obstacles.push({
        x: 0,
        y: 1.0 + wallThickness / 2,
        width: 2.0 + wallThickness * 2,
        height: wallThickness,
        color: { r: 0.2, g: 0.2, b: 0.25 }
      });
      // Bottom wall
      obstacles.push({
        x: 0,
        y: -1.0 - wallThickness / 2,
        width: 2.0 + wallThickness * 2,
        height: wallThickness,
        color: { r: 0.2, g: 0.2, b: 0.25 }
      });
      // Left wall
      obstacles.push({
        x: -1.0 - wallThickness / 2,
        y: 0,
        width: wallThickness,
        height: 2.0 + wallThickness * 2,
        color: { r: 0.2, g: 0.2, b: 0.25 }
      });
      // Right wall
      obstacles.push({
        x: 1.0 + wallThickness / 2,
        y: 0,
        width: wallThickness,
        height: 2.0 + wallThickness * 2,
        color: { r: 0.2, g: 0.2, b: 0.25 }
      });
    } else if (rule.type === 'random_obstacles') {
      const count = rule.count || 10;
      const minSize = rule.minSize || 0.1;
      const maxSize = rule.maxSize || 0.3;

      for (let i = 0; i < count; i++) {
        const w = Math.random() * (maxSize - minSize) + minSize;
        const h = Math.random() * (maxSize - minSize) + minSize;
        
        let x = Math.random() * 1.6 - 0.8;
        let y = Math.random() * 1.6 - 0.8;
        
        // Ensure starting positions at spawns are safe
        let overlapsSpawn = false;
        for (const spawn of spawnPoints) {
          if (Math.abs(x - spawn.x) < (w / 2 + 0.15) && Math.abs(y - spawn.y) < (h / 2 + 0.15)) {
            overlapsSpawn = true;
            break;
          }
        }

        if (overlapsSpawn) {
          continue; // skip or generate another
        }

        obstacles.push({
          x,
          y,
          width: w,
          height: h,
          color: {
            r: Math.random() * 0.2 + 0.1,
            g: Math.random() * 0.3 + 0.1,
            b: Math.random() * 0.4 + 0.4 // Neon blues/cyans/purples
          }
        });
      }
    } else if (rule.type === 'maze_grid') {
      const gridSize = 5;
      const cellSize = 2.0 / gridSize;
      
      for (let r = 1; r < gridSize; r++) {
        for (let c = 1; c < gridSize; c++) {
          const px = -1.0 + c * cellSize;
          const py = -1.0 + r * cellSize;
          
          // Keep starting spawns clear of maze nodes if close
          let overlapsSpawn = false;
          for (const spawn of spawnPoints) {
            if (Math.abs(px - spawn.x) < 0.25 && Math.abs(py - spawn.y) < 0.25) {
              overlapsSpawn = true;
              break;
            }
          }
          if (overlapsSpawn) continue;

          const rand = Math.random();
          const thickness = 0.08;
          const len = cellSize * 0.9;

          if (rand < 0.38) {
            // Horizontal segment
            obstacles.push({
              x: px + (Math.random() * 0.1 - 0.05),
              y: py,
              width: len,
              height: thickness,
              color: { r: 0.1, g: 0.4, b: 0.3 } // emerald forest
            });
          } else if (rand < 0.76) {
            // Vertical segment
            obstacles.push({
              x: px,
              y: py + (Math.random() * 0.1 - 0.05),
              width: thickness,
              height: len,
              color: { r: 0.1, g: 0.4, b: 0.3 }
            });
          }
        }
      }
    }
  }

  return obstacles;
}

function checkOverlap(px: number, py: number, pHalf: number, obs: Obstacle): boolean {
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

function movePlayerWithCollision(player: Player, dx: number, dy: number, obstacles: Obstacle[]) {
  const playerHalf = 0.03; // matches the collision boundaries

  // 1. Try to move X
  player.x += dx;
  for (const obs of obstacles) {
    if (checkOverlap(player.x, player.y, playerHalf, obs)) {
      if (dx > 0) {
        player.x = obs.x - obs.width / 2 - playerHalf;
      } else if (dx < 0) {
        player.x = obs.x + obs.width / 2 + playerHalf;
      }
    }
  }

  // 2. Try to move Y
  player.y += dy;
  for (const obs of obstacles) {
    if (checkOverlap(player.x, player.y, playerHalf, obs)) {
      if (dy > 0) {
        player.y = obs.y - obs.height / 2 - playerHalf;
      } else if (dy < 0) {
        player.y = obs.y + obs.height / 2 + playerHalf;
      }
    }
  }
}


async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Socket.IO Logic
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);
    
    // Initialize player
    players.set(socket.id, {
      id: socket.id,
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      color: {
        r: Math.random() * 0.8 + 0.2,
        g: Math.random() * 0.8 + 0.2,
        b: Math.random() * 0.8 + 0.2
      },
      status: 'lobby',
      roomId: null,
      categoryId: null
    });

    socket.emit('player_init', players.get(socket.id));

    // Handle matching by category
    socket.on('find_match', (data?: { categoryId: string }) => {
      const player = players.get(socket.id);
      if (!player) return;
      
      const categoryId = data?.categoryId || 'arena';
      player.status = 'matching';
      player.categoryId = categoryId;
      console.log(`${socket.id} looking for match in category: ${categoryId}`);

      // Simple matching: find another player in 'matching' status searching for the SAME category
      const otherPlayers = Array.from(players.values()).filter(
        p => p.status === 'matching' && p.id !== socket.id && p.categoryId === categoryId
      );

      if (otherPlayers.length > 0) {
        // Create match
        const opponent = otherPlayers[0];
        const roomId = uuidv4();
        
        const category = categories.find(c => c.id === categoryId) || categories[0];
        const matchConfig = category.config;

        // Spawn players at specific spawn points
        player.x = spawnPoints[0].x;
        player.y = spawnPoints[0].y;
        player.targetX = spawnPoints[0].x;
        player.targetY = spawnPoints[0].y;
        
        opponent.x = spawnPoints[1].x;
        opponent.y = spawnPoints[1].y;
        opponent.targetX = spawnPoints[1].x;
        opponent.targetY = spawnPoints[1].y;

        const obstacles = generateMap(matchConfig);

        rooms.set(roomId, {
          id: roomId,
          players: [socket.id, opponent.id],
          status: 'countdown',
          countdown: 5,
          config: matchConfig,
          obstacles: obstacles
        });

        player.status = 'in-game';
        player.roomId = roomId;
        opponent.status = 'in-game';
        opponent.roomId = roomId;

        socket.join(roomId);
        io.sockets.sockets.get(opponent.id)?.join(roomId);

        io.to(roomId).emit('match_found', { 
          roomId, 
          players: [player, opponent], 
          config: matchConfig,
          obstacles: obstacles
        });
        
        // Start countdown
        let countdown = 5;
        const interval = setInterval(() => {
          countdown--;
          if (rooms.has(roomId)) {
            rooms.get(roomId)!.countdown = countdown;
            io.to(roomId).emit('countdown', countdown);
          }
          if (countdown <= 0) {
            clearInterval(interval);
            if (rooms.has(roomId)) {
              rooms.get(roomId)!.status = 'playing';
              io.to(roomId).emit('game_start');
            }
          }
        }, 1000);
      } else {
        socket.emit('waiting_for_match');
      }
    });

    socket.on('start_solo_match', (data?: { categoryId: string }) => {
      const player = players.get(socket.id);
      if (!player) return;

      const categoryId = data?.categoryId || 'arena';
      player.status = 'in-game';
      player.categoryId = categoryId;
      console.log(`${socket.id} starting solo match in category: ${categoryId}`);

      const roomId = uuidv4();
      player.roomId = roomId;

      const category = categories.find(c => c.id === categoryId) || categories[0];
      const matchConfig = category.config;

      // Spawn player at starting point
      player.x = spawnPoints[0].x;
      player.y = spawnPoints[0].y;
      player.targetX = spawnPoints[0].x;
      player.targetY = spawnPoints[0].y;

      const obstacles = generateMap(matchConfig);

      rooms.set(roomId, {
        id: roomId,
        players: [socket.id],
        status: 'countdown',
        countdown: 5,
        config: matchConfig,
        obstacles: obstacles
      });

      socket.join(roomId);

      io.to(roomId).emit('match_found', { 
        roomId, 
        players: [player], 
        config: matchConfig,
        obstacles: obstacles
      });

      // Start countdown
      let countdown = 5;
      const interval = setInterval(() => {
        countdown--;
        if (rooms.has(roomId)) {
          rooms.get(roomId)!.countdown = countdown;
          io.to(roomId).emit('countdown', countdown);
        }
        if (countdown <= 0) {
          clearInterval(interval);
          if (rooms.has(roomId)) {
            rooms.get(roomId)!.status = 'playing';
            io.to(roomId).emit('game_start');
          }
        }
      }, 1000);
    });

    socket.on('move', (data: { targetX: number, targetY: number }) => {
      const player = players.get(socket.id);
      if (player && player.roomId) {
        player.targetX = data.targetX;
        player.targetY = data.targetY;
        
        io.to(player.roomId).emit('player_move', {
          id: socket.id,
          targetX: data.targetX,
          targetY: data.targetY
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      const player = players.get(socket.id);
      if (player && player.roomId) {
        const room = rooms.get(player.roomId);
        if (room) {
          room.players = room.players.filter(id => id !== socket.id);
          io.to(player.roomId).emit('player_disconnected', socket.id);
          if (room.players.length === 0) {
            rooms.delete(player.roomId);
          }
        }
      }
      players.delete(socket.id);
    });
  });

  // Game loop with server-authoritative sliding AABB collision detection
  setInterval(() => {
    rooms.forEach(room => {
      if (room.status === 'playing') {
        const roomPlayers = room.players.map(pid => players.get(pid)).filter(Boolean) as Player[];
        let stateChanged = false;
        
        roomPlayers.forEach(p => {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0.005) {
            const speed = 0.025;
            const ratio = Math.min(speed / dist, 1);
            const stepX = dx * ratio;
            const stepY = dy * ratio;
            
            movePlayerWithCollision(p, stepX, stepY, room.obstacles);
            stateChanged = true;
          }
        });

        if (stateChanged) {
          io.to(room.id).emit('game_state', roomPlayers);
        }
      }
    });
  }, 1000 / 30); // 30 ticks per second

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
