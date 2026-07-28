// HydraTrack domain engines — pure TypeScript ports of the Flutter/Dart
// originals. No React/Expo imports: fully testable logic.

export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';
export type Climate = 'cold' | 'moderate' | 'hot';
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary', light: 'Lightly Active', moderate: 'Moderately Active',
  high: 'Very Active', athlete: 'Athlete',
};
export const ACTIVITY_BONUS: Record<ActivityLevel, number> = {
  sedentary: 0, light: 300, moderate: 500, high: 750, athlete: 1000,
};
export const CLIMATE_BONUS: Record<Climate, number> = { cold: 0, moderate: 250, hot: 500 };
export const BMI_BONUS: Record<BmiCategory, number> = {
  underweight: 250, normal: 0, overweight: 250, obese: 500,
};

// ── BMI ───────────────────────────────────────────────────────────
export function computeBmi(heightCm: number, weightKg: number): number {
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

export function bmiCategory(bmi: number): BmiCategory {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export const BMI_LABELS: Record<BmiCategory, string> = {
  underweight: 'Underweight', normal: 'Healthy Weight',
  overweight: 'Overweight', obese: 'Obese',
};

// ── Daily goal: 35 ml/kg + activity + climate + BMI ───────────────
export interface GoalBreakdown {
  baseMl: number; activityMl: number; climateMl: number; bmiMl: number; totalMl: number;
}

export function goalBreakdown(
  weightKg: number, activity: ActivityLevel, climate: Climate, bmi: number,
): GoalBreakdown {
  const baseMl = Math.round(weightKg * 35);
  const activityMl = ACTIVITY_BONUS[activity];
  const climateMl = CLIMATE_BONUS[climate];
  const bmiMl = BMI_BONUS[bmiCategory(bmi)];
  return { baseMl, activityMl, climateMl, bmiMl, totalMl: baseMl + activityMl + climateMl + bmiMl };
}

// ── Environment boost (temperature + altitude + dry air) ──────────
export interface EnvBoost { tempMl: number; altitudeMl: number; aridityMl: number; totalMl: number }

export function tempBoostMl(tempC: number | null): number {
  if (tempC == null) return 0;
  if (tempC < 25) return 0;
  if (tempC < 32) return 250;
  if (tempC < 38) return 500;
  return 750;
}

export function envBoost(
  tempC: number | null, humidityPct: number | null, elevationM: number | null,
): EnvBoost {
  const tempMl = tempBoostMl(tempC);
  let altitudeMl = 0;
  if (elevationM != null) altitudeMl = elevationM >= 2500 ? 500 : elevationM >= 1500 ? 300 : 0;
  const aridityMl = humidityPct != null && humidityPct < 30 && (tempC ?? 0) >= 20 ? 250 : 0;
  return { tempMl, altitudeMl, aridityMl, totalMl: tempMl + altitudeMl + aridityMl };
}

// ── Hydration pace ─────────────────────────────────────────────────
export interface Pace { expectedMl: number; deltaMl: number; onTrack: boolean; status: string }

export function hydrationPace(
  nowMin: number, wakeMin: number, sleepMin: number, actualMl: number, goalMl: number,
): Pace {
  const frac = sleepMin <= wakeMin ? 0 :
    Math.min(1, Math.max(0, (Math.min(Math.max(nowMin, wakeMin), sleepMin) - wakeMin) / (sleepMin - wakeMin)));
  const expectedMl = Math.round(goalMl * frac);
  const deltaMl = actualMl - expectedMl;
  let status: string;
  if (actualMl >= goalMl) status = 'Goal complete — fully topped up! 💧';
  else if (frac <= 0) status = 'Your day is just starting — sip early.';
  else if (deltaMl >= 0) status = `You're ${deltaMl} ml ahead of pace — great rhythm!`;
  else status = `You're ${-deltaMl} ml behind pace — a glass now keeps you on track.`;
  return { expectedMl, deltaMl, onTrack: deltaMl >= 0, status };
}

// ── Catch-up plan ──────────────────────────────────────────────────
export function catchUpPlan(remainingMl: number, nowMin: number, sleepMin: number, perServingMl = 250) {
  const minutesLeft = Math.max(0, sleepMin - nowMin);
  if (remainingMl <= 0) return null;
  const servings = Math.ceil(remainingMl / perServingMl);
  const intervalMin = servings > 0 ? Math.floor(minutesLeft / servings) : 0;
  const cadence = intervalMin >= 60 ? `about every ${(intervalMin / 60).toFixed(1)} h` : `every ~${intervalMin} min`;
  return {
    servings, intervalMin, rushed: intervalMin > 0 && intervalMin < 20,
    message: minutesLeft <= 0
      ? `${remainingMl} ml left, but your day's nearly over — sip what you can.`
      : `Drink a ${perServingMl} ml serving ${cadence} (${servings} to go) to finish by bedtime.`,
  };
}

// ── Beverages ──────────────────────────────────────────────────────
export interface Beverage {
  id: string; name: string; factor: number; caffeinePer100: number; emoji: string; color: string;
}

export const BEVERAGES: Beverage[] = [
  { id: 'water', name: 'Water', factor: 1.0, caffeinePer100: 0, emoji: '💧', color: '#4F7CFF' },
  { id: 'sparkling', name: 'Sparkling', factor: 1.0, caffeinePer100: 0, emoji: '🫧', color: '#4FE0D0' },
  { id: 'coconut', name: 'Coconut', factor: 1.1, caffeinePer100: 0, emoji: '🥥', color: '#9CCC65' },
  { id: 'sports', name: 'Sports', factor: 1.0, caffeinePer100: 0, emoji: '🏃', color: '#26C6DA' },
  { id: 'herbal', name: 'Herbal tea', factor: 1.0, caffeinePer100: 0, emoji: '🌿', color: '#66BB6A' },
  { id: 'tea', name: 'Tea', factor: 0.9, caffeinePer100: 20, emoji: '🍵', color: '#F2A65A' },
  { id: 'milk', name: 'Milk', factor: 0.9, caffeinePer100: 0, emoji: '🥛', color: '#BFD7EA' },
  { id: 'soup', name: 'Soup', factor: 0.9, caffeinePer100: 0, emoji: '🍜', color: '#E0A458' },
  { id: 'juice', name: 'Juice', factor: 0.85, caffeinePer100: 0, emoji: '🧃', color: '#FFB454' },
  { id: 'smoothie', name: 'Smoothie', factor: 0.85, caffeinePer100: 0, emoji: '🥤', color: '#EC7FA9' },
  { id: 'coffee', name: 'Coffee', factor: 0.8, caffeinePer100: 40, emoji: '☕', color: '#E8845A' },
  { id: 'soda', name: 'Soda', factor: 0.7, caffeinePer100: 10, emoji: '🥫', color: '#8B7CF6' },
  { id: 'energy', name: 'Energy', factor: 0.7, caffeinePer100: 32, emoji: '⚡', color: '#F06277' },
  { id: 'alcohol', name: 'Beer/Wine', factor: 0.5, caffeinePer100: 0, emoji: '🍺', color: '#D4A017' },
];

export const beverageById = (id: string): Beverage =>
  BEVERAGES.find((b) => b.id === id) ?? BEVERAGES[0];

export const QUICK_AMOUNTS = [100, 150, 200, 250, 350, 500, 750];

// ── Recommendations ────────────────────────────────────────────────
export function recommendation(currentMl: number, goalMl: number, hour: number, streak: number): string {
  const progress = goalMl === 0 ? 0 : currentMl / goalMl;
  const remaining = Math.max(0, goalMl - currentMl);
  if (streak >= 7) return `🔥 ${streak}-day hydration streak! Keep it going.`;
  if (progress >= 1) return 'Goal smashed! 🎉 Great hydration today.';
  if (progress < 0.35 && hour >= 12)
    return `You're behind your hydration goal by ${remaining} ml. Drink one glass now to catch up.`;
  if (hour < 10) return 'Start your day strong — a glass of water now sets the pace.';
  return `${remaining} ml remaining to reach today's target.`;
}

// ── Formatting ─────────────────────────────────────────────────────
export const ML_PER_OZ = 29.5735;

export function fmtVol(ml: number, useOz: boolean): string {
  if (useOz) return `${Math.round(ml / ML_PER_OZ)} oz`;
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${ml} ml`;
}

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
