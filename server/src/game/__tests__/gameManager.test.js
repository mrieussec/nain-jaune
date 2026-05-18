import { describe, it, expect, beforeEach } from 'vitest';
import { GameManager } from '../GameManager.js';

describe('GameManager', () => {
  let gm;

  beforeEach(() => {
    gm = new GameManager();
  });

  describe('createRoom()', () => {
    it('creates a room and returns it', () => {
      const room = gm.createRoom('Alice');
      expect(room).toBeDefined();
      expect(room.id).toBeTruthy();
    });

    it('stores the room internally', () => {
      const room = gm.createRoom('Alice');
      expect(gm.getRoom(room.id)).toBe(room);
    });

    it('creates rooms with unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 20; i++) {
        ids.add(gm.createRoom('Player').id);
      }
      expect(ids.size).toBe(20);
    });
  });

  describe('joinRoom()', () => {
    it('adds a player to an existing room', () => {
      const room = gm.createRoom('Alice');
      const result = gm.joinRoom(room.id, 'socket-bob', 'Bob');
      expect(result.success).toBe(true);
      expect(room.players.size).toBe(2);
    });

    it('fails if room does not exist', () => {
      const result = gm.joinRoom('nonexistent', 'socket-1', 'Bob');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('fails if room is full', () => {
      const room = gm.createRoom('P1');
      // Need to manually set players to maxPlayers
      room.maxPlayers = 2;
      gm.joinRoom(room.id, 's2', 'P2');
      const result = gm.joinRoom(room.id, 's3', 'P3');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/full/i);
    });

    it('fails if game already started', () => {
      const room = gm.createRoom('Alice');
      // Manually mark game as started
      gm.joinRoom(room.id, 's2', 'Bob');
      // Fix socket IDs so startGame works
      const [ownerId] = [...room.players.keys()];
      room.players.get(ownerId).id = ownerId;
      room.startGame();
      const result = gm.joinRoom(room.id, 's3', 'Charlie');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/started/i);
    });

    it('maps playerId → roomId', () => {
      const room = gm.createRoom('Alice');
      gm.joinRoom(room.id, 'socket-bob', 'Bob');
      expect(gm.playerRooms.get('socket-bob')).toBe(room.id);
    });
  });

  describe('removePlayer()', () => {
    it('removes a player from the room', () => {
      const room = gm.createRoom('Alice');
      gm.joinRoom(room.id, 'socket-bob', 'Bob');
      gm.removePlayer('socket-bob');
      expect(room.players.size).toBe(1);
    });

    it('deletes the room when it becomes empty', () => {
      const room = gm.createRoom('Alice');
      // Fix owner socket ID mapping
      const [ownerId] = [...room.players.keys()];
      gm.playerRooms.set('socket-alice', room.id);
      room.players.get(ownerId).id = 'socket-alice';
      room.players.set('socket-alice', room.players.get(ownerId));
      room.players.delete(ownerId);

      gm.removePlayer('socket-alice');
      expect(gm.getRoom(room.id)).toBeUndefined();
    });

    it('does nothing for unknown player IDs', () => {
      expect(() => gm.removePlayer('ghost-id')).not.toThrow();
    });
  });

  describe('getRoomsInfo()', () => {
    it('returns an empty array when no rooms exist', () => {
      expect(gm.getRoomsInfo()).toEqual([]);
    });

    it('returns info for all rooms', () => {
      gm.createRoom('Alice');
      gm.createRoom('Bob');
      const info = gm.getRoomsInfo();
      expect(info).toHaveLength(2);
      expect(info[0]).toHaveProperty('id');
      expect(info[0]).toHaveProperty('players');
      expect(info[0]).toHaveProperty('gameStarted');
    });
  });
});
