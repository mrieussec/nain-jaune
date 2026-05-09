export const chatHandlers = {
  sendMessage(socket, data, io) {
    const { roomId, message, playerName } = data;
    
    if (!roomId || !message) {
      return;
    }

    io.to(`room-${roomId}`).emit('messageReceived', {
      playerId: socket.id,
      playerName,
      message,
      timestamp: new Date().toISOString()
    });
  }
};
