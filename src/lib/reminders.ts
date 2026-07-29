import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { fmtVol } from './engines';

/// Local hydration reminders. Times are minutes-from-midnight on the
/// device's local clock. Because notification text is fixed at schedule
/// time, the whole slate is rebuilt on every launch and every intake
/// change: today's reminders carry the live "still to go" amount and are
/// dropped entirely once the goal is met; the next two days get generic
/// copy as a buffer until the app is opened again.

export type ReminderPrefs = {
  on: boolean;
  perDay: number;   // 2–12 reminders
  startMin: number; // first reminder, minutes from midnight (local)
  endMin: number;   // last reminder
};

export type ReminderStatus = {
  remainingMl: number; // today's goal minus today's intake
  useOz: boolean;
};

export const DEFAULT_PREFS: ReminderPrefs = {
  on: false, perDay: 6, startMin: 8 * 60, endMin: 22 * 60,
};

const NATIVE = Platform.OS !== 'web';
const CATEGORY = 'hydration-reminder';
export const ACTION_LOG_INTAKE = 'log-intake';

if (NATIVE) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

const num = (v: string | null | undefined, fallback: number) => {
  const n = v == null ? NaN : parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

export async function loadReminderPrefs(): Promise<ReminderPrefs> {
  const rows = await AsyncStorage.multiGet([
    'remindersOn', 'remindersPerDay', 'remindersStart', 'remindersEnd',
  ]);
  return {
    on: rows[0][1] === '1',
    perDay: Math.min(12, Math.max(2, num(rows[1][1], DEFAULT_PREFS.perDay))),
    startMin: num(rows[2][1], DEFAULT_PREFS.startMin),
    endMin: num(rows[3][1], DEFAULT_PREFS.endMin),
  };
}

export async function saveReminderPrefs(p: ReminderPrefs, status?: ReminderStatus | null) {
  await AsyncStorage.multiSet([
    ['remindersOn', p.on ? '1' : '0'],
    ['remindersPerDay', String(p.perDay)],
    ['remindersStart', String(p.startMin)],
    ['remindersEnd', String(p.endMin)],
  ]);
  return resyncReminders(p, status);
}

/// Evenly spaced times across the window, snapped to 5-minute marks.
export function reminderTimes(p: ReminderPrefs): number[] {
  const start = Math.max(0, Math.min(23 * 60 + 55, p.startMin));
  const end = Math.max(start, Math.min(23 * 60 + 55, p.endMin));
  if (p.perDay <= 1 || end === start) return [start];
  const step = (end - start) / (p.perDay - 1);
  return Array.from({ length: p.perDay }, (_, i) =>
    Math.round((start + step * i) / 5) * 5);
}

/// Formats via the device locale, so 13:30 vs 1:30 PM matches the
/// user's own clock settings.
export function fmtClock(min: number): string {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const GENERIC = [
  { title: '💧 Water break', body: 'A glass now keeps you on pace for today’s goal.' },
  { title: '🥤 Hydration check', body: 'When did you last drink? Log it and keep the streak alive.' },
  { title: '✨ Sip reminder', body: 'Small sips, big wins. Top up now.' },
  { title: '🌊 Stay ahead', body: 'Don’t let thirst catch you first — drink a little now.' },
];

/// Immediate one-off: fired when walked steps push the goal up a tier.
export async function notifyGoalRaised(goalMl: number, steps: number, useOz: boolean) {
  if (!NATIVE) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🚶 Goal raised',
      body: `You’ve walked ${steps.toLocaleString()} steps — today’s goal is now ${fmtVol(goalMl, useOz)}.`,
      categoryIdentifier: CATEGORY,
    },
    trigger: null,
  });
}

export async function resyncReminders(
  p: ReminderPrefs,
  status?: ReminderStatus | null,
): Promise<{ scheduled: number; denied: boolean }> {
  if (!NATIVE) return { scheduled: 0, denied: false };

  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!p.on) return { scheduled: 0, denied: false };

  const perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return { scheduled: 0, denied: true };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('hydration', {
      name: 'Hydration reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // The "Add intake" button on every reminder; tapping it (or the
  // notification itself) opens the quick-log dialog in the app.
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    {
      identifier: ACTION_LOG_INTAKE,
      buttonTitle: 'Add intake',
      options: { opensAppToForeground: true },
    },
  ]).catch(() => {});

  const times = reminderTimes(p);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let scheduled = 0;

  const scheduleAt = async (d: Date, title: string, body: string) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body, categoryIdentifier: CATEGORY },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: d,
        channelId: 'hydration',
      },
    });
    scheduled++;
  };

  // Today — only future slots, only while something is left. When the
  // status is unknown (no profile yet) fall back to generic copy.
  const remaining = status?.remainingMl ?? null;
  if (remaining == null || remaining > 0) {
    let i = 0;
    for (const m of times) {
      if (m <= nowMin + 1) continue;
      const d = new Date();
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const g = GENERIC[i++ % GENERIC.length];
      await scheduleAt(
        d,
        remaining != null ? '💧 Water reminder' : g.title,
        remaining != null
          ? `${fmtVol(remaining, status!.useOz)} still to go today. A glass now helps.`
          : g.body,
      );
    }
  }

  // The next two days — full slate with generic copy, refreshed with real
  // numbers as soon as the app runs again.
  for (let day = 1; day <= 2; day++) {
    let i = 0;
    for (const m of times) {
      const d = new Date();
      d.setDate(d.getDate() + day);
      d.setHours(Math.floor(m / 60), m % 60, 0, 0);
      const g = GENERIC[i++ % GENERIC.length];
      await scheduleAt(d, g.title, g.body);
    }
  }

  return { scheduled, denied: false };
}
