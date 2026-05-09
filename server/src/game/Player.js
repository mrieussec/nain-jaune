export class Player {
  constructor(id, name, isOwner = false) {
    this.id = id;
    this.name = name;
    this.hand = [];
    this.score = 0;
    this.points = 20; // Points/argent du joueur
    this.isOwner = isOwner;
    this.isAlive = true; // Still in the game
  }

  addCard(card) {
    this.hand.push(card);
  }

  removeCard(card) {
    const index = this.hand.findIndex(c => c.suit === card.suit && c.value === card.value);
    if (index !== -1) {
      this.hand.splice(index, 1);
      return true;
    }
    return false;
  }

  getHand() {
    return this.hand.slice().sort((a, b) => {
      if (a.suit !== b.suit) return a.suit.localeCompare(b.suit);
      const valueOrder = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13 };
      return (valueOrder[a.value] || 0) - (valueOrder[b.value] || 0);
    });
  }

  getHandSize() {
    return this.hand.length;
  }

  calculateScore() {
    // Score is based on cards remaining in hand
    let score = 0;
    for (const card of this.hand) {
      if (card.value === 'A') score += 1;
      else if (card.value === 'K' || card.value === 'Q' || card.value === 'J') score += 10;
      else score += parseInt(card.value) || 0;
    }
    return score;
  }
}
