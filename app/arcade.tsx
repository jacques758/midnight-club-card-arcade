'use client';

import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CardView from './card-view';
import {
  DEFAULT_STATS,
  SUITS,
  blackjackNetChange,
  isCrazyPlayable,
  makeDeck,
  rouletteColor,
  roulettePayout,
  randomSuit,
  recordRound,
  scoreHand,
  wheelRotationForResult,
  type Card,
  type Game,
  type PlayerStats,
  type RoundOutcome,
  type Suit,
} from './game-engine';
import { useProgressSync } from './progress-sync';
import {
  ACHIEVEMENTS,
  applyProgressionEvent,
  createDefaultProgression,
  getDailyChallenge,
  levelFromXp,
  levelProgress,
  normalizeProgression,
  TABLE_THEMES,
  todayKey,
  type ProgressionState,
} from './progression';
import RulesModal from './rules-modal';
import { playSound } from './sound';
import TutorialModal from './tutorial-modal';

type BlackjackStatus = 'betting' | 'playing' | 'done';
type RoulettePending = { result: number; choice: string; wager: number; finishAt: number };
type ProgressSnapshot = {
  version: 1 | 2 | 3;
  activeGame: Game;
  balance: number;
  stats: PlayerStats;
  muted: boolean;
  volume: number;
  crazy: { deck: Card[]; player: Card[]; computer: Card[]; top: Card | null; suit: Suit; message: string; over: boolean; pendingEight: number | null };
  roulette: { bet: number; choice: string; result: number | null; history: number[]; wheelTurn: number; message: string; pending: RoulettePending | null };
  blackjack: { deck: Card[]; player: Card[]; dealer: Card[]; bet: number; roundBet: number; status: BlackjackStatus; message: string };
  progression?: ProgressionState;
};
const games: { id: Game; name: string; icon: string; note: string }[] = [
  { id: 'crazy', name: 'Crazy 8', icon: '8', note: 'Match suit or rank' },
  { id: 'roulette', name: 'Roulette', icon: '●', note: 'Pick your lucky number' },
  { id: 'blackjack', name: 'Blackjack', icon: '21', note: 'Beat the house' },
];
const rouletteOutsideBets = [
  { id: 'red', label: 'RED', odds: '1:1' }, { id: 'black', label: 'BLACK', odds: '1:1' },
  { id: 'odd', label: 'ODD', odds: '1:1' }, { id: 'even', label: 'EVEN', odds: '1:1' },
  { id: 'low', label: '1–18', odds: '1:1' }, { id: 'high', label: '19–36', odds: '1:1' },
  { id: 'dozen-1', label: '1ST 12', odds: '2:1' }, { id: 'dozen-2', label: '2ND 12', odds: '2:1' }, { id: 'dozen-3', label: '3RD 12', odds: '2:1' },
  { id: 'column-1', label: 'COL 1', odds: '2:1' }, { id: 'column-2', label: 'COL 2', odds: '2:1' }, { id: 'column-3', label: 'COL 3', odds: '2:1' },
];

function rouletteBetLabel(choice: string) {
  if (choice.startsWith('number-')) return `Number ${choice.slice(7)}`;
  return rouletteOutsideBets.find((bet) => bet.id === choice)?.label || choice;
}


export default function Arcade() {
  const [activeGame, setActiveGame] = useState<Game>('blackjack');
  const [balance, setBalance] = useState(1000);
  const [stats, setStats] = useState<PlayerStats>(DEFAULT_STATS);
  const statsRef = useRef<PlayerStats>(DEFAULT_STATS);
  const [progression, setProgression] = useState<ProgressionState>(() => createDefaultProgression());
  const progressionRef = useRef(progression);
  const [showProgression, setShowProgression] = useState(false);
  const [progressionNotice, setProgressionNotice] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.65);
  const [showRules, setShowRules] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [immersive, setImmersive] = useState(false);
  const [celebration, setCelebration] = useState<RoundOutcome | null>(null);

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
  const [roulettePending, setRoulettePending] = useState<RoulettePending | null>(null);
  const [wheelTurn, setWheelTurn] = useState(0);
  const [rouletteMessage, setRouletteMessage] = useState('Choose a bet, then spin the wheel.');

  const [bjDeck, setBjDeck] = useState<Card[]>([]);
  const [bjPlayer, setBjPlayer] = useState<Card[]>([]);
  const [bjDealer, setBjDealer] = useState<Card[]>([]);
  const [bjBet, setBjBet] = useState(25);
  const [bjRoundBet, setBjRoundBet] = useState(25);
  const [bjStatus, setBjStatus] = useState<BlackjackStatus>('betting');
  const [bjMessage, setBjMessage] = useState('Set your bet and deal the cards.');
  const spinning = roulettePending !== null;

  const registerResult = useCallback((outcome: RoundOutcome, netChips = 0, detail?: string) => {
    const nextStats = recordRound(statsRef.current, outcome, netChips);
    statsRef.current = nextStats;
    setStats(nextStats);
    const progress = applyProgressionEvent(progressionRef.current, { game: activeGame, outcome, netChips, detail }, nextStats);
    progressionRef.current = progress.state;
    setProgression(progress.state);
    const unlocked = progress.newlyUnlocked.map((id) => ACHIEVEMENTS.find((item) => item.id === id)?.title).filter(Boolean);
    setProgressionNotice(progress.challengeCompleted ? `Daily challenge complete · +${progress.xpEarned} XP` : unlocked.length ? `Achievement unlocked · ${unlocked.join(', ')}` : `+${progress.xpEarned} XP`);
    window.setTimeout(() => setProgressionNotice(null), 2600);
    setCelebration(outcome);
    if (celebrationTimeoutRef.current) window.clearTimeout(celebrationTimeoutRef.current);
    celebrationTimeoutRef.current = window.setTimeout(() => setCelebration(null), 1800);
    playSound(outcome === 'win' ? 'win' : outcome === 'loss' ? 'loss' : 'push', muted, volume);
  }, [activeGame, muted, volume]);

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
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current);
    };
  }, [beginCrazy]);

  useEffect(() => {
    const syncFullscreen = () => setImmersive(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  async function toggleImmersive() {
    if (!immersive) {
      setImmersive(true);
      try { await document.documentElement.requestFullscreen?.(); } catch { /* CSS immersive mode remains available. */ }
    } else {
      setImmersive(false);
      if (document.fullscreenElement) await document.exitFullscreen();
    }
  }

  function computerTurn(player: Card[], deck: Card[], top: Card, suit: Suit) {
    const computer = [...crazyComputer];
    const index = computer.findIndex((card) => isCrazyPlayable(card, top, suit));
    if (index < 0) {
      const drawn = deck.pop();
      if (drawn) computer.push(drawn);
      if (drawn) playSound('card', muted, volume);
      if (!drawn) setCrazyOver(true);
      setCrazyComputer(computer); setCrazyDeck(deck);
      setCrazyMessage(drawn ? 'The house drew a card. Your turn.' : 'The deck is empty — start a fresh round.');
      return;
    }
    const [played] = computer.splice(index, 1);
    playSound('card', muted, volume);
    const nextSuit = played.rank === '8' ? randomSuit() : played.suit;
    setCrazyComputer(computer); setCrazyDeck(deck); setCrazyTop(played); setCrazySuit(nextSuit);
    if (computer.length === 0) { setCrazyOver(true); setCrazyMessage('The house is out of cards. Better luck next hand.'); registerResult('loss', 0, 'The house cleared its Crazy 8 hand first.'); }
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
    playSound('card', muted, volume);
    setPendingEight(null); setCrazyPlayer(player); setCrazyTop(card); setCrazySuit(nextSuit);
    if (player.length === 0) { setCrazyOver(true); setCrazyMessage('You cleared your hand — you win!'); registerResult('win', 0, 'You cleared every card in Crazy 8.'); return; }
    computerTurn(player, [...crazyDeck], card, nextSuit);
  }

  function drawCrazy() {
    if (crazyOver || !crazyTop) return;
    const deck = [...crazyDeck]; const drawn = deck.pop();
    if (!drawn) { setCrazyOver(true); setCrazyMessage('The draw pile is empty. Start a fresh hand.'); return; }
    const player = [...crazyPlayer, drawn]; setCrazyPlayer(player); setCrazyDeck(deck);
    playSound('card', muted, volume);
    setCrazyMessage(`You drew ${drawn.rank}${drawn.suit}. The house takes its turn.`);
    computerTurn(player, deck, crazyTop, crazySuit);
  }

  function spinRoulette() {
    if (spinning) return;
    if (balance < rouletteBet) { setRouletteMessage('Not enough chips. Reset your balance or lower the bet.'); return; }
    const choice = rouletteChoice; const wager = rouletteBet;
    const result = Math.floor(Math.random() * 37);
    const spinDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 2300;
    setRoulettePending({ result, choice, wager, finishAt: Date.now() + spinDuration }); setRouletteResult(null);
    setRouletteMessage('No more bets…'); setWheelTurn((turn) => wheelRotationForResult(turn, result));
    playSound('spin', muted, volume);
  }

  function chooseRoulette(choice: string) {
    setRouletteChoice(choice);
    playSound('chip', muted, volume);
  }

  useEffect(() => {
    if (!roulettePending) return;
    const { result, choice, wager, finishAt } = roulettePending;
    const settle = () => {
      const color = rouletteColor(result);
      const payout = roulettePayout(choice, wager, result);
      const net = payout - wager;
      setBalance((value) => value + net);
      setRouletteResult(result);
      setRouletteHistory((history) => [result, ...history].slice(0, 6));
      setRouletteMessage(payout ? `${result} ${color.toUpperCase()} — you won ${net} chips!` : `${result} ${color.toUpperCase()} — the house wins.`);
      setRoulettePending(null);
      registerResult(payout ? 'win' : 'loss', net, `${result} ${color.toUpperCase()} · ${rouletteBetLabel(choice)} bet.`);
    };
    timeoutRef.current = window.setTimeout(settle, Math.max(0, finishAt - Date.now()));
    return () => { if (timeoutRef.current) window.clearTimeout(timeoutRef.current); };
  }, [registerResult, roulettePending]);

  function beginBlackjack() {
    if (balance < bjBet) { setBjMessage('Not enough chips. Reset your balance or lower the bet.'); return; }
    const deck = makeDeck();
    const player = [deck.pop()!, deck.pop()!]; const dealer = [deck.pop()!, deck.pop()!];
    playSound('card', muted, volume);
    setBjDeck(deck); setBjPlayer(player); setBjDealer(dealer); setBjRoundBet(bjBet);
    const playerScore = scoreHand(player); const dealerScore = scoreHand(dealer);
    if (playerScore === 21 || dealerScore === 21) {
      setBjStatus('done');
      if (playerScore === 21 && dealerScore === 21) { setBjMessage('Two blackjacks — push. Your bet is returned.'); registerResult('push', 0, 'Both you and the dealer had blackjack.'); }
      else if (playerScore === 21) { const net = blackjackNetChange('blackjack', bjBet); setBalance((value) => value + net); setBjMessage('Natural blackjack! You win 3 to 2.'); registerResult('win', net, `Natural blackjack · +${net} chips.`); }
      else { const net = blackjackNetChange('loss', bjBet); setBalance((value) => value + net); setBjMessage('Dealer blackjack. The house takes the hand.'); registerResult('loss', net, `Dealer blackjack · ${net} chips.`); }
    } else { setBjStatus('playing'); setBjMessage('Hit, stand, or double down.'); }
  }

  function resolveBlackjack(player: Card[], dealerStart: Card[], deckStart: Card[], wager: number) {
    const dealer = [...dealerStart]; const deck = [...deckStart];
    while (scoreHand(dealer) < 17 && deck.length) dealer.push(deck.pop()!);
    const playerScore = scoreHand(player); const dealerScore = scoreHand(dealer);
    setBjDealer(dealer); setBjDeck(deck); setBjStatus('done');
    if (dealerScore > 21 || playerScore > dealerScore) { const net = blackjackNetChange('win', wager); setBalance((value) => value + net); setBjMessage(dealerScore > 21 ? `Dealer busts with ${dealerScore} — you win!` : `${playerScore} beats ${dealerScore} — you win!`); registerResult('win', net, dealerScore > 21 ? `Dealer bust ${dealerScore} · your ${playerScore}.` : `Your ${playerScore} beat dealer ${dealerScore}.`); }
    else if (playerScore === dealerScore) { setBjMessage(`${playerScore} to ${dealerScore} — push. Your bet is returned.`); registerResult('push', 0, `Push at ${playerScore}.`); }
    else { const net = blackjackNetChange('loss', wager); setBalance((value) => value + net); setBjMessage(`Dealer wins ${dealerScore} to ${playerScore}.`); registerResult('loss', net, `Dealer ${dealerScore} beat your ${playerScore}.`); }
  }

  function hitBlackjack() {
    if (bjStatus !== 'playing') return;
    const deck = [...bjDeck]; const card = deck.pop(); if (!card) return;
    const player = [...bjPlayer, card]; setBjPlayer(player); setBjDeck(deck);
    playSound('card', muted, volume);
    const score = scoreHand(player);
    if (score > 21) { const net = blackjackNetChange('loss', bjRoundBet); setBalance((value) => value + net); setBjStatus('done'); setBjMessage(`${score} — bust. The house wins.`); registerResult('loss', net, `You busted with ${score}.`); }
    else if (score === 21) setBjMessage('Twenty-one. Stand to reveal the dealer.');
    else setBjMessage(`${score}. Hit again or stand.`);
  }

  function doubleBlackjack() {
    if (bjStatus !== 'playing' || bjPlayer.length !== 2) return;
    if (balance < bjRoundBet * 2) { setBjMessage('Not enough chips to double.'); return; }
    playSound('chip', muted, volume);
    const wager = bjRoundBet * 2; setBjRoundBet(wager);
    const deck = [...bjDeck]; const player = [...bjPlayer, deck.pop()!]; setBjPlayer(player); setBjDeck(deck);
    if (scoreHand(player) > 21) { const net = blackjackNetChange('loss', wager); setBalance((value) => value + net); setBjStatus('done'); setBjMessage(`${scoreHand(player)} — bust on the double.`); registerResult('loss', net, `Double-down bust at ${scoreHand(player)}.`); }
    else resolveBlackjack(player, bjDealer, deck, wager);
  }

  function resetBlackjack() { setBjPlayer([]); setBjDealer([]); setBjDeck([]); setBjStatus('betting'); setBjMessage('Set your bet and deal the cards.'); }

  const activeName = games.find((game) => game.id === activeGame)!.name;
  const hasActiveWager = spinning || bjStatus === 'playing';
  const reservedChips = spinning ? rouletteBet : bjStatus === 'playing' ? bjRoundBet : 0;
  const availableBalance = Math.max(0, balance - reservedChips);
  const closeRules = useCallback(() => setShowRules(false), []);
  const restoreProgress = useCallback((progress: ProgressSnapshot) => {
    if (!progress || ![1, 2, 3].includes(progress.version)) return;
    setActiveGame(progress.activeGame);
    setBalance(Number.isFinite(progress.balance) ? Math.max(0, progress.balance) : 1000);
    const restoredStats = { ...DEFAULT_STATS, ...progress.stats };
    statsRef.current = restoredStats;
    setStats(restoredStats);
    const restoredProgression = normalizeProgression(progress.progression);
    progressionRef.current = restoredProgression;
    setProgression(restoredProgression);
    setMuted(Boolean(progress.muted));
    setVolume(Math.min(1, Math.max(0, Number(progress.volume) || 0.65)));
    if (progress.crazy) {
      setCrazyDeck(progress.crazy.deck || []); setCrazyPlayer(progress.crazy.player || []); setCrazyComputer(progress.crazy.computer || []);
      setCrazyTop(progress.crazy.top || null); setCrazySuit(progress.crazy.suit || '♠'); setCrazyMessage(progress.crazy.message || 'Your turn.');
      setCrazyOver(Boolean(progress.crazy.over)); setPendingEight(progress.crazy.pendingEight ?? null);
    }
    if (progress.roulette) {
      setRouletteBet(progress.roulette.bet || 25); setRouletteChoice(progress.roulette.choice || 'red'); setRouletteResult(progress.roulette.result ?? null);
      setRouletteHistory(progress.roulette.history || []); setWheelTurn(progress.roulette.wheelTurn || 0); setRouletteMessage(progress.roulette.message || 'Choose a bet, then spin.');
      setRoulettePending(progress.roulette.pending || null);
    }
    if (progress.blackjack) {
      setBjDeck(progress.blackjack.deck || []); setBjPlayer(progress.blackjack.player || []); setBjDealer(progress.blackjack.dealer || []);
      setBjBet(progress.blackjack.bet || 25); setBjRoundBet(progress.blackjack.roundBet || 25); setBjStatus(progress.blackjack.status || 'betting');
      setBjMessage(progress.blackjack.message || 'Set your bet and deal the cards.');
    }
  }, []);
  const progressSnapshot = useMemo<ProgressSnapshot>(() => ({
    version: 3,
    activeGame,
    balance,
    stats,
    muted,
    volume,
    crazy: { deck: crazyDeck, player: crazyPlayer, computer: crazyComputer, top: crazyTop, suit: crazySuit, message: crazyMessage, over: crazyOver, pendingEight },
    roulette: { bet: rouletteBet, choice: rouletteChoice, result: rouletteResult, history: rouletteHistory, wheelTurn, message: rouletteMessage, pending: roulettePending },
    blackjack: { deck: bjDeck, player: bjPlayer, dealer: bjDealer, bet: bjBet, roundBet: bjRoundBet, status: bjStatus, message: bjMessage },
    progression,
  }), [activeGame, balance, bjBet, bjDealer, bjDeck, bjMessage, bjPlayer, bjRoundBet, bjStatus, crazyComputer, crazyDeck, crazyMessage, crazyOver, crazyPlayer, crazySuit, crazyTop, muted, pendingEight, progression, rouletteBet, rouletteChoice, rouletteHistory, rouletteMessage, roulettePending, rouletteResult, stats, volume, wheelTurn]);
  const { status: progressStatus } = useProgressSync({ snapshot: progressSnapshot, restore: restoreProgress });
  const dailyChallenge = getDailyChallenge(todayKey());
  const playerLevel = levelFromXp(progression.xp);
  const xpProgress = levelProgress(progression.xp);

  function updateProfile(update: Partial<Pick<ProgressionState, 'nickname' | 'avatar' | 'theme' | 'tutorialsSeen'>>) {
    const next = { ...progressionRef.current, ...update };
    progressionRef.current = next;
    setProgression(next);
  }

  return (
    <main className={`arcade-shell game-first game-${activeGame} theme-${progression.theme} ${immersive ? 'immersive' : ''} ${celebration ? `celebrate-${celebration}` : ''}`}>
      <div className="ambient-orbs" aria-hidden="true"><span/><span/><span/></div>
      {celebration === 'win' && <div className="celebration-layer" aria-hidden="true">{Array.from({length:18},(_,index)=><span key={index} style={{'--particle':index} as CSSProperties}>{index % 3 === 0 ? '◆' : index % 3 === 1 ? '●' : '✦'}</span>)}</div>}
      <header className="topbar" id="top">
        <a className="brand" href="#top" aria-label="Midnight Club home"><span className="brand-mark">M</span><span>MIDNIGHT <b>CLUB</b></span></a>
        <div className="header-actions"><button type="button" className="immersive-toggle" onClick={toggleImmersive} aria-pressed={immersive}><span aria-hidden="true">{immersive ? '↙' : '↗'}</span>{immersive ? 'EXIT TABLE' : 'IMMERSIVE'}</button><button type="button" className="balance-pill" onClick={() => { setBalance(1000); playSound('chip', muted, volume); }} disabled={hasActiveWager} aria-label={hasActiveWager ? `${availableBalance} chips available; reset disabled during a hand` : `${availableBalance} chips available; reset to one thousand`} title={hasActiveWager ? 'Finish the current wager before resetting chips' : 'Reset chips to 1,000'}><span>◎</span><small>AVAILABLE CHIPS · TAP TO RESET</small><strong>{availableBalance.toLocaleString()}</strong></button></div>
      </header>

      <section className="intro compact-intro">
        <p className="eyebrow">THE HOUSE IS OPEN</p>
        <h1>Your table <em>awaits.</em></h1>
        <p>Choose a classic, take your seat, and let the night unfold.</p>
        <div className="hero-suits" aria-hidden="true"><span>♣</span><span>♦</span><span>♥</span><span>♠</span></div>
      </section>

      <section className="progression-bar" aria-label="Player progression">
        <button type="button" className="player-summary" onClick={() => setShowProgression((visible) => !visible)} aria-expanded={showProgression}>
          <span className="profile-avatar">{progression.avatar}</span><span><small>LEVEL {playerLevel}</small><strong>{progression.nickname}</strong></span>
        </button>
        <div className="xp-summary"><div><span>{xpProgress.current} / {xpProgress.target} XP</span><small>NEXT LEVEL</small></div><div className="xp-track"><span style={{ width: `${xpProgress.percent}%` }}/></div></div>
        <div className={`daily-summary ${progression.daily.completed ? 'complete' : ''}`}><span>{dailyChallenge.icon}</span><div><small>DAILY CHALLENGE</small><strong>{progression.daily.completed ? 'Completed' : `${progression.daily.progress}/${dailyChallenge.target} · ${dailyChallenge.title}`}</strong></div></div>
        <button type="button" className="badge-summary" onClick={() => setShowProgression((visible) => !visible)}><span>◆</span><strong>{progression.unlocked.length}/{ACHIEVEMENTS.length}</strong><small>BADGES</small></button>
      </section>

      {showProgression && <section className="progression-panel" aria-label="Player profile and achievements">
        <div className="profile-editor"><p className="eyebrow">PLAYER PROFILE</p><label>Nickname<input value={progression.nickname} maxLength={18} onChange={(event) => updateProfile({ nickname: event.target.value.slice(0, 18) })}/></label><div className="avatar-picker" aria-label="Choose a suit avatar">{['♠','♥','♦','♣'].map((avatar) => <button type="button" key={avatar} className={progression.avatar === avatar ? 'active' : ''} onClick={() => updateProfile({ avatar })} aria-pressed={progression.avatar === avatar}>{avatar}</button>)}</div></div>
        <article className={`daily-card ${progression.daily.completed ? 'complete' : ''}`}><span>{dailyChallenge.icon}</span><div><small>TODAY · +{dailyChallenge.reward} XP</small><h2>{dailyChallenge.title}</h2><p>{dailyChallenge.description}</p><div className="challenge-track"><span style={{width:`${Math.min(100,(progression.daily.progress / dailyChallenge.target) * 100)}%`}}/></div><strong>{progression.daily.completed ? 'REWARD EARNED' : `${progression.daily.progress} OF ${dailyChallenge.target}`}</strong></div></article>
        <div className="achievement-grid">{ACHIEVEMENTS.map((achievement) => { const earned = progression.unlocked.includes(achievement.id); return <article key={achievement.id} className={earned ? 'earned' : 'locked'}><span>{achievement.icon}</span><div><small>{earned ? 'UNLOCKED' : 'LOCKED'}</small><h3>{achievement.title}</h3><p>{achievement.description}</p></div></article>; })}</div>
        <div className="reward-section"><div className="progression-section-title"><div><p className="eyebrow">TABLE COLLECTION</p><h2>Unlocked themes</h2></div><small>LEVEL REWARDS</small></div><div className="theme-grid">{TABLE_THEMES.map((theme) => { const unlocked = playerLevel >= theme.minLevel; return <button type="button" key={theme.id} className={`${progression.theme === theme.id ? 'selected' : ''} ${unlocked ? '' : 'locked'}`} disabled={!unlocked} onClick={() => updateProfile({ theme: theme.id })}><span style={{background:theme.swatch}}/><strong>{theme.name}</strong><small>{unlocked ? theme.note : `UNLOCKS AT LEVEL ${theme.minLevel}`}</small></button>; })}</div></div>
        <div className="history-section"><div className="progression-section-title"><div><p className="eyebrow">GAME JOURNAL</p><h2>Recent rounds</h2></div><small>LAST {Math.min(12, progression.history.length)}</small></div>{progression.history.length ? <div className="game-history">{progression.history.map((entry) => <article key={entry.id} className={entry.outcome}><span>{games.find((game) => game.id === entry.game)?.icon}</span><div><strong>{games.find((game) => game.id === entry.game)?.name}</strong><p>{entry.detail}</p></div><div><b>{entry.netChips > 0 ? `+${entry.netChips}` : entry.netChips || '—'}</b><small>{entry.playedAt.slice(11,16)} UTC</small></div></article>)}</div> : <div className="empty-history"><span>◇</span><p>Complete a round and it will appear here.</p></div>}</div>
      </section>}

      {progressionNotice && <div className="progression-toast" role="status"><span>✦</span>{progressionNotice}</div>}

      <section className="stats-strip" aria-label="Player statistics and sound settings">
        <div className="save-state"><span className={progressStatus}/>{progressStatus === 'loading' ? 'RESTORING' : progressStatus === 'saving' ? 'SAVING' : progressStatus === 'offline' ? 'OFFLINE' : 'PROGRESS SAVED'}</div>
        <div className="stat"><small>ROUNDS</small><strong>{stats.rounds}</strong></div>
        <div className="stat"><small>WIN RATE</small><strong>{stats.rounds ? `${Math.round((stats.wins / stats.rounds) * 100)}%` : '—'}</strong></div>
        <div className="stat"><small>BEST WIN</small><strong>{stats.biggestWin}</strong></div>
        <div className="stat"><small>BEST STREAK</small><strong>{stats.bestStreak}</strong></div>
        <div className="sound-control"><button type="button" onClick={() => { const next = !muted; setMuted(next); if (!next) playSound('chip', false, volume); }} aria-pressed={!muted} aria-label={muted ? 'Turn sound on' : 'Mute sound'}>{muted ? 'SOUND OFF' : 'SOUND ON'}</button><input aria-label="Sound volume" type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} disabled={muted}/></div>
      </section>

      <nav className="game-tabs" aria-label="Choose a game">
        {games.map((game) => <button type="button" className={`game-tab ${activeGame === game.id ? 'active' : ''}`} key={game.id} onClick={() => { setActiveGame(game.id); playSound('chip', muted, volume); }} aria-pressed={activeGame === game.id} disabled={hasActiveWager && activeGame !== game.id}><span className="tab-icon">{game.icon}</span><span><strong>{game.name}</strong><small>{game.note}</small></span></button>)}
      </nav>

      <section className="table-wrap" aria-label={`${activeName} table`}>
        <div className="table-ambience" aria-hidden="true"><span/><span/><span/><span/></div>
        <div className="table-topline"><div><span className="live-dot"/> {activeName.toUpperCase()} · TABLE 0{games.findIndex((g) => g.id === activeGame) + 1}</div><div className="table-help"><button className="tutorial-button" onClick={() => setShowTutorial(true)}>{progression.tutorialsSeen.includes(activeGame) ? '◇ QUICK TOUR' : 'NEW · QUICK TOUR'}</button><button className="rules-button" onClick={() => setShowRules(true)}>ⓘ &nbsp; HOW TO PLAY</button></div></div>

        {activeGame === 'crazy' && <>
          <div className="crazy-table">
            <div className="opponent-zone"><p>THE HOUSE <b>{crazyComputer.length}</b></p><div className="computer-hand">{crazyComputer.map((_, index) => <CardView key={index} card={{rank:'A',suit:'♠'}} hidden small />)}</div></div>
            <div className="crazy-center"><div className="draw-stack" aria-label="Draw pile"><span>M</span></div>{crazyTop && <CardView key={`${crazyTop.rank}${crazyTop.suit}`} card={crazyTop} />}{crazyTop && <div className="called-suit">ACTIVE SUIT <b>{crazySuit}</b></div>}</div>
            <div className="player-zone"><p>YOUR HAND <b>{crazyPlayer.length}</b></p><div className="crazy-hand">{crazyPlayer.map((card, index) => <CardView key={`${card.rank}${card.suit}`} card={card} onClick={() => playCrazy(index)} disabled={crazyOver} />)}</div></div>
          </div>
          {pendingEight !== null && <div className="suit-picker"><span>CALL A SUIT</span>{SUITS.map((suit) => <button key={suit} className={suit === '♥' || suit === '♦' ? 'red-suit' : ''} onClick={() => playCrazy(pendingEight, suit)}>{suit}</button>)}</div>}
          <div className="action-dock status-dock"><p key={crazyMessage} className="game-status status-pop" aria-live="polite">{crazyMessage}</p>{crazyOver ? <button className="primary-action" onClick={() => { beginCrazy(); playSound('card', muted, volume); }}>NEW HAND</button> : <button className="primary-action" onClick={drawCrazy}>DRAW CARD</button>}</div>
        </>}

        {activeGame === 'roulette' && <>
          <div className="roulette-table">
            <div className="wheel-stage"><div className={`roulette-wheel ${spinning ? 'spinning' : ''} ${rouletteResult !== null ? 'result-hit' : ''}`} style={{'--wheel-spin': `${wheelTurn}deg`} as CSSProperties}><div className="wheel-ring" aria-hidden="true"/><div className="wheel-numbers" aria-hidden="true">{Array.from({length:37},(_,number)=><span key={number} style={{'--slot-angle':`${number * (360 / 37)}deg`} as CSSProperties}>{number}</span>)}</div><div className="wheel-center"><small>RESULT</small><b>{rouletteResult ?? '—'}</b></div></div><div className={`ball-orbit ${spinning ? 'ball-spinning' : ''}`} aria-hidden="true"><span/></div><div className="wheel-pointer" aria-hidden="true">◆</div><div className="history-row" aria-label="Recent roulette results">{rouletteHistory.length ? rouletteHistory.map((number, i) => <span key={`${number}-${i}`} className={rouletteColor(number)}>{number}</span>) : <small>RECENT SPINS APPEAR HERE</small>}</div></div>
            <div className="betting-board"><div key={`${rouletteChoice}-${rouletteBet}`} className="placed-chip roulette-placed-chip" aria-hidden="true"><span>{rouletteBet}</span><small>{rouletteBetLabel(rouletteChoice)}</small></div><div className="number-grid"><button type="button" className={`number-cell zero ${rouletteChoice === 'number-0' ? 'selected' : ''}`} onClick={() => chooseRoulette('number-0')} disabled={spinning} aria-pressed={rouletteChoice === 'number-0'}>0</button>{Array.from({length:36},(_,i)=>i+1).map((number)=><button type="button" key={number} className={`number-cell ${rouletteColor(number)} ${rouletteChoice === `number-${number}` ? 'selected' : ''}`} onClick={()=>chooseRoulette(`number-${number}`)} disabled={spinning} aria-pressed={rouletteChoice === `number-${number}`}>{number}</button>)}</div><div className="outside-bets expanded">{rouletteOutsideBets.map((bet)=><button type="button" key={bet.id} className={`${bet.id} ${rouletteChoice===bet.id?'selected':''}`} onClick={()=>chooseRoulette(bet.id)} disabled={spinning} aria-pressed={rouletteChoice===bet.id}><span>{bet.label}</span><small>{bet.odds}</small></button>)}</div><p className="bet-note">Selected: <b>{rouletteBetLabel(rouletteChoice)}</b></p></div>
          </div>
          <div className="action-dock roulette-dock"><div className="chip-row">{[10,25,50,100].map((chip)=><button key={chip} className={`chip ${rouletteBet===chip?'active':''}`} onClick={()=>{setRouletteBet(chip);playSound('chip',muted,volume);}} disabled={spinning}>{chip}</button>)}</div><p key={rouletteMessage} className="game-status status-pop" aria-live="polite">{rouletteMessage}</p><button className="primary-action spin-button" onClick={spinRoulette} disabled={spinning}>{spinning?'SPINNING…':`SPIN · ${rouletteBet}`}</button></div>
        </>}

        {activeGame === 'blackjack' && <>
          <div className="blackjack-table">
            <div className="dealer-side"><p>DEALER <b>{bjDealer.length ? (bjStatus === 'playing' ? scoreHand(bjDealer.slice(0,1)) : scoreHand(bjDealer)) : '—'}</b></p><div className="hand">{bjDealer.length ? bjDealer.map((card,index)=><CardView key={`${card.rank}${card.suit}-${index}`} card={card} hidden={index===1 && bjStatus==='playing'} />) : <div className="empty-hand">DEALER</div>}</div></div>
            <div className="table-message"><span>BLACKJACK PAYS 3 TO 2</span><b>21</b><small>Dealer stands on 17</small></div>
            {bjPlayer.length > 0 && <div key={bjRoundBet} className="placed-chip blackjack-placed-chip" aria-label={`${bjRoundBet} chips wagered`}><span>{bjRoundBet}</span><small>BET</small></div>}
            <div className="player-side"><div className="hand">{bjPlayer.length ? bjPlayer.map((card,index)=><CardView key={`${card.rank}${card.suit}-${index}`} card={card} />) : <div className="deck-ready"><span>M</span></div>}</div><p>YOUR HAND <b>{bjPlayer.length ? scoreHand(bjPlayer) : '—'}</b></p></div>
          </div>
          <div className="action-dock blackjack-dock">
            <div className="bet-controls"><small>{bjStatus==='playing'?'ROUND BET':'CHOOSE BET'}</small><div>{[10,25,50,100].map((chip)=><button type="button" key={chip} className={`chip ${bjBet===chip?'active':''}`} onClick={()=>{setBjBet(chip);playSound('chip',muted,volume);}} disabled={bjStatus!=='betting'} aria-pressed={bjBet===chip}>{chip}</button>)}</div></div>
            <p key={bjMessage} className="game-status status-pop" aria-live="polite">{bjMessage}</p>
            <div className="bj-actions">{bjStatus==='betting' && <button className="primary-action" onClick={beginBlackjack}>DEAL · {bjBet}</button>}{bjStatus==='playing' && <><button className="secondary-action" onClick={doubleBlackjack} disabled={bjPlayer.length!==2}>DOUBLE</button><button className="primary-action" onClick={hitBlackjack}>HIT</button><button className="secondary-action" onClick={()=>resolveBlackjack(bjPlayer,bjDealer,bjDeck,bjRoundBet)}>STAND</button></>}{bjStatus==='done' && <button className="primary-action" onClick={resetBlackjack}>NEW HAND</button>}</div>
          </div>
        </>}
      </section>

      <footer><span>PLAY FOR FUN · NO REAL MONEY</span><span>♣ &nbsp; FAIR SHUFFLE &nbsp; ♦</span></footer>

      {showRules && <RulesModal game={activeGame} onClose={closeRules} />}
      {showTutorial && <TutorialModal
        game={activeGame}
        onClose={() => setShowTutorial(false)}
        onComplete={() => {
          updateProfile({ tutorialsSeen: [...new Set([...progressionRef.current.tutorialsSeen, activeGame])] });
          setShowTutorial(false);
        }}
      />}
    </main>
  );
}
