import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { catchUpPlan, hydrationPace, recommendation, tempBoostMl } from '@/lib/engines';
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

        <WeatherCard />
      </ScrollView>
    </SafeAreaView>
  );
}

function WeatherCard() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const ctx = app.dayContext;
  const boost = app.env.totalMl;

  const detect = async () => {
    setBusy(true);
    const result = await app.detectEnvironment();
    setBusy(false);
    if (!result) Alert.alert('Location unavailable', 'Check permissions, or set weather manually.');
  };

  const manual = [
    { label: 'Comfortable', t: 20 }, { label: 'Warm', t: 28 },
    { label: 'Hot', t: 35 }, { label: 'Scorching', t: 40 },
  ];

  return (
    <View style={card}>
      <View style={s.rowBetween}>
        <Text style={s.cardTitle}>🌡 Weather & location</Text>
        {boost > 0 && <Text style={{ color: C.gold, fontWeight: '800' }}>+{boost} ml goal</Text>}
      </View>
      <Text style={s.sub}>
        {ctx?.place
          ? `📍 ${ctx.place}${ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C` : ''}`
          : 'Detect your location for live weather-adjusted goals.'}
      </Text>
      {(app.env.altitudeMl > 0 || app.env.aridityMl > 0) && (
        <Text style={s.sub}>
          {app.env.altitudeMl > 0 ? `+${app.env.altitudeMl} ml altitude ` : ''}
          {app.env.aridityMl > 0 ? `+${app.env.aridityMl} ml dry air` : ''}
        </Text>
      )}
      <Pressable style={s.detectBtn} onPress={detect} disabled={busy}>
        <Text style={{ color: C.primary, fontWeight: '700' }}>
          {busy ? 'Detecting…' : ctx?.place ? '📍 Update' : '📍 Detect'}
        </Text>
      </Pressable>
      <View style={[s.chips, { marginTop: 10 }]}>
        {manual.map((m) => (
          <Pressable
            key={m.label}
            style={[s.chip, app.env.tempMl > 0 && tempBoostMl(m.t) === app.env.tempMl && s.chipOn]}
            onPress={() => app.setManualTemp(m.t)}
          >
            <Text style={s.chipTxt}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
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
