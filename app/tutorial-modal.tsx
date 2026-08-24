'use client';

import { useEffect, useState } from 'react';
import type { Game } from './game-engine';

const TUTORIALS: Record<Game, { icon: string; title: string; body: string; tip: string }[]> = {
  crazy: [
    { icon: '♣', title: 'Match the table', body: 'Play a card with the same suit or rank as the discard card.', tip: 'Playable cards lift when you hover or focus them.' },
    { icon: '8', title: 'Eights are wild', body: 'Play any eight, then choose the suit the house must follow.', tip: 'Save an eight when your hand has difficult cards.' },
    { icon: '✓', title: 'Clear your hand', body: 'The first player with no cards wins the round and earns 100 XP.', tip: 'If nothing matches, draw a card and pass the turn.' },
  ],
  roulette: [
    { icon: '◎', title: 'Choose your coverage', body: 'Pick one number or use an outside, dozen, or column bet.', tip: 'Wider bets win more often but pay less.' },
    { icon: '◆', title: 'Set your chip', body: 'Choose a chip value. It becomes your stake for the next spin.', tip: 'Number bets pay 35 to 1; dozens and columns pay 2 to 1.' },
    { icon: '●', title: 'Spin the wheel', body: 'Press Spin and wait for the ball to settle. Your balance updates automatically.', tip: 'Zero is green and never counts as odd, even, high, or low.' },
  ],
  blackjack: [
    { icon: '21', title: 'Get close to 21', body: 'Build a hand closer to 21 than the dealer without going over.', tip: 'Aces count as 11 or 1—whichever helps your hand.' },
    { icon: '+', title: 'Hit, stand, or double', body: 'Hit for another card, stand to reveal the dealer, or double your opening bet for one final card.', tip: 'The dealer must draw to 16 and stand on 17.' },
    { icon: '♠', title: 'Natural blackjack', body: 'An ace with a ten-value card is blackjack and pays 3 to 2.', tip: 'A normal win pays 1 to 1 and a tie returns your stake.' },
  ],
};

export default function TutorialModal({ game, onClose, onComplete }: { game: Game; onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const pages = TUTORIALS[game];
  const page = pages[step];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function next() {
    if (step === pages.length - 1) onComplete();
    else setStep((current) => current + 1);
  }

  return <div className="tutorial-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="tutorial-modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <button type="button" className="tutorial-close" onClick={onClose} aria-label="Close tutorial">×</button>
      <div className="tutorial-progress" aria-label={`Step ${step + 1} of ${pages.length}`}>{pages.map((_, index) => <span key={index} className={index <= step ? 'active' : ''}/>)}</div>
      <div className="tutorial-icon" aria-hidden="true">{page.icon}</div>
      <p className="eyebrow">QUICK TOUR · {step + 1} OF {pages.length}</p>
      <h2 id="tutorial-title">{page.title}</h2>
      <p>{page.body}</p>
      <aside><span>PRO TIP</span>{page.tip}</aside>
      <div className="tutorial-actions"><button type="button" className="secondary-action" onClick={step ? () => setStep((current) => current - 1) : onClose}>{step ? 'BACK' : 'SKIP'}</button><button type="button" className="primary-action" onClick={next}>{step === pages.length - 1 ? 'TAKE A SEAT' : 'NEXT'}</button></div>
    </section>
  </div>;
}
