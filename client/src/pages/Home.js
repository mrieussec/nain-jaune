import React, { useState, useEffect } from 'react';
import './Home.css';
import socketService from '../services/socketService';
import loginImage from '../components/login.png';

const Home = ({ onNavigate }) => {
  const [playerName, setPlayerName] = useState('');
  const [rooms, setRooms] = useState([]);
  const [showCreateRoom, setShowCreateRoom] = useState(false);

  useEffect(() => {
    socketService.connect();

    socketService.getRooms((data) => {
      setRooms(data.rooms);
    });

    socketService.onRoomsUpdated((data) => {
      setRooms(data.rooms);
    });

    return () => {
      socketService.offRoomsUpdated();
    };
  }, []);

  const handleCreateRoom = () => {
    if (playerName.trim()) {
      socketService.createRoom(playerName, (response) => {
        if (response.success) {
          onNavigate('game', { roomId: response.roomId, playerName });
        }
      });
    }
  };

  const handleJoinRoom = (roomId) => {
    if (playerName.trim()) {
      socketService.joinRoom(roomId, playerName, (response) => {
        if (response.success) {
          onNavigate('game', { roomId, playerName });
        }
      });
    }
  };

  return (
    <div className="home-container">

      {/* Colonne gauche : image mise en valeur */}
      <div className="home-visual">
        <img src={loginImage} alt="Jeu de Nain Jaune" className="login-image" />
      </div>

      {/* Colonne droite : formulaire */}
      <div className="home-panel">
        <h1 className="title">Nain Jaune</h1>
        <p className="subtitle">Le jeu de cartes classique, en ligne avec vos amis</p>

        <div className="player-input">
          <label>Votre nom</label>
          <input
            type="text"
            placeholder="Entrez votre nom..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && playerName.trim() && handleCreateRoom()}
            maxLength="20"
          />
        </div>

        <button
          className="btn-primary"
          onClick={() => setShowCreateRoom(!showCreateRoom)}
          disabled={!playerName.trim()}
        >
          {showCreateRoom ? 'Annuler' : '✨ Créer une partie'}
        </button>

        {showCreateRoom && (
          <div className="create-room-panel">
            <button className="btn-success" onClick={handleCreateRoom}>
              Lancer une nouvelle partie
            </button>
          </div>
        )}

        <button className="btn-stats" onClick={() => onNavigate('stats', {})}>
          📊 Classement
        </button>

        <div className="rooms-section">
          <h2>Parties disponibles</h2>
          {rooms.length === 0 ? (
            <p className="no-rooms">Aucune partie en cours. Créez-en une !</p>
          ) : (
            <div className="rooms-list">
              {rooms.map((room) => (
                <div key={room.id} className="room-card">
                  <div className="room-info">
                    <h3>{room.name}</h3>
                    <p>{room.players}/{room.maxPlayers} joueurs</p>
                    {room.gameStarted && <span className="badge-started">En cours</span>}
                  </div>
                  <button
                    className="btn-join"
                    onClick={() => handleJoinRoom(room.id)}
                    disabled={!playerName.trim() || room.isFull || room.gameStarted}
                  >
                    Rejoindre
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
