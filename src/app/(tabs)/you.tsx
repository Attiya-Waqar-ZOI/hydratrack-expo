import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';

import { autoGoal, useApp } from '@/lib/app-state';
import {
  ACTIVITY_LABELS, ActivityLevel, BMI_LABELS, Climate, bmiCategory, fmtVol,
} from '@/lib/engines';
import { C, card } from '@/lib/theme';

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
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={s.h1}>You</Text>

        <View style={card}>
          <Text style={s.name}>{p.name}</Text>
          <Text style={s.sub}>
            {p.age} yrs · {p.gender === 'male' ? 'Male' : 'Female'} ·{' '}
            {ACTIVITY_LABELS[p.activity as ActivityLevel]}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={[card, { flex: 1 }]}>
            <Text style={s.sub}>BMI</Text>
            <Text style={s.metric}>{p.bmi.toFixed(1)}</Text>
            <Text style={{ color: C.mint, fontWeight: '700' }}>
              {BMI_LABELS[bmiCategory(p.bmi)]}
            </Text>
          </View>
          <View style={[card, { flex: 1 }]}>
            <Text style={s.sub}>Daily goal</Text>
            <Text style={s.metric}>{fmtVol(p.dailyGoalMl, useOz)}</Text>
            <Text style={{ color: C.primary, fontWeight: '700' }}>
              {p.useCustomGoal ? 'Custom' : 'Auto'}
            </Text>
          </View>
        </View>

        <View style={card}>
          <Text style={s.cardTitle}>Daily goal</Text>
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
        </View>

        <View style={card}>
          <Text style={s.cardTitle}>Volume unit</Text>
          <View style={s.row}>
            <Seg label="ml" on={!useOz} onPress={() => setUnit('ml')} />
            <Seg label="oz" on={useOz} onPress={() => setUnit('oz')} />
          </View>
        </View>

        <Pressable style={[card, { borderColor: 'rgba(240,98,119,0.35)' }]} onPress={confirmReset}>
          <Text style={{ color: C.danger, fontWeight: '800' }}>🗑 Reset all data</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Seg({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[s.seg, on && { backgroundColor: C.primary }]}
    >
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
