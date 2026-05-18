import { describe, it, expect, beforeEach } from 'vitest';
import { Deck } from '../Deck.js';

describe('Deck', () => {
  let deck;

  beforeEach(() => {
    deck = new Deck();
  });

  describe('createDeck()', () => {
    it('contains exactly 52 cards', () => {
      expect(deck.getSize()).toBe(52);
    });

    it('contains all 4 suits', () => {
      const suits = new Set(deck.cards.map(c => c.suit));
      expect(suits).toEqual(new Set(['Hearts', 'Diamonds', 'Clubs', 'Spades']));
    });

    it('contains all 13 values per suit', () => {
      const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      for (const suit of ['Hearts', 'Diamonds', 'Clubs', 'Spades']) {
        const suitCards = deck.cards.filter(c => c.suit === suit).map(c => c.value);
        expect(suitCards.sort()).toEqual(values.sort());
      }
    });

    it('has no duplicate cards', () => {
      const keys = deck.cards.map(c => `${c.value}-${c.suit}`);
      expect(new Set(keys).size).toBe(52);
    });
  });

  describe('drawCard()', () => {
    it('removes and returns the top card', () => {
      const sizeBefore = deck.getSize();
      const card = deck.drawCard();
      expect(card).toHaveProperty('suit');
      expect(card).toHaveProperty('value');
      expect(deck.getSize()).toBe(sizeBefore - 1);
    });

    it('returns undefined when deck is empty', () => {
      while (deck.getSize() > 0) deck.drawCard();
      expect(deck.drawCard()).toBeUndefined();
    });

    it('returns all 52 cards with no duplicates', () => {
      const drawn = [];
      while (deck.getSize() > 0) drawn.push(deck.drawCard());
      const keys = drawn.map(c => `${c.value}-${c.suit}`);
      expect(new Set(keys).size).toBe(52);
    });
  });

  describe('shuffle()', () => {
    it('keeps 52 cards after shuffle', () => {
      deck.shuffle();
      expect(deck.getSize()).toBe(52);
    });

    it('does not lose or duplicate cards after shuffle', () => {
      deck.shuffle();
      const keys = deck.cards.map(c => `${c.value}-${c.suit}`);
      expect(new Set(keys).size).toBe(52);
    });
  });
});
