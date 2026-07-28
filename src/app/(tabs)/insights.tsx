import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { caffeineForDay } from '@/lib/db';
import {
  beverageById, catchUpPlan, fmtVol, hydrationPace, recommendation, todayKey,
} from '@/lib/engines';
import { GlowPanel } from '@/lib/glow';
import { C } from '@/lib/theme';

/// Dense dashboard: stat tiles, a visual pace bar (you vs. where you should
/// be), a coach card, and today's drink timeline.
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
  const plan = catchUpPlan(Math.max(0, goal - total), nowMin, p.sleepMin);
  const caffeine = caffeineForDay(todayKey());
  const pct = goal > 0 ? Math.min(1, total / goal) : 0;
  const expPct = goal > 0 ? Math.min(1, pace.expectedMl / goal) : 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 110 }}>
        <Text style={s.h1}>Insights</Text>

        {/* Stat tiles */}
        <View style={s.grid}>
          <Tile emoji="💧" value={fmtVol(total, useOz)} label="Drank today" colors={['rgba(123,232,245,0.6)', 'rgba(37,199,224,0.6)']} />
          <Tile emoji="🎯" value={fmtVol(goal, useOz)} label={app.env.totalMl > 0 ? `Goal · +${app.env.totalMl} weather` : 'Today’s goal'} colors={['rgba(37,199,224,0.6)', 'rgba(27,143,166,0.6)']} />
          <Tile emoji="☕" value={`${caffeine} mg`} label="Caffeine" colors={['rgba(27,143,166,0.6)', 'rgba(37,199,224,0.6)']} />
          <Tile emoji="🥤" value={`${app.todayLogs.length}`} label="Drinks logged" colors={['rgba(123,232,245,0.6)', 'rgba(27,143,166,0.6)']} />
        </View>

        {/* Pace bar */}
        <GlowPanel glow colors={pace.onTrack ? ['rgba(61,220,151,0.6)', 'rgba(123,232,245,0.6)'] : ['rgba(242,166,90,0.65)', 'rgba(232,132,90,0.6)']}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Today&apos;s pace</Text>
            <View style={[s.pill, { backgroundColor: pace.onTrack ? 'rgba(61,220,151,0.15)' : 'rgba(242,166,90,0.15)' }]}>
              <Text style={{ color: pace.onTrack ? C.success : C.warning, fontWeight: '700', fontSize: 12 }}>
                {pace.onTrack ? 'On track' : 'Behind pace'}
              </Text>
            </View>
          </View>
          <View style={s.track}>
            <View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: pace.onTrack ? C.success : C.warning }]} />
            <View style={[s.marker, { left: `${expPct * 100}%` }]} />
          </View>
          <Text style={s.legend}>▬ you   |  where you should be by now</Text>
          <Text style={s.sub}>{pace.status}</Text>
        </GlowPanel>

        {/* Coach */}
        <GlowPanel colors={['rgba(37,199,224,0.6)', 'rgba(123,232,245,0.5)']}>
          <Text style={[s.cardTitle, { color: C.mint }]}>🧠 Coach</Text>
          {plan && <Text style={s.sub}>{plan.rushed ? '⚡ ' : ''}{plan.message}</Text>}
          <Text style={[s.sub, { marginTop: 6 }]}>💡 {recommendation(total, goal, now.getHours(), 0)}</Text>
        </GlowPanel>

        {/* Today's drinks timeline */}
        <GlowPanel colors={['rgba(37,199,224,0.5)', 'rgba(27,143,166,0.5)']}>
          <Text style={s.cardTitle}>Today&apos;s drinks</Text>
          {app.todayLogs.length === 0 && (
            <Text style={s.sub}>Nothing yet — the first sip sets the tone. 💧</Text>
          )}
          {[...app.todayLogs].reverse().map((l) => {
            const bev = beverageById(l.beverageId);
            const t = new Date(l.loggedAt);
            return (
              <View key={l.id} style={s.logRow}>
                <Text style={{ fontSize: 18 }}>{bev.emoji}</Text>
                <Text style={s.logName}>{bev.name}</Text>
                <Text style={s.sub}>
                  {String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}
                </Text>
                <Text style={[s.logMl, { color: bev.color }]}>+{l.amountMl} ml</Text>
              </View>
            );
          })}
        </GlowPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

function Tile({ emoji, value, label, colors }: {
  emoji: string; value: string; label: string; colors: [string, string];
}) {
  return (
    <View style={{ flexBasis: '47.5%', flexGrow: 1 }}>
      <GlowPanel colors={colors} style={{ padding: 14 }}>
        <Text style={{ fontSize: 20 }}>{emoji}</Text>
        <Text style={s.tileVal}>{value}</Text>
        <Text style={s.tileLabel}>{label}</Text>
      </GlowPanel>
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: C.text, fontSize: 26, fontWeight: '900' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileVal: { color: C.text, fontWeight: '900', fontSize: 20, marginTop: 6 },
  tileLabel: { color: C.muted, fontSize: 12, marginTop: 2 },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 6 },
  sub: { color: C.muted, lineHeight: 19, marginTop: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  track: {
    height: 14, borderRadius: 8, backgroundColor: C.surfaceAlt,
    marginTop: 12, overflow: 'visible',
  },
  fill: { height: 14, borderRadius: 8 },
  marker: {
    position: 'absolute', top: -3, width: 3, height: 20,
    backgroundColor: C.text, borderRadius: 2,
  },
  legend: { color: C.muted, fontSize: 11, marginTop: 8 },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: 6,
  },
  logName: { color: C.text, fontWeight: '700', flex: 1 },
  logMl: { fontWeight: '800' },
});
