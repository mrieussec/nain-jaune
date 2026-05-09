import React, { useState, useEffect } from 'react';
import './GameRoom.css';
import socketService from '../services/socketService';
import PlayerHand from '../components/PlayerHand';
import Chat from '../components/Chat';
import Card from '../components/Card';
import boardImage from '../components/Nain_jaune.jpg';
import logoImage from '../components/logo.png';

const GameRoom = ({ roomId, playerName, onNavigate }) => {
  const [gameState, setGameState] = useState(null);
  const [playerHand, setPlayerHand] = useState([]);
  const [isCurrentPlayer, setIsCurrentPlayer] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [message, setMessage] = useState('');
  const [showRules, setShowRules] = useState(false);

  const specialPiles = {
    ten_diamonds: { value: '10', suit: 'Diamonds', label: '10♦' },
    jack_clubs: { value: 'J', suit: 'Clubs', label: 'V♣' },
    queen_spades: { value: 'Q', suit: 'Spades', label: 'D♠' },
    king_hearts: { value: 'K', suit: 'Hearts', label: 'R♥' },
    seven_diamonds: { value: '7', suit: 'Diamonds', label: '7♦ (Nain)' }
  };

  const getSpecialPileForCard = (card) => {
    if (!card) return null;
    if (card.value === '10' && card.suit === 'Diamonds') return 'ten_diamonds';
    if (card.value === 'J' && card.suit === 'Clubs') return 'jack_clubs';
    if (card.value === 'Q' && card.suit === 'Spades') return 'queen_spades';
    if (card.value === 'K' && card.suit === 'Hearts') return 'king_hearts';
    if (card.value === '7' && card.suit === 'Diamonds') return 'seven_diamonds';
    return null;
  };

  const canPlayCardOnPile = (card, pileKey) => {
    const pile = gameState?.table[pileKey] || [];

    if (pile.length === 0) {
      const specialCard = specialPiles[pileKey];
      return card.value === specialCard.value && card.suit === specialCard.suit;
    }

    const topCard = pile[pile.length - 1];
    const valueOrder = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    const cardVal = valueOrder[card.value] || 0;
    const topVal = valueOrder[topCard.value] || 0;
    return cardVal === topVal + 1 || cardVal === topVal - 1;
  };

  const canPlayCard = (card) => {
    const specialPile = getSpecialPileForCard(card);
    if (specialPile) {
      return canPlayCardOnPile(card, specialPile);
    }
    return Object.keys(specialPiles).some(pileKey => canPlayCardOnPile(card, pileKey));
  };

  const hasPlayableCard = (cards) => cards.some(canPlayCard);

  const getCardLabel = (card) => {
    const map = { 'A': 'As', 'J': 'V', 'Q': 'D', 'K': 'R' };
    return map[card.value] || card.value;
  };

  const playCardSound = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // Bruit blanc court avec enveloppe très rapide → "clac"
    const bufSize = Math.floor(ctx.sampleRate * 0.055);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 4);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    // Filtre passe-bande pour la crispness du claquement
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2800;
    bandpass.Q.value = 0.8;

    // Petit thump grave pour l'impact physique
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(140, now);
    thump.frequency.exponentialRampToValueAtTime(40, now + 0.04);
    thumpGain.gain.setValueAtTime(0.5, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.9, now);
    masterGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    noise.connect(bandpass);
    bandpass.connect(masterGain);
    thump.connect(thumpGain);
    thumpGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    noise.start(now);
    thump.start(now);
    thump.stop(now + 0.06);
  };

  const playWinSound = () => {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const now = ctx.currentTime;

    // 5 pièces qui s'entrechoquent à intervalles irréguliers
    const coins = [
      { delay: 0.00, freq: 1320, ratio: 2.73 },
      { delay: 0.07, freq: 1560, ratio: 3.12 },
      { delay: 0.13, freq: 1180, ratio: 2.41 },
      { delay: 0.21, freq: 1740, ratio: 2.95 },
      { delay: 0.28, freq: 1420, ratio: 3.28 },
    ];

    coins.forEach(({ delay, freq, ratio }) => {
      // Fondamentale métallique
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.value = freq;
      gain1.gain.setValueAtTime(0.001, now + delay);
      gain1.gain.linearRampToValueAtTime(0.28, now + delay + 0.004);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now + delay);
      osc1.stop(now + delay + 0.38);

      // Partiel inharmonique → timbre métallique de pièce
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = freq * ratio;
      gain2.gain.setValueAtTime(0.001, now + delay);
      gain2.gain.linearRampToValueAtTime(0.14, now + delay + 0.003);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + delay);
      osc2.stop(now + delay + 0.22);
    });
  };

  useEffect(() => {
    socketService.getRoomInfo(roomId, (response) => {
      if (response.success) {
        setGameState(response.gameState);
        setIsCurrentPlayer(response.gameState.currentPlayerId === socketService.socket.id);
      }
    });

    socketService.onGameStarted((data) => {
      setGameState(data.gameState);
      setGameStarted(true);
      const currentPlayer = data.players.find(p => p.id === socketService.socket.id);
      setPlayerHand(currentPlayer?.hand || []);
    });

    socketService.onPlayerJoined((data) => {
      setGameState(data.room);
    });

    socketService.onCardPlayed((data) => {
      setGameState(data.gameState);
      setIsCurrentPlayer(data.gameState.currentPlayerId === socketService.socket.id);
      if (data.gameState.currentPlayerId === socketService.socket.id) {
        setMessage('À votre tour!');
      }
      if (data.gameOver) {
        setMessage(data.message || 'Partie terminée !');
      }
    });

    socketService.onHandUpdated((data) => {
      setPlayerHand(data.hand);
    });

    socketService.onTurnPassed((data) => {
      setGameState(data.gameState);
      setIsCurrentPlayer(data.gameState.currentPlayerId === socketService.socket.id);
      if (data.gameState.currentPlayerId === socketService.socket.id) {
        setMessage('À votre tour!');
      }
    });

    socketService.onPlayerLeft((data) => {
      setMessage(`${data.playerId} a quitté la partie`);
    });

    return () => {
      socketService.offGameStarted();
      socketService.offPlayerJoined();
      socketService.offCardPlayed();
      socketService.offHandUpdated();
      socketService.offTurnPassed();
      socketService.offPlayerLeft();
    };
  }, [roomId]);

  const handleStartGame = () => {
    socketService.startGame(roomId, (response) => {
      if (response.success) {
        setGameState(response.gameState);
        setGameStarted(true);
      }
    });
  };

  const handlePlayCard = (card) => {
    if (!isCurrentPlayer) {
      setMessage('Pas votre tour!');
      return;
    }

    playCardSound();
    socketService.playCard(roomId, card, (response) => {
      if (response.success) {
        setSelectedCard(null);
        if (response.winnings) {
          playWinSound();
        }
      } else {
        setMessage(response.error || 'Coup invalide');
      }
    });
  };

  const handlePassTurn = () => {
    if (!isCurrentPlayer) {
      setMessage('Pas votre tour!');
      return;
    }
    socketService.passTurn(roomId, (response) => {
      if (!response.success) {
        setMessage(response.error || 'Impossible de passer');
      }
    });
  };

  const handleLeaveRoom = () => {
    socketService.leaveRoom(roomId, () => {
      onNavigate('home', {});
    });
  };

  if (!gameState) {
    return <div className="loading">Chargement de la partie...</div>;
  }

  const pileConfig = [
    { key: 'king_hearts',    label: 'R♥',  left: '24%', top: '24%', color: '#c0392b' },
    { key: 'queen_spades',   label: 'D♠',  left: '76%', top: '24%', color: '#1a1a2e' },
    { key: 'seven_diamonds', label: '7♦',  left: '50%', top: '50%', color: '#c0392b' },
    { key: 'ten_diamonds',   label: '10♦', left: '24%', top: '76%', color: '#c0392b' },
    { key: 'jack_clubs',     label: 'V♣',  left: '76%', top: '76%', color: '#1a1a2e' },
  ];
  const valueLabel  = { 'A': 'As', 'J': 'V', 'Q': 'D', 'K': 'R' };
  const suitSymbol  = { 'Hearts': '♥', 'Diamonds': '♦', 'Clubs': '♣', 'Spades': '♠' };

  return (
    <div className="game-room-container">

      {/* ── Header ── */}
      <div className="game-header">
        <div className="header-brand">
          <img src={logoImage} alt="Nain Jaune" className="header-logo-img" />
          <h1>Nain Jaune</h1>
        </div>
        <div className="header-buttons">
          <button className="btn-rules" onClick={() => setShowRules(!showRules)}>📋 Règles</button>
          <button className="btn-leave" onClick={handleLeaveRoom}>Quitter</button>
        </div>
      </div>

      {/* ── Zone principale : plateau gauche | panneau droit ── */}
      <div className="game-main">

        {/* Plateau de jeu */}
        <div className="game-board">
          {gameStarted ? (
            <>
              <div className="nj-board-wrapper">
                <img src={boardImage} alt="Plateau Nain Jaune" className="nj-board-image" />
                {pileConfig.map(pile => {
                  const cards    = gameState.table[pile.key] || [];
                  const topCard  = cards[cards.length - 1];
                  const bet      = gameState.bets[pile.key] || 0;
                  const hasCards = cards.length > 0;
                  return (
                    <div
                      key={pile.key}
                      className={`nj-pile-overlay ${hasCards ? 'has-cards' : ''}`}
                      style={{ left: pile.left, top: pile.top }}
                    >
                      {hasCards ? (
                        <div className="nj-top-card" style={{ color: pile.color }}>
                          <span className="nj-card-val">{valueLabel[topCard.value] || topCard.value}</span>
                          <span className="nj-card-suit">{suitSymbol[topCard.suit]}</span>
                        </div>
                      ) : (
                        <div className="nj-pile-label">{pile.label}</div>
                      )}
                      {bet > 0 && <div className="nj-bet-badge">💰{bet}</div>}
                    </div>
                  );
                })}
              </div>
              <div className="nj-talon">
                🃏 Talon : {gameState.talonSize} carte(s)
                {gameState.message && <span className="nj-game-msg"> — {gameState.message}</span>}
              </div>
            </>
          ) : (
            <div className="waiting-room">
              <h2>En attente du début de la partie</h2>
              <p>Joueurs : {gameState.players.map(p => p.name).join(', ')}</p>
              {gameState.players.length >= 2 && (
                <button className="btn-start" onClick={handleStartGame}>Démarrer la partie</button>
              )}
            </div>
          )}
        </div>

        {/* Panneau droit : joueurs → cartes → chat */}
        <div className="right-panel">

          {/* Joueurs */}
          <div className="players-info">
            <h3>Joueurs</h3>
            {gameState.players.map((p) => (
              <div key={p.id} className={`player-info ${p.id === gameState.currentPlayerId ? 'current' : ''}`}>
                <span>{p.id === gameState.currentPlayerId ? '▶ ' : ''}{p.name}</span>
                <span className="hand-size">{p.handSize} cartes</span>
                <span className="points">💰 {p.points}</span>
              </div>
            ))}
          </div>

          {/* Cartes du joueur */}
          {gameStarted && (
            <div className="player-strip">
              <div className="strip-turn">
                {isCurrentPlayer
                  ? <span className="your-turn">🎯 À votre tour</span>
                  : <span className="waiting-turn">Tour de {gameState.players[gameState.currentPlayerIndex]?.name}</span>
                }
                {isCurrentPlayer && !hasPlayableCard(playerHand) && (
                  <button className="btn-pass" onClick={handlePassTurn}>Passer</button>
                )}
              </div>
              <div className="strip-cards">
                <PlayerHand
                  cards={playerHand}
                  onCardClick={handlePlayCard}
                  disabled={!isCurrentPlayer}
                />
              </div>
            </div>
          )}

          {/* Chat */}
          <div className="chat-panel">
            <Chat roomId={roomId} playerName={playerName} socketService={socketService} />
          </div>

        </div>
      </div>

      {/* ── Modal règles ── */}
      {showRules && (
        <div className="rules-overlay" onClick={() => setShowRules(false)}>
          <div className="rules-modal" onClick={e => e.stopPropagation()}>
            <h3>📋 Règles du Nain Jaune</h3>
            <div className="rules-content">
              <h4>Objectif</h4>
              <p>Être le premier à vider sa main en jouant les cartes sur les piles.</p>
              <h4>Piles spéciales et mises</h4>
              <ul>
                <li>10♦ — 1 jeton</li>
                <li>V♣ (Valet de trèfle) — 2 jetons</li>
                <li>D♠ (Dame de pique) — 3 jetons</li>
                <li>R♥ (Roi de cœur) — 4 jetons</li>
                <li>7♦ (Nain Jaune) — 5 jetons</li>
              </ul>
              <h4>Déroulement</h4>
              <p>Les cartes se jouent en suites : A, 2, 3 … 10, V, D, R (toutes couleurs).</p>
              <p>Une carte est jouable si elle est consécutive (±1) à la dernière carte d'une pile.</p>
              <p>Quand on pose une carte spéciale, on remporte tous les jetons de cette pile !</p>
            </div>
            <button className="btn-close-rules" onClick={() => setShowRules(false)}>Fermer</button>
          </div>
        </div>
      )}

      {message && <div className="game-message">{message}</div>}
    </div>
  );
};

export default GameRoom;
