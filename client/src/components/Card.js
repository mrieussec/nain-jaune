import React, { useState, useEffect } from 'react';
import './Card.css';

const Card = ({ suit, value, onClick, disabled = false, faceDown = false }) => {
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

  return (
    <div
      className={`card ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && onClick && onClick()}
      style={{ color: getSuitColor(suit) }}
    >
      <div className="card-value">{value}</div>
      <div className="card-suit">{getSuitSymbol(suit)}</div>
    </div>
  );
};

export default Card;
