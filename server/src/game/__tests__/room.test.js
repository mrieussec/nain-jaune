import { describe, it, expect, beforeEach } from 'vitest';
import { Room } from '../Room.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a Room with N players already joined, each with a real socket-style ID.
 * The owner's ID is also fixed to a socket-style ID so startGame() works.
 */
function makeRoom(n = 2) {
  const room = new Room('test-room', 'Alice');

  // Fix the owner's auto-generated ID
  const [ownerId] = [...room.players.keys()];
  const owner = room.players.get(ownerId);
  owner.id = 'p1';
  room.players.delete(ownerId);
  room.players.set('p1', owner);
  room.playersOrder[0] = 'p1';

  for (let i = 2; i <= n; i++) {
    room.addPlayer(`p${i}`, `Player${i}`);
  }
  return room;
}

/**
 * Start a game and return the first active player's ID.
 */
function startAndGetFirst(room) {
  room.startGame();
  return room.activePlayerIds[room.currentPlayerIndex];
}

/**
 * Give a player a specific card (and remove it from the talon if present).
 */
function giveCard(room, playerId, card) {
  const player = room.players.get(playerId);
  player.hand.push(card);
  // Remove from talon (discard) to avoid duplicates
  room.discard = room.discard.filter(c => !(c.suit === card.suit && c.value === card.value));
}

/**
 * Remove a specific card from a player's hand.
 */
function removeFromHand(room, playerId, card) {
  const player = room.players.get(playerId);
  const idx = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
  if (idx !== -1) player.hand.splice(idx, 1);
}

/**
 * Ensure no player holds a specific card (move it to discard).
 */
function moveCardToTalon(room, card) {
  for (const player of room.players.values()) {
    const idx = player.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (idx !== -1) {
      room.discard.push(player.hand.splice(idx, 1)[0]);
      return;
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Room — constructor & player management', () => {
  it('initialises with correct defaults', () => {
    const room = new Room('r1', 'Alice');
    expect(room.id).toBe('r1');
    expect(room.gameStarted).toBe(false);
    expect(room.gameState).toBe('waiting');
    expect(room.players.size).toBe(1);
    expect(room.pot).toBe(0);
  });

  it('addPlayer() adds a player', () => {
    const room = makeRoom(1);
    room.addPlayer('p2', 'Bob');
    expect(room.players.size).toBe(2);
  });

  it('addPlayer() returns false when full', () => {
    const room = makeRoom(6);
    expect(room.addPlayer('p7', 'Eve')).toBe(false);
  });

  it('removePlayer() removes player and updates order', () => {
    const room = makeRoom(2);
    room.removePlayer('p2');
    expect(room.players.size).toBe(1);
    expect(room.playersOrder).not.toContain('p2');
  });

  it('isEmpty() and isFull() work correctly', () => {
    const room = makeRoom(1);
    expect(room.isEmpty()).toBe(false);
    room.removePlayer('p1');
    expect(room.isEmpty()).toBe(true);

    const full = makeRoom(6);
    expect(full.isFull()).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — card helpers', () => {
  let room;
  beforeEach(() => { room = new Room('r', 'A'); });

  it('cardValue() maps all card values correctly', () => {
    expect(room.cardValue('A')).toBe(1);
    expect(room.cardValue('7')).toBe(7);
    expect(room.cardValue('10')).toBe(10);
    expect(room.cardValue('J')).toBe(11);
    expect(room.cardValue('Q')).toBe(12);
    expect(room.cardValue('K')).toBe(13);
  });

  it('valueLabel() is the inverse of cardValue()', () => {
    expect(room.valueLabel(1)).toBe('A');
    expect(room.valueLabel(10)).toBe('10');
    expect(room.valueLabel(11)).toBe('J');
    expect(room.valueLabel(12)).toBe('Q');
    expect(room.valueLabel(13)).toBe('K');
    expect(room.valueLabel(5)).toBe('5');
  });

  it('getSpecialPileForCard() identifies all special cards', () => {
    expect(room.getSpecialPileForCard({ value: '10', suit: 'Diamonds' })).toBe('ten_diamonds');
    expect(room.getSpecialPileForCard({ value: 'J',  suit: 'Clubs' })).toBe('jack_clubs');
    expect(room.getSpecialPileForCard({ value: 'Q',  suit: 'Spades' })).toBe('queen_spades');
    expect(room.getSpecialPileForCard({ value: 'K',  suit: 'Hearts' })).toBe('king_hearts');
    expect(room.getSpecialPileForCard({ value: '7',  suit: 'Diamonds' })).toBe('seven_diamonds');
  });

  it('getSpecialPileForCard() returns null for non-special cards', () => {
    expect(room.getSpecialPileForCard({ value: '5', suit: 'Hearts' })).toBeNull();
    expect(room.getSpecialPileForCard({ value: 'K', suit: 'Spades' })).toBeNull();
  });

  it('canPlayCard() returns true when no active sequence', () => {
    room.currentSequence = null;
    expect(room.canPlayCard({ suit: 'Hearts', value: '5' })).toBe(true);
  });

  it('canPlayCard() returns true only for the exact next card in sequence', () => {
    room.currentSequence = { suit: 'Hearts', nextValue: 6 };
    expect(room.canPlayCard({ suit: 'Hearts', value: '6' })).toBe(true);
    expect(room.canPlayCard({ suit: 'Hearts', value: '7' })).toBe(false);
    expect(room.canPlayCard({ suit: 'Diamonds', value: '6' })).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — startGame()', () => {
  it('fails with fewer than 2 players', () => {
    const room = makeRoom(1);
    expect(room.startGame()).toBe(false);
  });

  it('succeeds with 2 players', () => {
    const room = makeRoom(2);
    expect(room.startGame()).toBe(true);
    expect(room.gameStarted).toBe(true);
    expect(room.gameState).toBe('playing');
  });

  it('deals cards only to active players (both active with 2 players)', () => {
    const room = makeRoom(2);
    room.startGame();
    for (const id of room.activePlayerIds) {
      expect(room.players.get(id).getHandSize()).toBeGreaterThan(0);
    }
  });

  it('excludes dealer from play with 3 players', () => {
    const room = makeRoom(3);
    room.startGame();
    expect(room.activePlayerIds).toHaveLength(2);
    expect(room.activePlayerIds).not.toContain(room.dealerPlayerId);
    expect(room.players.get(room.dealerPlayerId).getHandSize()).toBe(0);
  });

  it('all players pay bets at start', () => {
    const room = makeRoom(3);
    // Each player starts with 20 points, bets cost 15 total (1+2+3+4+5)
    room.startGame();
    for (const player of room.players.values()) {
      expect(player.points).toBe(5); // 20 - 15
    }
  });

  it('sets must7D=true when a player holds 7♦', () => {
    const room = makeRoom(2);
    room.startGame();
    // If 7♦ was dealt to an active player, must7D should be true
    const holder = room.activePlayerIds.find(id =>
      room.players.get(id).hand.some(c => c.value === '7' && c.suit === 'Diamonds')
    );
    if (holder) {
      expect(room.must7D).toBe(true);
      expect(room.activePlayerIds[room.currentPlayerIndex]).toBe(holder);
    } else {
      expect(room.must7D).toBe(false);
    }
  });

  it('pot resets to 0 at game start', () => {
    const room = makeRoom(2);
    room.pot = 99; // simulate leftover
    room.startGame();
    expect(room.pot).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — playCard()', () => {
  it('rejects a play when it is not the player\'s turn', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    const notCurrent = room.activePlayerIds.find(id => id !== room.activePlayerIds[room.currentPlayerIndex]);
    const card = room.players.get(notCurrent).hand[0];
    const result = room.playCard(notCurrent, card);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/tour/i);
  });

  it('rejects a play during brocantage phase', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    room.gameState = 'brocantage';
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const card = room.players.get(currentId).hand[0];
    const result = room.playCard(currentId, card);
    expect(result.success).toBe(false);
  });

  it('enforces must7D — only 7♦ is valid as first play', () => {
    const room = makeRoom(2);
    room.startGame();

    // Force must7D scenario
    room.must7D = true;
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const player = room.players.get(currentId);

    // Ensure player has 7♦
    if (!player.hand.some(c => c.value === '7' && c.suit === 'Diamonds')) {
      giveCard(room, currentId, { suit: 'Diamonds', value: '7' });
    }

    // Try to play a non-7♦ card
    const otherCard = player.hand.find(c => !(c.value === '7' && c.suit === 'Diamonds'));
    if (otherCard) {
      const result = room.playCard(currentId, otherCard);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/7♦/);
    }
  });

  it('allows playing 7♦ when must7D is true and clears the flag', () => {
    const room = makeRoom(2);
    room.startGame();
    room.must7D = true;
    room.currentSequence = null;

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    // Ensure player holds 7♦
    removeFromHand(room, currentId, { suit: 'Diamonds', value: '7' });
    giveCard(room, currentId, { suit: 'Diamonds', value: '7' });

    const result = room.playCard(currentId, { suit: 'Diamonds', value: '7' });
    expect(result.success).toBe(true);
    expect(room.must7D).toBe(false);
  });

  it('rejects a card not in the player\'s hand', () => {
    const room = makeRoom(2);
    room.startGame();
    room.must7D = false;
    room.currentSequence = null;
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    // Check BEFORE playing so we know the card is absent
    const has = room.players.get(currentId).hand.some(c => c.suit === 'Hearts' && c.value === 'A');
    if (!has) {
      const result = room.playCard(currentId, { suit: 'Hearts', value: 'A' });
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/introuvable/i);
    }
  });

  it('advances the sequence after a valid play', () => {
    const room = makeRoom(2);
    room.startGame();
    room.must7D = false;
    room.currentSequence = null;

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const card = room.players.get(currentId).hand[0];

    room.playCard(currentId, card);
    // Either sequence advanced or player gets free play (King / talon block)
    expect(room.lastPlayedCard).toEqual({ suit: card.suit, value: card.value });
  });

  it('gives winnings when a special card is played', () => {
    const room = makeRoom(2);
    room.startGame();
    room.must7D = false;
    room.currentSequence = null;

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const player = room.players.get(currentId);
    const specialCard = { suit: 'Clubs', value: 'J' }; // V♣ = 2 tokens

    // Set up a known bet amount and give card to player
    room.bets.jack_clubs = 10;
    removeFromHand(room, currentId, specialCard);
    giveCard(room, currentId, specialCard);

    const pointsBefore = player.points;
    const result = room.playCard(currentId, specialCard);

    expect(result.success).toBe(true);
    expect(result.specialCard).toBe(true);
    expect(player.points).toBe(pointsBefore + 10);
    expect(room.bets.jack_clubs).toBe(0);
  });

  it('King ends the sequence and the same player keeps the turn', () => {
    const room = makeRoom(2);
    room.startGame();
    room.must7D = false;
    room.currentSequence = { suit: 'Hearts', nextValue: 13 }; // waiting for K♥

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    removeFromHand(room, currentId, { suit: 'Hearts', value: 'K' });
    giveCard(room, currentId, { suit: 'Hearts', value: 'K' });

    room.playCard(currentId, { suit: 'Hearts', value: 'K' });

    expect(room.currentSequence).toBeNull();
    expect(room.activePlayerIds[room.currentPlayerIndex]).toBe(currentId);
  });

  it('triggers roundEnd when a player empties their hand', () => {
    const room = makeRoom(2);
    room.startGame();
    room.must7D = false;
    room.currentSequence = null;

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const player = room.players.get(currentId);

    // Leave exactly one card in hand
    const lastCard = player.hand[0];
    player.hand = [lastCard];

    const result = room.playCard(currentId, lastCard);
    expect(result.success).toBe(true);
    expect(result.type).toBe('roundEnd');
    expect(room.gameState).toMatch(/roundEnd|finished/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — passTurn()', () => {
  it('fails when there is no active sequence (free play)', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    room.currentSequence = null;
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const result = room.passTurn(currentId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/libre/i);
  });

  it('fails when it is not the player\'s turn', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    room.currentSequence = { suit: 'Hearts', nextValue: 5 };
    const otherId = room.activePlayerIds.find(id => id !== room.activePlayerIds[room.currentPlayerIndex]);
    const result = room.passTurn(otherId);
    expect(result.success).toBe(false);
  });

  it('fails when the player holds the required card', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    room.currentSequence = { suit: 'Spades', nextValue: 9 };
    giveCard(room, currentId, { suit: 'Spades', value: '9' });

    const result = room.passTurn(currentId);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/9♠/);
  });

  it('deducts 1 token from passer and adds to pot', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    room.currentSequence = { suit: 'Hearts', nextValue: 8, lastPlayerId: currentId };
    // Make sure the required card is not in hand
    removeFromHand(room, currentId, { suit: 'Hearts', value: '8' });

    const pointsBefore = room.players.get(currentId).points;
    const potBefore = room.pot;
    room.passTurn(currentId);

    expect(room.players.get(currentId).points).toBe(pointsBefore - 1);
    expect(room.pot).toBe(potBefore + 1);
  });

  it('advances to next player after pass', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    const firstId = room.activePlayerIds[room.currentPlayerIndex];
    room.currentSequence = { suit: 'Spades', nextValue: 3, lastPlayerId: firstId };
    removeFromHand(room, firstId, { suit: 'Spades', value: '3' });

    room.passTurn(firstId);
    expect(room.activePlayerIds[room.currentPlayerIndex]).not.toBe(firstId);
  });

  it('triggers brocantage when the required card is in the talon', () => {
    const room = makeRoom(2);
    startAndGetFirst(room);
    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const nextCard = { suit: 'Clubs', value: '4' };

    room.currentSequence = { suit: 'Clubs', nextValue: 4, lastPlayerId: currentId };
    // Make sure NO player has this card (it's in the talon)
    for (const id of room.activePlayerIds) moveCardToTalon(room, nextCard);

    room.passTurn(currentId);
    expect(room.gameState).toBe('brocantage');
    expect(room.brocantageInfo).not.toBeNull();
    expect(room.brocantageInfo.blockedCard).toEqual({ suit: 'Clubs', numValue: 4 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — brocantage', () => {
  /**
   * Set up a room where brocantage is already triggered.
   * Returns { room, brocanterId } where brocanterId is a player who can brocante.
   */
  function setupBrocantage(n = 2) {
    const room = makeRoom(n);
    room.startGame();
    room.must7D = false;

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const nextCard = { suit: 'Diamonds', value: '3' };

    room.currentSequence = { suit: 'Diamonds', nextValue: 3, lastPlayerId: currentId };
    for (const id of room.activePlayerIds) moveCardToTalon(room, nextCard);

    room.passTurn(currentId);
    // Should now be in brocantage
    return { room, lastPlayerId: currentId };
  }

  it('fails when there is no active brocantage', () => {
    const room = makeRoom(2);
    room.startGame();
    const result = room.brocanter('p1');
    expect(result.success).toBe(false);
  });

  it('brocanter() transfers tokens correctly (pays N-1 to others)', () => {
    const { room } = setupBrocantage(3);
    expect(room.gameState).toBe('brocantage');

    const brocanterId = room.activePlayerIds[0];
    const others = [...room.players.keys()].filter(id => id !== brocanterId);
    const brocanterBefore = room.players.get(brocanterId).points;
    const othersBefore = others.map(id => room.players.get(id).points);

    const nOthers = room.players.size - 1;
    room.brocanter(brocanterId);

    expect(room.players.get(brocanterId).points).toBe(brocanterBefore - nOthers);
    others.forEach((id, i) => {
      expect(room.players.get(id).points).toBe(othersBefore[i] + 1);
    });
  });

  it('brocanter() resumes playing state', () => {
    const { room } = setupBrocantage(2);
    const brocanterId = room.activePlayerIds[0];
    room.brocanter(brocanterId);
    expect(room.gameState).toBe('playing');
    expect(room.brocantageInfo).toBeNull();
  });

  it('declineBrocantage() does not resolve until all players decline', () => {
    const room = makeRoom(3);
    room.startGame();
    room.must7D = false;

    const currentId = room.activePlayerIds[room.currentPlayerIndex];
    const nextCard = { suit: 'Spades', value: '6' };
    room.currentSequence = { suit: 'Spades', nextValue: 6, lastPlayerId: currentId };
    for (const id of room.activePlayerIds) moveCardToTalon(room, nextCard);
    room.passTurn(currentId); // triggers brocantage

    expect(room.gameState).toBe('brocantage');

    const result1 = room.declineBrocantage(room.activePlayerIds[0]);
    expect(result1.resolved).toBe(false);
    expect(room.gameState).toBe('brocantage');
  });

  it('declineBrocantage() resolves and gives free play when all players decline', () => {
    const { room, lastPlayerId } = setupBrocantage(2);
    expect(room.gameState).toBe('brocantage');

    // Both players decline
    for (const id of [...room.players.keys()]) {
      room.declineBrocantage(id);
    }

    expect(room.gameState).toBe('playing');
    expect(room.brocantageInfo).toBeNull();
    expect(room.currentSequence).toBeNull();
    // The last player who played gets free play
    expect(room.activePlayerIds[room.currentPlayerIndex]).toBe(lastPlayerId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — endRound() & pot', () => {
  it('winner receives tokens from other players\' hand scores', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];

    // Give loser a known hand value
    room.players.get(loserId).hand = [
      { suit: 'Hearts', value: '5' },   // 5
      { suit: 'Clubs',  value: 'K' },   // 10
    ];
    room.players.get(winnerId).hand = [];

    const winnerBefore = room.players.get(winnerId).points;
    room.pot = 0;
    room.endRound(winnerId);

    expect(room.players.get(winnerId).points).toBe(winnerBefore + 15);
  });

  it('winner receives the accumulated pot', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];
    room.players.get(loserId).hand  = [];
    room.players.get(winnerId).hand = [];

    room.pot = 7;
    const winnerBefore = room.players.get(winnerId).points;
    room.endRound(winnerId);

    expect(room.players.get(winnerId).points).toBe(winnerBefore + 7);
    expect(room.pot).toBe(0);
  });

  it('doubles penalty for the player holding 7♦', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];

    // Give loser a hand worth 5 points, including the 7♦ → penalty × 2 = 10
    room.players.get(loserId).hand  = [{ suit: 'Diamonds', value: '7' }]; // 7 pts × 2 = 14
    room.players.get(winnerId).hand = [];
    room.pot = 0;

    const loserBefore  = room.players.get(loserId).points;
    const winnerBefore = room.players.get(winnerId).points;
    room.endRound(winnerId);

    expect(room.players.get(loserId).points).toBe(Math.max(0, loserBefore - 14));
    expect(room.players.get(winnerId).points).toBe(winnerBefore + 14);
  });

  it('sets gameState to finished when a player is eliminated', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];

    // Give loser 0 points so they get eliminated
    room.players.get(loserId).points = 0;
    room.players.get(loserId).hand   = [{ suit: 'Hearts', value: 'A' }]; // 1 point penalty
    room.players.get(winnerId).hand  = [];

    room.endRound(winnerId);
    expect(room.isGameOver).toBe(true);
    expect(room.gameState).toBe('finished');
  });

  it('sets gameState to roundEnd when no player is eliminated', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];

    room.players.get(loserId).points = 50;
    room.players.get(loserId).hand   = [{ suit: 'Hearts', value: '2' }];
    room.players.get(winnerId).hand  = [];
    room.pot = 0;

    room.endRound(winnerId);
    expect(room.gameState).toBe('roundEnd');
    expect(room.isGameOver).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — newRound()', () => {
  it('fails if the game is not in roundEnd state', () => {
    const room = makeRoom(2);
    room.startGame();
    expect(room.newRound()).toBe(false);
  });

  it('increments round counter and rotates dealer', () => {
    const room = makeRoom(2);
    room.startGame();

    const firstDealer = room.dealerPlayerId;
    room.gameState = 'roundEnd';
    room.newRound();

    expect(room.round).toBe(2);
    expect(room.dealerPlayerId).not.toBe(firstDealer);
  });

  it('resets round state correctly', () => {
    const room = makeRoom(2);
    room.startGame();
    room.gameState = 'roundEnd';
    room.newRound();

    expect(room.gameState).toBe('playing');
    expect(room.isRoundOver).toBe(false);
    expect(room.brocantageInfo).toBeNull();
    expect(room.currentSequence).toBeNull();
    // pot is reset only by endRound(); newRound() starts a fresh deal but
    // does not clear lingering pot (endRound clears it before roundEnd state)
    expect(room.pot).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — getGameState()', () => {
  it('returns all required fields', () => {
    const room = makeRoom(2);
    room.startGame();
    const state = room.getGameState();

    expect(state).toHaveProperty('roomId');
    expect(state).toHaveProperty('gameStarted');
    expect(state).toHaveProperty('gameState');
    expect(state).toHaveProperty('currentPlayerId');
    expect(state).toHaveProperty('players');
    expect(state).toHaveProperty('bets');
    expect(state).toHaveProperty('table');
    expect(state).toHaveProperty('pot');
    expect(state).toHaveProperty('must7D');
    expect(state).toHaveProperty('dealerPlayerId');
    expect(state).toHaveProperty('activePlayerIds');
    expect(state).toHaveProperty('brocantageInfo');
  });

  it('exposes brocantageInfo as null when not in brocantage', () => {
    const room = makeRoom(2);
    room.startGame();
    expect(room.getGameState().brocantageInfo).toBeNull();
  });

  it('exposes brocantageInfo summary during brocantage', () => {
    const room = makeRoom(2);
    room.startGame();
    room.brocantageInfo = {
      blockedCard: { suit: 'Hearts', numValue: 5 },
      lastPlayerId: 'p1',
      declinedPlayerIds: ['p2'],
    };
    room.gameState = 'brocantage';
    const info = room.getGameState().brocantageInfo;
    expect(info.suit).toBe('Hearts');
    expect(info.numValue).toBe(5);
    expect(info.declinedCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — integration: full round flow', () => {
  it('reaches roundEnd or finished after a player empties their hand', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];

    // Give the winner a single card and give the loser a known hand
    room.players.get(winnerId).hand = [{ suit: 'Hearts', value: '3' }];
    room.players.get(loserId).hand  = [{ suit: 'Clubs',  value: '5' }];
    room.must7D = false;
    room.currentSequence = null;
    // Ensure it is the winner's turn
    room.currentPlayerIndex = room.activePlayerIds.indexOf(winnerId);

    const result = room.playCard(winnerId, { suit: 'Hearts', value: '3' });
    expect(result.success).toBe(true);
    expect(result.type).toBe('roundEnd');
    expect(['roundEnd', 'finished']).toContain(room.gameState);
  });

  it('pot from pass penalties is awarded to the round winner', () => {
    const room = makeRoom(2);
    room.startGame();

    const winnerId = room.activePlayerIds[0];
    const loserId  = room.activePlayerIds[1];

    // Manually accumulate a pot
    room.pot = 4;
    room.players.get(winnerId).hand = [{ suit: 'Spades', value: '2' }];
    room.players.get(loserId).hand  = [];
    room.must7D = false;
    room.currentSequence = null;
    room.currentPlayerIndex = room.activePlayerIds.indexOf(winnerId);

    const winnerBefore = room.players.get(winnerId).points;
    room.playCard(winnerId, { suit: 'Spades', value: '2' });

    expect(room.pot).toBe(0);
    // Winner gets 0 from empty loser hand + 4 from pot
    expect(room.players.get(winnerId).points).toBe(winnerBefore + 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('Room — spectators', () => {
  it('addSpectator() adds a spectator to the room', () => {
    const room = makeRoom(2);
    room.addSpectator('spec-1', 'Charlie');
    expect(room.spectators.size).toBe(1);
    expect(room.spectators.get('spec-1')).toEqual({ id: 'spec-1', name: 'Charlie' });
  });

  it('addSpectator() allows multiple spectators', () => {
    const room = makeRoom(2);
    room.addSpectator('spec-1', 'Charlie');
    room.addSpectator('spec-2', 'Dave');
    expect(room.spectators.size).toBe(2);
  });

  it('removeSpectator() removes the spectator', () => {
    const room = makeRoom(2);
    room.addSpectator('spec-1', 'Charlie');
    room.removeSpectator('spec-1');
    expect(room.spectators.size).toBe(0);
  });

  it('removeSpectator() is a no-op for unknown id', () => {
    const room = makeRoom(2);
    expect(() => room.removeSpectator('ghost')).not.toThrow();
  });

  it('spectators are included in getGameState()', () => {
    const room = makeRoom(2);
    room.addSpectator('spec-1', 'Charlie');
    const state = room.getGameState();
    expect(state.spectators).toHaveLength(1);
    expect(state.spectators[0]).toEqual({ id: 'spec-1', name: 'Charlie' });
  });

  it('getGameState() returns empty spectators array when none', () => {
    const room = makeRoom(2);
    expect(room.getGameState().spectators).toEqual([]);
  });

  it('isEmpty() returns false when only spectators are present (no players)', () => {
    const room = new Room('r', 'Alice');
    // Remove the owner to simulate empty players
    const [ownerId] = [...room.players.keys()];
    room.removePlayer(ownerId);
    room.addSpectator('spec-1', 'Bob');
    expect(room.isEmpty()).toBe(false);
  });

  it('isEmpty() returns true when both players and spectators are gone', () => {
    const room = new Room('r', 'Alice');
    const [ownerId] = [...room.players.keys()];
    room.removePlayer(ownerId);
    expect(room.isEmpty()).toBe(true);
  });

  it('spectators do not receive cards when game starts', () => {
    const room = makeRoom(2);
    room.addSpectator('spec-1', 'Charlie');
    room.startGame();
    // Spectators are not in room.players, so they have no hand
    expect(room.players.has('spec-1')).toBe(false);
  });

  it('spectators are not included in activePlayerIds', () => {
    const room = makeRoom(3);
    room.addSpectator('spec-1', 'Dave');
    room.startGame();
    expect(room.activePlayerIds).not.toContain('spec-1');
  });
});
