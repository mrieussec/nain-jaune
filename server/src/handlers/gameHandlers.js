export const gameHandlers = {
  createRoom(socket, data, callback, gameManager, io) {
    const { playerName } = data;
    
    if (!playerName) {
      return callback({ success: false, error: 'Player name required' });
    }

    const room = gameManager.createRoom(playerName);
    const ownerId = room.playersOrder[0];
    
    // Update socket ID mapping
    gameManager.playerRooms.set(socket.id, room.id);
    const player = gameManager.rooms.get(room.id).players.get(ownerId);
    player.id = socket.id;
    gameManager.playerRooms.delete(ownerId);
    gameManager.playerRooms.set(socket.id, room.id);
    
    // Update playersOrder to use socket ID
    room.playersOrder[0] = socket.id;
    // Update Map key
    room.players.set(socket.id, player);
    room.players.delete(ownerId);

    socket.join(`room-${room.id}`);
    
    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
    callback({ success: true, roomId: room.id, gameState: room.getGameState() });
  },

  joinRoom(socket, data, callback, gameManager, io) {
    const { roomId, playerName } = data;
    
    if (!roomId || !playerName) {
      return callback({ success: false, error: 'Room ID and player name required' });
    }

    const result = gameManager.joinRoom(roomId, socket.id, playerName);
    
    if (!result.success) {
      return callback(result);
    }

    socket.join(`room-${roomId}`);
    const room = gameManager.getRoom(roomId);
    
    io.to(`room-${roomId}`).emit('playerJoined', {
      room: room.getGameState()
    });
    
    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
    callback({ success: true, roomId, gameState: room.getGameState() });
  },

  startGame(socket, data, callback, gameManager, io) {
    const { roomId } = data;
    const room = gameManager.getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    if (!room.startGame()) {
      return callback({ success: false, error: 'Cannot start game' });
    }

    const gameState = room.getGameState();

    // Broadcast game start to the whole room so no player misses it
    const roomChannel = `room-${roomId}`;
    console.log(`[startGame] Broadcasting to channel "${roomChannel}" – sockets in room:`,
      [...(io.sockets.adapter.rooms.get(roomChannel) || [])]);
    io.to(roomChannel).emit('gameStarted', { gameState });

    // Send each player their hand individually
    for (const [, player] of room.players) {
      io.to(player.id).emit('handUpdated', { hand: player.getHand() });
    }

    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
    callback({ success: true, gameState });
  },

  playCard(socket, data, callback, gameManager, io, statsManager) {
    const { roomId, card } = data;
    const room = gameManager.getRoom(roomId);

    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    const result = room.playCard(socket.id, card);

    if (!result.success) {
      return callback(result);
    }

    // ── Stats hooks ────────────────────────────────────────────────────────
    if (statsManager) {
      const playerName = room.players.get(socket.id)?.name;
      if (result.specialCard && result.pileKey && playerName) {
        statsManager.recordSpecialCard({ playerName, pileKey: result.pileKey });
      }
      if (result.type === 'roundEnd') {
        const winnerName = room.players.get(socket.id)?.name || playerName;
        const loserNames = [...room.players.values()]
          .filter(p => p.id !== socket.id)
          .map(p => p.name);
        statsManager.recordRoundEnd({ winnerName, loserNames, roundGain: result.roundGain ?? 0 });
        if (result.gameOver) {
          const allNames = [...room.players.values()].map(p => p.name);
          statsManager.recordGameEnd({ allPlayerNames: allNames });
          for (const p of room.players.values()) {
            if (p.points <= 0) statsManager.recordElimination({ playerName: p.name });
          }
        }
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const gameState = room.getGameState();
    const playerStates = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.getHandSize(),
      points: p.points
    }));

    io.to(`room-${roomId}`).emit('cardPlayed', {
      playerId: socket.id,
      card,
      result: result.type,
      winnings: result.winnings || 0,
      specialCard: result.specialCard || false,
      gameState,
      players: playerStates,
      message: room.message,
      gameOver: room.isGameOver
    });

    io.to(socket.id).emit('handUpdated', {
      hand: room.players.get(socket.id).getHand()
    });

    callback({ success: true, gameState });
  },

  passTurn(socket, data, callback, gameManager, io) {
    const { roomId } = data;
    const room = gameManager.getRoom(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    const result = room.passTurn(socket.id);
    if (!result.success) {
      return callback(result);
    }

    const gameState = room.getGameState();
    const playerStates = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.getHandSize(),
      points: p.points
    }));

    io.to(`room-${roomId}`).emit('turnPassed', {
      playerId: socket.id,
      gameState,
      players: playerStates,
      message: room.message
    });

    callback({ success: true, gameState });
  },

  brocanter(socket, data, callback, gameManager, io, statsManager) {
    const { roomId } = data;
    const room = gameManager.getRoom(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    const result = room.brocanter(socket.id);
    if (!result.success) {
      return callback(result);
    }

    // ── Stats hook ─────────────────────────────────────────────────────────
    if (statsManager) {
      const playerName = room.players.get(socket.id)?.name;
      if (playerName) statsManager.recordBrocantage({ playerName });
      if (result.specialCard && result.pileKey && playerName) {
        statsManager.recordSpecialCard({ playerName, pileKey: result.pileKey });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    const gameState = room.getGameState();
    const playerStates = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.getHandSize(),
      points: p.points
    }));

    io.to(`room-${roomId}`).emit('cardPlayed', {
      playerId: socket.id,
      card: room.lastPlayedCard,
      result: 'brocantage',
      winnings: result.winnings || 0,
      specialCard: result.specialCard || false,
      gameState,
      players: playerStates,
      message: room.message,
      gameOver: room.isGameOver
    });

    callback({ success: true, gameState });
  },

  declineBrocantage(socket, data, callback, gameManager, io, statsManager) {
    const { roomId } = data;
    const room = gameManager.getRoom(roomId);
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    const result = room.declineBrocantage(socket.id);
    if (!result.success) {
      return callback(result);
    }

    // ── Stats hook ─────────────────────────────────────────────────────────
    if (statsManager) {
      const playerName = room.players.get(socket.id)?.name;
      if (playerName) statsManager.recordBrocantageDeclined({ playerName });
    }
    // ──────────────────────────────────────────────────────────────────────

    const gameState = room.getGameState();
    const playerStates = Array.from(room.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      handSize: p.getHandSize(),
      points: p.points
    }));

    io.to(`room-${roomId}`).emit('turnPassed', {
      playerId: socket.id,
      resolved: result.resolved,
      gameState,
      players: playerStates,
      message: room.message
    });

    callback({ success: true, resolved: result.resolved, gameState });
  },

  leaveRoom(socket, data, callback, gameManager, io) {
    const { roomId } = data;

    // Récupérer le nom avant suppression
    const room = gameManager.getRoom(roomId);
    const leavingPlayer = room?.players.get(socket.id);
    const playerName = leavingPlayer?.name || null;

    gameManager.removePlayer(socket.id);
    socket.leave(`room-${roomId}`);

    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
    io.to(`room-${roomId}`).emit('playerLeft', {
      playerId: socket.id,
      playerName
    });

    callback({ success: true });
  },

  newRound(socket, data, callback, gameManager, io) {
    const { roomId } = data;
    const room = gameManager.getRoom(roomId);
    if (!room) return callback({ success: false, error: 'Room not found' });
    if (!room.newRound()) return callback({ success: false, error: 'Impossible de démarrer une nouvelle manche' });

    const gameState = room.getGameState();

    // Broadcast new round to the whole room so no player misses it
    io.to(`room-${roomId}`).emit('newRound', { gameState });

    // Send each player their hand individually
    for (const [, player] of room.players) {
      io.to(player.id).emit('handUpdated', { hand: player.getHand() });
    }

    callback({ success: true, gameState });
  },

  getRoomInfo(socket, data, callback, gameManager) {
    const roomId = data && data.roomId ? data.roomId : data;
    const room = gameManager.getRoom(roomId);

    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    // Always (re-)join the socket.io room channel — handles reconnections
    socket.join(`room-${roomId}`);

    // Include the player's own hand so the client can restore it on mount / reconnect
    const player = room.players.get(socket.id);
    const hand = player ? player.getHand() : [];

    console.log(`[getRoomInfo] socket=${socket.id} roomId=${roomId} gameStarted=${room.gameStarted} playerFound=${!!player}`);
    callback({ success: true, gameState: room.getGameState(), hand });
  }
};
