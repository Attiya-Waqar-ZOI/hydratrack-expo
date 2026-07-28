// Home ("Today") — port of the design: greeting + name, big percent beside
// the measuring cylinder, bordered quick-add buttons, a one-line weather
// note, and the last three drinks.
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { AppHeader, LogRow } from '@/lib/chrome';
import { Cylinder } from '@/lib/cylinder';
import { beverageById, fmtVol } from '@/lib/engines';
import { showToast } from '@/lib/toast';
import { C, F, T } from '@/lib/theme';

const QUICK = [150, 250, 350, 500];

export default function Home() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;

  const useOz = p.unit === 'oz';
  const goal = app.effectiveGoal;
  const total = app.todayTotal;
  const remaining = Math.max(0, goal - total);
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
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 24, gap: 26 }}>
        <View>
          <Text style={[T.body, { fontSize: 15 }]}>{greeting}</Text>
          <Text style={[T.h1, { fontSize: 40, lineHeight: 44, letterSpacing: -1.3, marginTop: 3 }]}>{p.name}</Text>
        </View>

        {/* Hero: figure + measuring cylinder */}
        <View style={s.hero}>
          <View>
            <Text style={s.pct}>{Math.round((goal > 0 ? Math.min(1, total / goal) : 0) * 100)}%</Text>
            <Text style={s.totals}>{fmtVol(total, useOz)} of {fmtVol(goal, useOz)}</Text>
            <Text style={[T.body, { fontSize: 15, marginTop: 4 }]}>
              {remaining > 0 ? `${fmtVol(remaining, useOz)} to go` : 'Goal met. Nicely done.'}
            </Text>
          </View>
          <Cylinder goalMl={goal} totalMl={total} />
        </View>

        {/* Quick add */}
        <View>
          <Text style={s.section}>Log a glass</Text>
          <View style={s.quickRow}>
            {QUICK.map((ml) => (
              <Pressable
                key={ml}
                onPress={() => log(ml)}
                style={({ pressed }) => [s.quickBtn, pressed && { backgroundColor: C.neutral200 }]}
              >
                <Text style={s.quickTxt}>{fmtVol(ml, useOz)}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => router.push('/add')} style={s.ghost} hitSlop={6}>
              <Text style={s.ghostTxt}>Other drink</Text>
            </Pressable>
          </View>
        </View>

        {/* Weather */}
        <View>
          <Text style={[s.section, { marginBottom: 4 }]}>Today&apos;s weather</Text>
          <Text style={[T.body, { fontSize: 15, maxWidth: 320 }]}>{weatherLine}</Text>
          {!ctx?.place && (
            <Pressable onPress={() => app.detectEnvironment().catch(() => {})} style={{ marginTop: 6 }} hitSlop={6}>
              <Text style={s.ghostTxt}>Use my location</Text>
            </Pressable>
          )}
        </View>

        {/* Last drinks */}
        <View>
          <Text style={s.section}>Last drinks</Text>
          {recent.length === 0 && (
            <Text style={[T.body, { fontSize: 15 }]}>Nothing logged yet today.</Text>
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
  hero: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 22, paddingTop: 4, paddingHorizontal: 4, marginBottom: -8,
  },
  pct: { fontFamily: F.heading, fontSize: 62, lineHeight: 66, letterSpacing: -2.4, color: C.text },
  totals: { fontFamily: F.heading, fontSize: 19, color: C.text, marginTop: 14 },
  section: { fontFamily: F.heading, fontSize: 19, color: C.text, marginBottom: 12 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  quickBtn: {
    borderWidth: 1, borderColor: C.divider, borderRadius: 2,
    paddingVertical: 9, paddingHorizontal: 15,
  },
  quickTxt: { fontFamily: F.heading, fontSize: 15, color: C.text },
  ghost: { paddingVertical: 9, paddingHorizontal: 4 },
  ghostTxt: { fontFamily: F.heading, fontSize: 15, color: C.accentDeep },
});
