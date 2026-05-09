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
    
    // Send individual messages to each player with their own hand
    for (const [playerId, player] of room.players) {
      io.to(player.id).emit('gameStarted', {
        gameState,
        players: Array.from(room.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          hand: p.id === player.id ? p.getHand() : [],
          handSize: p.getHandSize()
        }))
      });
    }

    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
    callback({ success: true, gameState });
  },

  playCard(socket, data, callback, gameManager, io) {
    const { roomId, card } = data;
    const room = gameManager.getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    const result = room.playCard(socket.id, card);
    
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

    io.to(`room-${roomId}`).emit('cardPlayed', {
      playerId: socket.id,
      card,
      result: result.type,
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

  leaveRoom(socket, data, callback, gameManager, io) {
    const { roomId } = data;
    gameManager.removePlayer(socket.id);
    socket.leave(`room-${roomId}`);
    
    io.emit('roomsUpdated', { rooms: gameManager.getRoomsInfo() });
    io.to(`room-${roomId}`).emit('playerLeft', {
      playerId: socket.id
    });

    callback({ success: true });
  },

  getRoomInfo(socket, data, callback, gameManager) {
    const roomId = data && data.roomId ? data.roomId : data;
    const room = gameManager.getRoom(roomId);
    
    if (!room) {
      return callback({ success: false, error: 'Room not found' });
    }

    callback({ success: true, gameState: room.getGameState() });
  }
};
