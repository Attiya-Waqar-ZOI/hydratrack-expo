// Shared data-shape contracts between the storage implementations.
export interface Profile {
  name: string; age: number; gender: string;
  heightCm: number; weightKg: number;
  activity: string; climate: string;
  wakeMin: number; sleepMin: number;
  unit: 'ml' | 'oz';
  useCustomGoal: 0 | 1; customGoalMl: number;
  dailyGoalMl: number; bmi: number;
}

export interface LogRow {
  id: string; amountMl: number; volumeMl: number; beverageId: string;
  loggedAt: number; dayKey: string;
}

export interface DayContextRow {
  dayKey: string; place: string | null; tempC: number | null;
  humidity: number | null; elevationM: number | null; note: string | null;
}

export interface CustomBeverageRow {
  id: string; name: string; factor: number;
}

export interface FavoriteRow {
  id: string; beverageId: string; volumeMl: number;
}

/// How often each (beverage, volume) pair was logged — feeds the Popular
/// category and per-drink usual-size suggestions.
export interface VolumeCount {
  beverageId: string; volumeMl: number; n: number;
}

export interface Store {
  getProfile(): Profile | null;
  saveProfile(p: Profile): void;
  clearAll(): void;
  addLog(l: LogRow): void;
  updateLog(l: LogRow): void;
  getLog(id: string): LogRow | null;
  deleteLog(id: string): void;
  logsForDay(dayKey: string): LogRow[];
  totalsByDay(limitDays: number): { dayKey: string; totalMl: number }[];
  volumeCounts(sinceMs: number): VolumeCount[];
  getDayContext(dayKey: string): DayContextRow | null;
  saveDayContext(c: DayContextRow): void;
  customBeverages(): CustomBeverageRow[];
  addCustomBeverage(b: CustomBeverageRow): void;
  deleteCustomBeverage(id: string): void;
  favorites(): FavoriteRow[];
  addFavorite(f: FavoriteRow): void;
  deleteFavorite(id: string): void;
}
