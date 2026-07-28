import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { useApp } from '@/lib/app-state';
import { beverageById, fmtVol } from '@/lib/engines';
import { GlowPanel } from '@/lib/glow';
import { showToast } from '@/lib/toast';
import { C } from '@/lib/theme';
import { WeatherCard } from '@/lib/weather-card';

const QUICK = [150, 250, 350, 500];

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
    showToast(`💧 ${fmtVol(ml, useOz)} added`, {
      actionLabel: 'Undo',
      onAction: () => app.undo(id),
    });
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
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 28 }}>
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

        {/* Hero: gradient progress ring in a glowing panel */}
        <GlowPanel glow colors={['rgba(79,224,208,0.75)', 'rgba(79,124,255,0.75)']} style={{ alignItems: 'center', paddingVertical: 28 }}>
          <Ring progress={progress} />
          <Text style={s.totals}>
            {fmtVol(total, useOz)} <Text style={{ color: C.muted }}>of {fmtVol(goal, useOz)}</Text>
          </Text>
          <Text style={s.remaining}>
            {remaining === 0 ? '🎉 Goal reached — nicely done!' : `${fmtVol(remaining, useOz)} to go`}
          </Text>
        </GlowPanel>

        {/* Add drink */}
        <GlowPanel colors={['rgba(79,124,255,0.45)', 'rgba(139,124,246,0.45)']}>
          <Text style={s.cardTitle}>Add a drink</Text>
          <View style={s.chips}>
            {QUICK.map((ml, i) => (
              <Pressable
                key={ml}
                style={[s.chip, { borderColor: CHIP_COLORS[i % CHIP_COLORS.length] }]}
                onPress={() => log(ml)}
              >
                <Text style={s.chipTxt}>💧 {fmtVol(ml, useOz)}</Text>
              </Pressable>
            ))}
            <Pressable
              style={[s.chip, { borderColor: C.gold }, customOpen && { backgroundColor: C.primary }]}
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
        </GlowPanel>

        {/* Climate / weather — fills the fold and drives the goal */}
        <WeatherCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const CHIP_COLORS = ['rgba(79,224,208,0.6)', 'rgba(79,124,255,0.6)', 'rgba(139,124,246,0.6)', 'rgba(236,90,141,0.6)'];

function NoteEditor({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const [draft, setDraft] = useState(app.dayContext?.note ?? '');
  return (
    <GlowPanel colors={['rgba(79,124,255,0.5)', 'rgba(139,124,246,0.5)']}>
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
          onPress={() => {
            app.saveNote(draft.trim());
            onDone();
            showToast('📌 Note saved for today');
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </GlowPanel>
  );
}

function Ring({ progress }: { progress: number }) {
  const size = 220;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={C.mint} />
            <Stop offset="0.6" stopColor={C.primary} />
            <Stop offset="1" stopColor={C.grape} />
          </SvgGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r}
          stroke={C.surfaceAlt} strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r}
          stroke="url(#ring)" strokeWidth={stroke} fill="none"
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
    backgroundColor: C.surfaceAlt, borderRadius: 14, borderWidth: 1,
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
