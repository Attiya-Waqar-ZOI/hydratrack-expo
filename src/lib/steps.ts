import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { todayKey } from './engines';

/// Step-aware goal boost. Steps come from the device's motion sensor
/// (Core Motion via expo-sensors) — works inside Expo Go, no HealthKit
/// needed. Read whenever the app is active; tiers add to the daily goal
/// alongside the weather boost.

export const STEP_TIERS = [
  { steps: 18000, ml: 750 },
  { steps: 12000, ml: 500 },
  { steps: 7000, ml: 250 },
];

export function stepBoostMl(steps: number): number {
  for (const t of STEP_TIERS) if (steps >= t.steps) return t.ml;
  return 0;
}

const NATIVE = Platform.OS !== 'web';

export async function stepsEnabled(): Promise<boolean> {
  return (await AsyncStorage.getItem('stepsOn')) === '1';
}

export async function setStepsEnabled(on: boolean) {
  await AsyncStorage.setItem('stepsOn', on ? '1' : '0');
}

/// Raises the OS Motion & Fitness prompt. False on web, denial, or
/// devices without a step counter.
export async function requestStepPermission(): Promise<boolean> {
  if (!NATIVE) return false;
  try {
    const { Pedometer } = await import('expo-sensors');
    if (!(await Pedometer.isAvailableAsync())) return false;
    const perm = await Pedometer.requestPermissionsAsync();
    return perm.granted;
  } catch {
    return false;
  }
}

/// Steps from local midnight to now; null when unavailable.
export async function todaySteps(): Promise<number | null> {
  if (!NATIVE) return null;
  try {
    const { Pedometer } = await import('expo-sensors');
    if (!(await Pedometer.isAvailableAsync())) return null;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const r = await Pedometer.getStepCountAsync(start, new Date());
    return r?.steps ?? null;
  } catch {
    return null;
  }
}

/// The boost already announced today — so the "goal raised" notification
/// fires once per tier, not on every app foreground.
export async function announcedBoost(): Promise<number> {
  const v = await AsyncStorage.getItem(`stepBoostAnnounced:${todayKey()}`);
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : 0;
}

export async function setAnnouncedBoost(ml: number) {
  await AsyncStorage.setItem(`stepBoostAnnounced:${todayKey()}`, String(ml));
}
