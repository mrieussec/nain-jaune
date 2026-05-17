import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { GameManager } from './game/GameManager.js';
import { gameHandlers } from './handlers/gameHandlers.js';
import { chatHandlers } from './handlers/chatHandlers.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5001',
  'https://nain-jaune-online.web.app',
  'https://nain-jaune-online.firebaseapp.com',
  ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : [])
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Game manager instance
const gameManager = new GameManager();

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running', version: '2.0.0' });
});

// Socket.io connection handlers
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);

  // Send current rooms list to newly connected client
  socket.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });

  // Rooms list
  socket.on('getRooms', (callback) => callback({ rooms: gameManager.getRoomsInfo() }));

  // Game handlers
  socket.on('createRoom', (data, callback) => gameHandlers.createRoom(socket, data, callback, gameManager, io));
  socket.on('joinRoom', (data, callback) => gameHandlers.joinRoom(socket, data, callback, gameManager, io));
  socket.on('startGame', (data, callback) => gameHandlers.startGame(socket, data, callback, gameManager, io));
  socket.on('playCard', (data, callback) => gameHandlers.playCard(socket, data, callback, gameManager, io));
  socket.on('passTurn', (data, callback) => gameHandlers.passTurn(socket, data, callback, gameManager, io));
  socket.on('leaveRoom', (data, callback) => gameHandlers.leaveRoom(socket, data, callback, gameManager, io));
  socket.on('newRound', (data, callback) => gameHandlers.newRound(socket, data, callback, gameManager, io));
  socket.on('getRoomInfo', (data, callback) => gameHandlers.getRoomInfo(socket, data, callback, gameManager));
  socket.on('brocanter', (data, callback) => gameHandlers.brocanter(socket, data, callback, gameManager, io));
  socket.on('declineBrocantage', (data, callback) => gameHandlers.declineBrocantage(socket, data, callback, gameManager, io));
  
  // Chat handlers
  socket.on('sendMessage', (data) => chatHandlers.sendMessage(socket, data, io));

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameManager.removePlayer(socket.id);
    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
  });
});

server.listen(PORT, () => {
  console.log(`🎮 Nain Jaune server running on http://localhost:${PORT}`);
});
