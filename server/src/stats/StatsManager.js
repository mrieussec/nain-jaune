import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_FILE = path.resolve(__dirname, '../../../data/stats.json');

const DEFAULT_PLAYER = (name) => ({
  name,
  gamesPlayed: 0,
  roundsWon: 0,
  roundsPlayed: 0,
  totalPointsGained: 0,
  specialCardsCollected: {
    seven_diamonds: 0,
    king_hearts: 0,
    queen_spades: 0,
    jack_clubs: 0,
    ten_diamonds: 0,
  },
  brocantagesDone: 0,
  brocantagesDeclined: 0,
  timesEliminated: 0,
  bestRoundGain: 0,
  lastPlayed: null,
});

export class StatsManager {
  constructor(filePath = DEFAULT_FILE) {
    this.filePath = filePath;
    this.stats = this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  _save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.stats, null, 2), 'utf8');
    } catch (err) {
      console.error('[StatsManager] Failed to save stats:', err.message);
    }
  }

  /** Normalise les noms : trim + lowercase pour la clé, préserve la casse pour l'affichage */
  _key(name) {
    return name.trim().toLowerCase();
  }

  getOrCreate(name) {
    const key = this._key(name);
    if (!this.stats[key]) {
      this.stats[key] = DEFAULT_PLAYER(name.trim());
    }
    return this.stats[key];
  }

  /**
   * Enregistre la fin d'une manche.
   * @param {string} winnerName
   * @param {string[]} loserNames
   * @param {number} roundGain  - jetons gagnés par le vainqueur cette manche
   */
  recordRoundEnd({ winnerName, loserNames, roundGain = 0 }) {
    const winner = this.getOrCreate(winnerName);
    winner.roundsWon += 1;
    winner.roundsPlayed += 1;
    winner.totalPointsGained += roundGain;
    if (roundGain > winner.bestRoundGain) winner.bestRoundGain = roundGain;
    winner.lastPlayed = new Date().toISOString();

    for (const name of loserNames) {
      const loser = this.getOrCreate(name);
      loser.roundsPlayed += 1;
      loser.lastPlayed = new Date().toISOString();
    }

    this._save();
  }

  /**
   * Enregistre la fin d'une partie (incrémente gamesPlayed pour tous).
   * @param {string[]} allPlayerNames
   */
  recordGameEnd({ allPlayerNames }) {
    for (const name of allPlayerNames) {
      this.getOrCreate(name).gamesPlayed += 1;
    }
    this._save();
  }

  /** Enregistre qu'un joueur a été éliminé. */
  recordElimination({ playerName }) {
    this.getOrCreate(playerName).timesEliminated += 1;
    this._save();
  }

  /** Enregistre la collecte d'une case spéciale. */
  recordSpecialCard({ playerName, pileKey }) {
    const p = this.getOrCreate(playerName);
    if (pileKey in p.specialCardsCollected) {
      p.specialCardsCollected[pileKey] += 1;
    }
    this._save();
  }

  /** Enregistre un brocantage effectué. */
  recordBrocantage({ playerName }) {
    this.getOrCreate(playerName).brocantagesDone += 1;
    this._save();
  }

  /** Enregistre un refus de brocantage. */
  recordBrocantageDeclined({ playerName }) {
    this.getOrCreate(playerName).brocantagesDeclined += 1;
    this._save();
  }

  /**
   * Retourne le classement : trié par roundsWon desc, puis roundsPlayed asc (à égalité).
   */
  getLeaderboard() {
    return Object.values(this.stats).sort((a, b) => {
      if (b.roundsWon !== a.roundsWon) return b.roundsWon - a.roundsWon;
      return a.roundsPlayed - b.roundsPlayed;
    });
  }

  /** Retourne les stats d'un joueur par nom (insensible à la casse), ou null. */
  getPlayerStats(name) {
    return this.stats[this._key(name)] || null;
  }

  getAllStats() {
    return this.stats;
  }
}
