import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { autoGoal, useApp } from '@/lib/app-state';
import {
  ACTIVITY_LABELS, ActivityLevel, BMI_LABELS, Climate, bmiCategory, fmtVol,
} from '@/lib/engines';
import { GlowPanel } from '@/lib/glow';
import {
  DEFAULT_PREFS, ReminderPrefs, fmtClock, loadReminderPrefs, reminderTimes,
  saveReminderPrefs,
} from '@/lib/reminders';
import { showToast } from '@/lib/toast';
import { C } from '@/lib/theme';

export default function You() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;
  const useOz = p.unit === 'oz';

  const setUnit = (unit: 'ml' | 'oz') => app.saveProfile({ ...p, unit });

  const setGoalMode = (custom: boolean) => {
    if (custom) {
      app.saveProfile({ ...p, useCustomGoal: 1, customGoalMl: p.dailyGoalMl });
    } else {
      const g = autoGoal(p.weightKg, p.activity as ActivityLevel, p.climate as Climate, p.bmi);
      app.saveProfile({ ...p, useCustomGoal: 0, dailyGoalMl: g });
    }
  };

  const nudgeGoal = (delta: number) => {
    const g = Math.min(6000, Math.max(500, p.dailyGoalMl + delta));
    app.saveProfile({ ...p, dailyGoalMl: g, customGoalMl: g, useCustomGoal: 1 });
  };

  const confirmReset = () =>
    Alert.alert('Reset all data?', 'This permanently clears your profile and logs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: () => { app.resetAll(); router.replace('/onboarding'); },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}>
        <Text style={s.h1}>You</Text>

        {/* Identity */}
        <GlowPanel glow colors={['rgba(123,232,245,0.7)', 'rgba(27,143,166,0.7)']}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={s.avatar}>
              <Text style={{ fontSize: 26 }}>{p.gender === 'male' ? '👨' : '👩'}</Text>
            </View>
            <View>
              <Text style={s.name}>{p.name}</Text>
              <Text style={s.sub}>
                {p.age} yrs · {p.gender === 'male' ? 'Male' : 'Female'} ·{' '}
                {ACTIVITY_LABELS[p.activity as ActivityLevel]}
              </Text>
            </View>
          </View>
        </GlowPanel>

        {/* Metrics */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <GlowPanel colors={['rgba(61,220,151,0.6)', 'rgba(123,232,245,0.6)']}>
              <Text style={s.sub}>🫀 BMI</Text>
              <Text style={s.metric}>{p.bmi.toFixed(1)}</Text>
              <Text style={{ color: C.success, fontWeight: '700' }}>
                {BMI_LABELS[bmiCategory(p.bmi)]}
              </Text>
            </GlowPanel>
          </View>
          <View style={{ flex: 1 }}>
            <GlowPanel colors={['rgba(37,199,224,0.6)', 'rgba(27,143,166,0.6)']}>
              <Text style={s.sub}>🎯 Daily goal</Text>
              <Text style={s.metric}>{fmtVol(p.dailyGoalMl, useOz)}</Text>
              <Text style={{ color: C.primary, fontWeight: '700' }}>
                {p.useCustomGoal ? 'Custom' : 'Auto'}
              </Text>
            </GlowPanel>
          </View>
        </View>

        {/* Goal */}
        <GlowPanel colors={['rgba(37,199,224,0.55)', 'rgba(123,232,245,0.55)']}>
          <Text style={s.cardTitle}>🎯 Daily goal</Text>
          <View style={s.row}>
            <Seg label="Auto" on={!p.useCustomGoal} onPress={() => setGoalMode(false)} />
            <Seg label="Custom" on={!!p.useCustomGoal} onPress={() => setGoalMode(true)} />
          </View>
          {!!p.useCustomGoal && (
            <View style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
              <Btn label="− 100" onPress={() => nudgeGoal(-100)} />
              <Text style={[s.metric, { marginHorizontal: 14 }]}>
                {fmtVol(p.dailyGoalMl, useOz)}
              </Text>
              <Btn label="＋ 100" onPress={() => nudgeGoal(100)} />
            </View>
          )}
        </GlowPanel>

        {/* Notifications */}
        <NotificationSettings />

        {/* Units */}
        <GlowPanel colors={['rgba(37,199,224,0.55)', 'rgba(27,143,166,0.55)']}>
          <Text style={s.cardTitle}>📏 Volume unit</Text>
          <View style={s.row}>
            <Seg label="ml" on={!useOz} onPress={() => setUnit('ml')} />
            <Seg label="oz" on={useOz} onPress={() => setUnit('oz')} />
          </View>
        </GlowPanel>

        <GlowPanel colors={['rgba(240,98,119,0.55)', 'rgba(240,98,119,0.35)']}>
          <Pressable onPress={confirmReset}>
            <Text style={{ color: C.danger, fontWeight: '800' }}>🗑 Reset all data</Text>
          </Pressable>
        </GlowPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

/// Reminder preferences — count plus a fully custom time window. Every
/// change reschedules the local notifications on the device clock.
function NotificationSettings() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadReminderPrefs().then(setPrefs);
  }, []);

  const save = (next: ReminderPrefs) => {
    setPrefs(next);
    saveReminderPrefs(next).then(({ scheduled, denied }) => {
      if (denied) {
        showToast('🔕 Allow notifications in iOS Settings to get reminders');
      } else if (next.on && scheduled > 0) {
        showToast(`🔔 ${scheduled} daily reminders, ${fmtClock(next.startMin)} – ${fmtClock(next.endMin)}`);
      }
    });
  };

  const times = reminderTimes(prefs);
  const STEP = 30; // minutes per tap on the time steppers

  return (
    <GlowPanel colors={['rgba(27,143,166,0.6)', 'rgba(37,199,224,0.5)']}>
      <Text style={s.cardTitle}>🔔 Reminders</Text>
      <View style={s.row}>
        <Seg label="Off" on={!prefs.on} onPress={() => save({ ...prefs, on: false })} />
        <Seg label="On" on={prefs.on} onPress={() => save({ ...prefs, on: true })} />
      </View>
      {prefs.on && (
        <>
          <View style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
            <Btn label="−" onPress={() => save({ ...prefs, perDay: Math.max(2, prefs.perDay - 1) })} />
            <Text style={[s.metric, { marginHorizontal: 14, fontSize: 18 }]}>
              {prefs.perDay} / day
            </Text>
            <Btn label="＋" onPress={() => save({ ...prefs, perDay: Math.min(12, prefs.perDay + 1) })} />
          </View>

          <TimeRow
            label="⏰ First reminder"
            min={prefs.startMin}
            onChange={(m) => save({
              ...prefs,
              startMin: Math.max(0, Math.min(prefs.endMin - STEP, m)),
            })}
          />
          <TimeRow
            label="🌙 Last reminder"
            min={prefs.endMin}
            onChange={(m) => save({
              ...prefs,
              endMin: Math.min(23 * 60 + 30, Math.max(prefs.startMin + STEP, m)),
            })}
          />

          <View style={[s.row, { marginTop: 12, flexWrap: 'wrap' }]}>
            {times.map((t) => (
              <View key={t} style={s.timeChip}>
                <Text style={{ color: C.mint, fontWeight: '700', fontSize: 12 }}>{fmtClock(t)}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: C.muted, fontSize: 11, marginTop: 10 }}>
            Times follow your phone’s clock and timezone automatically.
          </Text>
        </>
      )}
    </GlowPanel>
  );
}

function TimeRow({ label, min, onChange }: {
  label: string; min: number; onChange: (m: number) => void;
}) {
  return (
    <View style={[s.row, { marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }]}>
      <Text style={{ color: C.text, fontWeight: '700', flex: 1 }}>{label}</Text>
      <Btn label="−" onPress={() => onChange(min - 30)} />
      <Text style={[s.metric, { marginHorizontal: 10, fontSize: 16, minWidth: 84, textAlign: 'center' }]}>
        {fmtClock(min)}
      </Text>
      <Btn label="＋" onPress={() => onChange(min + 30)} />
    </View>
  );
}

function Seg({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.seg, on && { backgroundColor: C.primary }]}>
      <Text style={{ color: on ? '#fff' : C.muted, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.seg}>
      <Text style={{ color: C.primary, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  h1: { color: C.text, fontSize: 26, fontWeight: '900' },
  avatar: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  name: { color: C.text, fontSize: 20, fontWeight: '800' },
  sub: { color: C.muted, marginTop: 2 },
  metric: { color: C.text, fontSize: 22, fontWeight: '900', marginVertical: 2 },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 10 },
  seg: {
    backgroundColor: C.surfaceAlt, borderRadius: 12,
    paddingHorizontal: 18, paddingVertical: 10,
  },
  timeChip: {
    backgroundColor: 'rgba(37,199,224,0.12)', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(37,199,224,0.35)',
    paddingHorizontal: 10, paddingVertical: 5,
  },
});
