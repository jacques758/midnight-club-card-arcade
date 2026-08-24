import { describe, expect, it } from 'vitest';
import {
  blackjackNetChange,
  DEFAULT_STATS,
  isCrazyPlayable,
  makeDeck,
  rouletteColor,
  roulettePayout,
  recordRound,
  scoreHand,
  wheelRotationForResult,
  type Card,
} from './game-engine';
import { applyProgressionEvent, createDefaultProgression, getDailyChallenge, levelFromXp, levelProgress, normalizeProgression } from './progression';

const card = (rank: string, suit: Card['suit'] = '♠'): Card => ({ rank, suit });

describe('deck', () => {
  it('contains 52 unique cards', () => {
    const deck = makeDeck(() => 0.5);
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((item) => `${item.rank}${item.suit}`)).size).toBe(52);
  });
});

describe('blackjack scoring', () => {
  it('scores face cards as ten', () => expect(scoreHand([card('K'), card('Q')])).toBe(20));
  it('reduces aces from eleven to one when needed', () => expect(scoreHand([card('A'), card('A'), card('9')])).toBe(21));
  it('detects a bust', () => expect(scoreHand([card('K'), card('8'), card('5')])).toBe(23));
  it('calculates net changes after an unsettled wager', () => {
    expect(blackjackNetChange('blackjack', 100)).toBe(150);
    expect(blackjackNetChange('win', 100)).toBe(100);
    expect(blackjackNetChange('push', 100)).toBe(0);
    expect(blackjackNetChange('loss', 100)).toBe(-100);
  });
});

describe('Crazy 8 legality', () => {
  const top = card('5', '♣');
  it('allows a matching suit', () => expect(isCrazyPlayable(card('K', '♣'), top, '♣')).toBe(true));
  it('allows a matching rank', () => expect(isCrazyPlayable(card('5', '♥'), top, '♣')).toBe(true));
  it('allows an eight as wild', () => expect(isCrazyPlayable(card('8', '♦'), top, '♣')).toBe(true));
  it('rejects a non-match', () => expect(isCrazyPlayable(card('3', '♦'), top, '♣')).toBe(false));
});

describe('roulette', () => {
  it('classifies zero and standard colors', () => {
    expect(rouletteColor(0)).toBe('green');
    expect(rouletteColor(1)).toBe('red');
    expect(rouletteColor(2)).toBe('black');
  });
  it('pays 36 times the stake for a straight number', () => expect(roulettePayout('number-17', 25, 17)).toBe(900));
  it('pays two times the stake for outside bets', () => expect(roulettePayout('red', 25, 1)).toBe(50));
  it('supports high, low, dozen, and column bets', () => {
    expect(roulettePayout('low', 25, 18)).toBe(50);
    expect(roulettePayout('high', 25, 19)).toBe(50);
    expect(roulettePayout('dozen-2', 25, 17)).toBe(75);
    expect(roulettePayout('column-3', 25, 36)).toBe(75);
    expect(roulettePayout('column-1', 25, 36)).toBe(0);
  });
  it('does not treat zero as even', () => expect(roulettePayout('even', 25, 0)).toBe(0));
  it('aligns the chosen result with the wheel pointer', () => {
    const rotation = wheelRotationForResult(125, 17);
    const normalized = ((rotation % 360) + 360) % 360;
    const expected = (360 - 17 * (360 / 37)) % 360;
    expect(normalized).toBeCloseTo(expected, 8);
  });
});

describe('player statistics', () => {
  it('records wins, streaks, and chip totals', () => {
    const first = recordRound(DEFAULT_STATS, 'win', 50);
    const second = recordRound(first, 'win', 100);
    expect(second).toMatchObject({ rounds: 2, wins: 2, biggestWin: 100, netChips: 150, currentStreak: 2, bestStreak: 2 });
  });
  it('resets the current streak after a loss', () => {
    const win = recordRound(DEFAULT_STATS, 'win', 25);
    const loss = recordRound(win, 'loss', -25);
    expect(loss).toMatchObject({ rounds: 2, wins: 1, losses: 1, currentStreak: 0, bestStreak: 1, netChips: 0 });
  });
});

describe('player progression', () => {
  const date = '2026-08-24';

  it('calculates levels and progress toward the next level', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(500)).toBe(3);
    expect(levelProgress(575)).toMatchObject({ current: 75, target: 250, percent: 30 });
  });

  it('awards more XP for a win than a loss', () => {
    const start = createDefaultProgression(date);
    const winStats = recordRound(DEFAULT_STATS, 'win', 25);
    const lossStats = recordRound(DEFAULT_STATS, 'loss', -25);
    expect(applyProgressionEvent(start, { game: 'blackjack', outcome: 'win' }, winStats, date).xpEarned).toBeGreaterThan(
      applyProgressionEvent(start, { game: 'blackjack', outcome: 'loss' }, lossStats, date).xpEarned,
    );
  });

  it('unlocks the first-win achievement', () => {
    const stats = recordRound(DEFAULT_STATS, 'win', 25);
    const result = applyProgressionEvent(createDefaultProgression(date), { game: 'crazy', outcome: 'win' }, stats, date);
    expect(result.newlyUnlocked).toContain('first_win');
    expect(result.state.gameWins.crazy).toBe(1);
    expect(result.state.history[0]).toMatchObject({ game: 'crazy', outcome: 'win', netChips: 0 });
  });

  it('resets an expired daily challenge while preserving lifetime progress', () => {
    const old = { ...createDefaultProgression('2026-08-23'), xp: 425, unlocked: ['first_win' as const], daily: { date: '2026-08-23', progress: 3, completed: true } };
    expect(normalizeProgression(old, date)).toMatchObject({ xp: 425, unlocked: ['first_win'], daily: { date, progress: 0, completed: false } });
  });

  it('selects the same daily challenge for the same date', () => {
    expect(getDailyChallenge(date)).toEqual(getDailyChallenge(date));
  });

  it('preserves valid theme and tutorial rewards', () => {
    const profile = { ...createDefaultProgression(date), theme: 'sapphire' as const, tutorialsSeen: ['crazy' as const] };
    expect(normalizeProgression(profile, date)).toMatchObject({ theme: 'sapphire', tutorialsSeen: ['crazy'] });
  });
});
