import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';

const PORT = 3000;

interface Player {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  color: { r: number; g: number; b: number };
  status: 'lobby' | 'matching' | 'in-game';
  roomId: string | null;
}

interface Room {
  id: string;
  players: string[];
  status: 'waiting' | 'countdown' | 'playing';
  countdown: number;
}

const players = new Map<string, Player>();
const rooms = new Map<string, Room>();

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
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      targetX: 0,
      targetY: 0,
      color: {
        r: Math.random() * 0.8 + 0.2,
        g: Math.random() * 0.8 + 0.2,
        b: Math.random() * 0.8 + 0.2
      },
      status: 'lobby',
      roomId: null
    });

    socket.emit('player_init', players.get(socket.id));

    // Handle matching
    socket.on('find_match', () => {
      const player = players.get(socket.id);
      if (!player) return;
      
      player.status = 'matching';
      console.log(`${socket.id} looking for match`);

      // Simple matching: find another player in 'matching' status
      const otherPlayers = Array.from(players.values()).filter(
        p => p.status === 'matching' && p.id !== socket.id
      );

      if (otherPlayers.length > 0) {
        // Create match
        const opponent = otherPlayers[0];
        const roomId = uuidv4();
        
        rooms.set(roomId, {
          id: roomId,
          players: [socket.id, opponent.id],
          status: 'countdown',
          countdown: 5
        });

        player.status = 'in-game';
        player.roomId = roomId;
        opponent.status = 'in-game';
        opponent.roomId = roomId;

        socket.join(roomId);
        io.sockets.sockets.get(opponent.id)?.join(roomId);

        io.to(roomId).emit('match_found', { roomId, players: [player, opponent] });
        
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

    socket.on('move', (data: { targetX: number, targetY: number }) => {
      const player = players.get(socket.id);
      if (player && player.roomId) {
        player.targetX = data.targetX;
        player.targetY = data.targetY;
        
        // In a real game, movement is simulated on server. 
        // For now, we update target and let clients interpolate, or update position directly.
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

  // Game loop for server-side authority (simple position update based on targets)
  setInterval(() => {
    rooms.forEach(room => {
      if (room.status === 'playing') {
        const roomPlayers = room.players.map(pid => players.get(pid)).filter(Boolean) as Player[];
        let stateChanged = false;
        
        roomPlayers.forEach(p => {
          const dx = p.targetX - p.x;
          const dy = p.targetY - p.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist > 0.01) {
            const speed = 0.02;
            const ratio = Math.min(speed / dist, 1);
            p.x += dx * ratio;
            p.y += dy * ratio;
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
