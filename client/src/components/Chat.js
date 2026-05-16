import React, { useState, useEffect, useRef } from 'react';
import './Chat.css';

const Chat = ({ roomId, playerName, socketService }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    socketService.onMessageReceived((data) => {
      setMessages(prev => [...prev, {
        playerName: data.playerName,
        message: data.message,
        timestamp: new Date(data.timestamp)
      }]);
    });

    return () => {
      socketService.offMessageReceived();
    };
  }, [socketService]);

  // Auto-scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = () => {
    if (input.trim()) {
      socketService.sendMessage(roomId, input, playerName);
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className="chat-message">
            <strong>{msg.playerName}:</strong> {msg.message}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          placeholder="Écrivez un message..."
        />
        <button onClick={handleSendMessage}>Envoyer</button>
      </div>
    </div>
  );
};

export default Chat;
