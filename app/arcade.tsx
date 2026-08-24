'use client';

import { CSSProperties, useEffect, useRef, useState } from 'react';

type Game = 'crazy' | 'roulette' | 'blackjack';
type Suit = '♠' | '♥' | '♦' | '♣';
type Card = { suit: Suit; rank: string };
type BlackjackStatus = 'betting' | 'playing' | 'done';

const SUITS: Suit[] = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RED_NUMBERS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const games: { id: Game; name: string; icon: string; note: string }[] = [
  { id: 'crazy', name: 'Crazy 8', icon: '8', note: 'Match suit or rank' },
  { id: 'roulette', name: 'Roulette', icon: '●', note: 'Pick your lucky number' },
  { id: 'blackjack', name: 'Blackjack', icon: '21', note: 'Beat the house' },
];

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

function makeDeck() {
  const deck = SUITS.flatMap((suit) => RANKS.map((rank) => ({ suit, rank })));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function isRed(card: Card) { return card.suit === '♥' || card.suit === '♦'; }

function scoreHand(hand: Card[]) {
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

function CardView({ card, hidden = false, small = false, onClick, disabled = false }: { card: Card; hidden?: boolean; small?: boolean; onClick?: () => void; disabled?: boolean }) {
  if (hidden) return <div className={`playing-card card-back ${small ? 'small-card' : ''}`} aria-label="Hidden card"><span>M</span></div>;
  return (
    <button className={`playing-card ${isRed(card) ? 'red' : ''} ${small ? 'small-card' : ''} ${onClick ? 'playable-card' : ''}`} onClick={onClick} disabled={disabled} aria-label={`${card.rank} of ${card.suit}`}>
      <span>{card.rank}</span><i>{card.suit}</i><b>{card.suit}</b>
    </button>
  );
}

export default function Arcade() {
  const [activeGame, setActiveGame] = useState<Game>('blackjack');
  const [balance, setBalance] = useState(1000);
  const [storageReady, setStorageReady] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [crazyDeck, setCrazyDeck] = useState<Card[]>([]);
  const [crazyPlayer, setCrazyPlayer] = useState<Card[]>([]);
  const [crazyComputer, setCrazyComputer] = useState<Card[]>([]);
  const [crazyTop, setCrazyTop] = useState<Card | null>(null);
  const [crazySuit, setCrazySuit] = useState<Suit>('♠');
  const [crazyMessage, setCrazyMessage] = useState('Your turn — match the suit or rank.');
  const [crazyOver, setCrazyOver] = useState(false);
  const [pendingEight, setPendingEight] = useState<number | null>(null);

  const [rouletteBet, setRouletteBet] = useState(25);
  const [rouletteChoice, setRouletteChoice] = useState('red');
  const [rouletteResult, setRouletteResult] = useState<number | null>(null);
  const [rouletteHistory, setRouletteHistory] = useState<number[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelTurn, setWheelTurn] = useState(0);
  const [rouletteMessage, setRouletteMessage] = useState('Choose a bet, then spin the wheel.');

  const [bjDeck, setBjDeck] = useState<Card[]>([]);
  const [bjPlayer, setBjPlayer] = useState<Card[]>([]);
  const [bjDealer, setBjDealer] = useState<Card[]>([]);
  const [bjBet, setBjBet] = useState(25);
  const [bjRoundBet, setBjRoundBet] = useState(25);
  const [bjStatus, setBjStatus] = useState<BlackjackStatus>('betting');
  const [bjMessage, setBjMessage] = useState('Set your bet and deal the cards.');

  useEffect(() => {
    const saved = window.localStorage.getItem('midnight-club-chips');
    if (saved && Number.isFinite(Number(saved))) setBalance(Number(saved));
    setStorageReady(true);
    beginCrazy();
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  useEffect(() => {
    if (storageReady) window.localStorage.setItem('midnight-club-chips', String(balance));
  }, [balance, storageReady]);

  function beginCrazy() {
    const deck = makeDeck();
    const player = deck.splice(0, 7);
    const computer = deck.splice(0, 7);
    let top = deck.pop()!;
    while (top.rank === '8') { deck.unshift(top); top = deck.pop()!; }
    setCrazyDeck(deck); setCrazyPlayer(player); setCrazyComputer(computer);
    setCrazyTop(top); setCrazySuit(top.suit); setCrazyOver(false); setPendingEight(null);
    setCrazyMessage('Your turn — match the suit or rank.');
  }

  function computerTurn(player: Card[], deck: Card[], top: Card, suit: Suit) {
    const computer = [...crazyComputer];
    const index = computer.findIndex((card) => card.rank === '8' || card.suit === suit || card.rank === top.rank);
    if (index < 0) {
      const drawn = deck.pop();
      if (drawn) computer.push(drawn);
      setCrazyComputer(computer); setCrazyDeck(deck);
      setCrazyMessage(drawn ? 'The house drew a card. Your turn.' : 'The deck is empty — start a fresh round.');
      return;
    }
    const [played] = computer.splice(index, 1);
    const nextSuit = played.rank === '8' ? SUITS[Math.floor(Math.random() * SUITS.length)] : played.suit;
    setCrazyComputer(computer); setCrazyDeck(deck); setCrazyTop(played); setCrazySuit(nextSuit);
    if (computer.length === 0) { setCrazyOver(true); setCrazyMessage('The house is out of cards. Better luck next hand.'); }
    else setCrazyMessage(played.rank === '8' ? `The house played an 8 and called ${nextSuit}.` : `The house played ${played.rank}${played.suit}. Your turn.`);
    setCrazyPlayer(player);
  }

  function playCrazy(index: number, wildSuit?: Suit) {
    if (!crazyTop || crazyOver) return;
    const card = crazyPlayer[index];
    if (!(card.rank === '8' || card.suit === crazySuit || card.rank === crazyTop.rank)) {
      setCrazyMessage(`That card cannot follow ${crazyTop.rank}${crazySuit}.`); return;
    }
    if (card.rank === '8' && !wildSuit) { setPendingEight(index); setCrazyMessage('An eight is wild — choose the next suit.'); return; }
    const player = crazyPlayer.filter((_, i) => i !== index);
    const nextSuit = wildSuit || card.suit;
    setPendingEight(null); setCrazyPlayer(player); setCrazyTop(card); setCrazySuit(nextSuit);
    if (player.length === 0) { setCrazyOver(true); setCrazyMessage('You cleared your hand — you win!'); return; }
    computerTurn(player, [...crazyDeck], card, nextSuit);
  }

  function drawCrazy() {
    if (crazyOver || !crazyTop) return;
    const deck = [...crazyDeck]; const drawn = deck.pop();
    if (!drawn) { setCrazyMessage('The deck is empty — start a fresh round.'); return; }
    const player = [...crazyPlayer, drawn]; setCrazyPlayer(player); setCrazyDeck(deck);
    setCrazyMessage(`You drew ${drawn.rank}${drawn.suit}. The house takes its turn.`);
    computerTurn(player, deck, crazyTop, crazySuit);
  }

  function rouletteColor(number: number) { return number === 0 ? 'green' : RED_NUMBERS.has(number) ? 'red' : 'black'; }

  function spinRoulette() {
    if (spinning) return;
    if (balance < rouletteBet) { setRouletteMessage('Not enough chips. Reset your balance or lower the bet.'); return; }
    const choice = rouletteChoice; const wager = rouletteBet;
    setBalance((value) => value - wager); setSpinning(true); setRouletteResult(null);
    setRouletteMessage('No more bets…'); setWheelTurn((turn) => turn + 1440 + Math.floor(Math.random() * 720));
    timeoutRef.current = setTimeout(() => {
      const result = Math.floor(Math.random() * 37);
      const color = rouletteColor(result);
      const straight = choice.startsWith('number-') && Number(choice.split('-')[1]) === result;
      const outside = choice === color || (choice === 'odd' && result > 0 && result % 2 === 1) || (choice === 'even' && result > 0 && result % 2 === 0);
      const payout = straight ? wager * 36 : outside ? wager * 2 : 0;
      if (payout) setBalance((value) => value + payout);
      setRouletteResult(result); setRouletteHistory((history) => [result, ...history].slice(0, 6)); setSpinning(false);
      setRouletteMessage(payout ? `${result} ${color.toUpperCase()} — you won ${payout - wager} chips!` : `${result} ${color.toUpperCase()} — the house wins.`);
    }, 2300);
  }

  function beginBlackjack() {
    if (balance < bjBet) { setBjMessage('Not enough chips. Reset your balance or lower the bet.'); return; }
    const deck = makeDeck();
    const player = [deck.pop()!, deck.pop()!]; const dealer = [deck.pop()!, deck.pop()!];
    setBalance((value) => value - bjBet); setBjDeck(deck); setBjPlayer(player); setBjDealer(dealer); setBjRoundBet(bjBet);
    const playerScore = scoreHand(player); const dealerScore = scoreHand(dealer);
    if (playerScore === 21 || dealerScore === 21) {
      setBjStatus('done');
      if (playerScore === 21 && dealerScore === 21) { setBalance((value) => value + bjBet); setBjMessage('Two blackjacks — push. Your bet is returned.'); }
      else if (playerScore === 21) { setBalance((value) => value + Math.floor(bjBet * 2.5)); setBjMessage('Natural blackjack! You win 3 to 2.'); }
      else setBjMessage('Dealer blackjack. The house takes the hand.');
    } else { setBjStatus('playing'); setBjMessage('Hit, stand, or double down.'); }
  }

  function resolveBlackjack(player: Card[], dealerStart: Card[], deckStart: Card[], wager: number) {
    const dealer = [...dealerStart]; const deck = [...deckStart];
    while (scoreHand(dealer) < 17 && deck.length) dealer.push(deck.pop()!);
    const playerScore = scoreHand(player); const dealerScore = scoreHand(dealer);
    setBjDealer(dealer); setBjDeck(deck); setBjStatus('done');
    if (dealerScore > 21 || playerScore > dealerScore) { setBalance((value) => value + wager * 2); setBjMessage(dealerScore > 21 ? `Dealer busts with ${dealerScore} — you win!` : `${playerScore} beats ${dealerScore} — you win!`); }
    else if (playerScore === dealerScore) { setBalance((value) => value + wager); setBjMessage(`${playerScore} to ${dealerScore} — push. Your bet is returned.`); }
    else setBjMessage(`Dealer wins ${dealerScore} to ${playerScore}.`);
  }

  function hitBlackjack() {
    if (bjStatus !== 'playing') return;
    const deck = [...bjDeck]; const card = deck.pop(); if (!card) return;
    const player = [...bjPlayer, card]; setBjPlayer(player); setBjDeck(deck);
    const score = scoreHand(player);
    if (score > 21) { setBjStatus('done'); setBjMessage(`${score} — bust. The house wins.`); }
    else if (score === 21) setBjMessage('Twenty-one. Stand to reveal the dealer.');
    else setBjMessage(`${score}. Hit again or stand.`);
  }

  function doubleBlackjack() {
    if (bjStatus !== 'playing' || bjPlayer.length !== 2) return;
    if (balance < bjRoundBet) { setBjMessage('Not enough chips to double.'); return; }
    setBalance((value) => value - bjRoundBet);
    const wager = bjRoundBet * 2; setBjRoundBet(wager);
    const deck = [...bjDeck]; const player = [...bjPlayer, deck.pop()!]; setBjPlayer(player); setBjDeck(deck);
    if (scoreHand(player) > 21) { setBjStatus('done'); setBjMessage(`${scoreHand(player)} — bust on the double.`); }
    else resolveBlackjack(player, bjDealer, deck, wager);
  }

  function resetBlackjack() { setBjPlayer([]); setBjDealer([]); setBjDeck([]); setBjStatus('betting'); setBjMessage('Set your bet and deal the cards.'); }

  const activeName = games.find((game) => game.id === activeGame)!.name;

  return (
    <main className="arcade-shell">
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label="Midnight Club home"><span className="brand-mark">M</span><span>MIDNIGHT <b>CLUB</b></span></a>
        <button className="balance-pill" onClick={() => setBalance(1000)} title="Reset chips to 1,000"><span>◎</span><small>TABLE CHIPS · TAP TO RESET</small><strong>{balance.toLocaleString()}</strong></button>
      </header>

      <section className="intro">
        <p className="eyebrow">THE HOUSE IS OPEN</p>
        <h1>Three tables.<br/><em>One lucky night.</em></h1>
        <p>Classic card-room games, reimagined for your screen. No sign-up, no real money—just shuffle, spin, and play.</p>
      </section>

      <nav className="game-tabs" aria-label="Choose a game">
        {games.map((game) => <button className={`game-tab ${activeGame === game.id ? 'active' : ''}`} key={game.id} onClick={() => setActiveGame(game.id)} aria-pressed={activeGame === game.id}><span className="tab-icon">{game.icon}</span><span><strong>{game.name}</strong><small>{game.note}</small></span></button>)}
      </nav>

      <section className="table-wrap" aria-label={`${activeName} table`}>
        <div className="table-topline"><div><span className="live-dot"/> {activeName.toUpperCase()} · TABLE 0{games.findIndex((g) => g.id === activeGame) + 1}</div><button className="rules-button" onClick={() => setShowRules(true)}>ⓘ &nbsp; HOW TO PLAY</button></div>

        {activeGame === 'crazy' && <>
          <div className="crazy-table">
            <div className="opponent-zone"><p>THE HOUSE <b>{crazyComputer.length}</b></p><div className="computer-hand">{crazyComputer.map((_, index) => <CardView key={index} card={{rank:'A',suit:'♠'}} hidden small />)}</div></div>
            <div className="crazy-center"><div className="draw-stack" aria-label="Draw pile"><span>M</span></div>{crazyTop && <CardView card={crazyTop} />}{crazyTop && <div className="called-suit">ACTIVE SUIT <b>{crazySuit}</b></div>}</div>
            <div className="player-zone"><p>YOUR HAND <b>{crazyPlayer.length}</b></p><div className="crazy-hand">{crazyPlayer.map((card, index) => <CardView key={`${card.rank}${card.suit}`} card={card} onClick={() => playCrazy(index)} disabled={crazyOver} />)}</div></div>
          </div>
          {pendingEight !== null && <div className="suit-picker"><span>CALL A SUIT</span>{SUITS.map((suit) => <button key={suit} className={suit === '♥' || suit === '♦' ? 'red-suit' : ''} onClick={() => playCrazy(pendingEight, suit)}>{suit}</button>)}</div>}
          <div className="action-dock status-dock"><p className="game-status" aria-live="polite">{crazyMessage}</p>{crazyOver ? <button className="primary-action" onClick={beginCrazy}>NEW HAND</button> : <button className="primary-action" onClick={drawCrazy}>DRAW CARD</button>}</div>
        </>}

        {activeGame === 'roulette' && <>
          <div className="roulette-table">
            <div className="wheel-stage"><div className={`roulette-wheel ${spinning ? 'spinning' : ''}`} style={{'--wheel-spin': `${wheelTurn}deg`} as CSSProperties}><div className="wheel-ring"><span>0</span></div><div className="wheel-center"><small>RESULT</small><b>{rouletteResult ?? '—'}</b></div></div><div className="wheel-pointer">◆</div><div className="history-row">{rouletteHistory.length ? rouletteHistory.map((number, i) => <span key={`${number}-${i}`} className={rouletteColor(number)}>{number}</span>) : <small>RECENT SPINS APPEAR HERE</small>}</div></div>
            <div className="betting-board"><div className="number-grid"><button className={`number-cell zero ${rouletteChoice === 'number-0' ? 'selected' : ''}`} onClick={() => setRouletteChoice('number-0')}>0</button>{Array.from({length:36},(_,i)=>i+1).map((number)=><button key={number} className={`number-cell ${rouletteColor(number)} ${rouletteChoice === `number-${number}` ? 'selected' : ''}`} onClick={()=>setRouletteChoice(`number-${number}`)}>{number}</button>)}</div><div className="outside-bets">{['red','black','odd','even'].map((bet)=><button key={bet} className={`${bet} ${rouletteChoice===bet?'selected':''}`} onClick={()=>setRouletteChoice(bet)}>{bet.toUpperCase()}</button>)}</div><p className="bet-note">Selected: <b>{rouletteChoice.replace('number-','Number ')}</b></p></div>
          </div>
          <div className="action-dock roulette-dock"><div className="chip-row">{[10,25,50,100].map((chip)=><button key={chip} className={`chip ${rouletteBet===chip?'active':''}`} onClick={()=>setRouletteBet(chip)} disabled={spinning}>{chip}</button>)}</div><p className="game-status" aria-live="polite">{rouletteMessage}</p><button className="primary-action spin-button" onClick={spinRoulette} disabled={spinning}>{spinning?'SPINNING…':`SPIN · ${rouletteBet}`}</button></div>
        </>}

        {activeGame === 'blackjack' && <>
          <div className="blackjack-table">
            <div className="dealer-side"><p>DEALER <b>{bjDealer.length ? (bjStatus === 'playing' ? scoreHand(bjDealer.slice(0,1)) : scoreHand(bjDealer)) : '—'}</b></p><div className="hand">{bjDealer.length ? bjDealer.map((card,index)=><CardView key={`${card.rank}${card.suit}-${index}`} card={card} hidden={index===1 && bjStatus==='playing'} />) : <div className="empty-hand">DEALER</div>}</div></div>
            <div className="table-message"><span>BLACKJACK PAYS 3 TO 2</span><b>21</b><small>Dealer stands on 17</small></div>
            <div className="player-side"><div className="hand">{bjPlayer.length ? bjPlayer.map((card,index)=><CardView key={`${card.rank}${card.suit}-${index}`} card={card} />) : <div className="deck-ready"><span>M</span></div>}</div><p>YOUR HAND <b>{bjPlayer.length ? scoreHand(bjPlayer) : '—'}</b></p></div>
          </div>
          <div className="action-dock blackjack-dock">
            <div className="bet-controls"><small>{bjStatus==='playing'?'ROUND BET':'CHOOSE BET'}</small><div>{[10,25,50,100].map((chip)=><button key={chip} className={`chip ${bjBet===chip?'active':''}`} onClick={()=>setBjBet(chip)} disabled={bjStatus==='playing'}>{chip}</button>)}</div></div>
            <p className="game-status" aria-live="polite">{bjMessage}</p>
            <div className="bj-actions">{bjStatus==='betting' && <button className="primary-action" onClick={beginBlackjack}>DEAL · {bjBet}</button>}{bjStatus==='playing' && <><button className="secondary-action" onClick={doubleBlackjack} disabled={bjPlayer.length!==2}>DOUBLE</button><button className="primary-action" onClick={hitBlackjack}>HIT</button><button className="secondary-action" onClick={()=>resolveBlackjack(bjPlayer,bjDealer,bjDeck,bjRoundBet)}>STAND</button></>}{bjStatus==='done' && <button className="primary-action" onClick={resetBlackjack}>NEW HAND</button>}</div>
          </div>
        </>}
      </section>

      <footer><span>PLAY FOR FUN · NO REAL MONEY</span><span>♣ &nbsp; FAIR SHUFFLE &nbsp; ♦</span></footer>

      {showRules && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowRules(false)}><section className="rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onMouseDown={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setShowRules(false)} aria-label="Close rules">×</button><p className="eyebrow">TABLE RULES</p><h2 id="rules-title">{rules[activeGame].title}</h2><p>{rules[activeGame].copy}</p><ol>{rules[activeGame].points.map((point,index)=><li key={point}><span>0{index+1}</span>{point}</li>)}</ol><button className="primary-action" onClick={()=>setShowRules(false)}>LET’S PLAY</button></section></div>}
    </main>
  );
}
