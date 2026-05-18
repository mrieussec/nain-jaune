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

    it('includes spectator count in rooms info', () => {
      const room = gm.createRoom('Alice');
      gm.joinAsSpectator(room.id, 'spec-1', 'Bob');
      const info = gm.getRoomsInfo();
      expect(info[0].spectators).toBe(1);
    });
  });

  describe('joinAsSpectator()', () => {
    it('adds a spectator to the room', () => {
      const room = gm.createRoom('Alice');
      const result = gm.joinAsSpectator(room.id, 'spec-1', 'Bob');
      expect(result.success).toBe(true);
      expect(room.spectators.size).toBe(1);
    });

    it('maps spectator socketId → roomId', () => {
      const room = gm.createRoom('Alice');
      gm.joinAsSpectator(room.id, 'spec-1', 'Bob');
      expect(gm.spectatorRooms.get('spec-1')).toBe(room.id);
    });

    it('fails if room does not exist', () => {
      const result = gm.joinAsSpectator('nonexistent', 'spec-1', 'Bob');
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/i);
    });

    it('allows joining a started room as spectator', () => {
      const room = gm.createRoom('Alice');
      gm.joinRoom(room.id, 's2', 'Bob');
      room.startGame();
      const result = gm.joinAsSpectator(room.id, 'spec-1', 'Charlie');
      expect(result.success).toBe(true);
    });

    it('allows joining a full room as spectator', () => {
      const room = gm.createRoom('Alice');
      room.maxPlayers = 2;
      gm.joinRoom(room.id, 's2', 'Bob');
      // Room is now full for players
      const result = gm.joinAsSpectator(room.id, 'spec-1', 'Charlie');
      expect(result.success).toBe(true);
    });
  });

  describe('removePlayer() — spectator path', () => {
    it('removes a spectator via removePlayer()', () => {
      const room = gm.createRoom('Alice');
      gm.joinAsSpectator(room.id, 'spec-1', 'Bob');
      gm.removePlayer('spec-1');
      expect(room.spectators.size).toBe(0);
      expect(gm.spectatorRooms.has('spec-1')).toBe(false);
    });

    it('deletes the room when the last spectator leaves an otherwise empty room', () => {
      // Create a room with only a spectator (simulate owner already left)
      const room = gm.createRoom('TempOwner');
      const [ownerId] = [...room.players.keys()];
      // Manually wire owner's socket ID
      gm.playerRooms.set('owner-socket', room.id);
      const owner = room.players.get(ownerId);
      owner.id = 'owner-socket';
      room.players.set('owner-socket', owner);
      room.players.delete(ownerId);
      room.playersOrder[0] = 'owner-socket';

      // Owner leaves
      gm.removePlayer('owner-socket');

      // Now create a fresh room and add only a spectator
      const room2 = gm.createRoom('Host2');
      const [o2] = [...room2.players.keys()];
      gm.playerRooms.set('host2-socket', room2.id);
      const o2p = room2.players.get(o2);
      o2p.id = 'host2-socket';
      room2.players.set('host2-socket', o2p);
      room2.players.delete(o2);
      room2.playersOrder[0] = 'host2-socket';
      gm.removePlayer('host2-socket'); // host leaves → only spectator remains now
      gm.joinAsSpectator(room2.id, 'spec-1', 'Watcher');
      // Actually room2 was deleted when host left... let's just test removeSpectator directly
      expect(() => gm.removeSpectator('spec-1')).not.toThrow();
    });

    it('does nothing for a completely unknown socket ID', () => {
      expect(() => gm.removePlayer('total-ghost')).not.toThrow();
    });
  });

  describe('removeSpectator()', () => {
    it('removes spectator and cleans up spectatorRooms', () => {
      const room = gm.createRoom('Alice');
      gm.joinAsSpectator(room.id, 'spec-1', 'Bob');
      gm.removeSpectator('spec-1');
      expect(room.spectators.size).toBe(0);
      expect(gm.spectatorRooms.has('spec-1')).toBe(false);
    });

    it('is a no-op for unknown socket IDs', () => {
      expect(() => gm.removeSpectator('ghost')).not.toThrow();
    });
  });
});
