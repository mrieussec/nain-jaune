import React from 'react';
import './PlayerHand.css';
import Card from './Card';

// canPlayCard: optional function (card) => bool for highlighting playable cards
const PlayerHand = ({ cards, onCardClick, disabled = false, canPlayCard = null }) => {
  return (
    <div className="player-hand">
      <div className="hand-cards">
        {cards.map((card, index) => {
          const playable = canPlayCard ? canPlayCard(card) : null;
          return (
            <Card
              key={index}
              suit={card.suit}
              value={card.value}
              onClick={() => onCardClick(card)}
              disabled={disabled}
              playable={playable}
            />
          );
        })}
      </div>
    </div>
  );
};

export default PlayerHand;
