// Central app state: profile, today's intake, environment context, actions.
// A single context keeps v1 simple; screens re-render via the `version` tick.
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { DayContextRow, LogRow, Profile, hydrateCustomBeverages, makeLog, store } from './db';
import {
  ActivityLevel, Beverage, Climate, EnvBoost, Gender, envBoost, recommendedGoalMl,
  todayKey,
} from './engines';

interface AppState {
  profile: Profile | null;
  todayLogs: LogRow[];
  todayTotal: number;
  effectiveGoal: number;
  env: EnvBoost;
  dayContext: DayContextRow | null;
  version: number;
  saveProfile: (p: Profile) => void;
  addDrink: (volumeMl: number, beverage: Beverage, at?: Date) => string;
  undo: (id: string) => void;
  setManualTemp: (tempC: number | null) => void;
  detectEnvironment: () => Promise<DayContextRow | null>;
  saveNote: (note: string) => void;
  addCustomBeverage: (name: string, servingMl: number, waterMl: number) => string;
  removeCustomBeverage: (id: string) => void;
  resetAll: () => void;
  refresh: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [manualTemp, setManualTempState] = useState<number | null>(null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const state = useMemo<AppState>(() => {
    const profile = store.getProfile();
    const tk = todayKey();
    const todayLogs = store.logsForDay(tk);
    const todayTotal = todayLogs.reduce((s, l) => s + l.amountMl, 0);
    const dayContext = store.getDayContext(tk);
    const env = envBoost(
      manualTemp ?? dayContext?.tempC ?? null,
      dayContext?.humidity ?? null,
      dayContext?.elevationM ?? null,
    );
    const effectiveGoal = (profile?.dailyGoalMl ?? 0) + env.totalMl;

    return {
      profile, todayLogs, todayTotal, effectiveGoal, env, dayContext, version,
      refresh: bump,
      saveProfile: (p) => { store.saveProfile(p); bump(); },
      addDrink: (volumeMl, beverage, at) => {
        const log = makeLog(volumeMl, beverage, at);
        store.addLog(log); bump(); return log.id;
      },
      undo: (id) => { store.deleteLog(id); bump(); },
      setManualTemp: (t) => { setManualTempState(t); },
      saveNote: (note) => {
        const existing = store.getDayContext(tk);
        store.saveDayContext({
          dayKey: tk, place: existing?.place ?? null, tempC: existing?.tempC ?? null,
          humidity: existing?.humidity ?? null, elevationM: existing?.elevationM ?? null,
          note,
        });
        bump();
      },
      detectEnvironment: async () => {
        const geo = await detectGeoWeather();
        if (!geo) return null;
        const existing = store.getDayContext(tk);
        const row: DayContextRow = {
          dayKey: tk,
          place: geo.place ?? existing?.place ?? null,
          tempC: geo.tempC ?? existing?.tempC ?? null,
          humidity: geo.humidity ?? existing?.humidity ?? null,
          elevationM: geo.elevationM ?? existing?.elevationM ?? null,
          note: existing?.note ?? null,
        };
        store.saveDayContext(row);
        bump();
        return row;
      },
      // Hydration factor derives from the user's reference serving:
      // "in servingMl of this drink, waterMl counts as water".
      addCustomBeverage: (name, servingMl, waterMl) => {
        const factor = Math.max(0.05, Math.min(1.5, waterMl / servingMl));
        const id = `custom_${Date.now().toString(36)}`;
        store.addCustomBeverage({
          id, name: name.trim(), factor: Math.round(factor * 100) / 100,
        });
        hydrateCustomBeverages(); bump();
        return id;
      },
      removeCustomBeverage: (id) => {
        store.deleteCustomBeverage(id);
        hydrateCustomBeverages(); bump();
      },
      resetAll: () => {
        store.clearAll(); hydrateCustomBeverages(); setManualTempState(null); bump();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, manualTemp, bump]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const s = useContext(Ctx);
  if (!s) throw new Error('useApp outside provider');
  return s;
}

// ── Geo + weather (expo-location + Open-Meteo + BigDataCloud) ─────
interface GeoWeather {
  place: string | null; tempC: number | null; humidity: number | null; elevationM: number | null;
}

async function detectGeoWeather(): Promise<GeoWeather | null> {
  try {
    const Location = await import('expo-location');
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Low,
    });
    const { latitude: lat, longitude: lon } = pos.coords;

    const [wx, place] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`)
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`)
        .then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    const city: string | undefined = place?.city || place?.locality;
    const country: string | undefined = place?.countryName;
    return {
      tempC: wx?.current?.temperature_2m ?? null,
      humidity: wx?.current?.relative_humidity_2m ?? null,
      elevationM: wx?.elevation ?? null,
      place: city ? (country ? `${city}, ${country}` : city) : country ?? null,
    };
  } catch {
    return null;
  }
}

// ── Convenience: goal from profile fields ──────────────────────────
export function autoGoal(
  weightKg: number, activity: ActivityLevel, climate: Climate, gender: Gender, age: number,
): number {
  return recommendedGoalMl(weightKg, activity, climate, gender, age);
}
