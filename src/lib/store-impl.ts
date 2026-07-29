// Native storage (iOS/Android inside Expo Go): real SQLite.
// Metro resolves this file on native; web gets store-impl.web.ts instead,
// so expo-sqlite never enters the web bundle.
import * as SQLite from 'expo-sqlite';

import type { CustomBeverageRow, DayContextRow, LogRow, Profile, Store } from './types';

export function createStore(): Store {
  const db = SQLite.openDatabaseSync('hydratrack.db');
  db.execSync(`
    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT, age INTEGER, gender TEXT, heightCm REAL, weightKg REAL,
      activity TEXT, climate TEXT, wakeMin INTEGER, sleepMin INTEGER,
      unit TEXT, useCustomGoal INTEGER, customGoalMl INTEGER,
      dailyGoalMl INTEGER, bmi REAL
    );
    CREATE TABLE IF NOT EXISTS water_log (
      id TEXT PRIMARY KEY, amountMl INTEGER, volumeMl INTEGER,
      beverageId TEXT, loggedAt INTEGER, dayKey TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_log_day ON water_log(dayKey);
    CREATE TABLE IF NOT EXISTS day_context (
      dayKey TEXT PRIMARY KEY, place TEXT, tempC REAL,
      humidity REAL, elevationM REAL, note TEXT
    );
    CREATE TABLE IF NOT EXISTS custom_beverage (
      id TEXT PRIMARY KEY, name TEXT, factor REAL
    );
  `);
  return {
    getProfile: () =>
      db.getFirstSync<Profile>('SELECT * FROM profile WHERE id = 1') ?? null,
    saveProfile: (p) =>
      db.runSync(
        `INSERT OR REPLACE INTO profile
         (id,name,age,gender,heightCm,weightKg,activity,climate,wakeMin,sleepMin,
          unit,useCustomGoal,customGoalMl,dailyGoalMl,bmi)
         VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [p.name, p.age, p.gender, p.heightCm, p.weightKg, p.activity, p.climate,
         p.wakeMin, p.sleepMin, p.unit, p.useCustomGoal, p.customGoalMl,
         p.dailyGoalMl, p.bmi],
      ),
    clearAll: () =>
      db.execSync('DELETE FROM profile; DELETE FROM water_log; DELETE FROM day_context; DELETE FROM custom_beverage;'),
    addLog: (l) =>
      db.runSync(
        'INSERT INTO water_log (id,amountMl,volumeMl,beverageId,loggedAt,dayKey) VALUES (?,?,?,?,?,?)',
        [l.id, l.amountMl, l.volumeMl, l.beverageId, l.loggedAt, l.dayKey],
      ),
    deleteLog: (id) => db.runSync('DELETE FROM water_log WHERE id = ?', [id]),
    logsForDay: (dayKey) =>
      db.getAllSync<LogRow>(
        'SELECT * FROM water_log WHERE dayKey = ? ORDER BY loggedAt ASC', [dayKey]),
    totalsByDay: (limitDays) =>
      db.getAllSync<{ dayKey: string; totalMl: number }>(
        `SELECT dayKey, SUM(amountMl) AS totalMl FROM water_log
         GROUP BY dayKey ORDER BY dayKey DESC LIMIT ?`, [limitDays]),
    getDayContext: (dayKey) =>
      db.getFirstSync<DayContextRow>(
        'SELECT * FROM day_context WHERE dayKey = ?', [dayKey]) ?? null,
    saveDayContext: (c) =>
      db.runSync(
        'INSERT OR REPLACE INTO day_context (dayKey,place,tempC,humidity,elevationM,note) VALUES (?,?,?,?,?,?)',
        [c.dayKey, c.place, c.tempC, c.humidity, c.elevationM, c.note],
      ),
    customBeverages: () =>
      db.getAllSync<CustomBeverageRow>('SELECT * FROM custom_beverage ORDER BY name ASC'),
    addCustomBeverage: (b) =>
      db.runSync(
        'INSERT OR REPLACE INTO custom_beverage (id,name,factor) VALUES (?,?,?)',
        [b.id, b.name, b.factor],
      ),
    deleteCustomBeverage: (id) =>
      db.runSync('DELETE FROM custom_beverage WHERE id = ?', [id]),
  };
}
