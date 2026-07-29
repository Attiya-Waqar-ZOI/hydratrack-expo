// Home ("Today") — soft-card layout: greeting headline on the page, then
// each section in its own rounded surface card so the structure reads at
// a glance. Hero pairs the big percent with the animated water glass.
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { AppHeader, LogRow } from '@/lib/chrome';
import { beverageById, fmtVol } from '@/lib/engines';
import { GoalGlass } from '@/lib/glass';
import { showToast } from '@/lib/toast';
import { C, F, R, T } from '@/lib/theme';

const QUICK = [150, 250, 350, 500];

export default function Home() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;

  const useOz = p.unit === 'oz';
  const goal = app.effectiveGoal;
  const total = app.todayTotal;
  // Deliberately uncapped: past the goal the figure keeps counting
  // (e.g. 112%) and the glass overflows.
  const progress = goal > 0 ? total / goal : 0;
  const remaining = Math.max(0, goal - total);
  const overMl = Math.max(0, total - goal);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const ctx = app.dayContext;
  const boost = app.env.totalMl;
  const weatherLine = (() => {
    if (ctx?.place && ctx.tempC != null) {
      const t = Math.round(ctx.tempC);
      const adj = t < 15 ? 'Cool' : t < 25 ? 'Mild' : t < 32 ? 'Warm' : 'Hot';
      const tail = boost > 0
        ? `Your goal is ${boost} ml higher than usual today.`
        : 'No weather adjustment today.';
      return `${adj}, ${t}°C in ${ctx.place}. ${tail}`;
    }
    return 'Turn on location to adjust your goal for heat and altitude.';
  })();

  const log = (ml: number) => {
    const id = app.addDrink(ml, beverageById('water'));
    showToast(`${fmtVol(ml, useOz)} added`, {
      actionLabel: 'Undo',
      onAction: () => app.undo(id),
    });
  };

  const recent = [...app.todayLogs].reverse().slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, gap: 14 }}>
        {/* Greeting lives on the page itself */}
        <View style={{ paddingHorizontal: 6, marginBottom: 4 }}>
          <Text style={[T.body, { fontSize: 15 }]}>{greeting}</Text>
          <Text style={[T.h1, { fontSize: 38, lineHeight: 42, letterSpacing: -1.2, marginTop: 2 }]}>{p.name}</Text>
        </View>

        {/* Hero card: figure + water glass */}
        <View style={s.card}>
          <View style={s.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.pct}>{Math.round(progress * 100)}%</Text>
              <Text style={s.totals}>{fmtVol(total, useOz)} of {fmtVol(goal, useOz)}</Text>
              <Text style={[T.body, { fontSize: 14.5, marginTop: 3 }]}>
                {remaining > 0
                  ? `${fmtVol(remaining, useOz)} to go`
                  : overMl > 0
                    ? `${fmtVol(overMl, useOz)} over goal. Overflowing.`
                    : 'Goal met. Nicely done.'}
              </Text>
            </View>
            <GoalGlass fill={progress} width={104} ground={C.surface} />
          </View>
        </View>

        {/* Quick add card */}
        <View style={s.card}>
          <Text style={s.section}>Log a glass</Text>
          <View style={s.quickRow}>
            {QUICK.map((ml) => (
              <Pressable
                key={ml}
                onPress={() => log(ml)}
                style={({ pressed }) => [s.quickBtn, pressed && { backgroundColor: C.accent100 }]}
              >
                <Text style={s.quickTxt}>{fmtVol(ml, useOz)}</Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => router.push('/add')}
              style={({ pressed }) => [s.otherBtn, pressed && { backgroundColor: C.accent200 }]}
              hitSlop={6}
            >
              <Text style={s.ghostTxt}>Other drink</Text>
            </Pressable>
          </View>
        </View>

        {/* Weather card */}
        <View style={s.card}>
          <Text style={[s.section, { marginBottom: 6 }]}>Today&apos;s weather</Text>
          <Text style={[T.body, { fontSize: 14.5, lineHeight: 21 }]}>{weatherLine}</Text>
          {app.stepBoost > 0 && app.stepsToday != null && (
            <Text style={[T.body, { fontSize: 14.5, lineHeight: 21, marginTop: 4 }]}>
              🚶 Plus {app.stepBoost} ml for {app.stepsToday.toLocaleString()} steps today.
            </Text>
          )}
          {!ctx?.place && (
            <Pressable onPress={() => app.detectEnvironment().catch(() => {})} style={{ marginTop: 8 }} hitSlop={6}>
              <Text style={s.ghostTxt}>Use my location</Text>
            </Pressable>
          )}
        </View>

        {/* Last drinks card */}
        <View style={s.card}>
          <Text style={[s.section, { marginBottom: 4 }]}>Last drinks</Text>
          {recent.length === 0 && (
            <Text style={[T.body, { fontSize: 14.5, marginTop: 4 }]}>Nothing logged yet today.</Text>
          )}
          {recent.map((l) => {
            const t = new Date(l.loggedAt);
            return (
              <LogRow
                key={l.id}
                name={beverageById(l.beverageId).name}
                time={`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`}
                amount={`+${fmtVol(l.amountMl, useOz)}`}
              />
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface,
    borderRadius: R.lg,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  pct: { fontFamily: F.heading, fontSize: 54, lineHeight: 58, letterSpacing: -2, color: C.text },
  totals: { fontFamily: F.heading, fontSize: 18, color: C.text, marginTop: 8 },
  section: { fontFamily: F.heading, fontSize: 18, letterSpacing: -0.2, color: C.text, marginBottom: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, alignItems: 'center' },
  quickBtn: {
    backgroundColor: C.bg, borderRadius: R.md,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  quickTxt: { fontFamily: F.heading, fontSize: 14.5, color: C.text },
  ghost: { paddingVertical: 10, paddingHorizontal: 4 },
  otherBtn: {
    backgroundColor: C.accent100, borderRadius: R.md,
    paddingVertical: 10, paddingHorizontal: 16,
  },
  ghostTxt: { fontFamily: F.heading, fontSize: 14.5, color: C.accentDeep },
});
