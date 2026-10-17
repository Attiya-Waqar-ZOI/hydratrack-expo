// Excel export: a structured .xlsx of any date range the user picks.
// Sheet 1 "Drinks" = one row per log (date, time, drink, volumes, caffeine,
// location). Sheet 2 "Daily totals" = one row per day with total vs goal,
// place, temperature and the day's note. Native: written to the cache and
// handed to the share sheet; web preview: a plain browser download.
import { Platform } from 'react-native';

import { store } from './db';
import { beverageById } from './engines';

export async function exportExcel(startKey: string, endKey: string): Promise<boolean> {
  const XLSX = await import('xlsx');
  const goal = store.getProfile()?.dailyGoalMl ?? null;
  const ctxByDay = new Map(store.allDayContexts().map((c) => [c.dayKey, c]));

  const logs = store.allLogs().filter((l) => l.dayKey >= startKey && l.dayKey <= endKey);

  const hhmm = (ms: number) => {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const drinkRows = logs.map((l) => {
    const b = beverageById(l.beverageId);
    return {
      Date: l.dayKey,
      Time: hhmm(l.loggedAt),
      Drink: b.name,
      'Volume (ml)': l.volumeMl,
      'Counts as (ml)': l.amountMl,
      'Caffeine (mg)': Math.round((l.volumeMl / 100) * b.caffeinePer100),
      Location: l.place ?? ctxByDay.get(l.dayKey)?.place ?? '',
    };
  });

  // Daily summary over every day in the range, including empty ones.
  const dayRows: Record<string, string | number>[] = [];
  const totals = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const l of logs) {
    totals.set(l.dayKey, (totals.get(l.dayKey) ?? 0) + l.amountMl);
    counts.set(l.dayKey, (counts.get(l.dayKey) ?? 0) + 1);
  }
  const [sy, sm, sd] = startKey.split('-').map(Number);
  const [ey, em, ed] = endKey.split('-').map(Number);
  for (let d = new Date(sy, sm - 1, sd); d <= new Date(ey, em - 1, ed); d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const ctx = ctxByDay.get(key);
    const total = totals.get(key) ?? 0;
    dayRows.push({
      Date: key,
      'Total (ml)': total,
      'Goal (ml)': goal ?? '',
      'Goal met': goal ? (total >= goal ? 'Yes' : 'No') : '',
      Drinks: counts.get(key) ?? 0,
      Location: ctx?.place ?? '',
      'Temp (°C)': ctx?.tempC != null ? Math.round(ctx.tempC) : '',
      Note: ctx?.note ?? '',
    });
  }

  const wb = XLSX.utils.book_new();
  const wsDrinks = XLSX.utils.json_to_sheet(drinkRows.length ? drinkRows : [{ Date: '', Time: '', Drink: '', 'Volume (ml)': '', 'Counts as (ml)': '', 'Caffeine (mg)': '', Location: '' }]);
  wsDrinks['!cols'] = [{ wch: 11 }, { wch: 6 }, { wch: 16 }, { wch: 11 }, { wch: 13 }, { wch: 13 }, { wch: 22 }];
  const wsDays = XLSX.utils.json_to_sheet(dayRows);
  wsDays['!cols'] = [{ wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 9 }, { wch: 7 }, { wch: 22 }, { wch: 9 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsDrinks, 'Drinks');
  XLSX.utils.book_append_sheet(wb, wsDays, 'Daily totals');

  const name = `hydratrack-${startKey}-to-${endKey}.xlsx`;
  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, name);
    return true;
  }

  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) return false;
  const FS = await import('expo-file-system/legacy');
  const uri = `${FS.cacheDirectory}${name}`;
  await FS.writeAsStringAsync(uri, XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }), {
    encoding: FS.EncodingType.Base64,
  });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: 'Export HydraTrack data',
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
  return true;
}
