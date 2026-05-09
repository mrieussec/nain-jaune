import React, { useState } from 'react';
import Home from './pages/Home';
import GameRoom from './pages/GameRoom';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [pageData, setPageData] = useState({});

  const handleNavigate = (page, data) => {
    setCurrentPage(page);
    setPageData(data);
  };

  return (
    <div className="app">
      {currentPage === 'home' && (
        <Home onNavigate={handleNavigate} />
      )}
      {currentPage === 'game' && (
        <GameRoom
          roomId={pageData.roomId}
          playerName={pageData.playerName}
          onNavigate={handleNavigate}
        />
      )}
    </div>
  );
}

export default App;
