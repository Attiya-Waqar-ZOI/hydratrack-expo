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

export interface Store {
  getProfile(): Profile | null;
  saveProfile(p: Profile): void;
  clearAll(): void;
  addLog(l: LogRow): void;
  deleteLog(id: string): void;
  logsForDay(dayKey: string): LogRow[];
  totalsByDay(limitDays: number): { dayKey: string; totalMl: number }[];
  getDayContext(dayKey: string): DayContextRow | null;
  saveDayContext(c: DayContextRow): void;
}
