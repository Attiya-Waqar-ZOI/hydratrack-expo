// Backup & restore. Everything in the local database serialises into one
// JSON file the user saves via the iOS/Android share sheet; restore merges
// a backup back in without ever deleting what's already on the device.
// Why this exists: Expo Go sandboxes data per load-source, so a dev-server
// install, a cloud install, or an Expo Go reinstall each start empty.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import { hydrateCustomBeverages, store } from './db';
import { todayKey } from './engines';
import type { CustomBeverageRow, DayContextRow, FavoriteRow, LogRow, Profile } from './types';

export type BackupFreq = 'off' | 'weekly' | 'daily';

const FREQ_KEY = 'backupFreq';
const LAST_EXPORT_KEY = 'lastBackupAt';

interface BackupFile {
  app: 'hydratrack';
  schema: 1;
  exportedAt: string;
  profile: Profile | null;
  logs: LogRow[];
  customBeverages: CustomBeverageRow[];
  favorites: FavoriteRow[];
  dayContexts: DayContextRow[];
  settings: Record<string, string | null>;
}

// Settings that travel with a backup (only applied where the device has none).
const SETTING_KEYS = [
  'remindersOn', 'remindersPerDay', 'remindersStart', 'remindersEnd',
  'weatherAuto', 'stepsOn',
];

export async function getBackupFreq(): Promise<BackupFreq> {
  const v = await AsyncStorage.getItem(FREQ_KEY);
  return v === 'off' || v === 'daily' ? v : 'weekly';
}
export const setBackupFreq = (f: BackupFreq) => AsyncStorage.setItem(FREQ_KEY, f);

export const lastExportAt = async (): Promise<number | null> => {
  const v = await AsyncStorage.getItem(LAST_EXPORT_KEY);
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

async function buildBackup(): Promise<BackupFile> {
  const settings: Record<string, string | null> = {};
  for (const [k, v] of await AsyncStorage.multiGet(SETTING_KEYS)) settings[k] = v;
  return {
    app: 'hydratrack',
    schema: 1,
    exportedAt: new Date().toISOString(),
    profile: store.getProfile(),
    logs: store.allLogs(),
    customBeverages: store.customBeverages(),
    favorites: store.favorites(),
    dayContexts: store.allDayContexts(),
    settings,
  };
}

/// Write the backup file and open the share sheet. Resolves true when the
/// sheet was shown (iOS cannot tell whether the user actually saved).
export async function exportBackup(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) return false;
  const FS = await import('expo-file-system/legacy');
  const uri = `${FS.cacheDirectory}hydratrack-backup-${todayKey()}.json`;
  await FS.writeAsStringAsync(uri, JSON.stringify(await buildBackup()));
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save your HydraTrack backup',
    UTI: 'public.json',
  });
  await AsyncStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
  return true;
}

export interface RestoreResult {
  logs: number; customBeverages: number; favorites: number; dayContexts: number;
  profileApplied: boolean;
}

/// Pick a backup file and merge it in. Never deletes or overwrites existing
/// data: logs/favorites/custom drinks are added only when their id is new,
/// day contexts only for days with none, the profile only if none exists.
export async function restoreBackup(): Promise<RestoreResult | 'cancelled'> {
  const Picker = await import('expo-document-picker');
  const res = await Picker.getDocumentAsync({
    type: 'application/json', copyToCacheDirectory: true, multiple: false,
  });
  if (res.canceled || !res.assets?.[0]) return 'cancelled';

  const FS = await import('expo-file-system/legacy');
  const raw = await FS.readAsStringAsync(res.assets[0].uri);
  const data = JSON.parse(raw) as BackupFile;
  if (data.app !== 'hydratrack' || !Array.isArray(data.logs)) throw new Error('not a HydraTrack backup');

  const out: RestoreResult = {
    logs: 0, customBeverages: 0, favorites: 0, dayContexts: 0, profileApplied: false,
  };

  if (data.profile && !store.getProfile()) {
    store.saveProfile(data.profile);
    out.profileApplied = true;
  }
  for (const l of data.logs) {
    // Backups from before the place column simply have none.
    if (!store.getLog(l.id)) { store.addLog({ ...l, place: l.place ?? null }); out.logs++; }
  }
  const haveCustom = new Set(store.customBeverages().map((c) => c.id));
  for (const c of data.customBeverages ?? []) {
    if (!haveCustom.has(c.id)) { store.addCustomBeverage(c); out.customBeverages++; }
  }
  const haveFav = new Set(store.favorites().map((f) => f.id));
  for (const f of data.favorites ?? []) {
    if (!haveFav.has(f.id)) { store.addFavorite(f); out.favorites++; }
  }
  for (const c of data.dayContexts ?? []) {
    if (!store.getDayContext(c.dayKey)) { store.saveDayContext(c); out.dayContexts++; }
  }
  for (const [k, v] of Object.entries(data.settings ?? {})) {
    if (v != null && (await AsyncStorage.getItem(k)) == null) await AsyncStorage.setItem(k, v);
  }
  hydrateCustomBeverages();
  return out;
}

/// Should the app pop the backup share sheet on this launch?
/// Yes when the chosen period has passed since the last export AND there is
/// data newer than that export (no point backing up nothing new).
export async function shouldAutoPrompt(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const freq = await getBackupFreq();
  if (freq === 'off') return false;
  const last = (await lastExportAt()) ?? 0;
  const periodMs = (freq === 'daily' ? 1 : 7) * 86_400_000;
  if (Date.now() - last < periodMs) return false;
  const logs = store.allLogs();
  if (logs.length === 0) return false;
  return logs[logs.length - 1].loggedAt > last;
}
