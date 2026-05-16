import React from 'react';
import './Card.css';

// playable: true = highlight, false = dim, null = neutral (no sequence active)
const Card = ({ suit, value, onClick, disabled = false, faceDown = false, playable = null }) => {
  const getSuitSymbol = (suit) => {
    const symbols = {
      'Hearts': '♥',
      'Diamonds': '♦',
      'Clubs': '♣',
      'Spades': '♠'
    };
    return symbols[suit] || '';
  };

  const getSuitColor = (suit) => {
    return (suit === 'Hearts' || suit === 'Diamonds') ? 'red' : 'black';
  };

  if (faceDown) {
    return <div className="card card-back" />;
  }

  const playableClass = playable === true ? 'card-playable' : playable === false ? 'card-unplayable' : '';

  return (
    <div
      className={`card ${disabled ? 'disabled' : ''} ${playableClass}`}
      onClick={() => !disabled && onClick && onClick()}
      style={{ color: getSuitColor(suit) }}
    >
      <div className="card-value">{value}</div>
      <div className="card-suit">{getSuitSymbol(suit)}</div>
    </div>
  );
};

export default Card;
