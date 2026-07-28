import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/// Local hydration reminders. Times are minutes-from-midnight in the
/// device's local clock — expo-notifications DAILY triggers fire in local
/// time, so the schedule follows the user's clock and timezone. We resync
/// on every app launch and on every settings change.

export type ReminderPrefs = {
  on: boolean;
  perDay: number;   // 2–12 reminders
  startMin: number; // first reminder, minutes from midnight (local)
  endMin: number;   // last reminder
};

export const DEFAULT_PREFS: ReminderPrefs = {
  on: false, perDay: 6, startMin: 8 * 60, endMin: 22 * 60,
};

const NATIVE = Platform.OS !== 'web';

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

export async function saveReminderPrefs(p: ReminderPrefs) {
  await AsyncStorage.multiSet([
    ['remindersOn', p.on ? '1' : '0'],
    ['remindersPerDay', String(p.perDay)],
    ['remindersStart', String(p.startMin)],
    ['remindersEnd', String(p.endMin)],
  ]);
  return resyncReminders(p);
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

const MESSAGES = [
  { title: '💧 Water break', body: 'A glass now keeps you on pace for today’s goal.' },
  { title: '🥤 Hydration check', body: 'When did you last drink? Log it and keep the streak alive.' },
  { title: '✨ Sip reminder', body: 'Small sips, big wins. Top up now.' },
  { title: '🌊 Stay ahead', body: 'Don’t let thirst catch you first — drink a little now.' },
];

export async function resyncReminders(
  p: ReminderPrefs,
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

  const times = reminderTimes(p);
  for (let i = 0; i < times.length; i++) {
    const msg = MESSAGES[i % MESSAGES.length];
    await Notifications.scheduleNotificationAsync({
      content: { title: msg.title, body: msg.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: Math.floor(times[i] / 60),
        minute: times[i] % 60,
        channelId: 'hydration',
      },
    });
  }
  return { scheduled: times.length, denied: false };
}
