import { describe, expect, it } from 'vitest';
import {
  blackjackNetChange,
  isCrazyPlayable,
  makeDeck,
  rouletteColor,
  roulettePayout,
  scoreHand,
  wheelRotationForResult,
  type Card,
} from './game-engine';

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
  it('does not treat zero as even', () => expect(roulettePayout('even', 25, 0)).toBe(0));
  it('aligns the chosen result with the wheel pointer', () => {
    const rotation = wheelRotationForResult(125, 17);
    const normalized = ((rotation % 360) + 360) % 360;
    const expected = (360 - 17 * (360 / 37)) % 360;
    expect(normalized).toBeCloseTo(expected, 8);
  });
});
