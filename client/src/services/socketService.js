import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
  }

  connect() {
    if (this.socket) return;
    
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getRooms(callback) {
    this.socket.emit('getRooms', callback);
  }

  // Game events
  createRoom(playerName, callback) {
    this.socket.emit('createRoom', { playerName }, callback);
  }

  joinRoom(roomId, playerName, callback) {
    this.socket.emit('joinRoom', { roomId, playerName }, callback);
  }

  startGame(roomId, callback) {
    this.socket.emit('startGame', { roomId }, callback);
  }

  playCard(roomId, card, callback) {
    this.socket.emit('playCard', { roomId, card }, callback);
  }

  passTurn(roomId, callback) {
    this.socket.emit('passTurn', { roomId }, callback);
  }

  leaveRoom(roomId, callback) {
    this.socket.emit('leaveRoom', { roomId }, callback);
  }

  newRound(roomId, callback) {
    this.socket.emit('newRound', { roomId }, callback);
  }

  getRoomInfo(roomId, callback) {
    this.socket.emit('getRoomInfo', { roomId }, callback);
  }

  brocanter(roomId, callback) {
    this.socket.emit('brocanter', { roomId }, callback);
  }

  declineBrocantage(roomId, callback) {
    this.socket.emit('declineBrocantage', { roomId }, callback);
  }

  // Chat events
  sendMessage(roomId, message, playerName) {
    this.socket.emit('sendMessage', { roomId, message, playerName });
  }

  // Listeners
  onPlayerJoined(callback) {
    this.socket.on('playerJoined', callback);
  }

  onGameStarted(callback) {
    this.socket.on('gameStarted', callback);
  }

  onCardPlayed(callback) {
    this.socket.on('cardPlayed', callback);
  }

  onHandUpdated(callback) {
    this.socket.on('handUpdated', callback);
  }

  onTurnPassed(callback) {
    this.socket.on('turnPassed', callback);
  }

  onPlayerLeft(callback) {
    this.socket.on('playerLeft', callback);
  }

  onMessageReceived(callback) {
    this.socket.on('messageReceived', callback);
  }

  onRoomsUpdated(callback) {
    this.socket.on('roomsUpdated', callback);
  }

  onNewRound(callback) {
    this.socket.on('newRound', callback);
  }

  offNewRound() {
    this.socket.off('newRound');
  }

  offPlayerJoined() {
    this.socket.off('playerJoined');
  }

  offGameStarted() {
    this.socket.off('gameStarted');
  }

  offCardPlayed() {
    this.socket.off('cardPlayed');
  }

  offHandUpdated() {
    this.socket.off('handUpdated');
  }

  offTurnPassed() {
    this.socket.off('turnPassed');
  }

  offPlayerLeft() {
    this.socket.off('playerLeft');
  }

  offMessageReceived() {
    this.socket.off('messageReceived');
  }

  offRoomsUpdated() {
    this.socket.off('roomsUpdated');
  }
}

export default new SocketService();
