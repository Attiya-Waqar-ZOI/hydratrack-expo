// Quick log — the small dialog opened from a reminder notification's
// "Add intake" button (or by tapping the notification). One tap logs a
// standard serving and dismisses; "Something else" opens the full sheet.
import { Redirect, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from '@/lib/app-state';
import { beverageById, fmtVol } from '@/lib/engines';
import { showToast } from '@/lib/toast';
import { C, F, R, T } from '@/lib/theme';

const PRESETS = [
  { label: 'Half glass', ml: 125 },
  { label: 'Glass', ml: 250 },
  { label: 'Mug', ml: 350 },
  { label: 'Bottle', ml: 500 },
];

export default function QuickLog() {
  const app = useApp();
  const p = app.profile;
  if (!p) return <Redirect href="/" />;
  const useOz = p.unit === 'oz';
  const remaining = Math.max(0, app.effectiveGoal - app.todayTotal);

  // The dialog can be the app's entry point (opened straight from a
  // notification), so falling back to Home when there is nothing to pop.
  const dismiss = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const log = (ml: number) => {
    const id = app.addDrink(ml, beverageById('water'));
    dismiss();
    showToast(`${fmtVol(ml, useOz)} added`, {
      actionLabel: 'Undo',
      onAction: () => app.undo(id),
    });
  };

  return (
    <Pressable style={s.overlay} onPress={dismiss}>
      {/* stopPropagation so taps inside the card don't dismiss */}
      <Pressable style={s.card} onPress={() => {}}>
        <Text style={s.title}>Log water</Text>
        <Text style={[T.body, { fontSize: 14.5, marginTop: 2 }]}>
          {remaining > 0
            ? `${fmtVol(remaining, useOz)} still to go today.`
            : 'Goal met — anything extra is a bonus.'}
        </Text>
        <View style={s.grid}>
          {PRESETS.map((q) => (
            <Pressable
              key={q.ml}
              onPress={() => log(q.ml)}
              style={({ pressed }) => [s.opt, pressed && { backgroundColor: C.accent100 }]}
            >
              <Text style={s.optAmt}>{fmtVol(q.ml, useOz)}</Text>
              <Text style={s.optLabel}>{q.label}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => { dismiss(); router.push('/add'); }}
          hitSlop={8}
          style={{ marginTop: 14, alignSelf: 'center' }}
        >
          <Text style={{ fontFamily: F.heading, fontSize: 15, color: C.accentDeep }}>
            Something else →
          </Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(15,18,20,0.45)',
    alignItems: 'center', justifyContent: 'center', padding: 28,
  },
  card: {
    alignSelf: 'stretch', backgroundColor: C.bg, borderRadius: R.lg,
    padding: 22,
  },
  title: { fontFamily: F.heading, fontSize: 24, letterSpacing: -0.5, color: C.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 16 },
  opt: {
    flexBasis: '47%', flexGrow: 1, alignItems: 'center',
    backgroundColor: C.surface, borderRadius: R.md,
    borderWidth: 1, borderColor: C.divider,
    paddingVertical: 14,
  },
  optAmt: { fontFamily: F.heading, fontSize: 19, color: C.text },
  optLabel: { fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 2 },
});
