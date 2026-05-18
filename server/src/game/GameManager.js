import { Room } from './Room.js';

function generateRoomId(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class GameManager {
  constructor() {
    this.rooms = new Map();
    this.playerRooms   = new Map(); // socketId → roomId (joueurs)
    this.spectatorRooms = new Map(); // socketId → roomId (spectateurs)
  }

  createRoom(playerName) {
    const roomId = generateRoomId(8);
    const room = new Room(roomId, playerName);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, playerId, playerName) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };
    if (room.isFull()) return { success: false, error: 'Room is full' };
    if (room.gameStarted) return { success: false, error: 'Game already started' };

    room.addPlayer(playerId, playerName);
    this.playerRooms.set(playerId, roomId);
    return { success: true };
  }

  joinAsSpectator(roomId, socketId, name) {
    const room = this.rooms.get(roomId);
    if (!room) return { success: false, error: 'Room not found' };

    room.addSpectator(socketId, name);
    this.spectatorRooms.set(socketId, roomId);
    return { success: true };
  }

  removePlayer(socketId) {
    // Check if spectator first
    const spectatorRoomId = this.spectatorRooms.get(socketId);
    if (spectatorRoomId) {
      const room = this.rooms.get(spectatorRoomId);
      if (room) {
        room.removeSpectator(socketId);
        if (room.isEmpty()) this.rooms.delete(spectatorRoomId);
      }
      this.spectatorRooms.delete(socketId);
      return;
    }

    // Regular player
    const roomId = this.playerRooms.get(socketId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.removePlayer(socketId);
        if (room.isEmpty()) this.rooms.delete(roomId);
      }
      this.playerRooms.delete(socketId);
    }
  }

  removeSpectator(socketId) {
    const roomId = this.spectatorRooms.get(socketId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.removeSpectator(socketId);
        if (room.isEmpty()) this.rooms.delete(roomId);
      }
      this.spectatorRooms.delete(socketId);
    }
  }

  getRoomsInfo() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      players: room.players.size,
      maxPlayers: room.maxPlayers,
      spectators: room.spectators.size,
      gameStarted: room.gameStarted,
      isFull: room.isFull()
    }));
  }
}
