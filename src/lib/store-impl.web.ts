// Web preview storage: in-memory, same Store contract. Metro picks this file
// for web builds so the sqlite/wasm machinery stays out of the bundle.
import type {
  CustomBeverageRow, DayContextRow, FavoriteRow, LogRow, Profile, Store, VolumeCount,
} from './types';

export function createStore(): Store {
  let profile: Profile | null = null;
  const logs: LogRow[] = [];
  const contexts = new Map<string, DayContextRow>();
  const customs: CustomBeverageRow[] = [];
  const favs: FavoriteRow[] = [];
  return {
    getProfile: () => profile,
    saveProfile: (p) => { profile = p; },
    clearAll: () => {
      profile = null; logs.length = 0; contexts.clear(); customs.length = 0; favs.length = 0;
    },
    addLog: (l) => { logs.push(l); },
    updateLog: (l) => {
      const i = logs.findIndex((x) => x.id === l.id);
      if (i >= 0) logs[i] = l;
    },
    getLog: (id) => logs.find((l) => l.id === id) ?? null,
    deleteLog: (id) => {
      const i = logs.findIndex((l) => l.id === id);
      if (i >= 0) logs.splice(i, 1);
    },
    logsForDay: (dayKey) =>
      logs.filter((l) => l.dayKey === dayKey).sort((a, b) => a.loggedAt - b.loggedAt),
    totalsByDay: (limitDays) => {
      const m = new Map<string, number>();
      for (const l of logs) m.set(l.dayKey, (m.get(l.dayKey) ?? 0) + l.amountMl);
      return [...m.entries()]
        .map(([dayKey, totalMl]) => ({ dayKey, totalMl }))
        .sort((a, b) => b.dayKey.localeCompare(a.dayKey))
        .slice(0, limitDays);
    },
    volumeCounts: (sinceMs) => {
      const m = new Map<string, VolumeCount>();
      for (const l of logs) {
        if (l.loggedAt < sinceMs) continue;
        const k = `${l.beverageId}|${l.volumeMl}`;
        const row = m.get(k) ?? { beverageId: l.beverageId, volumeMl: l.volumeMl, n: 0 };
        row.n++; m.set(k, row);
      }
      return [...m.values()];
    },
    getDayContext: (dayKey) => contexts.get(dayKey) ?? null,
    saveDayContext: (c) => { contexts.set(c.dayKey, c); },
    customBeverages: () => [...customs].sort((a, b) => a.name.localeCompare(b.name)),
    addCustomBeverage: (b) => {
      const i = customs.findIndex((c) => c.id === b.id);
      if (i >= 0) customs[i] = b; else customs.push(b);
    },
    deleteCustomBeverage: (id) => {
      const i = customs.findIndex((c) => c.id === id);
      if (i >= 0) customs.splice(i, 1);
    },
    favorites: () => [...favs],
    addFavorite: (f) => {
      const i = favs.findIndex((x) => x.id === f.id);
      if (i >= 0) favs[i] = f; else favs.push(f);
    },
    deleteFavorite: (id) => {
      const i = favs.findIndex((f) => f.id === id);
      if (i >= 0) favs.splice(i, 1);
    },
  };
}
