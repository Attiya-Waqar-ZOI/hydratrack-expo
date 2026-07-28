// Insights ("Coach") — port of the design: a spoken pace line under the
// headline, the pace bar with an ink target marker, one concrete next
// action, and the day's drink list.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { useApp } from '@/lib/app-state';
import { AppHeader, LogRow } from '@/lib/chrome';
import { caffeineForDay, store } from '@/lib/db';
import { beverageById, fmtVol, hydrationPace, todayKey } from '@/lib/engines';
import { C, F, T } from '@/lib/theme';

const NATIVE = Platform.OS !== 'web';

export default function Insights() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;

  const useOz = p.unit === 'oz';
  const goal = app.effectiveGoal;
  const total = app.todayTotal;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pace = hydrationPace(nowMin, p.wakeMin, p.sleepMin, total, goal);
  const remain = Math.max(0, goal - total);
  const pct = goal > 0 ? Math.min(1, total / goal) : 0;
  const expPct = goal > 0 ? Math.min(1, pace.expectedMl / goal) : 0;

  const paceLine = pace.deltaMl >= 0
    ? `${fmtVol(pace.deltaMl, useOz)} ahead of where you need to be.`
    : `${fmtVol(-pace.deltaMl, useOz)} behind where you need to be.`;

  const nextAction = (() => {
    if (remain <= 0) return 'Nothing needed. You have met today’s goal.';
    const servings = Math.max(1, Math.ceil(remain / 250));
    const hoursLeft = Math.max(0.5, (p.sleepMin - nowMin) / 60);
    const every = Math.max(0.5, Math.round((hoursLeft / servings) * 10) / 10);
    return `Drink 250 ml now, then a glass roughly every ${every} hours until bed.`;
  })();

  const rows = [...app.todayLogs].reverse();

  // ── Week figures and patterns, computed from the last seven days ──
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return todayKey(d);
  });
  const totalsMap = new Map(store.totalsByDay(10).map((t) => [t.dayKey, t.totalMl]));
  const weekTotal = week.reduce((sum, k) => sum + (totalsMap.get(k) ?? 0), 0);
  const avg = Math.round(weekTotal / 7);
  const daysOnGoal = week.filter((k) => (totalsMap.get(k) ?? 0) >= goal).length;

  let streak = 0;
  for (let i = week.length - 1; i >= 0; i--) {
    if ((totalsMap.get(week[i]) ?? 0) >= goal) streak++;
    else if (i < week.length - 1) break;   // today not met yet doesn't break the chain
    else continue;
  }

  let morningMl = 0, waterMl = 0, allMl = 0;
  for (const k of week) {
    for (const l of store.logsForDay(k)) {
      allMl += l.amountMl;
      if (new Date(l.loggedAt).getHours() < 12) morningMl += l.amountMl;
      if (l.beverageId === 'water' || l.beverageId === 'sparkling') waterMl += l.amountMl;
    }
  }
  const caffeine = caffeineForDay(todayKey());
  const morningShare = allMl > 0 ? morningMl / allMl : 0;
  const waterShare = allMl > 0 ? waterMl / allMl : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, gap: 14 }}>
        <View style={{ paddingHorizontal: 6, marginBottom: 4 }}>
          <Text style={T.h1}>Coach</Text>
          <Text style={[T.body, { fontSize: 16, marginTop: 8, maxWidth: 300 }]}>{paceLine}</Text>
        </View>

        {/* Pace bar */}
        <View style={s.card}>
          <Text style={s.paceState}>{pace.onTrack ? 'On pace' : 'Behind'}</Text>
          <View style={s.track}>
            <View style={[s.fill, { width: `${pct * 100}%` }]} />
            <View style={[s.marker, { left: `${expPct * 100}%` }]}>
              <GoalStar />
            </View>
          </View>
          <View style={s.scaleRow}>
            <Text style={s.scaleTxt}>{fmtVol(total, useOz)} so far</Text>
            <Text style={s.scaleTxt}>{fmtVol(goal, useOz)} by bedtime</Text>
          </View>
        </View>

        {/* Next action */}
        <View style={s.card}>
          <Text style={s.section}>Do this next</Text>
          <Text style={[T.body, { fontSize: 16, maxWidth: 320 }]}>{nextAction}</Text>
        </View>

        {/* This week */}
        <View style={s.card}>
          <Text style={[s.section, { marginBottom: 14 }]}>This week</Text>
          <View style={s.figRow}>
            <View style={{ flex: 1 }}>
              <Text style={T.kicker}>Average</Text>
              <Text style={s.fig}>{fmtVol(avg, useOz)}</Text>
              <Text style={s.figNote}>a day</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.kicker}>On goal</Text>
              <Text style={s.fig}>{daysOnGoal} of 7</Text>
              <Text style={s.figNote}>days</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={T.kicker}>Streak</Text>
              <Text style={s.fig}>{streak}</Text>
              <Text style={s.figNote}>{streak === 1 ? 'day' : 'days'}</Text>
            </View>
          </View>
          {allMl > 0 ? (
            <View style={{ gap: 12, marginTop: 20 }}>
              <MetricBar label="Before noon" frac={morningShare} value={`${Math.round(morningShare * 100)}%`} />
              <MetricBar label="Plain water" frac={waterShare} value={`${Math.round(waterShare * 100)}%`} />
              <MetricBar
                label="Caffeine today"
                frac={Math.min(1, caffeine / 400)}
                value={`${caffeine} mg`}
                warn={caffeine >= 300}
              />
            </View>
          ) : (
            <Text style={[T.body, { fontSize: 14, marginTop: 16 }]}>
              Log a few days and patterns appear here
            </Text>
          )}
        </View>

        {/* Today's drinks */}
        <View style={s.card}>
          <Text style={[s.section, { marginBottom: 10 }]}>Today&apos;s drinks</Text>
          {rows.length === 0 && <Text style={[T.body, { fontSize: 15 }]}>Nothing logged yet today.</Text>}
          {rows.map((l) => {
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

/// The pace target: a big golden star that breathes gently.
function GoalStar() {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={{
        transform: [
          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) },
          { rotate: pulse.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '6deg'] }) },
        ],
        shadowColor: '#E8B04B', shadowOpacity: 0.55, shadowRadius: 7,
        shadowOffset: { width: 0, height: 2 }, elevation: 4,
      }}
    >
      <Svg width={32} height={32} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id="starGold" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFD97A" />
            <Stop offset="0.55" stopColor="#F0B34A" />
            <Stop offset="1" stopColor="#D18F22" />
          </LinearGradient>
        </Defs>
        <Path
          d="M12 2l2.9 6.2 6.6.8-4.9 4.6 1.3 6.6L12 17l-5.9 3.2 1.3-6.6L2.5 9l6.6-.8z"
          fill="url(#starGold)"
          stroke="#A87716"
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

/// One-line pattern metric: label, thin bar, serif value.
function MetricBar({ label, frac, value, warn = false }: {
  label: string; frac: number; value: string; warn?: boolean;
}) {
  return (
    <View style={s.metricRow}>
      <Text style={s.metricLabel}>{label}</Text>
      <View style={s.metricTrack}>
        <View style={[
          s.metricFill,
          { width: `${Math.max(2, Math.min(1, frac) * 100)}%` },
          warn && { backgroundColor: C.accent2400 },
        ]} />
      </View>
      <Text style={[s.metricVal, warn && { color: C.accent2Deep }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderRadius: 18,
    paddingHorizontal: 18, paddingVertical: 16,
  },
  paceState: { fontFamily: F.heading, fontSize: 15, color: C.text, marginBottom: 9 },
  track: { height: 12, borderRadius: 999, backgroundColor: C.bg, overflow: 'visible' },
  fill: { height: 12, borderRadius: 999, backgroundColor: C.accent },
  marker: { position: 'absolute', top: -10, marginLeft: -16 },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9 },
  scaleTxt: { fontFamily: F.body, fontSize: 13.5, color: C.muted },
  section: { fontFamily: F.heading, fontSize: 18, letterSpacing: -0.2, color: C.text, marginBottom: 4 },
  figRow: { flexDirection: 'row', gap: 16 },
  fig: { fontFamily: F.heading, fontSize: 26, letterSpacing: -0.5, color: C.text, marginTop: 3 },
  figNote: { fontFamily: F.body, fontSize: 12.5, color: C.faint, marginTop: 1 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metricLabel: { fontFamily: F.body, fontSize: 13.5, color: C.muted, width: 104 },
  metricTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: C.bg },
  metricFill: { height: 8, borderRadius: 999, backgroundColor: C.accent },
  metricVal: { fontFamily: F.heading, fontSize: 14, color: C.text, minWidth: 52, textAlign: 'right' },
});
