import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'midnight-club-chips';
const BALANCE_EVENT = 'midnight-club-balance-change';
const DEFAULT_BALANCE = 1000;

function readBalance(): number {
  if (typeof window === 'undefined') return DEFAULT_BALANCE;
  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored >= 0 ? stored : DEFAULT_BALANCE;
}

function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener(BALANCE_EVENT, callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener(BALANCE_EVENT, callback);
  };
}

export function useBalance(): [number, (next: number | ((current: number) => number)) => void] {
  const balance = useSyncExternalStore(subscribe, readBalance, () => DEFAULT_BALANCE);
  const updateBalance = (next: number | ((current: number) => number)) => {
    const value = typeof next === 'function' ? next(readBalance()) : next;
    window.localStorage.setItem(STORAGE_KEY, String(Math.max(0, Math.round(value))));
    window.dispatchEvent(new Event(BALANCE_EVENT));
  };
  return [balance, updateBalance];
}
