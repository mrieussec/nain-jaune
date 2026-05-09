import { Player } from './Player.js';
import { Deck } from './Deck.js';

export class Room {
  constructor(id, ownerName) {
    this.id = id;
    this.name = `${ownerName}'s Game`;
    this.maxPlayers = 6;
    this.players = new Map();
    this.playersOrder = [];
    this.gameStarted = false;
    this.gameState = 'waiting'; // waiting, playing, finished
    this.currentPlayerIndex = 0;
    this.deck = null;
    this.discard = []; // Talon - cartes non distribuées
    this.message = '';
    this.isGameOver = false;
    
    // 5 special cards (Wikipedia rules)
    this.specialCards = {
      ten_diamonds: { value: '10', suit: 'Diamonds', name: '10♦' },
      jack_clubs: { value: 'J', suit: 'Clubs', name: 'V♣' },
      queen_spades: { value: 'Q', suit: 'Spades', name: 'D♠' },
      king_hearts: { value: 'K', suit: 'Hearts', name: 'R♥' },
      seven_diamonds: { value: '7', suit: 'Diamonds', name: '7♦ (Nain Jaune)' }
    };
    
    this.table = {
      ten_diamonds: [],
      jack_clubs: [],
      queen_spades: [],
      king_hearts: [],
      seven_diamonds: []
    };
    
    this.bets = {
      ten_diamonds: 0,
      jack_clubs: 0,
      queen_spades: 0,
      king_hearts: 0,
      seven_diamonds: 0
    };
    
    this.round = 0;
    
    // Add owner as first player
    const ownerId = 'owner-' + Date.now();
    const owner = new Player(ownerId, ownerName, true);
    this.players.set(ownerId, owner);
    this.playersOrder.push(ownerId);
  }

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

  isFull() {
    return this.players.size >= this.maxPlayers;
  }

  isEmpty() {
    return this.players.size === 0;
  }

  startGame() {
    if (this.players.size < 2) return false;
    if (this.players.size > 6) return false;
    
    this.gameStarted = true;
    this.gameState = 'playing';
    this.round = 1;
    
    // Initialize deck and deal cards
    this.deck = new Deck();
    this.dealCards();
    
    // Collect initial bets
    this.collectBets();
    
    return true;
  }

  collectBets() {
    // Each player bets on the 5 special piles
    for (const player of this.players.values()) {
      player.points -= 15; // 1+2+3+4+5 jetons per round
      
      this.bets.ten_diamonds += 1;
      this.bets.jack_clubs += 2;
      this.bets.queen_spades += 3;
      this.bets.king_hearts += 4;
      this.bets.seven_diamonds += 5;
    }
  }

  getSpecialPileBet(pileKey) {
    return this.bets[pileKey] || 0;
  }

  getPileName(pileKey) {
    return this.specialCards[pileKey]?.name || '';
  }

  getCardLabel(card) {
    const labelMap = { 'A': 'As', 'J': 'V', 'Q': 'D', 'K': 'R' };
    return labelMap[card.value] || card.value;
  }

  getSpecialPileForCard(card) {
    if (card.value === '10' && card.suit === 'Diamonds') return 'ten_diamonds';
    if (card.value === 'J' && card.suit === 'Clubs') return 'jack_clubs';
    if (card.value === 'Q' && card.suit === 'Spades') return 'queen_spades';
    if (card.value === 'K' && card.suit === 'Hearts') return 'king_hearts';
    if (card.value === '7' && card.suit === 'Diamonds') return 'seven_diamonds';
    return null;
  }

  isSpecialCard(card) {
    return this.getSpecialPileForCard(card) !== null;
  }

  dealCards() {
    const cardsPerPlayer = Math.floor(52 / this.players.size);
    
    for (const playerId of this.playersOrder) {
      const player = this.players.get(playerId);
      for (let i = 0; i < cardsPerPlayer; i++) {
        const card = this.deck.drawCard();
        if (card) player.addCard(card);
      }
    }

    // Keep the remaining cards as the talon (discard pile)
    this.discard = this.deck.cards.splice(0);
  }

  cardValue(value) {
    const values = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
    return values[value] || 0;
  }

  canPlayCardOnPile(card, pileKey) {
    const pile = this.table[pileKey];
    if (!pile) return false;

    if (pile.length === 0) {
      const specialCard = this.specialCards[pileKey];
      return card.value === specialCard.value && card.suit === specialCard.suit;
    }

    const topCard = pile[pile.length - 1];
    const cardVal = this.cardValue(card.value);
    const topVal = this.cardValue(topCard.value);
    return cardVal === topVal + 1 || cardVal === topVal - 1;
  }

  canPlayCard(card) {
    const specialPile = this.getSpecialPileForCard(card);
    if (specialPile) {
      return this.canPlayCardOnPile(card, specialPile);
    }

    return Object.keys(this.table).some(pileKey => this.canPlayCardOnPile(card, pileKey));
  }

  canPlayerPlayAnyCard(player) {
    return player.hand.some(card => this.canPlayCard(card));
  }

  getPenaltyValue(card) {
    if (card.value === 'A') return 1;
    if (['J', 'Q', 'K'].includes(card.value)) return 10;
    return parseInt(card.value, 10) || 0;
  }

  endRound(winnerId) {
    const winner = this.players.get(winnerId);
    if (!winner) return;

    let totalPenalty = 0;
    for (const [playerId, player] of this.players) {
      if (playerId === winnerId) continue;
      const penalty = player.calculateScore();
      totalPenalty += penalty;
      player.points = Math.max(0, player.points - penalty);
    }

    winner.points += totalPenalty;
    this.gameState = 'finished';
    this.isGameOver = true;
    this.message = `${winner.name} remporte la manche et gagne ${totalPenalty} jetons ! Partie terminée.`;

    if (Array.from(this.players.values()).some(p => p.points <= 0)) {
      this.message = `${winner.name} remporte la manche ! Un joueur est à court de jetons. Partie terminée.`;
    }
  }

  playCard(playerId, card) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (this.gameState !== 'playing') return { success: false, error: 'La partie est terminée' };

    const cardIndex = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (cardIndex === -1) return { success: false, error: 'Card not in hand' };

    if (!this.canPlayCard(card)) return { success: false, error: 'Impossible de jouer cette carte' };

    player.hand.splice(cardIndex, 1);
    const specialPile = this.getSpecialPileForCard(card);
    let winnings = 0;
    let pileKey = null;
    let resultType = 'table';

    if (specialPile) {
      pileKey = specialPile;
      this.table[pileKey].push(card);
      winnings = this.bets[pileKey];
      player.points += winnings;
      this.bets[pileKey] = 0;
      this.message = `${player.name} pose ${this.getPileName(pileKey)} et prend ${winnings} jetons !`;
      resultType = 'special';
      if (pileKey === 'king_hearts') {
        this.message = `${player.name} pose ${this.getPileName(pileKey)}. Roi et je recommence !`;
      }
    } else {
      for (const key of Object.keys(this.table)) {
        if (this.canPlayCardOnPile(card, key)) {
          pileKey = key;
          this.table[key].push(card);
          this.message = `${player.name} pose ${this.getCardLabel(card)} sur ${this.getPileName(key)}.`;
          break;
        }
      }
    }

    if (player.hand.length === 0) {
      this.endRound(playerId);
      return {
        success: true,
        type: 'roundEnd',
        pileKey,
        winnings,
        specialCard: !!specialPile,
        winnerId: playerId,
        gameOver: true
      };
    }

    if (specialPile !== 'king_hearts') {
      this.nextTurn();
    }

    return {
      success: true,
      type: resultType,
      pileKey,
      winnings,
      specialCard: !!specialPile,
      gameOver: false
    };
  }

  passTurn(playerId) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (this.playersOrder[this.currentPlayerIndex] !== playerId) return { success: false, error: 'Pas votre tour' };
    if (this.canPlayerPlayAnyCard(player)) return { success: false, error: 'Vous avez des cartes jouables' };

    const unplayableCard = player.hand.find(card => !this.canPlayCard(card)) || player.hand[0];
    const cardLabel = this.getCardLabel(unplayableCard);
    this.message = `${player.name} passe - sans ${cardLabel}.`;
    this.nextTurn();

    return { success: true, type: 'pass' };
  }

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playersOrder.length;
  }

  getCurrentPlayer() {
    const playerId = this.playersOrder[this.currentPlayerIndex];
    return this.players.get(playerId);
  }

  getGameState() {
    return {
      roomId: this.id,
      gameStarted: this.gameStarted,
      gameState: this.gameState,
      currentPlayerIndex: this.currentPlayerIndex,
      currentPlayerId: this.playersOrder[this.currentPlayerIndex],
      players: Array.from(this.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        handSize: p.hand.length,
        isOwner: p.isOwner,
        points: p.points
      })),
      bets: this.bets,
      table: this.table,
      talonSize: this.discard ? this.discard.length : 0,
      round: this.round,
      message: this.message,
      isGameOver: this.isGameOver
    };
  }
}
