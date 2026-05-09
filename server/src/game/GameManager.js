import { Room } from './Room.js';

// Helper function to generate unique IDs
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
    this.playerRooms = new Map(); // Map of playerId -> roomId
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

  removePlayer(playerId) {
    const roomId = this.playerRooms.get(playerId);
    if (roomId) {
      const room = this.rooms.get(roomId);
      if (room) {
        room.removePlayer(playerId);
        if (room.isEmpty()) {
          this.rooms.delete(roomId);
        }
      }
      this.playerRooms.delete(playerId);
    }
  }

  getRoomsInfo() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      players: room.players.size,
      maxPlayers: room.maxPlayers,
      gameStarted: room.gameStarted,
      isFull: room.isFull()
    }));
  }
}
