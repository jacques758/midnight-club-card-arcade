export type SoundName = 'card' | 'chip' | 'spin' | 'win' | 'loss' | 'push';

let audioContext: AudioContext | null = null;

export function playSound(name: SoundName, muted: boolean, volume: number) {
  if (muted || volume <= 0 || typeof window === 'undefined') return;
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  const context = audioContext;
  void context.resume();
  const now = context.currentTime;
  const settings: Record<SoundName, { frequency: number; end: number; type: OscillatorType }> = {
    card: { frequency: 210, end: 0.08, type: 'triangle' },
    chip: { frequency: 720, end: 0.07, type: 'sine' },
    spin: { frequency: 120, end: 0.22, type: 'sawtooth' },
    win: { frequency: 660, end: 0.38, type: 'sine' },
    loss: { frequency: 135, end: 0.28, type: 'triangle' },
    push: { frequency: 330, end: 0.18, type: 'sine' },
  };
  const sound = settings[name];
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = sound.type;
  oscillator.frequency.setValueAtTime(sound.frequency, now);
  if (name === 'win') oscillator.frequency.exponentialRampToValueAtTime(990, now + sound.end);
  if (name === 'loss') oscillator.frequency.exponentialRampToValueAtTime(80, now + sound.end);
  gain.gain.setValueAtTime(Math.max(0.0001, volume * 0.12), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.end);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + sound.end);
}
