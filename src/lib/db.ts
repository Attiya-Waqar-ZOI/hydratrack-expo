// Storage facade: platform-resolved implementation + shared helpers.
// Native (Expo Go) → store-impl.ts (SQLite). Web preview → store-impl.web.ts.
import { Beverage, beverageById, setCustomBeverages, todayKey } from './engines';
import { createStore } from './store-impl';
import type { CustomBeverageRow, DayContextRow, LogRow, Profile, Store } from './types';

export type { CustomBeverageRow, DayContextRow, LogRow, Profile, Store };

export const store: Store = createStore();

/// Push the stored custom drinks into the engines registry so
/// beverageById / allBeverages see them. Run at startup + after edits.
export function hydrateCustomBeverages() {
  setCustomBeverages(store.customBeverages().map((c) => ({
    id: c.id, name: c.name, factor: c.factor, caffeinePer100: 0, icon: 'cup-outline',
  })));
}
hydrateCustomBeverages();

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
