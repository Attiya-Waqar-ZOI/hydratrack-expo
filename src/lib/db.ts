// Storage facade: platform-resolved implementation + shared helpers.
// Native (Expo Go) → store-impl.ts (SQLite). Web preview → store-impl.web.ts.
import { Beverage, beverageById, todayKey } from './engines';
import { createStore } from './store-impl';
import type { DayContextRow, LogRow, Profile, Store } from './types';

export type { DayContextRow, LogRow, Profile, Store };

export const store: Store = createStore();

export function makeLog(volumeMl: number, beverage: Beverage, at?: Date): LogRow {
  const when = at ?? new Date();
  return {
    id: `${when.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    amountMl: Math.round(volumeMl * beverage.factor),
    volumeMl,
    beverageId: beverage.id,
    loggedAt: when.getTime(),
    dayKey: todayKey(when),
  };
}

export function caffeineForDay(dayKey: string): number {
  return store
    .logsForDay(dayKey)
    .reduce(
      (s, l) => s + Math.round((l.volumeMl / 100) * beverageById(l.beverageId).caffeinePer100),
      0,
    );
}
