import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { autoGoal, useApp } from '@/lib/app-state';
import {
  ACTIVITY_LABELS, ActivityLevel, BMI_LABELS, Climate, bmiCategory, fmtVol,
} from '@/lib/engines';
import { GlowPanel } from '@/lib/glow';
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

/// Reminder preferences (persisted). The scheduling engine hooks in next —
/// these settings are what it will read.
function NotificationSettings() {
  const [on, setOn] = useState(false);
  const [perDay, setPerDay] = useState(6);

  useEffect(() => {
    AsyncStorage.multiGet(['remindersOn', 'remindersPerDay']).then(([a, b]) => {
      if (a[1] != null) setOn(a[1] === '1');
      if (b[1] != null) setPerDay(parseInt(b[1], 10) || 6);
    });
  }, []);

  const save = (nextOn: boolean, nextPerDay: number) => {
    setOn(nextOn);
    setPerDay(nextPerDay);
    AsyncStorage.multiSet([
      ['remindersOn', nextOn ? '1' : '0'],
      ['remindersPerDay', String(nextPerDay)],
    ]);
  };

  return (
    <GlowPanel colors={['rgba(27,143,166,0.6)', 'rgba(37,199,224,0.5)']}>
      <Text style={s.cardTitle}>🔔 Reminders</Text>
      <View style={s.row}>
        <Seg label="Off" on={!on} onPress={() => save(false, perDay)} />
        <Seg label="On" on={on} onPress={() => { save(true, perDay); showToast('🔔 Reminders will arrive between wake & sleep'); }} />
      </View>
      {on && (
        <View style={[s.row, { marginTop: 12, alignItems: 'center' }]}>
          <Btn label="−" onPress={() => save(true, Math.max(2, perDay - 1))} />
          <Text style={[s.metric, { marginHorizontal: 14, fontSize: 18 }]}>
            {perDay} / day
          </Text>
          <Btn label="＋" onPress={() => save(true, Math.min(12, perDay + 1))} />
        </View>
      )}
    </GlowPanel>
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
});
