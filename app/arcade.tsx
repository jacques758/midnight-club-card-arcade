'use client';

import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useBalance } from './balance-store';
import CardView from './card-view';
import {
  SUITS,
  blackjackNetChange,
  isCrazyPlayable,
  makeDeck,
  rouletteColor,
  roulettePayout,
  randomSuit,
  scoreHand,
  wheelRotationForResult,
  type Card,
  type Game,
  type Suit,
} from './game-engine';
import RulesModal from './rules-modal';

type BlackjackStatus = 'betting' | 'playing' | 'done';
const games: { id: Game; name: string; icon: string; note: string }[] = [
  { id: 'crazy', name: 'Crazy 8', icon: '8', note: 'Match suit or rank' },
  { id: 'roulette', name: 'Roulette', icon: '●', note: 'Pick your lucky number' },
  { id: 'blackjack', name: 'Blackjack', icon: '21', note: 'Beat the house' },
];


export default function Arcade() {
  const [activeGame, setActiveGame] = useState<Game>('blackjack');
  const [balance, setBalance] = useBalance();
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

  const beginCrazy = useCallback(() => {
    const deck = makeDeck();
    const player = deck.splice(0, 7);
    const computer = deck.splice(0, 7);
    let top = deck.pop()!;
    while (top.rank === '8') { deck.unshift(top); top = deck.pop()!; }
    setCrazyDeck(deck); setCrazyPlayer(player); setCrazyComputer(computer);
    setCrazyTop(top); setCrazySuit(top.suit); setCrazyOver(false); setPendingEight(null);
    setCrazyMessage('Your turn — match the suit or rank.');
  }, []);

  useEffect(() => {
    const setup = window.setTimeout(beginCrazy, 0);
    return () => {
      window.clearTimeout(setup);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [beginCrazy]);

  function computerTurn(player: Card[], deck: Card[], top: Card, suit: Suit) {
    const computer = [...crazyComputer];
    const index = computer.findIndex((card) => isCrazyPlayable(card, top, suit));
    if (index < 0) {
      const drawn = deck.pop();
      if (drawn) computer.push(drawn);
      setCrazyComputer(computer); setCrazyDeck(deck);
      setCrazyMessage(drawn ? 'The house drew a card. Your turn.' : 'The deck is empty — start a fresh round.');
      return;
    }
    const [played] = computer.splice(index, 1);
    const nextSuit = played.rank === '8' ? randomSuit() : played.suit;
    setCrazyComputer(computer); setCrazyDeck(deck); setCrazyTop(played); setCrazySuit(nextSuit);
    if (computer.length === 0) { setCrazyOver(true); setCrazyMessage('The house is out of cards. Better luck next hand.'); }
    else setCrazyMessage(played.rank === '8' ? `The house played an 8 and called ${nextSuit}.` : `The house played ${played.rank}${played.suit}. Your turn.`);
    setCrazyPlayer(player);
  }

  function playCrazy(index: number, wildSuit?: Suit) {
    if (!crazyTop || crazyOver) return;
    const card = crazyPlayer[index];
    if (!isCrazyPlayable(card, crazyTop, crazySuit)) {
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
    if (!drawn) { setCrazyOver(true); setCrazyMessage('The draw pile is empty. Start a fresh hand.'); return; }
    const player = [...crazyPlayer, drawn]; setCrazyPlayer(player); setCrazyDeck(deck);
    setCrazyMessage(`You drew ${drawn.rank}${drawn.suit}. The house takes its turn.`);
    computerTurn(player, deck, crazyTop, crazySuit);
  }

  function spinRoulette() {
    if (spinning) return;
    if (balance < rouletteBet) { setRouletteMessage('Not enough chips. Reset your balance or lower the bet.'); return; }
    const choice = rouletteChoice; const wager = rouletteBet;
    const result = Math.floor(Math.random() * 37);
    setSpinning(true); setRouletteResult(null);
    setRouletteMessage('No more bets…'); setWheelTurn((turn) => wheelRotationForResult(turn, result));
    const spinDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 2300;
    timeoutRef.current = setTimeout(() => {
      const color = rouletteColor(result);
      const payout = roulettePayout(choice, wager, result);
      setBalance((value) => value - wager + payout);
      setRouletteResult(result); setRouletteHistory((history) => [result, ...history].slice(0, 6)); setSpinning(false);
      setRouletteMessage(payout ? `${result} ${color.toUpperCase()} — you won ${payout - wager} chips!` : `${result} ${color.toUpperCase()} — the house wins.`);
    }, spinDuration);
  }

  function beginBlackjack() {
    if (balance < bjBet) { setBjMessage('Not enough chips. Reset your balance or lower the bet.'); return; }
    const deck = makeDeck();
    const player = [deck.pop()!, deck.pop()!]; const dealer = [deck.pop()!, deck.pop()!];
    setBjDeck(deck); setBjPlayer(player); setBjDealer(dealer); setBjRoundBet(bjBet);
    const playerScore = scoreHand(player); const dealerScore = scoreHand(dealer);
    if (playerScore === 21 || dealerScore === 21) {
      setBjStatus('done');
      if (playerScore === 21 && dealerScore === 21) setBjMessage('Two blackjacks — push. Your bet is returned.');
      else if (playerScore === 21) { setBalance((value) => value + blackjackNetChange('blackjack', bjBet)); setBjMessage('Natural blackjack! You win 3 to 2.'); }
      else { setBalance((value) => value + blackjackNetChange('loss', bjBet)); setBjMessage('Dealer blackjack. The house takes the hand.'); }
    } else { setBjStatus('playing'); setBjMessage('Hit, stand, or double down.'); }
  }

  function resolveBlackjack(player: Card[], dealerStart: Card[], deckStart: Card[], wager: number) {
    const dealer = [...dealerStart]; const deck = [...deckStart];
    while (scoreHand(dealer) < 17 && deck.length) dealer.push(deck.pop()!);
    const playerScore = scoreHand(player); const dealerScore = scoreHand(dealer);
    setBjDealer(dealer); setBjDeck(deck); setBjStatus('done');
    if (dealerScore > 21 || playerScore > dealerScore) { setBalance((value) => value + blackjackNetChange('win', wager)); setBjMessage(dealerScore > 21 ? `Dealer busts with ${dealerScore} — you win!` : `${playerScore} beats ${dealerScore} — you win!`); }
    else if (playerScore === dealerScore) setBjMessage(`${playerScore} to ${dealerScore} — push. Your bet is returned.`);
    else { setBalance((value) => value + blackjackNetChange('loss', wager)); setBjMessage(`Dealer wins ${dealerScore} to ${playerScore}.`); }
  }

  function hitBlackjack() {
    if (bjStatus !== 'playing') return;
    const deck = [...bjDeck]; const card = deck.pop(); if (!card) return;
    const player = [...bjPlayer, card]; setBjPlayer(player); setBjDeck(deck);
    const score = scoreHand(player);
    if (score > 21) { setBalance((value) => value + blackjackNetChange('loss', bjRoundBet)); setBjStatus('done'); setBjMessage(`${score} — bust. The house wins.`); }
    else if (score === 21) setBjMessage('Twenty-one. Stand to reveal the dealer.');
    else setBjMessage(`${score}. Hit again or stand.`);
  }

  function doubleBlackjack() {
    if (bjStatus !== 'playing' || bjPlayer.length !== 2) return;
    if (balance < bjRoundBet * 2) { setBjMessage('Not enough chips to double.'); return; }
    const wager = bjRoundBet * 2; setBjRoundBet(wager);
    const deck = [...bjDeck]; const player = [...bjPlayer, deck.pop()!]; setBjPlayer(player); setBjDeck(deck);
    if (scoreHand(player) > 21) { setBalance((value) => value + blackjackNetChange('loss', wager)); setBjStatus('done'); setBjMessage(`${scoreHand(player)} — bust on the double.`); }
    else resolveBlackjack(player, bjDealer, deck, wager);
  }

  function resetBlackjack() { setBjPlayer([]); setBjDealer([]); setBjDeck([]); setBjStatus('betting'); setBjMessage('Set your bet and deal the cards.'); }

  const activeName = games.find((game) => game.id === activeGame)!.name;
  const hasActiveWager = spinning || bjStatus === 'playing';
  const reservedChips = spinning ? rouletteBet : bjStatus === 'playing' ? bjRoundBet : 0;
  const availableBalance = Math.max(0, balance - reservedChips);
  const closeRules = useCallback(() => setShowRules(false), []);

  return (
    <main className="arcade-shell">
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label="Midnight Club home"><span className="brand-mark">M</span><span>MIDNIGHT <b>CLUB</b></span></a>
        <button type="button" className="balance-pill" onClick={() => setBalance(1000)} disabled={hasActiveWager} aria-label={hasActiveWager ? `${availableBalance} chips available; reset disabled during a hand` : `${availableBalance} chips available; reset to one thousand`} title={hasActiveWager ? 'Finish the current wager before resetting chips' : 'Reset chips to 1,000'}><span>◎</span><small>AVAILABLE CHIPS · TAP TO RESET</small><strong>{availableBalance.toLocaleString()}</strong></button>
      </header>

      <section className="intro">
        <p className="eyebrow">THE HOUSE IS OPEN</p>
        <h1>Three tables.<br/><em>One lucky night.</em></h1>
        <p>Classic card-room games, reimagined for your screen. No sign-up, no real money—just shuffle, spin, and play.</p>
      </section>

      <nav className="game-tabs" aria-label="Choose a game">
        {games.map((game) => <button type="button" className={`game-tab ${activeGame === game.id ? 'active' : ''}`} key={game.id} onClick={() => setActiveGame(game.id)} aria-pressed={activeGame === game.id} disabled={hasActiveWager && activeGame !== game.id}><span className="tab-icon">{game.icon}</span><span><strong>{game.name}</strong><small>{game.note}</small></span></button>)}
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
            <div className="wheel-stage"><div className={`roulette-wheel ${spinning ? 'spinning' : ''}`} style={{'--wheel-spin': `${wheelTurn}deg`} as CSSProperties}><div className="wheel-ring" aria-hidden="true"/><div className="wheel-numbers" aria-hidden="true">{Array.from({length:37},(_,number)=><span key={number} style={{'--slot-angle':`${number * (360 / 37)}deg`} as CSSProperties}>{number}</span>)}</div><div className="wheel-center"><small>RESULT</small><b>{rouletteResult ?? '—'}</b></div></div><div className="wheel-pointer" aria-hidden="true">◆</div><div className="history-row" aria-label="Recent roulette results">{rouletteHistory.length ? rouletteHistory.map((number, i) => <span key={`${number}-${i}`} className={rouletteColor(number)}>{number}</span>) : <small>RECENT SPINS APPEAR HERE</small>}</div></div>
            <div className="betting-board"><div className="number-grid"><button type="button" className={`number-cell zero ${rouletteChoice === 'number-0' ? 'selected' : ''}`} onClick={() => setRouletteChoice('number-0')} disabled={spinning} aria-pressed={rouletteChoice === 'number-0'}>0</button>{Array.from({length:36},(_,i)=>i+1).map((number)=><button type="button" key={number} className={`number-cell ${rouletteColor(number)} ${rouletteChoice === `number-${number}` ? 'selected' : ''}`} onClick={()=>setRouletteChoice(`number-${number}`)} disabled={spinning} aria-pressed={rouletteChoice === `number-${number}`}>{number}</button>)}</div><div className="outside-bets">{['red','black','odd','even'].map((bet)=><button type="button" key={bet} className={`${bet} ${rouletteChoice===bet?'selected':''}`} onClick={()=>setRouletteChoice(bet)} disabled={spinning} aria-pressed={rouletteChoice===bet}>{bet.toUpperCase()}</button>)}</div><p className="bet-note">Selected: <b>{rouletteChoice.replace('number-','Number ')}</b></p></div>
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
            <div className="bet-controls"><small>{bjStatus==='playing'?'ROUND BET':'CHOOSE BET'}</small><div>{[10,25,50,100].map((chip)=><button type="button" key={chip} className={`chip ${bjBet===chip?'active':''}`} onClick={()=>setBjBet(chip)} disabled={bjStatus!=='betting'} aria-pressed={bjBet===chip}>{chip}</button>)}</div></div>
            <p className="game-status" aria-live="polite">{bjMessage}</p>
            <div className="bj-actions">{bjStatus==='betting' && <button className="primary-action" onClick={beginBlackjack}>DEAL · {bjBet}</button>}{bjStatus==='playing' && <><button className="secondary-action" onClick={doubleBlackjack} disabled={bjPlayer.length!==2}>DOUBLE</button><button className="primary-action" onClick={hitBlackjack}>HIT</button><button className="secondary-action" onClick={()=>resolveBlackjack(bjPlayer,bjDealer,bjDeck,bjRoundBet)}>STAND</button></>}{bjStatus==='done' && <button className="primary-action" onClick={resetBlackjack}>NEW HAND</button>}</div>
          </div>
        </>}
      </section>

      <footer><span>PLAY FOR FUN · NO REAL MONEY</span><span>♣ &nbsp; FAIR SHUFFLE &nbsp; ♦</span></footer>

      {showRules && <RulesModal game={activeGame} onClose={closeRules} />}
    </main>
  );
}
