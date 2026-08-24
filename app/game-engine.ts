export type Game = 'crazy' | 'roulette' | 'blackjack';
export type Suit = '♠' | '♥' | '♦' | '♣';
export type Card = { suit: Suit; rank: string };

export const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function makeDeck(random: () => number = Math.random): Card[] {
  const deck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex], deck[index]];
  }
  return deck;
}

export function isRedCard(card: Card): boolean {
  return card.suit === '♥' || card.suit === '♦';
}

export function randomSuit(random: () => number = Math.random): Suit {
  return SUITS[Math.floor(random() * SUITS.length)];
}

export function scoreHand(hand: Card[]): number {
  let score = 0;
  let aces = 0;
  hand.forEach((card) => {
    if (card.rank === 'A') { score += 11; aces += 1; }
    else if (['J', 'Q', 'K'].includes(card.rank)) score += 10;
    else score += Number(card.rank);
  });
  while (score > 21 && aces > 0) { score -= 10; aces -= 1; }
  return score;
}

export function blackjackNetChange(outcome: 'blackjack' | 'win' | 'push' | 'loss', wager: number): number {
  if (outcome === 'blackjack') return Math.floor(wager * 1.5);
  if (outcome === 'win') return wager;
  if (outcome === 'loss') return -wager;
  return 0;
}

export function isCrazyPlayable(card: Card, top: Card, activeSuit: Suit): boolean {
  return card.rank === '8' || card.suit === activeSuit || card.rank === top.rank;
}

export function rouletteColor(number: number): 'green' | 'red' | 'black' {
  if (number === 0) return 'green';
  return RED_NUMBERS.has(number) ? 'red' : 'black';
}

export function roulettePayout(choice: string, wager: number, result: number): number {
  const color = rouletteColor(result);
  const straight = choice.startsWith('number-') && Number(choice.slice(7)) === result;
  const outside = choice === color
    || (choice === 'odd' && result > 0 && result % 2 === 1)
    || (choice === 'even' && result > 0 && result % 2 === 0);
  return straight ? wager * 36 : outside ? wager * 2 : 0;
}

export function wheelRotationForResult(currentTurn: number, result: number, fullSpins = 4): number {
  const segment = 360 / 37;
  const normalizedCurrent = ((currentTurn % 360) + 360) % 360;
  const target = (360 - result * segment) % 360;
  const alignment = (target - normalizedCurrent + 360) % 360;
  return currentTurn + fullSpins * 360 + alignment;
}
