const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const { SkipBoGame } = require('./src/gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// Online Rooms Storage
// ============================================================
const rooms = {}; // roomId -> { game, players, stackSize }
const playerRooms = {}; // socketId -> roomId

// ============================================================
// Routes
// ============================================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length });
});

// ============================================================
// Socket.io Events
// ============================================================
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // ---- VS COMPUTER MODE ----
  socket.on('start_vs_computer', ({ stackSize, playerName }) => {
    const game = new SkipBoGame(stackSize || 20, 'computer');
    const names = [playerName || 'Игрок', 'Компьютер'];
    const state = game.initGame(names);

    socket.gameVsComputer = game;
    socket.emit('game_started', { state, playerIndex: 0, mode: 'computer' });
  });

  socket.on('play_to_build', ({ cardSource, cardIndex, buildPileIndex }) => {
    const game = socket.gameVsComputer;
    if (!game) return socket.emit('error', { message: 'Игра не найдена' });

    const result = game.playCardToBuild(0, cardSource, cardIndex, buildPileIndex);
    if (!result.success) {
      return socket.emit('error', { message: result.error });
    }

    socket.emit('game_update', { state: game.getState(0) });

    if (game.gameOver) {
      return socket.emit('game_over', { winner: game.winner, winnerName: game.players[game.winner].name });
    }

    // Computer plays automatically after short delay
    if (game.currentPlayerIndex === 1) {
      setTimeout(() => {
        const computerResult = game.computerTurn();
        socket.emit('computer_moved', { state: game.getState(0), actionLog: computerResult?.actionLog });
        if (game.gameOver) {
          socket.emit('game_over', { winner: game.winner, winnerName: game.players[game.winner].name });
        }
      }, 800);
    }
  });

  socket.on('discard_card', ({ cardIndex, discardPileIndex }) => {
    const game = socket.gameVsComputer;
    if (!game) return socket.emit('error', { message: 'Игра не найдена' });

    const result = game.discardCard(0, cardIndex, discardPileIndex);
    if (!result.success) {
      return socket.emit('error', { message: result.error });
    }

    socket.emit('game_update', { state: game.getState(0) });

    if (game.gameOver) {
      return socket.emit('game_over', { winner: game.winner, winnerName: game.players[game.winner].name });
    }

    // Computer plays
    if (game.currentPlayerIndex === 1) {
      setTimeout(() => {
        const computerResult = game.computerTurn();
        socket.emit('computer_moved', { state: game.getState(0), actionLog: computerResult?.actionLog });
        if (game.gameOver) {
          socket.emit('game_over', { winner: game.winner, winnerName: game.players[game.winner].name });
        }
      }, 800);
    }
  });

  // ---- ONLINE MODE ----
  socket.on('create_room', ({ stackSize, playerName }) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    rooms[roomId] = {
      game: null,
      stackSize: stackSize || 20,
      players: [{ socketId: socket.id, name: playerName || 'Игрок 1', index: 0 }],
      status: 'waiting'
    };
    playerRooms[socket.id] = roomId;
    socket.join(roomId);
    socket.emit('room_created', { roomId, playerIndex: 0 });
    console.log(`Room created: ${roomId}`);
  });

  socket.on('join_room', ({ roomId, playerName }) => {
    const room = rooms[roomId];
    if (!room) {
      return socket.emit('error', { message: 'Комната не найдена' });
    }
    if (room.players.length >= 2) {
      return socket.emit('error', { message: 'Комната заполнена' });
    }
    if (room.status !== 'waiting') {
      return socket.emit('error', { message: 'Игра уже начата' });
    }

    room.players.push({ socketId: socket.id, name: playerName || 'Игрок 2', index: 1 });
    playerRooms[socket.id] = roomId;
    socket.join(roomId);

    // Start game
    const game = new SkipBoGame(room.stackSize, 'online');
    const names = room.players.map(p => p.name);
    game.initGame(names);
    room.game = game;
    room.status = 'playing';

    // Send state to each player
    room.players.forEach(p => {
      const playerSocket = io.sockets.sockets.get(p.socketId);
      if (playerSocket) {
        playerSocket.emit('game_started', {
          state: game.getState(p.index),
          playerIndex: p.index,
          mode: 'online',
          roomId
        });
      }
    });
  });

  socket.on('online_play_to_build', ({ cardSource, cardIndex, buildPileIndex }) => {
    const roomId = playerRooms[socket.id];
    if (!roomId) return socket.emit('error', { message: 'Вы не в комнате' });

    const room = rooms[roomId];
    if (!room || !room.game) return socket.emit('error', { message: 'Игра не начата' });

    const playerData = room.players.find(p => p.socketId === socket.id);
    if (!playerData) return socket.emit('error', { message: 'Игрок не найден' });

    const result = room.game.playCardToBuild(playerData.index, cardSource, cardIndex, buildPileIndex);
    if (!result.success) {
      return socket.emit('error', { message: result.error });
    }

    // Send updated state to all players in room
    room.players.forEach(p => {
      const ps = io.sockets.sockets.get(p.socketId);
      if (ps) {
        ps.emit('game_update', { state: room.game.getState(p.index) });
      }
    });

    if (room.game.gameOver) {
      io.to(roomId).emit('game_over', {
        winner: room.game.winner,
        winnerName: room.game.players[room.game.winner].name
      });
    }
  });

  socket.on('online_discard_card', ({ cardIndex, discardPileIndex }) => {
    const roomId = playerRooms[socket.id];
    if (!roomId) return socket.emit('error', { message: 'Вы не в комнате' });

    const room = rooms[roomId];
    if (!room || !room.game) return socket.emit('error', { message: 'Игра не начата' });

    const playerData = room.players.find(p => p.socketId === socket.id);
    if (!playerData) return socket.emit('error', { message: 'Игрок не найден' });

    const result = room.game.discardCard(playerData.index, cardIndex, discardPileIndex);
    if (!result.success) {
      return socket.emit('error', { message: result.error });
    }

    room.players.forEach(p => {
      const ps = io.sockets.sockets.get(p.socketId);
      if (ps) {
        ps.emit('game_update', { state: room.game.getState(p.index) });
      }
    });

    if (room.game.gameOver) {
      io.to(roomId).emit('game_over', {
        winner: room.game.winner,
        winnerName: room.game.players[room.game.winner].name
      });
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    const roomId = playerRooms[socket.id];
    if (roomId && rooms[roomId]) {
      io.to(roomId).emit('player_disconnected', { message: 'Противник отключился' });
      delete rooms[roomId];
    }
    delete playerRooms[socket.id];
  });
});

// ============================================================
// Start Server
// ============================================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Skip-Bo server running on port ${PORT}`);
});
