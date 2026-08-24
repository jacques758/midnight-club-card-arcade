'use client';

import { isRedCard, type Card } from './game-engine';

export default function CardView({ card, hidden = false, small = false, onClick, disabled = false }: { card: Card; hidden?: boolean; small?: boolean; onClick?: () => void; disabled?: boolean }) {
  if (hidden) return <div className={`playing-card card-back ${small ? 'small-card' : ''}`} role="img" aria-label="Hidden card"><span>M</span></div>;
  return (
    <button type="button" className={`playing-card ${isRedCard(card) ? 'red' : ''} ${small ? 'small-card' : ''} ${onClick ? 'playable-card' : ''}`} onClick={onClick} disabled={disabled} aria-label={`${card.rank} ${card.suit}`}>
      <span>{card.rank}</span><i aria-hidden="true">{card.suit}</i><b aria-hidden="true">{card.suit}</b>
    </button>
  );
}
