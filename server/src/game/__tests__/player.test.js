import { describe, it, expect, beforeEach } from 'vitest';
import { Player } from '../Player.js';

describe('Player', () => {
  let player;

  beforeEach(() => {
    player = new Player('id-1', 'Alice', true);
  });

  describe('constructor', () => {
    it('sets basic properties', () => {
      expect(player.id).toBe('id-1');
      expect(player.name).toBe('Alice');
      expect(player.isOwner).toBe(true);
    });

    it('starts with 20 points', () => {
      expect(player.points).toBe(20);
    });

    it('starts with an empty hand', () => {
      expect(player.hand).toEqual([]);
    });

    it('isAlive is true by default', () => {
      expect(player.isAlive).toBe(true);
    });
  });

  describe('addCard() / removeCard()', () => {
    it('adds a card to the hand', () => {
      player.addCard({ suit: 'Hearts', value: 'A' });
      expect(player.getHandSize()).toBe(1);
    });

    it('removes an existing card and returns true', () => {
      player.addCard({ suit: 'Hearts', value: 'A' });
      const removed = player.removeCard({ suit: 'Hearts', value: 'A' });
      expect(removed).toBe(true);
      expect(player.getHandSize()).toBe(0);
    });

    it('returns false when card is not in hand', () => {
      const removed = player.removeCard({ suit: 'Spades', value: 'K' });
      expect(removed).toBe(false);
    });

    it('only removes one copy when duplicates exist (edge case)', () => {
      player.addCard({ suit: 'Hearts', value: '5' });
      player.addCard({ suit: 'Hearts', value: '5' });
      player.removeCard({ suit: 'Hearts', value: '5' });
      expect(player.getHandSize()).toBe(1);
    });
  });

  describe('getHand()', () => {
    it('returns a copy sorted by suit then value', () => {
      player.addCard({ suit: 'Spades', value: 'K' });
      player.addCard({ suit: 'Hearts', value: 'A' });
      player.addCard({ suit: 'Diamonds', value: '2' });
      player.addCard({ suit: 'Clubs', value: 'J' });
      const hand = player.getHand();
      expect(hand[0]).toEqual({ suit: 'Clubs', value: 'J' });
      expect(hand[1]).toEqual({ suit: 'Diamonds', value: '2' });
      expect(hand[2]).toEqual({ suit: 'Hearts', value: 'A' });
      expect(hand[3]).toEqual({ suit: 'Spades', value: 'K' });
    });

    it('does not mutate the internal hand', () => {
      player.addCard({ suit: 'Hearts', value: 'A' });
      const hand = player.getHand();
      hand.push({ suit: 'Clubs', value: '2' });
      expect(player.getHandSize()).toBe(1);
    });
  });

  describe('calculateScore()', () => {
    it('returns 0 for an empty hand', () => {
      expect(player.calculateScore()).toBe(0);
    });

    it('counts Ace as 1', () => {
      player.addCard({ suit: 'Hearts', value: 'A' });
      expect(player.calculateScore()).toBe(1);
    });

    it('counts numeric cards at face value', () => {
      player.addCard({ suit: 'Diamonds', value: '7' });
      player.addCard({ suit: 'Clubs', value: '10' });
      expect(player.calculateScore()).toBe(17);
    });

    it('counts J, Q, K as 10 each', () => {
      player.addCard({ suit: 'Spades', value: 'J' });
      player.addCard({ suit: 'Hearts', value: 'Q' });
      player.addCard({ suit: 'Clubs', value: 'K' });
      expect(player.calculateScore()).toBe(30);
    });

    it('sums a mixed hand correctly', () => {
      player.addCard({ suit: 'Hearts', value: 'A' });   // 1
      player.addCard({ suit: 'Diamonds', value: '5' }); // 5
      player.addCard({ suit: 'Clubs', value: 'K' });    // 10
      expect(player.calculateScore()).toBe(16);
    });
  });
});
