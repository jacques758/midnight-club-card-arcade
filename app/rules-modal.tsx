'use client';

import { useEffect, useRef } from 'react';
import type { Game } from './game-engine';

const rules: Record<Game, { title: string; copy: string; points: string[] }> = {
  crazy: {
    title: 'Crazy 8',
    copy: 'Be the first player to empty your hand.',
    points: ['Play a card matching the top card’s suit or rank.', 'Eights are wild—choose the suit that continues play.', 'If you cannot play, draw one card and your turn ends.'],
  },
  roulette: {
    title: 'Roulette',
    copy: 'Place a chip and spin the wheel.',
    points: ['A straight number pays 35 to 1.', 'Red, black, odd, and even bets pay 1 to 1.', 'Zero is green and does not count as even.'],
  },
  blackjack: {
    title: 'Blackjack',
    copy: 'Build a hand closer to 21 than the dealer without going over.',
    points: ['Face cards are 10; aces count as 1 or 11.', 'The dealer draws to 17 and then stands.', 'Blackjack pays 3 to 2; a regular win pays 1 to 1.'],
  },
};

export default function RulesModal({ game, onClose }: { game: Game; onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

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
      <section ref={dialogRef} className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" aria-describedby="rules-description" onMouseDown={(event) => event.stopPropagation()}>
        <button ref={closeRef} type="button" className="modal-close" onClick={onClose} aria-label="Close rules">×</button>
        <p className="eyebrow">TABLE RULES</p><h2 id="rules-title">{rules[game].title}</h2><p id="rules-description">{rules[game].copy}</p>
        <ol>{rules[game].points.map((point, index) => <li key={point}><span>0{index + 1}</span>{point}</li>)}</ol>
        <button type="button" className="primary-action" onClick={onClose}>LET’S PLAY</button>
      </section>
    </div>
  );
}
