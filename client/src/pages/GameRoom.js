import React, { useState, useEffect, useRef, useCallback } from 'react';
import './GameRoom.css';
import socketService from '../services/socketService';
import PlayerHand from '../components/PlayerHand';
import Chat from '../components/Chat';
import boardImage from '../components/Nain_jaune.jpg';
import logoImage from '../components/logo.png';

const VALUE_ORDER = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
                      '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
const VALUE_LABEL = { 1: 'As', 11: 'V', 12: 'D', 13: 'R' };
const SUIT_SYMBOL = { Hearts: '♥', Diamonds: '♦', Clubs: '♣', Spades: '♠' };

const cardLabel = (value) => VALUE_LABEL[VALUE_ORDER[value]] || value;
const seqLabel  = (num)   => VALUE_LABEL[num] || String(num);


const GameRoom = ({ roomId, playerName, onNavigate }) => {
  const [gameState, setGameState]         = useState(null);
  const [gameStarted, setGameStarted]     = useState(false);
  const [playerHand, setPlayerHand]       = useState([]);
  const [isCurrentPlayer, setIsCurrentPlayer] = useState(false);
  const [message, setMessage]             = useState('');
  const [showRules, setShowRules]         = useState(false);
  const [muted, setMuted]  = useState(false);
  const mutedRef           = useRef(false);
  // AudioContext unique réutilisé — évite la réinitialisation du mixer Chrome à chaque son
  const audioCtxRef        = useRef(null);
  // Garder le ref synchronisé pour que les closures socket lisent toujours la valeur courante
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  // ── Text-to-speech ────────────────────────────────────────────────────────
  // Appelé directement depuis les handlers socket (pas via useEffect) pour éviter
  // les conflits de timing avec AudioContext et les restrictions autoplay.
  // delayMs : laisser le son de carte se terminer avant de parler.

  const speak = useCallback((text, delayMs = 0) => {
    if (!text || !window.speechSynthesis) return;
    const fire = () => {
      if (mutedRef.current) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'fr-FR';
      utter.rate = 1.1;
      const applyVoice = () => {
        const voices = window.speechSynthesis.getVoices();
        const fr = voices.find(v => v.lang === 'fr-FR') || voices.find(v => v.lang.startsWith('fr'));
        if (fr) utter.voice = fr;
        window.speechSynthesis.speak(utter);
      };
      if (window.speechSynthesis.getVoices().length > 0) {
        applyVoice();
      } else {
        window.speechSynthesis.addEventListener('voiceschanged', applyVoice, { once: true });
      }
    };
    if (delayMs > 0) setTimeout(fire, delayMs); else fire();
  }, []); // stable : lit muted via mutedRef

  // ── Sequence helpers (mirrors server logic) ───────────────────────────────

  const canPlayCard = (card) => {
    if (gameState?.must7D) return card.value === '7' && card.suit === 'Diamonds';
    const seq = gameState?.currentSequence;
    if (!seq) return true; // free play: any card
    return card.suit === seq.suit && VALUE_ORDER[card.value] === seq.nextValue;
  };

  const canPass = () => {
    if (!gameState?.currentSequence) return false;
    return !playerHand.some(canPlayCard);
  };

  // ── Sounds ────────────────────────────────────────────────────────────────

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const playCardSound = () => {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    const bufSize = Math.floor(ctx.sampleRate * 0.055);
    const buffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSize, 4);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2800;
    bandpass.Q.value = 0.8;

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

    noise.connect(bandpass); bandpass.connect(masterGain);
    thump.connect(thumpGain); thumpGain.connect(masterGain);
    masterGain.connect(ctx.destination);
    noise.start(now); thump.start(now); thump.stop(now + 0.06);
  };

  // Son de notification de tour : deux notes en carillon (do → mi)
  const playTurnSound = () => {
    if (mutedRef.current) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const notes = [
      { t: 0.00, freq: 880  },   // La5
      { t: 0.18, freq: 1108 },   // Ré6
    ];
    notes.forEach(({ t, freq }) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.001, now + t);
      gain.gain.linearRampToValueAtTime(0.22, now + t + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.38);
      // Légère harmonique pour timbre de cloche
      const osc2  = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.value = freq * 2.756; // inharmonique typique cloche
      gain2.gain.setValueAtTime(0.001, now + t);
      gain2.gain.linearRampToValueAtTime(0.07, now + t + 0.005);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + t + 0.12);
      osc.connect(gain);   gain.connect(ctx.destination);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc.start(now + t);  osc.stop(now + t + 0.42);
      osc2.start(now + t); osc2.stop(now + t + 0.15);
    });
  };

  // Son de pièces de monnaie — modèle physique d'une plaque circulaire en métal
  const playCoinSound = () => {
    if (mutedRef.current) return;
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    // Ratios de fréquence des modes de vibration d'une plaque circulaire
    // (zéros des fonctions de Bessel J0, J1, J2…)
    // Chaque mode a sa propre amplitude et son propre decay (les hauts modes s'éteignent vite)
    const modes = [
      { ratio: 1.000, amp: 0.30, decay: 0.22 },
      { ratio: 1.593, amp: 0.20, decay: 0.14 },
      { ratio: 2.136, amp: 0.14, decay: 0.09 },
      { ratio: 2.296, amp: 0.10, decay: 0.07 },
      { ratio: 2.917, amp: 0.07, decay: 0.05 },
      { ratio: 3.155, amp: 0.04, decay: 0.03 },
    ];

    const coinHit = (startT, fundamental, vol) => {
      // Résonances de la pièce
      modes.forEach(({ ratio, amp, decay }) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = fundamental * ratio;
        // Attaque quasi instantanée (~0.5 ms) puis décroissance exponentielle propre
        gain.gain.setValueAtTime(0.0001, startT);
        gain.gain.linearRampToValueAtTime(amp * vol, startT + 0.0005);
        gain.gain.exponentialRampToValueAtTime(0.0001, startT + decay);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(startT); osc.stop(startT + decay + 0.005);
      });

      // Transitoire d'impact : bruit blanc très bref filtré en bande haute
      const impactLen = Math.floor(ctx.sampleRate * 0.006);
      const impactBuf = ctx.createBuffer(1, impactLen, ctx.sampleRate);
      const impactData = impactBuf.getChannelData(0);
      for (let i = 0; i < impactLen; i++) {
        impactData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (impactLen * 0.08));
      }
      const impactSrc = ctx.createBufferSource();
      impactSrc.buffer = impactBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = fundamental * 2.5; bp.Q.value = 1.2;
      const impactGain = ctx.createGain();
      impactGain.gain.value = 0.35 * vol;
      impactSrc.connect(bp); bp.connect(impactGain); impactGain.connect(ctx.destination);
      impactSrc.start(startT);
    };

    // Séquence de chocs : timing légèrement irrégulier comme des vraies pièces
    coinHit(now + 0.000, 2750, 1.00);
    coinHit(now + 0.065, 3100, 0.85);
    coinHit(now + 0.120, 2500, 0.95);
    coinHit(now + 0.185, 3400, 0.70);
    coinHit(now + 0.255, 2850, 0.80);
    coinHit(now + 0.310, 3200, 0.55);
  };

  const playWinSound = () => {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const coins = [
      { delay: 0.00, freq: 1320, ratio: 2.73 },
      { delay: 0.07, freq: 1560, ratio: 3.12 },
      { delay: 0.13, freq: 1180, ratio: 2.41 },
      { delay: 0.21, freq: 1740, ratio: 2.95 },
      { delay: 0.28, freq: 1420, ratio: 3.28 },
    ];
    coins.forEach(({ delay, freq, ratio }) => {
      const osc1 = ctx.createOscillator(), gain1 = ctx.createGain();
      osc1.type = 'sine'; osc1.frequency.value = freq;
      gain1.gain.setValueAtTime(0.001, now + delay);
      gain1.gain.linearRampToValueAtTime(0.28, now + delay + 0.004);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
      osc1.connect(gain1); gain1.connect(ctx.destination);
      osc1.start(now + delay); osc1.stop(now + delay + 0.38);

      const osc2 = ctx.createOscillator(), gain2 = ctx.createGain();
      osc2.type = 'sine'; osc2.frequency.value = freq * ratio;
      gain2.gain.setValueAtTime(0.001, now + delay);
      gain2.gain.linearRampToValueAtTime(0.14, now + delay + 0.003);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.18);
      osc2.connect(gain2); gain2.connect(ctx.destination);
      osc2.start(now + delay); osc2.stop(now + delay + 0.22);
    });
  };

  // ── Socket event wiring ───────────────────────────────────────────────────

  // Sync current room state (used on mount and on socket reconnect)
  const syncRoomState = useCallback(() => {
    socketService.getRoomInfo(roomId, (response) => {
      if (response.success) {
        setGameState(response.gameState);
        if (response.gameState.gameStarted) setGameStarted(true);
        setIsCurrentPlayer(response.gameState.currentPlayerId === socketService.socket.id);
        if (response.hand?.length > 0) setPlayerHand(response.hand);
      }
    });
  }, [roomId]);

  useEffect(() => {
    syncRoomState();

    socketService.onGameStarted((data) => {
      console.log('[onGameStarted]', data);
      setGameState(data.gameState);
      setGameStarted(true);
      setIsCurrentPlayer(data.gameState.currentPlayerId === socketService.socket.id);
      speak('La partie commence !');
    });

    socketService.onPlayerJoined((data) => {
      // Don't overwrite a started game with a stale pre-game state
      setGameState(prev => prev?.gameStarted ? prev : data.room);
    });

    socketService.onCardPlayed((data) => {
      setGameState(data.gameState);
      setIsCurrentPlayer(data.gameState.currentPlayerId === socketService.socket.id);
      playCardSound();
      if (data.specialCard && data.winnings > 0) {
        setTimeout(() => playCoinSound(), 80);
      }
      if (data.gameOver) {
        playWinSound();
        setMessage(data.message || 'Partie terminée !');
      } else {
        const nextPlayer = data.gameState.players?.find(p => p.id === data.gameState.currentPlayerId);
        if (data.gameState.currentPlayerId === socketService.socket.id) {
          // Jouer le son seulement si le tour a changé de joueur (pas si on rejoue en séquence)
          if (data.gameState.currentPlayerId !== data.playerId) {
            setTimeout(() => playTurnSound(), 120);
          }
          setMessage('À votre tour !');
        } else {
          setMessage(`Au tour de ${nextPlayer?.name || '…'}`);
        }
      }
      // Délai 150ms : laisser le son de carte se terminer avant de parler
      speak(data.gameState.message, 150);
    });

    socketService.onHandUpdated((data) => {
      setPlayerHand(data.hand);
    });

    socketService.onTurnPassed((data) => {
      setGameState(data.gameState);
      setIsCurrentPlayer(data.gameState.currentPlayerId === socketService.socket.id);
      const nextPlayer = data.gameState.players?.find(p => p.id === data.gameState.currentPlayerId);
      if (data.gameState.currentPlayerId === socketService.socket.id) {
        playTurnSound();
        setMessage('À votre tour !');
      } else {
        setMessage(`Au tour de ${nextPlayer?.name || '…'}`);
      }
      speak(data.gameState.message);
    });

    socketService.onNewRound((data) => {
      setGameState(data.gameState);
      setGameStarted(true);
      setIsCurrentPlayer(data.gameState.currentPlayerId === socketService.socket.id);
      const nextPlayer = data.gameState.players?.find(p => p.id === data.gameState.currentPlayerId);
      if (data.gameState.currentPlayerId === socketService.socket.id) {
        setMessage(`Manche ${data.gameState.round} — à vous !`);
      } else {
        setMessage(`Manche ${data.gameState.round} — au tour de ${nextPlayer?.name || '…'}`);
      }
      speak(data.gameState.message);
    });

    socketService.onPlayerLeft((data) => {
      const name = data.playerName || 'Un joueur';
      setMessage(`${name} a quitté la partie.`);
    });

    // Re-sync state on socket reconnection (handles brief disconnections)
    socketService.socket.on('connect', syncRoomState);

    return () => {
      socketService.offGameStarted();
      socketService.offPlayerJoined();
      socketService.offCardPlayed();
      socketService.offHandUpdated();
      socketService.offTurnPassed();
      socketService.offNewRound();
      socketService.offPlayerLeft();
      socketService.socket.off('connect', syncRoomState);
      window.speechSynthesis?.cancel();
    };
  // speak est stable (useCallback vide), syncRoomState stable (useCallback [roomId])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, syncRoomState]);

  // Polling pendant la salle d'attente — rattrapage si l'event gameStarted est manqué
  useEffect(() => {
    if (gameStarted) return;
    const timer = setInterval(() => {
      socketService.getRoomInfo(roomId, (response) => {
        if (response.success && response.gameState.gameStarted) {
          setGameState(response.gameState);
          setGameStarted(true);
          setIsCurrentPlayer(response.gameState.currentPlayerId === socketService.socket.id);
          if (response.hand?.length > 0) setPlayerHand(response.hand);
        }
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [roomId, gameStarted]);

  // ── Actions ───────────────────────────────────────────────────────────────

  const handleStartGame = () => {
    socketService.startGame(roomId, (response) => {
      if (response.success) {
        setGameState(response.gameState);
        setGameStarted(true);
      }
    });
  };

  const handlePlayCard = (card) => {
    if (!isCurrentPlayer) { setMessage('Pas votre tour !'); return; }

    if (!canPlayCard(card)) {
      const seq = gameState?.currentSequence;
      if (seq) {
        setMessage(`Attendu : ${seqLabel(seq.nextValue)}${SUIT_SYMBOL[seq.suit]}`);
      }
      return;
    }

    playCardSound();
    socketService.playCard(roomId, card, (response) => {
      if (response.success) {
        if (response.winnings) playWinSound();
      } else {
        setMessage(response.error || 'Coup invalide');
      }
    });
  };

  const handlePassTurn = () => {
    if (!isCurrentPlayer) { setMessage('Pas votre tour !'); return; }
    socketService.passTurn(roomId, (response) => {
      if (!response.success) setMessage(response.error || 'Impossible de passer');
    });
  };

  const handleNewRound = () => {
    socketService.newRound(roomId, (response) => {
      if (!response.success) setMessage(response.error || 'Impossible de démarrer une nouvelle manche');
    });
  };

  const handleBrocanter = () => {
    socketService.brocanter(roomId, (r) => { if (!r.success) setMessage(r.error || 'Erreur'); });
  };

  const handleDeclineBrocantage = () => {
    socketService.declineBrocantage(roomId, (r) => { if (!r.success) setMessage(r.error || 'Erreur'); });
  };

  const handleLeaveRoom = () => {
    socketService.leaveRoom(roomId, () => onNavigate('home', {}));
  };

  // ── Render ────────────────────────────────────────────────────────────────

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

  const seq = gameState.currentSequence;
  const isRoundOver = gameState.gameState === 'roundEnd';
  const isGameOver  = gameState.gameState === 'finished';
  const isBrocantage = gameState.gameState === 'brocantage';

  return (
    <div className="game-room-container">

      {/* ── Header ── */}
      <div className="game-header">
        <div className="header-brand">
          <img src={logoImage} alt="Nain Jaune" className="header-logo-img" />
          <h1>Nain Jaune</h1>
          {gameStarted && <span className="round-badge">Manche {gameState.round}</span>}
        </div>
        <div className="header-message">
          {message && <div className="game-message" onClick={() => setMessage('')}>{message}</div>}
        </div>
        <div className="header-buttons">
          {isRoundOver && (
            <button className="btn-new-round" onClick={handleNewRound}>▶ Nouvelle manche</button>
          )}
          <button className="btn-mute" onClick={() => { setMuted(m => !m); window.speechSynthesis?.cancel(); }} title={muted ? 'Activer la voix' : 'Couper la voix'}>
            {muted ? '🔇' : '🔊'}
          </button>
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
              <div className="nj-talon">🃏 Talon : {gameState.talonSize} carte(s)</div>

              <div className="nj-board-wrapper">
                <img src={boardImage} alt="Plateau Nain Jaune" className="nj-board-image" />
                {pileConfig.map(pile => {
                  const cards   = gameState.table[pile.key] || [];
                  const topCard = cards[cards.length - 1];
                  const bet     = gameState.bets[pile.key] || 0;
                  const hasCards = cards.length > 0;
                  return (
                    <div
                      key={pile.key}
                      className={`nj-pile-overlay ${hasCards ? 'has-cards' : ''}`}
                      style={{ left: pile.left, top: pile.top }}
                    >
                      {hasCards ? (
                        <div className="nj-top-card" style={{ color: pile.color }}>
                          <span className="nj-card-val">{cardLabel(topCard.value)}</span>
                          <span className="nj-card-suit">{SUIT_SYMBOL[topCard.suit]}</span>
                        </div>
                      ) : (
                        <div className="nj-pile-label">{pile.label}</div>
                      )}
                      {bet > 0 && <div className="nj-bet-badge">💰{bet}</div>}
                    </div>
                  );
                })}
              </div>

              {/* Boutons de fin de manche / partie */}
              {isGameOver && (
                <div className="nj-board-footer">
                  <div className="nj-game-over">🏁 Partie terminée !</div>
                </div>
              )}
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
              <div key={p.id} className={`player-info ${p.id === gameState.currentPlayerId && !isRoundOver && !isGameOver ? 'current' : ''}`}>
                <span>
                  {p.id === gameState.currentPlayerId && !isRoundOver && !isGameOver ? '▶ ' : ''}
                  {p.name}
                  {p.id === gameState.dealerPlayerId && <span className="dealer-badge">🃏</span>}
                </span>
                <span className="hand-size">{p.handSize} cartes</span>
                <span className="points">💰 {p.points}</span>
              </div>
            ))}
            {gameState.pot > 0 && (
              <div className="pot-info">💰 Pot : {gameState.pot} jeton{gameState.pot > 1 ? 's' : ''}</div>
            )}
          </div>

          {/* Main du joueur */}
          {gameStarted && !isGameOver && (
            <div className="player-strip">
              {isRoundOver && (
                <span className="round-over-msg">Manche terminée</span>
              )}

              {/* Indicateur must7D */}
              {isCurrentPlayer && !isRoundOver && gameState?.must7D && (
                <div className="strip-sequence">
                  Vous devez jouer le <strong>7♦</strong> (Nain Jaune) pour commencer
                </div>
              )}

              {/* Indicateur séquence dans le panneau joueur */}
              {isCurrentPlayer && !isRoundOver && !gameState?.must7D && seq && (
                <div className="strip-sequence">
                  {canPass() ? (
                    <>
                      Vous n'avez pas <strong>{seqLabel(seq.nextValue)}{SUIT_SYMBOL[seq.suit]}</strong>
                      <button className="btn-pass" onClick={handlePassTurn}>Passer</button>
                    </>
                  ) : (
                    <>Jouez <strong>{seqLabel(seq.nextValue)}{SUIT_SYMBOL[seq.suit]}</strong></>
                  )}
                </div>
              )}
              {isCurrentPlayer && !isRoundOver && !gameState?.must7D && !seq && !isBrocantage && (
                <div className="strip-sequence free-play">Jeu libre — choisissez n'importe quelle carte</div>
              )}

              {/* Panel brocantage */}
              {isBrocantage && gameState.brocantageInfo && (
                <div className="brocantage-panel">
                  <div className="brocantage-info">
                    🃏 <strong>{seqLabel(gameState.brocantageInfo.numValue)}{SUIT_SYMBOL[gameState.brocantageInfo.suit]}</strong> dans le talon — brocantage !
                  </div>
                  <div className="brocantage-actions">
                    <button className="btn-brocanter" onClick={handleBrocanter}>
                      Brocanter ({gameState.players.length - 1} jeton{gameState.players.length - 1 > 1 ? 's' : ''})
                    </button>
                    <button className="btn-decline-brocantage" onClick={handleDeclineBrocantage}>Refuser</button>
                  </div>
                </div>
              )}

              <div className="strip-cards">
                <PlayerHand
                  cards={playerHand}
                  onCardClick={handlePlayCard}
                  disabled={!isCurrentPlayer || isRoundOver || isBrocantage}
                  canPlayCard={isCurrentPlayer && !isRoundOver && !isBrocantage ? canPlayCard : null}
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
              <h4>🎯 Objectif</h4>
              <p>Être le premier à vider sa main. La partie dure plusieurs manches jusqu'à ce qu'un joueur n'ait plus de jetons.</p>

              <h4>🃏 Le donneur</h4>
              <p>Avec 3 joueurs ou plus, le <strong>donneur ne joue pas</strong> la manche. Il distribue les cartes, paye les mises initiales sur le plateau, mais n'a pas de main. Le rôle de donneur tourne à chaque manche.</p>

              <h4>🟡 Ouverture : le 7♦ obligatoire</h4>
              <p>La manche <strong>doit toujours s'ouvrir avec le 7♦</strong>. Le joueur qui tient le 7♦ est obligé de jouer cette carte en premier. Si le 7♦ est dans le talon (carte non distribuée), le joueur à gauche du donneur ouvre librement avec la carte de son choix.</p>

              <h4>🔄 Séquences</h4>
              <p>Le joueur actif joue <strong>n'importe quelle carte</strong> (jeu libre). Chaque joueur suivant doit jouer la carte <strong>immédiatement supérieure de même couleur</strong> ou passer.</p>
              <p>Le <strong>Roi</strong> termine toujours une séquence — le joueur qui l'a posé rejoue librement.</p>

              <h4>⚠️ Passer</h4>
              <p>Quand un joueur ne peut pas (ou ne veut pas) jouer, il passe. <strong>Passer coûte 1 jeton</strong> qui est placé dans le pot commun. Ce pot est remporté par le gagnant de la manche.</p>

              <h4>🔒 Brocantage</h4>
              <p>Quand la suite est bloquée parce que la carte attendue est dans le talon, chaque joueur peut proposer un <strong>brocantage</strong> : payer <em>N−1 jetons</em> (répartis entre les autres joueurs) pour racheter la carte du talon et la jouer immédiatement, relançant la séquence.</p>
              <p>Si <strong>tous les joueurs refusent</strong> le brocantage, le dernier à avoir proposé reçoit le droit de rejouer <strong>librement</strong> sans payer.</p>

              <h4>⭐ Piles spéciales</h4>
              <p>Poser une carte spéciale rapporte tous les jetons accumulés sur sa case :</p>
              <ul>
                <li>10♦ — 1 jeton de départ (s'accumule si non remporté)</li>
                <li>V♣ — 2 jetons</li>
                <li>D♠ — 3 jetons</li>
                <li>R♥ — 4 jetons <em>(et rejouer librement)</em></li>
                <li>7♦ Nain Jaune — 5 jetons</li>
              </ul>

              <h4>🏆 Fin de manche</h4>
              <p>Le premier joueur à vider sa main gagne la manche. Il encaisse :</p>
              <ul>
                <li>La valeur des cartes restantes de chaque adversaire (As=1, 2–10=valeur faciale, V/D/R=10 pts)</li>
                <li>Le <strong>pot</strong> accumulé pendant la manche (pénalités de passe)</li>
              </ul>
              <p>⚠️ Le joueur tenant encore le <strong>7♦</strong> paie <strong>double</strong> sa valeur en main.</p>

              <h4>📌 Jetons non remportés</h4>
              <p>Les jetons d'une case spéciale non remportée restent sur la case et s'accumulent pour les manches suivantes.</p>
            </div>
            <button className="btn-close-rules" onClick={() => setShowRules(false)}>Fermer</button>
          </div>
        </div>
      )}

    </div>
  );
};

export default GameRoom;
