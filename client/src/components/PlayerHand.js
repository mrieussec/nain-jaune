import React from 'react';
import './PlayerHand.css';
import Card from './Card';

const PlayerHand = ({ cards, onCardClick, disabled = false }) => {
  return (
    <div className="player-hand">
      <div className="hand-cards">
        {cards.map((card, index) => (
          <Card
            key={index}
            suit={card.suit}
            value={card.value}
            onClick={() => onCardClick(card)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
};

export default PlayerHand;
