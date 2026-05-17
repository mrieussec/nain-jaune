import { Player } from './Player.js';
import { Deck } from './Deck.js';

const SUIT_SYMBOL = { Hearts: '♥', Diamonds: '♦', Clubs: '♣', Spades: '♠' };
const SUIT_NAME   = { Hearts: 'Cœur', Diamonds: 'Carreau', Clubs: 'Trèfle', Spades: 'Pique' };
const VALUE_NAME  = { A: 'As', J: 'Valet', Q: 'Dame', K: 'Roi' };

export class Room {
  constructor(id, ownerName) {
    this.id = id;
    this.name = `${ownerName}'s Game`;
    this.maxPlayers = 6;
    this.players = new Map();
    this.playersOrder = [];
    this.gameStarted = false;
    this.gameState = 'waiting'; // waiting | playing | brocantage | roundEnd | finished
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.deck = null;
    this.discard = [];
    this.message = '';
    this.isGameOver = false;
    this.isRoundOver = false;

    // { suit, nextValue (int 1–13), lastPlayerId }
    // null means free play (no active sequence)
    this.currentSequence = null;
    this.lastPlayedCard = null; // { suit, value } for display

    // Advanced rules state
    this.pot = 0;
    this.brocantageInfo = null; // { blockedCard: {suit, numValue}, lastPlayerId, declinedPlayerIds: [] }
    this.must7D = false;
    this.dealerPlayerId = null;
    this.activePlayerIds = []; // joueurs qui jouent cette manche (sans le donneur si ≥3)

    this.specialCards = {
      ten_diamonds:   { value: '10', suit: 'Diamonds', name: '10♦' },
      jack_clubs:     { value: 'J',  suit: 'Clubs',    name: 'V♣' },
      queen_spades:   { value: 'Q',  suit: 'Spades',   name: 'D♠' },
      king_hearts:    { value: 'K',  suit: 'Hearts',   name: 'R♥' },
      seven_diamonds: { value: '7',  suit: 'Diamonds', name: '7♦ (Nain Jaune)' },
    };

    this.table = {
      ten_diamonds: [],
      jack_clubs: [],
      queen_spades: [],
      king_hearts: [],
      seven_diamonds: [],
    };

    this.bets = {
      ten_diamonds: 0,
      jack_clubs: 0,
      queen_spades: 0,
      king_hearts: 0,
      seven_diamonds: 0,
    };

    this.round = 0;

    const ownerId = 'owner-' + Date.now();
    const owner = new Player(ownerId, ownerName, true);
    this.players.set(ownerId, owner);
    this.playersOrder.push(ownerId);
  }

  // ── Players ──────────────────────────────────────────────────────────────

  addPlayer(playerId, playerName) {
    if (this.isFull()) return false;
    const player = new Player(playerId, playerName, false);
    this.players.set(playerId, player);
    this.playersOrder.push(playerId);
    return true;
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    this.playersOrder = this.playersOrder.filter(id => id !== playerId);
  }

  isFull()  { return this.players.size >= this.maxPlayers; }
  isEmpty() { return this.players.size === 0; }

  // ── Card helpers ─────────────────────────────────────────────────────────

  cardValue(value) {
    const map = { A: 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6,
                  '7': 7, '8': 8, '9': 9, '10': 10, J: 11, Q: 12, K: 13 };
    return map[value] || 0;
  }

  valueLabel(num) {
    if (num === 1)  return 'A';
    if (num === 11) return 'J';
    if (num === 12) return 'Q';
    if (num === 13) return 'K';
    return String(num);
  }

  getCardLabel(card) {
    const map = { A: 'As', J: 'V', Q: 'D', K: 'R' };
    return map[card.value] || card.value;
  }

  // "As de Cœur", "5 de Carreau", "Valet de Trèfle" …
  cardName(suit, numOrStr) {
    const str = typeof numOrStr === 'number' ? this.valueLabel(numOrStr) : numOrStr;
    const valLabel = VALUE_NAME[str] || str;
    return `${valLabel} de ${SUIT_NAME[suit]}`;
  }

  getPileName(pileKey) { return this.specialCards[pileKey]?.name || ''; }

  getSpecialPileForCard(card) {
    if (card.value === '10' && card.suit === 'Diamonds') return 'ten_diamonds';
    if (card.value === 'J'  && card.suit === 'Clubs')    return 'jack_clubs';
    if (card.value === 'Q'  && card.suit === 'Spades')   return 'queen_spades';
    if (card.value === 'K'  && card.suit === 'Hearts')   return 'king_hearts';
    if (card.value === '7'  && card.suit === 'Diamonds') return 'seven_diamonds';
    return null;
  }

  // Returns true if any active player currently holds { suit, numValue }
  hasAnyPlayerCard(suit, numValue) {
    const str = this.valueLabel(numValue);
    return Array.from(this.players.values()).some(p =>
      p.hand.some(c => c.suit === suit && c.value === str)
    );
  }

  // ── Active players helpers ────────────────────────────────────────────────

  // Renvoie les IDs des joueurs actifs en ordre clockwise depuis le joueur après le donneur
  _getActivePlayerIds() {
    const n = this.playersOrder.length;
    if (n <= 2) return [...this.playersOrder];
    const dealerIdx = this.playersOrder.indexOf(this.dealerPlayerId);
    const result = [];
    for (let i = 1; i < n; i++) {
      result.push(this.playersOrder[(dealerIdx + i) % n]);
    }
    return result;
  }

  // ── Sequence logic ────────────────────────────────────────────────────────

  canPlayCard(card) {
    if (!this.currentSequence) return true;
    const { suit, nextValue } = this.currentSequence;
    return card.suit === suit && this.cardValue(card.value) === nextValue;
  }

  // ── Round setup ───────────────────────────────────────────────────────────

  _dealCards() {
    const cardsPerPlayer = Math.floor(52 / this.activePlayerIds.length);
    for (const playerId of this.activePlayerIds) {
      const player = this.players.get(playerId);
      player.hand = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        const card = this.deck.drawCard();
        if (card) player.addCard(card);
      }
    }
    this.discard = this.deck.cards.splice(0);
  }

  // TOUS les joueurs paient (même le donneur)
  _collectBets() {
    for (const player of this.players.values()) {
      player.points -= 15;
      this.bets.ten_diamonds   += 1;
      this.bets.jack_clubs     += 2;
      this.bets.queen_spades   += 3;
      this.bets.king_hearts    += 4;
      this.bets.seven_diamonds += 5;
    }
  }

  _setupRound() {
    this.dealerPlayerId = this.playersOrder[this.dealerIndex];
    this.activePlayerIds = this._getActivePlayerIds();
    this.must7D = false;
    this.brocantageInfo = null;
    this.currentSequence = null;
    this.lastPlayedCard = null;
    this.isRoundOver = false;

    // Vider toutes les mains
    for (const p of this.players.values()) p.hand = [];
    for (const key of Object.keys(this.table)) this.table[key] = [];

    this.deck = new Deck();
    this._dealCards();
    this._collectBets();

    // Trouver le porteur du 7♦ parmi les joueurs actifs
    const holderOf7D = this.activePlayerIds.find(id => {
      const p = this.players.get(id);
      return p.hand.some(c => c.value === '7' && c.suit === 'Diamonds');
    });

    if (holderOf7D) {
      this.currentPlayerIndex = this.activePlayerIds.indexOf(holderOf7D);
      this.must7D = true;
      this.message = `${this.players.get(holderOf7D).name} possède le 7♦ et doit commencer.`;
    } else {
      this.currentPlayerIndex = 0; // premier joueur actif (gauche du donneur)
      this.must7D = false;
      this.message = `Le 7♦ est dans le talon — ${this.players.get(this.activePlayerIds[0]).name} commence librement.`;
    }

    this.gameState = 'playing';
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────

  startGame() {
    if (this.players.size < 2 || this.players.size > 6) return false;
    this.gameStarted = true;
    this.round = 1;
    this.dealerIndex = 0;
    this.pot = 0;
    this.isGameOver = false;
    this._setupRound();
    return true;
  }

  newRound() {
    if (this.gameState !== 'roundEnd') return false;
    this.round++;
    this.dealerIndex = (this.dealerIndex + 1) % this.playersOrder.length;
    this._setupRound();
    this.message = `Manche ${this.round} — ${this.message}`;
    return true;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  playCard(playerId, card) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    if (this.gameState === 'brocantage') return { success: false, error: 'Brocantage en cours' };
    if (this.gameState !== 'playing') return { success: false, error: 'La partie est terminée' };

    // Vérifier que c'est bien le joueur actif
    if (this.activePlayerIds[this.currentPlayerIndex] !== playerId)
      return { success: false, error: 'Pas votre tour' };

    // Règle must7D
    if (this.must7D) {
      if (!(card.value === '7' && card.suit === 'Diamonds'))
        return { success: false, error: 'Vous devez commencer avec le 7♦ !' };
      this.must7D = false;
    }

    const cardIndex = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (cardIndex === -1) return { success: false, error: 'Carte introuvable' };

    if (!this.canPlayCard(card)) {
      if (this.currentSequence) {
        const { suit, nextValue } = this.currentSequence;
        return { success: false, error: `Jouez le ${this.valueLabel(nextValue)}${SUIT_SYMBOL[suit]} ou passez` };
      }
      return { success: false, error: 'Carte non jouable' };
    }

    player.hand.splice(cardIndex, 1);
    this.lastPlayedCard = { suit: card.suit, value: card.value };

    // Special card: collect pile bets
    const specialPile = this.getSpecialPileForCard(card);
    let winnings = 0;
    const pileKey = specialPile;
    const resultType = specialPile ? 'special' : 'sequence';

    if (specialPile) {
      this.table[specialPile].push(card);
      winnings = this.bets[specialPile];
      player.points += winnings;
      this.bets[specialPile] = 0;
      this.message = `${player.name} — ${this.cardName(card.suit, card.value)} (${this.getPileName(specialPile)}) : +${winnings} jeton${winnings > 1 ? 's' : ''} !`;
    } else {
      this.message = `${player.name} — ${this.cardName(card.suit, card.value)}.`;
    }

    if (player.hand.length === 0) {
      this.endRound(playerId);
      return { success: true, type: 'roundEnd', pileKey, winnings, specialCard: !!specialPile, winnerId: playerId, gameOver: this.isGameOver };
    }

    const cardVal = this.cardValue(card.value);
    const isKing = cardVal === 13;

    if (isKing || !this.hasAnyPlayerCard(card.suit, cardVal + 1)) {
      // Sequence ends — same player gets free play
      this.currentSequence = null;
      if (isKing) {
        this.message += ` Roi posé — ${player.name} rejoue.`;
      } else {
        this.message += ` Sans le ${this.cardName(card.suit, cardVal + 1)} — ${player.name} rejoue.`;
      }
      // currentPlayerIndex stays — same player
    } else {
      this.currentSequence = { suit: card.suit, nextValue: cardVal + 1, lastPlayerId: playerId };
      // Si le joueur actif possède déjà la prochaine carte, il garde la main
      const activePlayerHasNext = player.hand.some(
        c => c.suit === card.suit && this.cardValue(c.value) === cardVal + 1
      );
      if (activePlayerHasNext) {
        this.message += ` ${player.name} continue avec le ${this.cardName(card.suit, cardVal + 1)}.`;
        // currentPlayerIndex inchangé : même joueur
      } else {
        this.nextTurn();
      }
    }

    return { success: true, type: resultType, pileKey, winnings, specialCard: !!specialPile, gameOver: false };
  }

  passTurn(playerId) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    if (this.gameState === 'brocantage') return { success: false, error: 'Brocantage en cours' };

    if (this.activePlayerIds[this.currentPlayerIndex] !== playerId)
      return { success: false, error: 'Pas votre tour' };

    if (!this.currentSequence) {
      return { success: false, error: 'Vous devez jouer une carte (libre)' };
    }

    const { suit, nextValue } = this.currentSequence;
    const hasRequired = player.hand.some(
      c => c.suit === suit && this.cardValue(c.value) === nextValue
    );
    if (hasRequired) {
      return { success: false, error: `Vous avez le ${this.valueLabel(nextValue)}${SUIT_SYMBOL[suit]}` };
    }

    // Pénalité de passe : 1 jeton au pot
    player.points -= 1;
    this.pot += 1;
    this.message = `${player.name} — sans le ${this.cardName(suit, nextValue)}. (-1 jeton)`;

    this.nextTurn();

    // If no player holds the required card, enter brocantage
    if (!this.hasAnyPlayerCard(suit, nextValue)) {
      this.gameState = 'brocantage';
      this.brocantageInfo = {
        blockedCard: { suit, numValue: nextValue },
        lastPlayerId: this.currentSequence.lastPlayerId,
        declinedPlayerIds: []
      };
      this.currentSequence = null;
      this.message += ` Le ${this.cardName(suit, nextValue)} est dans le talon — brocantage !`;
    }

    return { success: true, type: 'pass' };
  }

  // ── Brocantage ────────────────────────────────────────────────────────────

  brocanter(playerId) {
    if (this.gameState !== 'brocantage' || !this.brocantageInfo)
      return { success: false, error: 'Pas de brocantage en cours' };
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    const { blockedCard, lastPlayerId } = this.brocantageInfo;
    const nOthers = this.players.size - 1;
    player.points -= nOthers;
    for (const [pid, p] of this.players) {
      if (pid !== playerId) p.points += 1;
    }

    const card = { suit: blockedCard.suit, value: this.valueLabel(blockedCard.numValue) };
    this.lastPlayedCard = card;

    const specialPile = this.getSpecialPileForCard(card);
    let winnings = 0;
    if (specialPile) {
      this.table[specialPile].push(card);
      winnings = this.bets[specialPile];
      player.points += winnings;
      this.bets[specialPile] = 0;
    }

    this.message = `${player.name} brocante le ${this.cardName(card.suit, card.value)} (-${nOthers} jeton${nOthers > 1 ? 's' : ''}).`;
    if (winnings > 0) this.message += ` +${winnings} jeton${winnings > 1 ? 's' : ''} !`;

    // Mettre le brocanteur comme joueur courant
    const idx = this.activePlayerIds.indexOf(playerId);
    this.currentPlayerIndex = idx >= 0 ? idx : 0;

    const cardVal = this.cardValue(card.value);
    const isKing = cardVal === 13;

    if (isKing || !this.hasAnyPlayerCard(card.suit, cardVal + 1)) {
      this.currentSequence = null;
      this.message += isKing ? ` Roi — ${player.name} rejoue.` : ` ${player.name} rejoue.`;
    } else {
      this.currentSequence = { suit: card.suit, nextValue: cardVal + 1, lastPlayerId: playerId };
      const hasNext = player.hand.some(c => c.suit === card.suit && this.cardValue(c.value) === cardVal + 1);
      if (!hasNext) this.nextTurn();
    }

    this.brocantageInfo = null;
    this.gameState = 'playing';
    return { success: true, winnings, specialCard: !!specialPile };
  }

  declineBrocantage(playerId) {
    if (this.gameState !== 'brocantage' || !this.brocantageInfo)
      return { success: false, error: 'Pas de brocantage en cours' };
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    if (!this.brocantageInfo.declinedPlayerIds.includes(playerId))
      this.brocantageInfo.declinedPlayerIds.push(playerId);

    if (this.brocantageInfo.declinedPlayerIds.length >= this.players.size) {
      const { lastPlayerId } = this.brocantageInfo;
      const lastPlayer = this.players.get(lastPlayerId);
      const lastIdx = this.activePlayerIds.indexOf(lastPlayerId);
      this.currentPlayerIndex = lastIdx >= 0 ? lastIdx : 0;
      this.currentSequence = null;
      this.message = `Personne ne brocante — ${lastPlayer?.name || 'Joueur'} rejoue librement.`;
      this.brocantageInfo = null;
      this.gameState = 'playing';
      return { success: true, resolved: true };
    }
    return { success: true, resolved: false };
  }

  endRound(winnerId) {
    const winner = this.players.get(winnerId);
    if (!winner) return;

    let winnerGain = 0;
    for (const [playerId, player] of this.players) {
      if (playerId === winnerId) continue;
      let penalty = player.calculateScore();
      // Holding the Nain Jaune (7♦) at round end = double penalty
      const hasNainJaune = player.hand.some(c => c.suit === 'Diamonds' && c.value === '7');
      if (hasNainJaune) penalty *= 2;
      player.points = Math.max(0, player.points - penalty);
      winnerGain += penalty;
    }

    // Winner receives the pot in addition to normal gain
    winnerGain += this.pot;
    winner.points += winnerGain;
    const potMsg = this.pot > 0 ? ` (dont ${this.pot} du pot)` : '';
    this.pot = 0;

    this.isRoundOver = true;
    const anyEliminated = Array.from(this.players.values()).some(p => p.points <= 0);

    if (anyEliminated) {
      this.gameState = 'finished';
      this.isGameOver = true;
      this.message = `${winner.name} remporte la manche (+${winnerGain}${potMsg}) ! Un joueur est éliminé. Partie terminée !`;
    } else {
      this.gameState = 'roundEnd';
      this.message = `${winner.name} remporte la manche (+${winnerGain}${potMsg}) !`;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.activePlayerIds.length;
  }

  getCurrentPlayer() {
    return this.players.get(this.activePlayerIds[this.currentPlayerIndex]);
  }

  getGameState() {
    return {
      roomId: this.id,
      gameStarted: this.gameStarted,
      gameState: this.gameState,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.activePlayerIds[this.currentPlayerIndex] || null,
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        handSize: p.hand.length,
        isOwner: p.isOwner,
        points: p.points,
      })),
      bets: this.bets,
      table: this.table,
      talonSize: this.discard ? this.discard.length : 0,
      round: this.round,
      message: this.message,
      isGameOver: this.isGameOver,
      isRoundOver: this.isRoundOver,
      currentSequence: this.currentSequence,
      lastPlayedCard: this.lastPlayedCard,
      // Advanced rules
      pot: this.pot,
      must7D: this.must7D,
      dealerPlayerId: this.dealerPlayerId,
      activePlayerIds: this.activePlayerIds,
      brocantageInfo: this.brocantageInfo ? {
        suit: this.brocantageInfo.blockedCard.suit,
        numValue: this.brocantageInfo.blockedCard.numValue,
        declinedCount: this.brocantageInfo.declinedPlayerIds.length,
      } : null,
    };
  }
}
