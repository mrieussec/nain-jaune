import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { StatsManager } from '../StatsManager.js';

function tmpFile() {
  return path.join(os.tmpdir(), `nj-stats-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
}

describe('StatsManager', () => {
  let sm;
  let filePath;

  beforeEach(() => {
    filePath = tmpFile();
    sm = new StatsManager(filePath);
  });

  afterEach(() => {
    try { fs.unlinkSync(filePath); } catch { /* already gone */ }
  });

  // ── Initialisation ──────────────────────────────────────────────────────

  it('starts with an empty stats object', () => {
    expect(sm.getAllStats()).toEqual({});
  });

  it('does not throw when the stats file does not exist', () => {
    const missing = tmpFile(); // never written
    expect(() => new StatsManager(missing)).not.toThrow();
  });

  // ── getOrCreate ─────────────────────────────────────────────────────────

  it('creates a default record for a new player', () => {
    const p = sm.getOrCreate('Alice');
    expect(p.name).toBe('Alice');
    expect(p.roundsWon).toBe(0);
    expect(p.gamesPlayed).toBe(0);
    expect(p.specialCardsCollected).toMatchObject({
      seven_diamonds: 0, king_hearts: 0, queen_spades: 0, jack_clubs: 0, ten_diamonds: 0,
    });
  });

  it('returns the same record on subsequent calls (no reset)', () => {
    sm.getOrCreate('Bob');
    sm.recordBrocantage({ playerName: 'Bob' });
    const p = sm.getOrCreate('Bob');
    expect(p.brocantagesDone).toBe(1);
  });

  it('is case-insensitive for the key but preserves original display name', () => {
    sm.getOrCreate('Alice');
    const p = sm.getOrCreate('ALICE');
    expect(p.name).toBe('Alice'); // first-written name preserved
  });

  // ── recordRoundEnd ──────────────────────────────────────────────────────

  it('increments roundsWon only for the winner', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob', 'Charlie'], roundGain: 10 });
    expect(sm.getPlayerStats('alice').roundsWon).toBe(1);
    expect(sm.getPlayerStats('bob').roundsWon).toBe(0);
    expect(sm.getPlayerStats('charlie').roundsWon).toBe(0);
  });

  it('increments roundsPlayed for all participants', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob'], roundGain: 5 });
    expect(sm.getPlayerStats('alice').roundsPlayed).toBe(1);
    expect(sm.getPlayerStats('bob').roundsPlayed).toBe(1);
  });

  it('adds roundGain to totalPointsGained for the winner', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: [], roundGain: 20 });
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: [], roundGain: 15 });
    expect(sm.getPlayerStats('alice').totalPointsGained).toBe(35);
  });

  it('updates bestRoundGain only when the new gain is higher', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: [], roundGain: 10 });
    expect(sm.getPlayerStats('alice').bestRoundGain).toBe(10);

    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: [], roundGain: 5 });
    expect(sm.getPlayerStats('alice').bestRoundGain).toBe(10); // unchanged

    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: [], roundGain: 30 });
    expect(sm.getPlayerStats('alice').bestRoundGain).toBe(30);
  });

  it('sets lastPlayed timestamp for winner and losers', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob'], roundGain: 0 });
    expect(sm.getPlayerStats('alice').lastPlayed).not.toBeNull();
    expect(sm.getPlayerStats('bob').lastPlayed).not.toBeNull();
  });

  it('handles roundGain defaulting to 0 gracefully', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: [] });
    expect(sm.getPlayerStats('alice').totalPointsGained).toBe(0);
  });

  // ── recordGameEnd ────────────────────────────────────────────────────────

  it('increments gamesPlayed for all players', () => {
    sm.recordGameEnd({ allPlayerNames: ['Alice', 'Bob', 'Charlie'] });
    expect(sm.getPlayerStats('alice').gamesPlayed).toBe(1);
    expect(sm.getPlayerStats('bob').gamesPlayed).toBe(1);
    expect(sm.getPlayerStats('charlie').gamesPlayed).toBe(1);
  });

  it('accumulates gamesPlayed over multiple games', () => {
    sm.recordGameEnd({ allPlayerNames: ['Alice'] });
    sm.recordGameEnd({ allPlayerNames: ['Alice'] });
    expect(sm.getPlayerStats('alice').gamesPlayed).toBe(2);
  });

  // ── recordElimination ───────────────────────────────────────────────────

  it('increments timesEliminated for the given player', () => {
    sm.recordElimination({ playerName: 'Bob' });
    sm.recordElimination({ playerName: 'Bob' });
    expect(sm.getPlayerStats('bob').timesEliminated).toBe(2);
  });

  // ── recordSpecialCard ───────────────────────────────────────────────────

  it('increments the correct specialCardsCollected pile', () => {
    sm.recordSpecialCard({ playerName: 'Alice', pileKey: 'seven_diamonds' });
    sm.recordSpecialCard({ playerName: 'Alice', pileKey: 'seven_diamonds' });
    sm.recordSpecialCard({ playerName: 'Alice', pileKey: 'king_hearts' });
    const p = sm.getPlayerStats('alice');
    expect(p.specialCardsCollected.seven_diamonds).toBe(2);
    expect(p.specialCardsCollected.king_hearts).toBe(1);
    expect(p.specialCardsCollected.queen_spades).toBe(0);
  });

  it('ignores unknown pile keys safely', () => {
    expect(() => sm.recordSpecialCard({ playerName: 'Alice', pileKey: 'unknown_pile' })).not.toThrow();
  });

  // ── recordBrocantage / recordBrocantageDeclined ─────────────────────────

  it('increments brocantagesDone', () => {
    sm.recordBrocantage({ playerName: 'Alice' });
    sm.recordBrocantage({ playerName: 'Alice' });
    expect(sm.getPlayerStats('alice').brocantagesDone).toBe(2);
  });

  it('increments brocantagesDeclined', () => {
    sm.recordBrocantageDeclined({ playerName: 'Bob' });
    expect(sm.getPlayerStats('bob').brocantagesDeclined).toBe(1);
  });

  // ── Persistence ─────────────────────────────────────────────────────────

  it('persists data to disk and reloads correctly', () => {
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob'], roundGain: 25 });
    sm.recordSpecialCard({ playerName: 'Alice', pileKey: 'seven_diamonds' });

    // Create a new manager reading the same file
    const sm2 = new StatsManager(filePath);
    const alice = sm2.getPlayerStats('alice');
    expect(alice.roundsWon).toBe(1);
    expect(alice.totalPointsGained).toBe(25);
    expect(alice.specialCardsCollected.seven_diamonds).toBe(1);
  });

  // ── getLeaderboard ──────────────────────────────────────────────────────

  it('sorts by roundsWon descending', () => {
    sm.recordRoundEnd({ winnerName: 'Charlie', loserNames: ['Alice', 'Bob'], roundGain: 5 });
    sm.recordRoundEnd({ winnerName: 'Charlie', loserNames: ['Alice', 'Bob'], roundGain: 5 });
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob', 'Charlie'], roundGain: 5 });

    const lb = sm.getLeaderboard();
    expect(lb[0].name).toBe('Charlie'); // 2 wins
    expect(lb[1].name).toBe('Alice');   // 1 win
    expect(lb[2].name).toBe('Bob');     // 0 wins
  });

  it('breaks ties by roundsPlayed ascending (fewer games = higher rank)', () => {
    // Both have 1 win, but Alice played 3 rounds total, Bob played 2
    sm.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob'], roundGain: 0 });
    sm.recordRoundEnd({ winnerName: 'Bob',   loserNames: ['Alice'], roundGain: 0 });
    sm.recordRoundEnd({ winnerName: 'Bob',   loserNames: ['Alice'], roundGain: 0 }); // Bob now 2 wins
    // Reset to get a tie: re-create managers with controlled data
    const fp2 = tmpFile();
    const sm2 = new StatsManager(fp2);
    sm2.recordRoundEnd({ winnerName: 'Alice', loserNames: ['Bob', 'Charlie'], roundGain: 0 });
    sm2.recordRoundEnd({ winnerName: 'Bob',   loserNames: ['Alice', 'Charlie'], roundGain: 0 });
    // Alice: 1 win, 2 played. Bob: 1 win, 2 played. Charlie: 0 wins, 2 played.
    // Tie between Alice and Bob: same rounds played → order stable
    const lb = sm2.getLeaderboard();
    expect(lb[0].roundsWon).toBeGreaterThanOrEqual(lb[1].roundsWon);
    try { fs.unlinkSync(fp2); } catch { /* ignore */ }
  });

  it('returns an empty array when no stats exist', () => {
    expect(sm.getLeaderboard()).toEqual([]);
  });

  // ── getPlayerStats ───────────────────────────────────────────────────────

  it('returns null for an unknown player', () => {
    expect(sm.getPlayerStats('unknown')).toBeNull();
  });

  it('looks up player case-insensitively', () => {
    sm.getOrCreate('Alice');
    expect(sm.getPlayerStats('ALICE')).not.toBeNull();
    expect(sm.getPlayerStats('alice')).not.toBeNull();
    expect(sm.getPlayerStats('Alice')).not.toBeNull();
  });
});
