// Central app state: profile, today's intake, environment context, actions.
// A single context keeps v1 simple; screens re-render via the `version` tick.
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState as RNAppState } from 'react-native';

import {
  DayContextRow, FavoriteRow, LogRow, Profile, hydrateCustomBeverages, makeLog, store,
} from './db';
import { loadReminderPrefs, notifyGoalRaised, resyncReminders } from './reminders';
import {
  announcedBoost, requestStepPermission, setAnnouncedBoost, setStepsEnabled,
  stepBoostMl, stepsEnabled, todaySteps,
} from './steps';
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
  updateDrink: (id: string, volumeMl: number, beverage: Beverage, at: Date) => void;
  undo: (id: string) => void;
  favorites: FavoriteRow[];
  toggleFavorite: (beverageId: string, volumeMl: number) => boolean;
  removeFavorite: (id: string) => void;
  weatherAuto: boolean;
  setWeatherAuto: (on: boolean) => Promise<boolean>;
  setManualTemp: (tempC: number | null) => void;
  detectEnvironment: () => Promise<DayContextRow | null>;
  saveNote: (note: string) => void;
  addCustomBeverage: (name: string, servingMl: number, waterMl: number) => string;
  removeCustomBeverage: (id: string) => void;
  stepsToday: number | null;
  stepBoost: number;
  setStepTracking: (on: boolean) => Promise<boolean>;
  resetAll: () => void;
  refresh: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [version, setVersion] = useState(0);
  const [manualTemp, setManualTempState] = useState<number | null>(null);
  const [stepsToday, setStepsToday] = useState<number | null>(null);
  const [stepBoost, setStepBoost] = useState(0);
  const [weatherAuto, setWeatherAutoState] = useState(false);
  const detectedDay = useRef<string | null>(null);
  // Always points at the latest render's detectEnvironment, so the
  // mount-once foreground listener never runs a stale day's version.
  const detectRef = useRef<() => Promise<DayContextRow | null>>(async () => null);
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  // Re-read the motion sensor whenever the app becomes active; the boost
  // tier feeds straight into effectiveGoal.
  const refreshSteps = useCallback(async () => {
    if (!(await stepsEnabled())) {
      setStepsToday(null); setStepBoost(0);
      return;
    }
    const steps = await todaySteps();
    if (steps == null) return;
    setStepsToday(steps);
    setStepBoost(stepBoostMl(steps));
  }, []);

  useEffect(() => {
    refreshSteps();
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') refreshSteps();
    });
    return () => sub.remove();
  }, [refreshSteps]);

  const state = useMemo<AppState>(() => {
    const profile = store.getProfile();
    const tk = todayKey();
    const todayLogs = store.logsForDay(tk);
    const todayTotal = todayLogs.reduce((s, l) => s + l.amountMl, 0);
    const favorites = store.favorites();
    const dayContext = store.getDayContext(tk);
    const env = envBoost(
      manualTemp ?? dayContext?.tempC ?? null,
      dayContext?.humidity ?? null,
      dayContext?.elevationM ?? null,
    );
    const effectiveGoal = (profile?.dailyGoalMl ?? 0) + env.totalMl + stepBoost;

    const detectEnvironment = async (): Promise<DayContextRow | null> => {
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
    };
    detectRef.current = detectEnvironment;

    return {
      profile, todayLogs, todayTotal, effectiveGoal, env, dayContext, version,
      stepsToday, stepBoost, favorites, weatherAuto,
      setStepTracking: async (on: boolean) => {
        if (!on) {
          await setStepsEnabled(false);
          setStepsToday(null); setStepBoost(0);
          return true;
        }
        const granted = await requestStepPermission();
        if (granted) {
          await setStepsEnabled(true);
          await refreshSteps();
        }
        return granted;
      },
      refresh: bump,
      saveProfile: (p) => { store.saveProfile(p); bump(); },
      addDrink: (volumeMl, beverage, at) => {
        const log = makeLog(volumeMl, beverage, at);
        store.addLog(log); bump(); return log.id;
      },
      updateDrink: (id, volumeMl, beverage, at) => {
        store.updateLog({
          id, volumeMl,
          amountMl: Math.round(volumeMl * beverage.factor),
          beverageId: beverage.id,
          loggedAt: at.getTime(),
          dayKey: todayKey(at),
        });
        bump();
      },
      undo: (id) => { store.deleteLog(id); bump(); },
      // Returns whether the pair is a favorite AFTER the toggle.
      toggleFavorite: (beverageId, volumeMl) => {
        const hit = store.favorites().find(
          (f) => f.beverageId === beverageId && f.volumeMl === volumeMl,
        );
        if (hit) store.deleteFavorite(hit.id);
        else store.addFavorite({
          id: `fav_${Date.now().toString(36)}`, beverageId, volumeMl,
        });
        bump();
        return !hit;
      },
      removeFavorite: (id) => { store.deleteFavorite(id); bump(); },
      // Remembered daily-weather setting: once on, the goal adjusts itself
      // each day with no prompt (iOS keeps the location grant).
      setWeatherAuto: async (on: boolean) => {
        if (!on) {
          await AsyncStorage.setItem('weatherAuto', '0');
          setWeatherAutoState(false);
          return true;
        }
        const row = await detectEnvironment();
        if (row == null) return false; // permission denied or offline
        await AsyncStorage.setItem('weatherAuto', '1');
        setWeatherAutoState(true);
        return true;
      },
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
      detectEnvironment,
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
     
  }, [version, manualTemp, bump, stepsToday, stepBoost, refreshSteps, weatherAuto]);

  // Remembered weather setting: refresh today's context automatically on
  // launch and whenever the app comes back to the foreground on a new day —
  // the user should never have to tap "use my location" again.
  useEffect(() => {
    const autoDetect = async () => {
      const on = (await AsyncStorage.getItem('weatherAuto')) === '1';
      setWeatherAutoState(on);
      if (!on) return;
      const tk = todayKey();
      if (detectedDay.current === tk) return;
      const ctx = store.getDayContext(tk);
      if (ctx?.tempC != null) { detectedDay.current = tk; return; }
      detectedDay.current = tk; // even on failure, retry only on next activation
      await detectRef.current().catch(() => null);
    };
    autoDetect();
    const sub = RNAppState.addEventListener('change', (st) => {
      if (st === 'active') autoDetect();
    });
    return () => sub.remove();
     
  }, []);

  // Announce a goal raise once per tier per day, as a notification.
  useEffect(() => {
    if (stepBoost <= 0 || stepsToday == null) return;
    const p = store.getProfile();
    if (!p) return;
    announcedBoost().then((prev) => {
      if (stepBoost > prev) {
        setAnnouncedBoost(stepBoost);
        notifyGoalRaised(state.effectiveGoal, stepsToday, p.unit === 'oz').catch(() => {});
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepBoost]);

  // Rebuild the notification slate whenever intake or the goal moves:
  // reminder text carries the live remaining amount, and today's slots
  // disappear the moment the goal is met. Also covers app launch.
  useEffect(() => {
    const p = state.profile;
    loadReminderPrefs()
      .then((prefs) => {
        if (!prefs.on) return;
        return resyncReminders(prefs, p ? {
          remainingMl: Math.max(0, state.effectiveGoal - state.todayTotal),
          useOz: p.unit === 'oz',
        } : null);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.todayTotal, state.effectiveGoal, state.profile?.unit]);

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
