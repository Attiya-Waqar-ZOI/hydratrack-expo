import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { useApp } from '@/lib/app-state';
import { beverageById, fmtVol } from '@/lib/engines';
import { C, card } from '@/lib/theme';

const QUICK = [150, 250, 350, 500];

/// Minimal home: today's progress vs target + drink logging. Everything
/// analytical lives in the Insights tab; the day note hides behind the
/// top-right icon.
export default function Home() {
  const app = useApp();
  const [showNote, setShowNote] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customMl, setCustomMl] = useState('');

  const p = app.profile;
  if (!p) return null;

  const useOz = p.unit === 'oz';
  const goal = app.effectiveGoal;
  const total = app.todayTotal;
  const progress = goal > 0 ? Math.min(1, total / goal) : 0;
  const remaining = Math.max(0, goal - total);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const hasNote = !!app.dayContext?.note?.length;

  const log = (ml: number) => {
    const id = app.addDrink(ml, beverageById('water'));
    Alert.alert('Logged 💧', `+${fmtVol(ml, useOz)} water`, [
      { text: 'Undo', onPress: () => app.undo(id) },
      { text: 'OK' },
    ]);
  };

  const logCustom = () => {
    const ml = parseInt(customMl, 10);
    if (Number.isNaN(ml) || ml <= 0) return;
    log(Math.min(3000, ml));
    setCustomMl('');
    setCustomOpen(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        {/* Header: greeting + note icon */}
        <View style={s.headerRow}>
          <View>
            <Text style={{ color: C.muted }}>{greeting}</Text>
            <Text style={s.name}>{p.name}</Text>
          </View>
          <Pressable
            onPress={() => setShowNote(!showNote)}
            style={[s.noteBtn, hasNote && { backgroundColor: 'rgba(79,124,255,0.18)' }]}
            hitSlop={8}
          >
            <Text style={{ fontSize: 20 }}>{hasNote ? '📌' : '📝'}</Text>
          </Pressable>
        </View>

        {showNote && <NoteEditor onDone={() => setShowNote(false)} />}

        {/* Today's progress */}
        <View style={[card, { alignItems: 'center', paddingVertical: 30 }]}>
          <Ring progress={progress} />
          <Text style={s.totals}>
            {fmtVol(total, useOz)} / {fmtVol(goal, useOz)}
          </Text>
          <Text style={s.remaining}>
            {remaining === 0 ? '🎉 Goal reached — nicely done!' : `${fmtVol(remaining, useOz)} to go`}
          </Text>
        </View>

        {/* Add drink */}
        <View style={card}>
          <Text style={s.cardTitle}>Add a drink</Text>
          <View style={s.chips}>
            {QUICK.map((ml) => (
              <Pressable key={ml} style={s.chip} onPress={() => log(ml)}>
                <Text style={s.chipTxt}>💧 {fmtVol(ml, useOz)}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[s.chip, customOpen && { backgroundColor: C.primary }]}
              onPress={() => setCustomOpen(!customOpen)}
            >
              <Text style={[s.chipTxt, customOpen && { color: '#fff' }]}>✏️ Custom</Text>
            </Pressable>
          </View>
          {customOpen && (
            <View style={s.customRow}>
              <TextInput
                style={s.customField}
                value={customMl}
                onChangeText={setCustomMl}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="Amount in ml"
                placeholderTextColor={C.muted}
                autoFocus
              />
              <Pressable style={s.customGo} onPress={logCustom}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Log</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => router.push('/add')} style={{ marginTop: 12 }}>
            <Text style={{ color: C.primary, fontWeight: '700' }}>
              ☕ Other drinks & earlier times →
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function NoteEditor({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const [draft, setDraft] = useState(app.dayContext?.note ?? '');
  return (
    <View style={card}>
      <Text style={s.cardTitle}>📝 Note for today</Text>
      <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
        Context you’ll want later — “traveling to Oman”, “fasting”, “long run”.
      </Text>
      <TextInput
        style={s.noteInput}
        value={draft}
        onChangeText={setDraft}
        placeholder="e.g. Traveling to Oman"
        placeholderTextColor={C.muted}
        multiline
        maxLength={200}
        autoFocus
      />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable style={s.noteBtnSm} onPress={onDone}>
          <Text style={{ color: C.muted, fontWeight: '700' }}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[s.noteBtnSm, { backgroundColor: C.primary }]}
          onPress={() => { app.saveNote(draft.trim()); onDone(); }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Ring({ progress }: { progress: number }) {
  const size = 230;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r}
          stroke={C.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r}
          stroke={C.primary} strokeWidth={stroke} fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circ}`}
          strokeDashoffset={circ * (1 - progress)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: C.text, fontSize: 44, fontWeight: '900' }}>
          {Math.round(progress * 100)}%
        </Text>
        <Text style={{ color: C.muted, fontSize: 12 }}>of today&apos;s goal</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: C.text, fontSize: 24, fontWeight: '900' },
  noteBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: C.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  totals: { color: C.text, fontWeight: '800', fontSize: 18, marginTop: 14 },
  remaining: { color: C.muted, marginTop: 4 },
  cardTitle: { color: C.text, fontWeight: '800', marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.surfaceAlt, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  chipTxt: { color: C.text, fontWeight: '600' },
  customRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  customField: {
    flex: 1, backgroundColor: C.surfaceAlt, color: C.text, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, fontWeight: '700',
  },
  customGo: {
    backgroundColor: C.primary, borderRadius: 14, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  noteInput: {
    backgroundColor: C.surfaceAlt, color: C.text, borderRadius: 12,
    padding: 12, minHeight: 70, textAlignVertical: 'top', marginBottom: 10,
  },
  noteBtnSm: {
    backgroundColor: C.surfaceAlt, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
  },
});
