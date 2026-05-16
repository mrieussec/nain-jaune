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
    this.gameState = 'waiting'; // waiting | playing | roundEnd | finished
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

  // Returns true if any player currently holds { suit, numValue }
  hasAnyPlayerCard(suit, numValue) {
    const str = this.valueLabel(numValue);
    return Array.from(this.players.values()).some(p =>
      p.hand.some(c => c.suit === suit && c.value === str)
    );
  }

  // ── Sequence logic ────────────────────────────────────────────────────────
  //
  // Rules:
  //   • currentSequence === null  → free play: the active player may play any card
  //   • currentSequence set       → the active player must play exactly that card,
  //                                 or pass if they don't hold it
  //
  // After a card is played:
  //   • King played  → sequence ends, same player gets free play
  //   • Next card in talon (no player holds it) → sequence ends, same player gets free play
  //   • Otherwise → sequence continues, turn passes to next player
  //
  // After a pass:
  //   • If no remaining player holds the required card → sequence blocked,
  //     the last player to have played gets free play
  //   • Otherwise → turn passes to next player

  canPlayCard(card) {
    if (!this.currentSequence) return true;
    const { suit, nextValue } = this.currentSequence;
    return card.suit === suit && this.cardValue(card.value) === nextValue;
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────

  startGame() {
    if (this.players.size < 2 || this.players.size > 6) return false;

    this.gameStarted = true;
    this.gameState = 'playing';
    this.round = 1;
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.currentSequence = null;
    this.lastPlayedCard = null;
    this.isRoundOver = false;
    this.isGameOver = false;

    this.deck = new Deck();
    this.dealCards();
    this.collectBets();

    return true;
  }

  collectBets() {
    for (const player of this.players.values()) {
      const total = 1 + 2 + 3 + 4 + 5;
      player.points -= total;
      this.bets.ten_diamonds   += 1;
      this.bets.jack_clubs     += 2;
      this.bets.queen_spades   += 3;
      this.bets.king_hearts    += 4;
      this.bets.seven_diamonds += 5;
    }
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
    this.discard = this.deck.cards.splice(0);
  }

  newRound() {
    if (this.gameState !== 'roundEnd') return false;

    this.round++;
    this.isRoundOver = false;
    this.currentSequence = null;
    this.lastPlayedCard = null;
    this.message = `Manche ${this.round} — bonne chance !`;

    for (const player of this.players.values()) {
      player.hand = [];
    }
    for (const key of Object.keys(this.table)) {
      this.table[key] = [];
    }

    // Rotate starting player each round
    this.dealerIndex = (this.dealerIndex + 1) % this.playersOrder.length;
    this.currentPlayerIndex = this.dealerIndex;

    this.deck = new Deck();
    this.dealCards();
    this.collectBets(); // unclaimed bets from previous round accumulate

    this.gameState = 'playing';
    return true;
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  playCard(playerId, card) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };
    if (this.gameState !== 'playing') return { success: false, error: 'La partie est terminée' };
    if (this.playersOrder[this.currentPlayerIndex] !== playerId)
      return { success: false, error: 'Pas votre tour' };

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
    if (this.playersOrder[this.currentPlayerIndex] !== playerId)
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

    this.message = `${player.name} — sans le ${this.cardName(suit, nextValue)}.`;
    this.nextTurn();

    // If no player holds the required card, sequence is blocked
    if (!this.hasAnyPlayerCard(suit, nextValue)) {
      const lastPlayer = this.players.get(this.currentSequence.lastPlayerId);
      const lastPlayerIndex = this.playersOrder.indexOf(this.currentSequence.lastPlayerId);
      this.currentSequence = null;
      this.currentPlayerIndex = lastPlayerIndex;
      this.message += ` Sans le ${this.cardName(suit, nextValue)} — ${lastPlayer?.name || 'Joueur'} rejoue.`;
    }

    return { success: true, type: 'pass' };
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
    winner.points += winnerGain;

    this.isRoundOver = true;
    const anyEliminated = Array.from(this.players.values()).some(p => p.points <= 0);

    if (anyEliminated) {
      this.gameState = 'finished';
      this.isGameOver = true;
      this.message = `${winner.name} remporte la manche (+${winnerGain} jeton${winnerGain > 1 ? 's' : ''}) ! Un joueur est éliminé. Partie terminée !`;
    } else {
      this.gameState = 'roundEnd';
      this.message = `${winner.name} remporte la manche (+${winnerGain} jeton${winnerGain > 1 ? 's' : ''}) !`;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  nextTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playersOrder.length;
  }

  getCurrentPlayer() {
    return this.players.get(this.playersOrder[this.currentPlayerIndex]);
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
    };
  }
}
