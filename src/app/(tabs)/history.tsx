import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { store } from '@/lib/db';
import { beverageById, fmtVol, todayKey } from '@/lib/engines';
import { C, card } from '@/lib/theme';

const WD = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function History() {
  const app = useApp();
  const goal = app.profile?.dailyGoalMl ?? 1;
  const useOz = app.profile?.unit === 'oz';
  const [selected, setSelected] = useState<string | null>(null);

  // app.version in deps: recompute after every log change.
  const totals = useMemo(
    () => new Map(store.totalsByDay(190).map((t) => [t.dayKey, t.totalMl])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [app.version],
  );

  const days = (n: number) =>
    Array.from({ length: n }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (n - 1 - i));
      return d;
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={s.h1}>History</Text>

        {/* Last 7 days bars */}
        <View style={card}>
          <Text style={s.cardTitle}>Last 7 days</Text>
          <View style={s.bars}>
            {days(7).map((d) => {
              const key = todayKey(d);
              const p = Math.min(1, (totals.get(key) ?? 0) / goal);
              return (
                <View key={key} style={s.barCol}>
                  <Text style={s.barPct}>{Math.round(p * 100)}%</Text>
                  <View style={[s.bar, { height: Math.max(6, 90 * p) }]} />
                  <Text style={s.barDay}>{WD[(d.getDay() + 6) % 7]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Days in pixels (month) */}
        <View style={card}>
          <Text style={s.cardTitle}>Days in pixels — tap a day</Text>
          <View style={s.grid}>
            {days(28).map((d) => {
              const key = todayKey(d);
              const p = Math.min(1, (totals.get(key) ?? 0) / goal);
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelected(key)}
                  style={[
                    s.px,
                    {
                      backgroundColor: p <= 0
                        ? C.surfaceAlt
                        : `rgba(79,124,255,${0.25 + 0.75 * p})`,
                    },
                    selected === key && { borderWidth: 2, borderColor: C.mint },
                  ]}
                >
                  <Text style={s.pxTxt}>{d.getDate()}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {selected && <DayJournal dayKey={selected} useOz={useOz} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function DayJournal({ dayKey, useOz }: { dayKey: string; useOz: boolean }) {
  const logs = store.logsForDay(dayKey);
  const ctx = store.getDayContext(dayKey);
  const total = logs.reduce((s2, l) => s2 + l.amountMl, 0);
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);

  return (
    <View style={card}>
      <Text style={s.cardTitle}>
        📖 {WD[(date.getDay() + 6) % 7]}, {d}/{m}/{y}
      </Text>
      <Text style={s.sub}>{fmtVol(total, useOz)} logged · {logs.length} drinks</Text>
      {ctx?.place && (
        <Text style={s.sub}>
          📍 {ctx.place}{ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C` : ''}
        </Text>
      )}
      {ctx?.note ? <Text style={s.sub}>📝 {ctx.note}</Text> : null}
      {logs.length === 0 && <Text style={s.sub}>Nothing logged this day.</Text>}
      {[...logs].reverse().map((l) => {
        const bev = beverageById(l.beverageId);
        const t = new Date(l.loggedAt);
        return (
          <View key={l.id} style={s.logRow}>
            <Text style={{ fontSize: 18 }}>{bev.emoji}</Text>
            <Text style={s.logName}>{bev.name} · {l.volumeMl} ml</Text>
            <Text style={s.sub}>
              {String(t.getHours()).padStart(2, '0')}:{String(t.getMinutes()).padStart(2, '0')}
              {'  '}+{l.amountMl} ml
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  h1: { color: C.text, fontSize: 26, fontWeight: '900' },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 10 },
  sub: { color: C.muted, marginTop: 2, lineHeight: 19 },
  bars: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 130 },
  barCol: { alignItems: 'center', flex: 1 },
  barPct: { color: C.muted, fontSize: 10, marginBottom: 4 },
  bar: { width: 22, borderRadius: 8, backgroundColor: C.primary },
  barDay: { color: C.muted, fontSize: 10, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  px: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  pxTxt: { color: C.text, fontSize: 11, fontWeight: '600' },
  logRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 8, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    marginTop: 8,
  },
  logName: { color: C.text, fontWeight: '600', flex: 1 },
});
