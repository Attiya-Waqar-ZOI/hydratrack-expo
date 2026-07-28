// Log a drink — port of the design's sheet: beverage radio list with
// "counts …" metas, a ruler for the amount, bordered When chips, the
// hydration line, and a full-width serif CTA.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { BEVERAGES, beverageById, fmtVol } from '@/lib/engines';
import { Ruler } from '@/lib/ruler';
import { showToast } from '@/lib/toast';
import { C, F, btnPrimary } from '@/lib/theme';

const AMT = { min: 50, max: 1000, px: 0.24, step: 50 };
const WHENS = [
  { label: 'Now', h: 0 }, { label: '1h ago', h: 1 }, { label: '2h ago', h: 2 },
  { label: '3h ago', h: 3 }, { label: '6h ago', h: 6 },
];

export default function AddDrink() {
  const app = useApp();
  const useOz = app.profile?.unit === 'oz';
  const [bevId, setBevId] = useState('water');
  const [ml, setMl] = useState(250);
  const [hoursAgo, setHoursAgo] = useState(0);

  const bev = beverageById(bevId);
  const hydration = Math.round(ml * bev.factor);

  const log = () => {
    const at = hoursAgo > 0 ? new Date(Date.now() - hoursAgo * 3600_000) : undefined;
    const id = app.addDrink(ml, bev, at);
    router.back();
    showToast(`${fmtVol(ml, !!useOz)} ${bev.name} added`, {
      actionLabel: 'Undo',
      onAction: () => app.undo(id),
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      {/* Sheet header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontFamily: F.body, fontSize: 17, color: C.muted }}>←</Text>
        </Pressable>
        <Text style={s.title}>Log a drink</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 12, gap: 26 }}>
        {/* Beverage list */}
        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>What did you drink</Text>
          {BEVERAGES.map((b) => (
            <Pressable
              key={b.id}
              onPress={() => setBevId(b.id)}
              style={({ pressed }) => [s.bevRow, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.radio, bevId === b.id && { borderColor: C.accent }]}>
                  {bevId === b.id && <View style={s.radioDot} />}
                </View>
                <Text style={{ fontFamily: F.body, fontSize: 16, color: C.text }}>{b.name}</Text>
              </View>
              <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.muted }}>
                {b.factor === 1 ? 'counts fully' : `counts ${Math.round(b.factor * 100)}%`}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Amount */}
        <View>
          <View style={s.amtRow}>
            <Text style={s.section}>How much</Text>
            <Text style={s.readout}>{fmtVol(ml, !!useOz)}</Text>
          </View>
          <View style={{ marginTop: 4 }}>
            <Ruler
              value={ml} min={AMT.min} max={AMT.max} px={AMT.px} step={AMT.step}
              labels={Array.from({ length: 5 }, (_, i) => {
                const v = 200 + i * 200;
                return { left: (v - AMT.min) * AMT.px, text: String(v) };
              })}
              onChange={setMl}
            />
          </View>
        </View>

        {/* When */}
        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>When</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {WHENS.map((w) => (
              <Pressable
                key={w.h}
                onPress={() => setHoursAgo(w.h)}
                style={[s.whenChip, hoursAgo === w.h && s.whenChipOn]}
              >
                <Text style={{ fontFamily: F.body, fontSize: 15, color: C.text }}>{w.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Hydration line */}
        <View style={s.hydRow}>
          <Text style={{ fontFamily: F.body, fontSize: 15, color: C.muted }}>Counts as hydration</Text>
          <Text style={{ fontFamily: F.heading, fontSize: 19, color: C.text }}>
            {fmtVol(hydration, !!useOz)}
          </Text>
        </View>
      </ScrollView>

      <View style={{ paddingHorizontal: 26, paddingTop: 12, paddingBottom: 16 }}>
        <Pressable
          onPress={log}
          style={({ pressed }) => [btnPrimary, pressed && { backgroundColor: C.accentDeep }]}
        >
          <Text style={s.ctaTxt}>Log {fmtVol(ml, !!useOz)} {bev.name.toLowerCase()}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 26, paddingTop: 26, paddingBottom: 16,
  },
  title: { fontFamily: F.heading, fontSize: 22, letterSpacing: -0.4, color: C.text },
  section: { fontFamily: F.heading, fontSize: 19, color: C.text },
  bevRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, paddingVertical: 11, paddingHorizontal: 2,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  radio: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: C.neutral400,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: C.accent },
  amtRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  readout: { fontFamily: F.heading, fontSize: 30, letterSpacing: -0.7, color: C.text },
  whenChip: {
    borderWidth: 1, borderColor: C.divider, borderRadius: 2,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  whenChipOn: { borderWidth: 1.5, borderColor: C.accent, paddingVertical: 7.5, paddingHorizontal: 13.5 },
  hydRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, paddingTop: 2,
  },
  ctaTxt: { fontFamily: F.heading, fontSize: 18, color: C.onAccent },
});
