import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { MatchCategory, Player, Room } from './src/types';
import { generateMap, spawnPoints } from './src/server/map';
import { updateGameState } from './src/server/gameLoop';

const PORT = 3000;

const categoriesPath = path.join(process.cwd(), 'src', 'config', 'matchCategories.json');
const categories: MatchCategory[] = JSON.parse(fs.readFileSync(categoriesPath, 'utf8'));

const players = new Map<string, Player>();
const rooms = new Map<string, Room>();

function createPlayer(id: string): Player {
  return {
    id,
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
  };
}

function assignSpawnPoints(roomPlayers: Player[]) {
  roomPlayers.forEach((p, index) => {
    const spawn = spawnPoints[index % spawnPoints.length];
    p.x = spawn.x;
    p.y = spawn.y;
    p.targetX = spawn.x;
    p.targetY = spawn.y;
  });
}

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: { origin: '*' }
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);
    
    players.set(socket.id, createPlayer(socket.id));
    socket.emit('player_init', players.get(socket.id));

    socket.on('find_match', (data?: { categoryId: string }) => {
      const player = players.get(socket.id);
      if (!player) return;
      
      const categoryId = data?.categoryId || 'arena';
      player.status = 'matching';
      player.categoryId = categoryId;
      
      const opponent = Array.from(players.values()).find(
        p => p.status === 'matching' && p.id !== socket.id && p.categoryId === categoryId
      );

      if (opponent) {
        const roomId = uuidv4();
        const category = categories.find(c => c.id === categoryId) || categories[0];
        const matchConfig = category.config;

        assignSpawnPoints([player, opponent]);
        const obstacles = generateMap(matchConfig);

        rooms.set(roomId, {
          id: roomId,
          players: [player.id, opponent.id],
          status: 'playing',
          countdown: 0,
          config: matchConfig,
          obstacles
        });

        player.status = 'in-game';
        player.roomId = roomId;
        opponent.status = 'in-game';
        opponent.roomId = roomId;

        socket.join(roomId);
        io.sockets.sockets.get(opponent.id)?.join(roomId);

        io.to(roomId).emit('match_found', { roomId, players: [player, opponent], config: matchConfig, obstacles });
        io.to(roomId).emit('game_start');
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

      const roomId = uuidv4();
      player.roomId = roomId;

      const category = categories.find(c => c.id === categoryId) || categories[0];
      const matchConfig = category.config;

      assignSpawnPoints([player]);
      const obstacles = generateMap(matchConfig);

      rooms.set(roomId, {
        id: roomId,
        players: [player.id],
        status: 'playing',
        countdown: 0,
        config: matchConfig,
        obstacles
      });

      socket.join(roomId);
      io.to(roomId).emit('match_found', { roomId, players: [player], config: matchConfig, obstacles });
      io.to(roomId).emit('game_start');
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
      const player = players.get(socket.id);
      if (player && player.roomId) {
        const room = rooms.get(player.roomId);
        if (room) {
          room.players = room.players.filter(id => id !== socket.id);
          io.to(player.roomId).emit('player_disconnected', socket.id);
          if (room.players.length === 0) rooms.delete(player.roomId);
        }
      }
      players.delete(socket.id);
    });
  });

  setInterval(() => {
    const updates = updateGameState(rooms, players);
    for (const update of updates) {
      io.to(update.roomId).emit('game_state', update.players);
    }
  }, 1000 / 30);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  httpServer.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
}

startServer();
