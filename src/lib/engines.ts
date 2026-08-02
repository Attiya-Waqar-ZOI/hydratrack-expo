// HydraTrack domain engines — pure TypeScript ports of the Flutter/Dart
// originals. No React/Expo imports: fully testable logic.

export type Gender = 'male' | 'female' | 'nonbinary' | 'na';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';
export type Climate = 'cold' | 'moderate' | 'hot';
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary', light: 'Lightly active', moderate: 'Moderately active',
  high: 'Very active', athlete: 'Athlete',
};
export const GENDER_LABELS: Record<Gender, string> = {
  male: 'Male', female: 'Female', nonbinary: 'Non-binary', na: 'Rather not say',
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

// ── Recommended goal (Broadsheet onboarding formula) ───────────────
// 32 ml/kg scaled by activity, climate and sex, eased after 55,
// clamped to a sane range and rounded to 50 ml.
export const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.0, light: 1.08, moderate: 1.16, high: 1.26, athlete: 1.38,
};
export const CLIMATE_MULT: Record<Climate, number> = { cold: 0.96, moderate: 1.0, hot: 1.12 };
export const GENDER_MULT: Record<Gender, number> = {
  male: 1.05, female: 0.97, nonbinary: 1.0, na: 1.0,
};

export function recommendedGoalMl(
  weightKg: number, activity: ActivityLevel, climate: Climate, gender: Gender, age: number,
): number {
  const base = weightKg * 32;
  const ageF = age > 55 ? 0.95 : 1;
  const ml = base * ACTIVITY_MULT[activity] * CLIMATE_MULT[climate] * (GENDER_MULT[gender] ?? 1) * ageF;
  return Math.max(1500, Math.min(5000, Math.round(ml / 50) * 50));
}

// ── Environment boost (temperature + altitude + dry air) ──────────
export interface EnvBoost { tempMl: number; altitudeMl: number; aridityMl: number; totalMl: number }

// Tiers deliberately gentle: the profile's climate already bakes heat into
// the base goal, so the live-weather boost is a nudge, not a second goal.
// (Early tiers reached +1000 ml and pushed goals past 5 L — user feedback.)
export function tempBoostMl(tempC: number | null): number {
  if (tempC == null) return 0;
  if (tempC < 27) return 0;
  if (tempC < 33) return 150;
  if (tempC < 38) return 300;
  return 450;
}

// Whatever the conditions, weather never adds more than this.
export const ENV_BOOST_CAP = 500;

export function envBoost(
  tempC: number | null, humidityPct: number | null, elevationM: number | null,
): EnvBoost {
  const tempMl = tempBoostMl(tempC);
  let altitudeMl = 0;
  if (elevationM != null) altitudeMl = elevationM >= 2500 ? 400 : elevationM >= 1500 ? 250 : 0;
  const aridityMl = humidityPct != null && humidityPct < 30 && (tempC ?? 0) >= 20 ? 150 : 0;
  return {
    tempMl, altitudeMl, aridityMl,
    totalMl: Math.min(ENV_BOOST_CAP, tempMl + altitudeMl + aridityMl),
  };
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
  if (actualMl >= goalMl) status = 'Goal complete';
  else if (frac <= 0) status = 'Day just started';
  else if (deltaMl >= 0) status = `${deltaMl} ml ahead of pace`;
  else status = `${-deltaMl} ml behind pace`;
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
      ? `${remainingMl} ml left today. Sip what you can.`
      : `${perServingMl} ml ${cadence}, ${servings} to go`,
  };
}

// ── Beverages ──────────────────────────────────────────────────────
// `emoji` is the tile/list icon; `color` tints the home glass when the
// day's mix isn't plain water. Alcohol has a NEGATIVE factor: it costs
// water (1000 ml beer ≈ −600 ml hydration), per user feedback.
export interface Beverage {
  id: string; name: string; factor: number; caffeinePer100: number;
  emoji: string; color: string;
}

export const BEVERAGES: Beverage[] = [
  { id: 'water', name: 'Water', factor: 1.0, caffeinePer100: 0, emoji: '💧', color: '#99e0ff' },
  { id: 'sparkling', name: 'Sparkling water', factor: 1.0, caffeinePer100: 0, emoji: '🫧', color: '#debce3' },
  { id: 'herbal', name: 'Herbal tea', factor: 1.0, caffeinePer100: 0, emoji: '🌿', color: '#bfdcae' },
  { id: 'coconut', name: 'Coconut water', factor: 1.1, caffeinePer100: 0, emoji: '🥥', color: '#e9e4d2' },
  { id: 'sports', name: 'Sports drink', factor: 1.0, caffeinePer100: 0, emoji: '🏃', color: '#aee3e0' },
  { id: 'milk', name: 'Milk', factor: 0.9, caffeinePer100: 0, emoji: '🥛', color: '#fcfbf7' },
  { id: 'tea', name: 'Tea', factor: 0.9, caffeinePer100: 20, emoji: '🍵', color: '#00ffbb' },
  { id: 'soup', name: 'Soup', factor: 0.9, caffeinePer100: 0, emoji: '🍜', color: '#e9c98a' },
  { id: 'juice', name: 'Juice', factor: 0.85, caffeinePer100: 0, emoji: '🧃', color: '#fa9f16' },
  { id: 'smoothie', name: 'Smoothie', factor: 0.85, caffeinePer100: 0, emoji: '🍓', color: '#f7a8b8' },
  { id: 'coffee', name: 'Coffee', factor: 0.8, caffeinePer100: 40, emoji: '☕', color: '#593e2a' },
  { id: 'soda', name: 'Soda', factor: 0.7, caffeinePer100: 10, emoji: '🥤', color: '#cf9d7c' },
  { id: 'energy', name: 'Energy drink', factor: 0.7, caffeinePer100: 32, emoji: '⚡', color: '#ffd966' },
  { id: 'alcohol', name: 'Beer or wine', factor: -0.6, caffeinePer100: 0, emoji: '🍺', color: '#e6c25e' },
];

// Standard serving sizes shown as one-tap chips wherever an amount is set.
export const SIZE_CHIPS = [250, 330, 500, 600, 1000];

// Add-sheet categories, per the requested flow. `favorites` and `popular`
// are filled at runtime; `custom` holds the user's own drinks.
export interface BeverageCategory { key: string; label: string; ids: string[] }
export const BEVERAGE_CATEGORIES: BeverageCategory[] = [
  { key: 'water', label: 'Water', ids: ['water', 'sparkling', 'coconut'] },
  { key: 'hot', label: 'Coffee & tea', ids: ['coffee', 'tea', 'herbal'] },
  { key: 'juice', label: 'Juices', ids: ['juice', 'smoothie'] },
  { key: 'soda', label: 'Soda & energy', ids: ['soda', 'energy'] },
  { key: 'wellness', label: 'Sports & wellness', ids: ['sports', 'soup'] },
  { key: 'milk', label: 'Milk', ids: ['milk'] },
  { key: 'alcohol', label: 'Alcohol', ids: ['alcohol'] },
];

// User-defined drinks, hydrated from storage at startup (db.ts) and after
// every edit. Kept here so beverageById stays the single lookup.
export let CUSTOM_BEVERAGES: Beverage[] = [];
export function setCustomBeverages(list: Beverage[]) { CUSTOM_BEVERAGES = list; }
export const allBeverages = (): Beverage[] => [...BEVERAGES, ...CUSTOM_BEVERAGES];

export const beverageById = (id: string): Beverage =>
  BEVERAGES.find((b) => b.id === id)
  ?? CUSTOM_BEVERAGES.find((b) => b.id === id)
  ?? BEVERAGES[0];

export const QUICK_AMOUNTS = [100, 150, 200, 250, 350, 500, 750];

// ── Recommendations ────────────────────────────────────────────────
export function recommendation(currentMl: number, goalMl: number, hour: number, streak: number): string {
  const progress = goalMl === 0 ? 0 : currentMl / goalMl;
  const remaining = Math.max(0, goalMl - currentMl);
  if (streak >= 7) return `${streak}-day streak`;
  if (progress >= 1) return 'Goal reached';
  if (progress < 0.35 && hour >= 12)
    return `${remaining} ml behind. A glass now helps.`;
  if (hour < 10) return 'Start with a glass of water';
  return `${remaining} ml to go`;
}

// ── Formatting ─────────────────────────────────────────────────────
export const ML_PER_OZ = 29.5735;

export function fmtVol(ml: number, useOz: boolean): string {
  if (ml < 0) return `−${fmtVol(-ml, useOz)}`; // alcohol logs carry negative hydration
  if (useOz) return `${Math.round(ml / ML_PER_OZ)} oz`;
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${ml} ml`;
}

/// "+250 ml" / "−600 ml" — signed amounts for log rows.
export function fmtSigned(ml: number, useOz: boolean): string {
  return ml < 0 ? fmtVol(ml, useOz) : `+${fmtVol(ml, useOz)}`;
}


export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
