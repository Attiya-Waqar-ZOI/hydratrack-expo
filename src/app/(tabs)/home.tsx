// Home ("Today") — soft-card layout: greeting headline on the page, then
// each section in its own rounded surface card so the structure reads at
// a glance. Hero pairs the big percent with the animated water glass.
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { AppHeader, LogRow } from '@/lib/chrome';
import { beverageById, fmtSigned, fmtVol } from '@/lib/engines';
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
    if (app.weatherAuto) return 'Checking today’s weather…';
    return 'Turn on location once — the goal then adjusts itself for heat every day.';
  })();

  const log = (ml: number, bevId = 'water') => {
    const bev = beverageById(bevId);
    const id = app.addDrink(ml, bev);
    showToast(`${fmtVol(ml, useOz)} ${bev.name} added`, {
      actionLabel: 'Undo',
      onAction: () => app.undo(id),
    });
  };

  const enableWeather = async () => {
    const ok = await app.setWeatherAuto(true).catch(() => false);
    showToast(ok
      ? 'Weather is on — your goal now adjusts automatically each day'
      : 'Could not read the weather — check location permission');
  };

  // The glass wears the color of the LAST drink logged today: coffee turns
  // it brown, juice orange… water brings back the classic blue.
  const lastLog = app.todayLogs[app.todayLogs.length - 1];
  const mix = lastLog ? beverageById(lastLog.beverageId).color : null;
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
            <GoalGlass
              fill={progress} width={104} ground={C.surface}
              waterColor={mix ?? C.accent300}
            />
          </View>
        </View>

        {/* Quick add card: the user's starred drinks, one tap each.
            Before any favorite exists, plain water sizes fill in. */}
        <View style={s.card}>
          <Text style={s.section}>{app.favorites.length > 0 ? 'Favorites' : 'Log a glass'}</Text>
          <View style={s.quickRow}>
            {app.favorites.length > 0
              ? app.favorites.map((f) => {
                const b = beverageById(f.beverageId);
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => log(f.volumeMl, f.beverageId)}
                    style={({ pressed }) => [s.quickBtn, pressed && { backgroundColor: C.accent100 }]}
                  >
                    <Text style={s.quickTxt}>{b.emoji} {b.name} · {fmtVol(f.volumeMl, useOz)}</Text>
                  </Pressable>
                );
              })
              : QUICK.map((ml) => (
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
          {app.favorites.length === 0 && (
            <Text style={[T.body, { fontSize: 13, marginTop: 10 }]}>
              ☆ Star a drink and size in “Other drink” to pin it here.
            </Text>
          )}
        </View>

        {/* Weather + steps card */}
        <View style={s.card}>
          <Text style={[s.section, { marginBottom: 6 }]}>Today&apos;s conditions</Text>
          <Text style={[T.body, { fontSize: 14.5, lineHeight: 21 }]}>{weatherLine}</Text>
          {app.stepsToday != null && (
            <Text style={[T.body, { fontSize: 14.5, lineHeight: 21, marginTop: 4 }]}>
              🚶 {app.stepsToday.toLocaleString()} steps today
              {app.stepBoost > 0 ? ` — goal raised by ${app.stepBoost} ml.` : '.'}
            </Text>
          )}
          {!ctx?.place && !app.weatherAuto && (
            <Pressable onPress={enableWeather} style={{ marginTop: 8 }} hitSlop={6}>
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
            const b = beverageById(l.beverageId);
            return (
              <LogRow
                key={l.id}
                name={`${b.emoji} ${b.name}`}
                time={`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`}
                amount={fmtSigned(l.amountMl, useOz)}
                onPress={() => router.push({ pathname: '/edit-log', params: { id: l.id } })}
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
