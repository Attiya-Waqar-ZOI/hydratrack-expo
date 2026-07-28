import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';

import { useApp } from '@/lib/app-state';
import { BEVERAGES, beverageById, fmtVol } from '@/lib/engines';
import { C, card } from '@/lib/theme';

const AMOUNTS = [50, 100, 150, 200, 250, 350, 500, 750, 1000];

export default function AddDrink() {
  const app = useApp();
  const useOz = app.profile?.unit === 'oz';
  const [bevId, setBevId] = useState('water');
  const [volume, setVolume] = useState(250);
  const [custom, setCustom] = useState('');
  const [hoursAgo, setHoursAgo] = useState(0);

  const bev = beverageById(bevId);
  const effVolume = custom ? Math.max(1, parseInt(custom, 10) || 0) : volume;
  const hydration = Math.round(effVolume * bev.factor);
  const caffeine = Math.round((effVolume / 100) * bev.caffeinePer100);

  const log = () => {
    const at = hoursAgo > 0 ? new Date(Date.now() - hoursAgo * 3600_000) : undefined;
    app.addDrink(effVolume, bev, at);
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={s.label}>Beverage</Text>
      <View style={s.chips}>
        {BEVERAGES.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => setBevId(b.id)}
            style={[s.chip, bevId === b.id && { backgroundColor: b.color }]}
          >
            <Text style={[s.chipTxt, bevId === b.id && { color: '#fff' }]}>
              {b.emoji} {b.name}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={s.label}>Amount</Text>
      <View style={s.chips}>
        {AMOUNTS.map((ml) => (
          <Pressable
            key={ml}
            onPress={() => { setVolume(ml); setCustom(''); }}
            style={[s.chip, !custom && volume === ml && { backgroundColor: C.primary }]}
          >
            <Text style={[s.chipTxt, !custom && volume === ml && { color: '#fff' }]}>
              {fmtVol(ml, !!useOz)}
            </Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={s.input}
        value={custom}
        onChangeText={setCustom}
        keyboardType="number-pad"
        placeholder="Custom amount (ml)"
        placeholderTextColor={C.muted}
      />

      <Text style={s.label}>When</Text>
      <View style={s.chips}>
        {[0, 1, 2, 3, 6, 12].map((h) => (
          <Pressable
            key={h}
            onPress={() => setHoursAgo(h)}
            style={[s.chip, hoursAgo === h && { backgroundColor: C.primary }]}
          >
            <Text style={[s.chipTxt, hoursAgo === h && { color: '#fff' }]}>
              {h === 0 ? 'Now' : `${h}h ago`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={[card, { flexDirection: 'row', justifyContent: 'space-around' }]}>
        <View style={{ alignItems: 'center' }}>
          <Text style={s.mutedSm}>Counts as</Text>
          <Text style={s.stat}>{hydration} ml</Text>
          <Text style={s.mutedSm}>hydration</Text>
        </View>
        {caffeine > 0 && (
          <View style={{ alignItems: 'center' }}>
            <Text style={s.mutedSm}>Caffeine</Text>
            <Text style={s.stat}>{caffeine} mg</Text>
            <Text style={s.mutedSm}>this serving</Text>
          </View>
        )}
      </View>

      <Pressable style={[s.cta, { backgroundColor: bev.color }]} onPress={log}>
        <Text style={s.ctaTxt}>
          Log {fmtVol(effVolume, !!useOz)} {bev.name}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  label: { color: C.text, fontWeight: '800', fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.surfaceAlt, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipTxt: { color: C.text, fontWeight: '600', fontSize: 13 },
  input: {
    backgroundColor: C.surfaceAlt, color: C.text, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  mutedSm: { color: C.muted, fontSize: 12 },
  stat: { color: C.text, fontWeight: '900', fontSize: 20, marginVertical: 2 },
  cta: { borderRadius: 18, padding: 16, alignItems: 'center', marginBottom: 30 },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
