import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { catchUpPlan, hydrationPace, recommendation } from '@/lib/engines';
import { C, card } from '@/lib/theme';

/// Everything analytical that used to crowd the home screen: pace coaching,
/// catch-up plan, smart recommendation, and the weather/location context.
export default function Insights() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;

  const goal = app.effectiveGoal;
  const total = app.todayTotal;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pace = hydrationPace(nowMin, p.wakeMin, p.sleepMin, total, goal);
  const plan = catchUpPlan(Math.max(0, goal - total), nowMin, p.sleepMin);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={s.h1}>Insights</Text>

        {/* Pace */}
        <View style={card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Today&apos;s pace</Text>
            <View style={[s.pill, { backgroundColor: pace.onTrack ? 'rgba(61,220,151,0.15)' : 'rgba(242,166,90,0.15)' }]}>
              <Text style={{ color: pace.onTrack ? C.success : C.warning, fontWeight: '700', fontSize: 12 }}>
                {pace.onTrack ? 'On track' : 'Behind pace'}
              </Text>
            </View>
          </View>
          <Text style={s.sub}>{pace.status}</Text>
        </View>

        {plan && (
          <View style={[card, { backgroundColor: 'rgba(232,180,88,0.10)' }]}>
            <Text style={[s.cardTitle, { color: C.gold }]}>
              {plan.rushed ? '⚡ Catch-up plan' : '🕐 Catch-up plan'}
            </Text>
            <Text style={s.sub}>{plan.message}</Text>
          </View>
        )}

        <View style={[card, { backgroundColor: C.primaryDeep }]}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            💡 {recommendation(total, goal, now.getHours(), 0)}
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  h1: { color: C.text, fontSize: 26, fontWeight: '900' },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 6 },
  sub: { color: C.muted, lineHeight: 19, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.surfaceAlt, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.primary },
  chipTxt: { color: C.text, fontWeight: '600', fontSize: 13 },
  detectBtn: {
    backgroundColor: C.surfaceAlt, borderRadius: 12, paddingHorizontal: 14,
    paddingVertical: 10, alignItems: 'center', marginTop: 10, alignSelf: 'flex-start',
  },
});
