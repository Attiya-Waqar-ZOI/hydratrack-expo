// Storage facade: platform-resolved implementation + shared helpers.
// Native (Expo Go) → store-impl.ts (SQLite). Web preview → store-impl.web.ts.
import { Beverage, beverageById, setCustomBeverages, todayKey } from './engines';
import { createStore } from './store-impl';
import type {
  CustomBeverageRow, DayContextRow, FavoriteRow, LogRow, Profile, Store, VolumeCount,
} from './types';

export type { CustomBeverageRow, DayContextRow, FavoriteRow, LogRow, Profile, Store, VolumeCount };

export const store: Store = createStore();

/// Push the stored custom drinks into the engines registry so
/// beverageById / allBeverages see them. Run at startup + after edits.
export function hydrateCustomBeverages() {
  setCustomBeverages(store.customBeverages().map((c) => ({
    id: c.id, name: c.name, factor: c.factor, caffeinePer100: 0,
    emoji: '🍶', color: '#c4d3dc',
  })));
}
hydrateCustomBeverages();

/// Usage stats over the last `days`: beverages ranked by how often they were
/// logged, each with its most-logged volume. Feeds Popular + size suggestions.
export interface DrinkStat { beverageId: string; uses: number; usualMl: number }

export function drinkStats(days = 21): DrinkStat[] {
  const since = Date.now() - days * 86_400_000;
  const byBev = new Map<string, { uses: number; top: VolumeCount }>();
  for (const vc of store.volumeCounts(since)) {
    const cur = byBev.get(vc.beverageId);
    if (!cur) byBev.set(vc.beverageId, { uses: vc.n, top: vc });
    else {
      cur.uses += vc.n;
      if (vc.n > cur.top.n) cur.top = vc;
    }
  }
  return [...byBev.entries()]
    .map(([beverageId, s]) => ({ beverageId, uses: s.uses, usualMl: s.top.volumeMl }))
    .sort((a, b) => b.uses - a.uses);
}

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
