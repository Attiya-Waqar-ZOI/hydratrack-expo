import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useApp } from '@/lib/app-state';
import {
  QUICK_AMOUNTS, beverageById, catchUpPlan, fmtVol, hydrationPace,
  recommendation, tempBoostMl,
} from '@/lib/engines';
import { C, card } from '@/lib/theme';

export default function Home() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;

  const useOz = p.unit === 'oz';
  const goal = app.effectiveGoal;
  const total = app.todayTotal;
  const progress = goal > 0 ? Math.min(1, total / goal) : 0;
  const remaining = Math.max(0, goal - total);
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const pace = hydrationPace(nowMin, p.wakeMin, p.sleepMin, total, goal);
  const plan = catchUpPlan(remaining, nowMin, p.sleepMin);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const quickAdd = (ml: number) => {
    const id = app.addDrink(ml, beverageById('water'));
    Alert.alert('Logged 💧', `+${fmtVol(ml, useOz)} water`, [
      { text: 'Undo', onPress: () => app.undo(id) },
      { text: 'OK' },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <View>
          <Text style={{ color: C.muted }}>{greeting}</Text>
          <Text style={s.name}>{p.name}</Text>
        </View>

        {/* Hero ring */}
        <View style={[card, { alignItems: 'center', paddingVertical: 26 }]}>
          <Ring progress={progress} />
          <Text style={s.remaining}>
            {remaining === 0
              ? '🎉 Goal reached — nicely done!'
              : `${fmtVol(remaining, useOz)} to go today`}
          </Text>
          <View style={[s.pill, { backgroundColor: pace.onTrack ? 'rgba(61,220,151,0.15)' : 'rgba(242,166,90,0.15)' }]}>
            <Text style={{ color: pace.onTrack ? C.success : C.warning, fontWeight: '700', fontSize: 12 }}>
              {pace.onTrack ? 'On track' : 'Behind pace'}
            </Text>
          </View>
          <Text style={[s.sub, { textAlign: 'center', marginTop: 6 }]}>{pace.status}</Text>
        </View>

        {/* Quick add */}
        <View style={card}>
          <View style={s.rowBetween}>
            <Text style={s.cardTitle}>Quick add water</Text>
            <Pressable onPress={() => router.push('/add')}>
              <Text style={{ color: C.primary, fontWeight: '700' }}>More drinks →</Text>
            </Pressable>
          </View>
          <View style={s.chips}>
            {QUICK_AMOUNTS.map((ml) => (
              <Pressable key={ml} style={s.chip} onPress={() => quickAdd(ml)}>
                <Text style={s.chipTxt}>💧 {fmtVol(ml, useOz)}</Text>
              </Pressable>
            ))}
          </View>
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
            💡 {recommendation(total, goal, hour, 0)}
          </Text>
        </View>

        <WeatherCard />
        <NoteCard />
      </ScrollView>
    </SafeAreaView>
  );
}

function Ring({ progress }: { progress: number }) {
  const size = 210;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={C.surfaceAlt} strokeWidth={stroke} fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={C.primary} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 40, fontWeight: '900' }}>
          {Math.round(progress * 100)}%
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>of today&apos;s goal</Text>
      </View>
    </View>
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
        {boost > 0 && (
          <Text style={{ color: C.gold, fontWeight: '800' }}>+{boost} ml goal</Text>
        )}
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

function NoteCard() {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const note = app.dayContext?.note;

  if (editing) {
    return (
      <View style={card}>
        <Text style={s.cardTitle}>📝 Day note</Text>
        <TextInput
          style={s.noteInput} value={draft} onChangeText={setDraft}
          placeholder="e.g. Fasting today — drinking less until sunset"
          placeholderTextColor={C.muted} multiline maxLength={200} autoFocus
        />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable style={s.detectBtn} onPress={() => setEditing(false)}>
            <Text style={{ color: C.muted, fontWeight: '700' }}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[s.detectBtn, { backgroundColor: C.primary }]}
            onPress={() => { app.saveNote(draft); setEditing(false); }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <Pressable style={card} onPress={() => { setDraft(note ?? ''); setEditing(true); }}>
      <Text style={s.cardTitle}>📝 Day note</Text>
      <Text style={s.sub}>
        {note?.length
          ? note
          : 'Add context — fasting, workout, travel… saved with today’s history.'}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  name: { color: C.text, fontSize: 24, fontWeight: '900' },
  remaining: { color: C.text, fontWeight: '700', marginTop: 12 },
  pill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  sub: { color: C.muted, lineHeight: 19, marginTop: 2 },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
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
  noteInput: {
    backgroundColor: C.surfaceAlt, color: C.text, borderRadius: 12,
    padding: 12, minHeight: 70, textAlignVertical: 'top', marginBottom: 10,
  },
});
