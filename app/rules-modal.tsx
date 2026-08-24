'use client';

import { useEffect, useRef } from 'react';
import type { Game } from './game-engine';

type RuleBook = {
  title: string;
  icon: string;
  summary: string;
  facts: { label: string; value: string }[];
  sections: { title: string; points: string[] }[];
  payouts?: { bet: string; winsWhen: string; payout: string }[];
  houseNote: string;
};

const rules: Record<Game, RuleBook> = {
  crazy: {
    title: 'Crazy 8',
    icon: '8',
    summary: 'Be the first player to get rid of every card in your hand.',
    facts: [{ label: 'PLAYERS', value: 'You vs. house' }, { label: 'DEAL', value: '7 cards each' }, { label: 'DECK', value: '52 cards' }],
    sections: [
      { title: 'Starting the hand', points: [
        'A fresh 52-card deck is shuffled for every hand. You and the house receive seven cards each.',
        'One non-eight card is placed face up to begin the discard pile. Its suit becomes the active suit.',
        'You always take the first turn.',
      ] },
      { title: 'Playing a turn', points: [
        'Play one card that matches either the rank or the active suit of the face-up card.',
        'Any eight is wild and can be played at any time. After playing it, choose hearts, diamonds, clubs, or spades as the new active suit.',
        'If you do not play a card, draw one card. Your turn then ends, even if the drawn card could have been played.',
      ] },
      { title: 'The house turn', points: [
        'The house plays the first legal card it finds. When it plays an eight, it selects a new suit at random.',
        'If the house has no legal card, it draws one card and ends its turn. It does not immediately play the card it drew.',
      ] },
      { title: 'Winning and edge cases', points: [
        'The first player to empty their hand wins immediately.',
        'If the draw pile becomes empty, the hand stops without declaring a winner. Start a new hand to continue.',
        'There are no stacking, draw-two, skip, reverse, scoring, or last-card announcement rules in this version.',
      ] },
    ],
    houseNote: 'Arcade rule: drawing always ends the turn, and special effects belong only to eights.',
  },
  roulette: {
    title: 'European Roulette',
    icon: '●',
    summary: 'Choose one bet, select your stake, and predict where the ball will land.',
    facts: [{ label: 'POCKETS', value: '0–36' }, { label: 'ZERO', value: 'Single green 0' }, { label: 'BETS', value: 'One per spin' }],
    sections: [
      { title: 'Placing a bet', points: [
        'Choose a chip worth 10, 25, 50, or 100 virtual chips.',
        'Select one number or one outside bet. Your selected wager is reserved when the wheel starts spinning.',
        'You may change the selection or chip before spinning, but not while the wheel is moving.',
      ] },
      { title: 'Available outside bets', points: [
        'Red or Black wins when the ball lands on a number of the selected color.',
        'Odd or Even covers the matching non-zero numbers. Low covers 1–18; High covers 19–36.',
        'First, Second, and Third Dozen cover 1–12, 13–24, and 25–36.',
        'Column 1 covers 1, 4, 7 … 34; Column 2 covers 2, 5, 8 … 35; Column 3 covers 3, 6, 9 … 36.',
      ] },
      { title: 'Spin and settlement', points: [
        'The wheel produces one result from 0 through 36. The result, color, and chip change appear after the ball settles.',
        'A winning wager returns its stake plus the listed profit. A losing wager removes the selected stake.',
        'Zero is green. It loses for red, black, odd, even, low, high, every dozen, and every column.',
      ] },
    ],
    payouts: [
      { bet: 'Single number', winsWhen: 'Exact selected number', payout: '35:1 profit' },
      { bet: 'Red / Black', winsWhen: 'Selected color', payout: '1:1 profit' },
      { bet: 'Odd / Even', winsWhen: 'Selected parity, excluding 0', payout: '1:1 profit' },
      { bet: 'Low / High', winsWhen: '1–18 or 19–36', payout: '1:1 profit' },
      { bet: 'Dozen', winsWhen: 'Selected group of twelve', payout: '2:1 profit' },
      { bet: 'Column', winsWhen: 'Selected vertical column', payout: '2:1 profit' },
    ],
    houseNote: 'This is single-zero European Roulette. Only one wager can be active on each spin.',
  },
  blackjack: {
    title: 'Blackjack',
    icon: '21',
    summary: 'Finish closer to 21 than the dealer without going over 21.',
    facts: [{ label: 'DECK', value: 'Fresh 52 cards' }, { label: 'DEALER', value: 'Stands on all 17s' }, { label: 'BLACKJACK', value: 'Pays 3:2' }],
    sections: [
      { title: 'Card values and the deal', points: [
        'Cards 2–10 count at face value. Jacks, queens, and kings count as 10. An ace counts as 11 unless counting it as 1 prevents a bust.',
        'Choose a 10, 25, 50, or 100 chip wager. You and the dealer then receive two cards from a newly shuffled deck.',
        'Both player cards are visible. The dealer shows one card and keeps the second hidden until the player finishes.',
      ] },
      { title: 'Natural blackjack', points: [
        'An ace plus any ten-value card in the first two cards is a natural blackjack.',
        'Your natural blackjack pays 3 to 2. If both you and the dealer have blackjack, the result is a push.',
        'If only the dealer has blackjack, the wager loses immediately.',
      ] },
      { title: 'Your decisions', points: [
        'Hit takes another card. You may continue hitting until you stand, reach 21, or exceed 21.',
        'Stand ends your turn and reveals the dealer’s hidden card.',
        'Double is available only on your original two cards and only when enough chips are available. It doubles the wager, deals exactly one card, and then automatically stands.',
        'Exceeding 21 is a bust and loses immediately, even if the dealer would also have busted.',
      ] },
      { title: 'Dealer play and results', points: [
        'After you stand, the dealer draws while below 17 and stands on every 17, including soft 17.',
        'You win if the dealer busts or your total is higher. A normal win pays 1 to 1.',
        'Equal totals are a push with no chip change. Otherwise, the dealer wins and your wager is lost.',
      ] },
      { title: 'Options not used at this table', points: [
        'Splitting pairs, insurance, surrender, side bets, and multiple simultaneous hands are not available.',
        'The hand uses a fresh single deck. Dealer blackjack is resolved immediately after the deal, and insurance is not offered.',
      ] },
    ],
    payouts: [
      { bet: 'Natural blackjack', winsWhen: 'Ace + ten-value opening hand', payout: '3:2 profit' },
      { bet: 'Regular win', winsWhen: 'Beat dealer or dealer busts', payout: '1:1 profit' },
      { bet: 'Push', winsWhen: 'Equal totals', payout: 'Stake returned' },
      { bet: 'Loss / bust', winsWhen: 'Dealer wins or player exceeds 21', payout: 'Stake lost' },
    ],
    houseNote: 'Dealer rule: draw to 16 and stand on all 17s. Blackjack is recognized only on the opening two cards.',
  },
};

export default function RulesModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const book = rules[game];

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="rules-modal complete-rules" role="dialog" aria-modal="true" aria-labelledby="rules-title" aria-describedby="rules-description" onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Close rules">×</button>
        <header className="rules-header"><div className="rules-emblem" aria-hidden="true">{book.icon}</div><div><p className="eyebrow">COMPLETE TABLE RULES</p><h2 id="rules-title">{book.title}</h2><p id="rules-description">{book.summary}</p></div></header>
        <div className="rules-facts">{book.facts.map((fact) => <div key={fact.label}><small>{fact.label}</small><strong>{fact.value}</strong></div>)}</div>
        <div className="rules-scroll">
          <div className="rule-sections">{book.sections.map((section, index) => <article className="rule-section" key={section.title}><h3><span>{String(index + 1).padStart(2, '0')}</span>{section.title}</h3><ul>{section.points.map((point) => <li key={point}>{point}</li>)}</ul></article>)}</div>
          {book.payouts && <section className="payout-section"><div className="rules-section-heading"><p className="eyebrow">PAYOUT REFERENCE</p><h3>What each result returns</h3></div><div className="payout-table" role="table" aria-label={`${book.title} payouts`}><div className="payout-row payout-head" role="row"><span role="columnheader">BET / RESULT</span><span role="columnheader">WIN CONDITION</span><span role="columnheader">PAYOUT</span></div>{book.payouts.map((payout) => <div className="payout-row" role="row" key={payout.bet}><strong role="cell">{payout.bet}</strong><span role="cell">{payout.winsWhen}</span><b role="cell">{payout.payout}</b></div>)}</div></section>}
          <aside className="house-rule-note"><span>HOUSE RULE</span><p>{book.houseNote}</p></aside>
        </div>
        <footer className="rules-footer"><span>Virtual chips only · No real-money wagering</span><button type="button" className="primary-action" onClick={onClose}>I UNDERSTAND · PLAY</button></footer>
      </section>
    </div>
  );
}
