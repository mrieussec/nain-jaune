import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './Stats.css';

const SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

const MEDALS = ['🥇', '🥈', '🥉'];

const winRate = (p) => {
  if (!p.roundsPlayed) return '—';
  return `${Math.round((p.roundsWon / p.roundsPlayed) * 100)} %`;
};

const totalSpecial = (p) =>
  Object.values(p.specialCardsCollected).reduce((s, n) => s + n, 0);

const Stats = ({ onNavigate }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [selected, setSelected]       = useState(null); // player detail

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get(`${SERVER_URL}/api/stats`);
      setLeaderboard(data);
    } catch {
      setError('Impossible de charger les statistiques. Le serveur est-il en ligne ?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <div className="stats-container">
      <div className="stats-panel">

        {/* Header */}
        <div className="stats-header">
          <button className="btn-back" onClick={() => onNavigate('home', {})}>← Retour</button>
          <h1 className="stats-title">📊 Classement</h1>
          <button className="btn-refresh" onClick={fetchStats} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
        </div>

        {/* Body */}
        {loading && (
          <div className="stats-loading">
            <div className="spinner" />
            <p>Chargement…</p>
          </div>
        )}

        {!loading && error && (
          <div className="stats-error">{error}</div>
        )}

        {!loading && !error && leaderboard.length === 0 && (
          <div className="stats-empty">
            <p>🃏 Aucune statistique enregistrée pour l'instant.</p>
            <p>Terminez une partie pour apparaître ici !</p>
          </div>
        )}

        {!loading && !error && leaderboard.length > 0 && !selected && (
          <div className="stats-table-wrapper">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Joueur</th>
                  <th title="Manches remportées">Victoires</th>
                  <th title="Manches jouées">Parties</th>
                  <th title="Taux de victoire">% Vic.</th>
                  <th title="Meilleur gain en une manche">Meilleur gain</th>
                  <th title="Cases spéciales collectées">⭐</th>
                  <th title="7♦ collectés">7♦</th>
                  <th title="Brocantages effectués">🔒</th>
                  <th title="Fois éliminé">💀</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((p, i) => (
                  <tr
                    key={p.name}
                    className={`rank-${i + 1}`}
                    onClick={() => setSelected(p)}
                    title="Cliquer pour le détail"
                  >
                    <td className="rank-cell">
                      {i < 3 ? MEDALS[i] : <span className="rank-number">{i + 1}</span>}
                    </td>
                    <td className="name-cell">{p.name}</td>
                    <td className="num-cell wins">{p.roundsWon}</td>
                    <td className="num-cell">{p.roundsPlayed}</td>
                    <td className="num-cell rate">{winRate(p)}</td>
                    <td className="num-cell best">{p.bestRoundGain > 0 ? `+${p.bestRoundGain}` : '—'}</td>
                    <td className="num-cell">{totalSpecial(p)}</td>
                    <td className="num-cell">{p.specialCardsCollected.seven_diamonds}</td>
                    <td className="num-cell">{p.brocantagesDone}</td>
                    <td className="num-cell elim">{p.timesEliminated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="stats-hint">Cliquez sur un joueur pour le détail</p>
          </div>
        )}

        {/* Player detail card */}
        {selected && (
          <div className="player-detail">
            <button className="btn-back-detail" onClick={() => setSelected(null)}>← Classement</button>
            <h2>{selected.name}</h2>
            <div className="detail-grid">
              <div className="detail-card">
                <span className="detail-label">Parties jouées</span>
                <span className="detail-value">{selected.gamesPlayed}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Manches jouées</span>
                <span className="detail-value">{selected.roundsPlayed}</span>
              </div>
              <div className="detail-card highlight">
                <span className="detail-label">Victoires</span>
                <span className="detail-value">{selected.roundsWon}</span>
              </div>
              <div className="detail-card highlight">
                <span className="detail-label">Taux de victoire</span>
                <span className="detail-value">{winRate(selected)}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Total points gagnés</span>
                <span className="detail-value">+{selected.totalPointsGained}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Meilleur gain</span>
                <span className="detail-value">+{selected.bestRoundGain}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Brocantages</span>
                <span className="detail-value">{selected.brocantagesDone}</span>
              </div>
              <div className="detail-card">
                <span className="detail-label">Refus brocantage</span>
                <span className="detail-value">{selected.brocantagesDeclined}</span>
              </div>
              <div className="detail-card elim-card">
                <span className="detail-label">Fois éliminé</span>
                <span className="detail-value">{selected.timesEliminated}</span>
              </div>
            </div>

            <h3 className="special-title">Cases spéciales collectées</h3>
            <div className="special-grid">
              {[
                { key: 'seven_diamonds', label: '7♦ Nain Jaune', emoji: '⭐' },
                { key: 'king_hearts',    label: 'R♥',             emoji: '👑' },
                { key: 'queen_spades',   label: 'D♠',             emoji: '♠' },
                { key: 'jack_clubs',     label: 'V♣',             emoji: '♣' },
                { key: 'ten_diamonds',   label: '10♦',            emoji: '♦' },
              ].map(({ key, label, emoji }) => (
                <div key={key} className="special-card">
                  <span className="special-emoji">{emoji}</span>
                  <span className="special-label">{label}</span>
                  <span className="special-count">{selected.specialCardsCollected[key]}</span>
                </div>
              ))}
            </div>

            {selected.lastPlayed && (
              <p className="last-played">
                Dernière partie : {new Date(selected.lastPlayed).toLocaleDateString('fr-FR', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default Stats;
