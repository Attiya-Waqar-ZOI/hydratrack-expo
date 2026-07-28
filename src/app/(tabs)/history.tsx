// History — port of the design: a seven-day bar chart with a dashed goal
// line, a month heat grid with a tier legend, and the picked day's journal.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line } from 'react-native-svg';

import { useApp } from '@/lib/app-state';
import { AppHeader, LogRow } from '@/lib/chrome';
import { store } from '@/lib/db';
import { beverageById, fmtVol, todayKey } from '@/lib/engines';
import { C, F, T } from '@/lib/theme';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

const BAR_MAX = 80;    // bar height at 100% of goal
const LABEL_ZONE = 27; // baseline + gap + day label below the bars

export default function History() {
  const app = useApp();
  const goal = app.profile?.dailyGoalMl ?? 1;
  const useOz = app.profile?.unit === 'oz';
  const [selected, setSelected] = useState<string>(todayKey());

  // app.version in deps: recompute after every log change.
  const totals = useMemo(
    () => new Map(store.totalsByDay(190).map((t) => [t.dayKey, t.totalMl])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.version],
  );
  const pctOf = (key: string) => (totals.get(key) ?? 0) / goal;

  // Last seven days, today last.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const hit = week.filter((d) => pctOf(todayKey(d)) >= 1).length;

  // Current calendar month, Monday-start offset.
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;

  const tierFill = (p: number, future: boolean) => {
    if (future || p <= 0) return C.neutral200;
    if (p >= 0.95) return C.accent500;
    if (p >= 0.75) return C.accent300;
    if (p >= 0.5) return C.accent200;
    return C.accent100;   // anything logged at all reads as a hint of blue
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 24, gap: 30 }}>
        <View>
          <Text style={T.h1}>History</Text>
          <Text style={[T.body, { fontSize: 16, marginTop: 8, maxWidth: 300 }]}>
            {hit} of the last seven days met your goal. Tap a bar to see that day.
          </Text>
        </View>

        {/* Week bars */}
        <View style={{ paddingTop: 22 }}>
          <View style={s.chart}>
            {/* Dashed goal line */}
            <View style={[s.goalDash, { bottom: LABEL_ZONE + BAR_MAX - 1 }]} pointerEvents="none">
              <Svg width="100%" height={2}>
                <Line x1="0" y1="1" x2="100%" y2="1" stroke={C.faint} strokeWidth={1} strokeDasharray="4,4" />
              </Svg>
              <Text style={s.goalTag}>goal</Text>
            </View>
            {week.map((d) => {
              const key = todayKey(d);
              const p = pctOf(key);
              const picked = selected === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelected(key)}
                  style={({ pressed }) => [s.barCol, pressed && { opacity: 0.72 }]}
                >
                  {picked && <Text style={s.barPct}>{Math.round(p * 100)}%</Text>}
                  <View style={{
                    width: '100%',
                    height: Math.max(3, Math.min(1.25, p) * BAR_MAX),
                    backgroundColor: picked ? C.accent : C.accent300,
                  }} />
                  <View style={s.baseline} />
                  <Text style={[s.barDay, picked && { color: C.text }]}>{WD[(d.getDay() + 6) % 7]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Month grid */}
        <View>
          <Text style={s.section}>{MONTHS[now.getMonth()]}</Text>
          <View style={s.dowRow}>
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => (
              <Text key={i} style={s.dow}>{l}</Text>
            ))}
          </View>
          <View style={s.monthGrid}>
            {Array.from({ length: lead }, (_, i) => (
              <View key={`b${i}`} style={s.cellWrap} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const n = i + 1;
              const d = new Date(now.getFullYear(), now.getMonth(), n);
              const key = todayKey(d);
              const future = d > now;
              return (
                <View key={key} style={s.cellWrap}>
                  <Pressable
                    onPress={() => setSelected(key)}
                    style={[s.cell, { backgroundColor: tierFill(pctOf(key), future) }]}
                  >
                    <Text style={[s.cellTxt, future && { color: C.faint }]}>{n}</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          <View style={s.legendRow}>
            <Text style={s.legendTxt}>none</Text>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[C.neutral200, C.accent100, C.accent200, C.accent300, C.accent500].map((c, i) => (
                <View key={i} style={{ width: 14, height: 14, backgroundColor: c }} />
              ))}
            </View>
            <Text style={s.legendTxt}>on goal</Text>
          </View>
        </View>

        <DayJournal dayKey={selected} useOz={!!useOz} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DayJournal({ dayKey, useOz }: { dayKey: string; useOz: boolean }) {
  const logs = store.logsForDay(dayKey);
  const ctx = store.getDayContext(dayKey);
  const total = logs.reduce((sum, l) => sum + l.amountMl, 0);
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const isToday = dayKey === todayKey();
  const isFuture = dayKey > todayKey();
  const title = isToday
    ? `Today, ${d} ${MONTHS[m - 1]}`
    : `${WD[(date.getDay() + 6) % 7]}, ${d} ${MONTHS[m - 1]}`;

  if (isFuture) {
    return (
      <View>
        <Text style={[s.section, { marginBottom: 0 }]}>{title}</Text>
        <Text style={[T.body, { fontSize: 15, marginTop: 3 }]}>
          This day hasn&apos;t happened yet
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={[s.section, { marginBottom: 0 }]}>{title}</Text>
      <Text style={[T.body, { fontSize: 15, marginTop: 3 }]}>
        {logs.length > 0
          ? `${fmtVol(total, useOz)} logged in ${logs.length} drinks`
          : 'Nothing logged this day'}
        {ctx?.place ? ` · ${ctx.place}` : ''}
      </Text>
      {ctx?.note ? (
        <Text style={[T.body, { fontSize: 15, marginTop: 2, fontStyle: 'italic' }]}>“{ctx.note}”</Text>
      ) : null}
      <View style={{ marginTop: 12 }}>
        {[...logs].reverse().map((l) => {
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
    </View>
  );
}

const s = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 9, height: 132, position: 'relative' },
  goalDash: { position: 'absolute', left: 0, right: 0, height: 2 },
  goalTag: {
    position: 'absolute', right: 0, top: -8,
    fontFamily: F.body, fontSize: 11.5, color: C.muted,
    backgroundColor: C.bg, paddingHorizontal: 4,
  },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' },
  barPct: { fontFamily: F.heading, fontSize: 12.5, color: C.text, marginBottom: 5 },
  baseline: { height: 1, width: '100%', backgroundColor: C.text },
  barDay: { marginTop: 7, fontFamily: F.body, fontSize: 13.5, color: C.muted },
  section: { fontFamily: F.heading, fontSize: 21, letterSpacing: -0.3, color: C.text, marginBottom: 10 },
  dowRow: { flexDirection: 'row', marginBottom: 6 },
  dow: { width: '14.28%', textAlign: 'center', fontFamily: F.body, fontSize: 11, color: C.faint },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: '14.28%', padding: 2.5 },
  cell: {
    aspectRatio: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  cellTxt: { fontFamily: F.body, fontSize: 11.5, color: '#444141' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  legendTxt: { fontFamily: F.body, fontSize: 13, color: C.muted },
});
