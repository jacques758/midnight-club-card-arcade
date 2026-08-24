import type { Game, PlayerStats, RoundOutcome } from './game-engine';

export type AchievementId = 'first_win' | 'hot_streak' | 'club_regular' | 'high_roller' | 'triple_crown' | 'level_five';
export type DailyChallengeKind = 'rounds' | 'wins' | 'game_win';

export type Achievement = {
  id: AchievementId;
  icon: string;
  title: string;
  description: string;
};

export type DailyChallenge = {
  id: string;
  icon: string;
  title: string;
  description: string;
  kind: DailyChallengeKind;
  target: number;
  reward: number;
  game?: Game;
};

export type ProgressionState = {
  nickname: string;
  avatar: string;
  xp: number;
  gameWins: Record<Game, number>;
  unlocked: AchievementId[];
  daily: { date: string; progress: number; completed: boolean };
};

export const XP_PER_LEVEL = 250;

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first_win', icon: '★', title: 'First Light', description: 'Win your first round.' },
  { id: 'hot_streak', icon: '♨', title: 'Hot Hand', description: 'Build a three-win streak.' },
  { id: 'club_regular', icon: 'M', title: 'Club Regular', description: 'Complete ten rounds.' },
  { id: 'high_roller', icon: '◆', title: 'High Roller', description: 'Win 500 chips in one round.' },
  { id: 'triple_crown', icon: '♛', title: 'Triple Crown', description: 'Win at all three tables.' },
  { id: 'level_five', icon: 'Ⅴ', title: 'Midnight Elite', description: 'Reach level five.' },
];

const DAILY_CHALLENGES: DailyChallenge[] = [
  { id: 'three_rounds', icon: 'Ⅲ', title: 'Three After Dark', description: 'Complete three rounds at any table.', kind: 'rounds', target: 3, reward: 150 },
  { id: 'two_wins', icon: '✦', title: 'Winning Mood', description: 'Win two rounds at any table.', kind: 'wins', target: 2, reward: 200 },
  { id: 'blackjack_win', icon: '21', title: 'Beat the Dealer', description: 'Win one round of Blackjack.', kind: 'game_win', game: 'blackjack', target: 1, reward: 175 },
  { id: 'roulette_win', icon: '●', title: 'Lucky Spin', description: 'Win one Roulette spin.', kind: 'game_win', game: 'roulette', target: 1, reward: 175 },
  { id: 'crazy_win', icon: '8', title: 'Wild Finish', description: 'Win one Crazy 8 hand.', kind: 'game_win', game: 'crazy', target: 1, reward: 175 },
];

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function getDailyChallenge(date: string): DailyChallenge {
  const day = Math.floor(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
  return DAILY_CHALLENGES[Math.abs(day) % DAILY_CHALLENGES.length];
}

export function createDefaultProgression(date = todayKey()): ProgressionState {
  return {
    nickname: 'Night Owl',
    avatar: '♠',
    xp: 0,
    gameWins: { crazy: 0, roulette: 0, blackjack: 0 },
    unlocked: [],
    daily: { date, progress: 0, completed: false },
  };
}

export function normalizeProgression(value: Partial<ProgressionState> | null | undefined, date = todayKey()): ProgressionState {
  const fallback = createDefaultProgression(date);
  const sameDay = value?.daily?.date === date;
  return {
    nickname: typeof value?.nickname === 'string' && value.nickname.trim() ? value.nickname.trim().slice(0, 18) : fallback.nickname,
    avatar: typeof value?.avatar === 'string' ? value.avatar : fallback.avatar,
    xp: Number.isFinite(value?.xp) ? Math.max(0, Number(value?.xp)) : 0,
    gameWins: { ...fallback.gameWins, ...value?.gameWins },
    unlocked: Array.isArray(value?.unlocked) ? value.unlocked.filter((id): id is AchievementId => ACHIEVEMENTS.some((item) => item.id === id)) : [],
    daily: sameDay ? { date, progress: Math.max(0, Number(value?.daily?.progress) || 0), completed: Boolean(value?.daily?.completed) } : fallback.daily,
  };
}

export function levelFromXp(xp: number): number {
  return Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1;
}

export function levelProgress(xp: number): { current: number; target: number; percent: number } {
  const current = Math.max(0, xp) % XP_PER_LEVEL;
  return { current, target: XP_PER_LEVEL, percent: (current / XP_PER_LEVEL) * 100 };
}

export function applyProgressionEvent(
  current: ProgressionState,
  event: { game: Game; outcome: RoundOutcome },
  stats: PlayerStats,
  date = todayKey(),
) {
  const state = normalizeProgression(current, date);
  const challenge = getDailyChallenge(date);
  const baseXp = event.outcome === 'win' ? 100 : event.outcome === 'push' ? 35 : 20;
  const matchesChallenge = challenge.kind === 'rounds'
    || (challenge.kind === 'wins' && event.outcome === 'win')
    || (challenge.kind === 'game_win' && event.outcome === 'win' && challenge.game === event.game);
  const dailyProgress = Math.min(challenge.target, state.daily.progress + (matchesChallenge ? 1 : 0));
  const challengeCompleted = !state.daily.completed && dailyProgress >= challenge.target;
  const xpEarned = baseXp + (challengeCompleted ? challenge.reward : 0);
  const gameWins = { ...state.gameWins };
  if (event.outcome === 'win') gameWins[event.game] += 1;

  const candidate: ProgressionState = {
    ...state,
    xp: state.xp + xpEarned,
    gameWins,
    daily: { date, progress: dailyProgress, completed: state.daily.completed || challengeCompleted },
  };
  const earned = new Set<AchievementId>(candidate.unlocked);
  if (stats.wins >= 1) earned.add('first_win');
  if (stats.bestStreak >= 3) earned.add('hot_streak');
  if (stats.rounds >= 10) earned.add('club_regular');
  if (stats.biggestWin >= 500) earned.add('high_roller');
  if (Object.values(gameWins).every((wins) => wins >= 1)) earned.add('triple_crown');
  if (levelFromXp(candidate.xp) >= 5) earned.add('level_five');
  const newlyUnlocked = [...earned].filter((id) => !candidate.unlocked.includes(id));

  return {
    state: { ...candidate, unlocked: [...earned] },
    xpEarned,
    challengeCompleted,
    newlyUnlocked,
  };
}
