import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import {
  ACTIVITY_LABELS, ActivityLevel, BMI_LABELS, Climate, bmiCategory,
  computeBmi, fmtVol, goalBreakdown,
} from '@/lib/engines';
import { C, card } from '@/lib/theme';

const ACTIVITIES = Object.keys(ACTIVITY_LABELS) as ActivityLevel[];
const CLIMATES: Climate[] = ['cold', 'moderate', 'hot'];

export default function Onboarding() {
  const app = useApp();
  const [name, setName] = useState('');
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(70);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [climate, setClimate] = useState<Climate>('moderate');
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);

  const bmi = useMemo(() => computeBmi(height, weight), [height, weight]);
  const goal = useMemo(
    () => goalBreakdown(weight, activity, climate, bmi).totalMl,
    [weight, activity, climate, bmi],
  );

  const detect = async () => {
    setDetecting(true);
    const ctx = await app.detectEnvironment();
    setDetecting(false);
    setDetected(
      ctx
        ? `${ctx.place ?? 'Location detected'}${ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C` : ''}`
        : 'Could not detect — you can set weather manually later.',
    );
  };

  const finish = () => {
    app.saveProfile({
      name: name.trim() || 'Friend',
      age, gender,
      heightCm: height, weightKg: weight,
      activity, climate,
      wakeMin: 7 * 60, sleepMin: 23 * 60,
      unit: 'ml',
      useCustomGoal: 0, customGoalMl: 0,
      dailyGoalMl: goal, bmi,
    });
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
        <Text style={s.brand}>💧 HydraTrack</Text>
        <Text style={s.h1}>Welcome to HydraTrack</Text>
        <Text style={s.sub}>
          Let&apos;s build your hydration plan in under a minute.
        </Text>

        <View style={card}>
          <Text style={s.label}>What should we call you?</Text>
          <TextInput
            style={s.input} value={name} onChangeText={setName}
            placeholder="Your name" placeholderTextColor={C.muted}
          />
          <Stepper label="Age" value={age} set={setAge} min={12} max={90} unit="yrs" />
          <Text style={s.label}>Gender</Text>
          <Chips
            options={['male', 'female']}
            labels={{ male: 'Male', female: 'Female' }}
            selected={gender}
            onSelect={(g) => setGender(g as 'male' | 'female')}
          />
        </View>

        <View style={card}>
          <Stepper label="Height" value={height} set={setHeight} min={120} max={220} unit="cm" step={1} />
          <Stepper label="Weight" value={weight} set={setWeight} min={35} max={160} unit="kg" step={1} />
          <View style={s.bmiRow}>
            <Text style={s.label}>Your BMI</Text>
            <Text style={s.bmiVal}>
              {bmi.toFixed(1)} · {BMI_LABELS[bmiCategory(bmi)]}
            </Text>
          </View>
        </View>

        <View style={card}>
          <Text style={s.label}>Activity level</Text>
          <Chips
            options={ACTIVITIES} labels={ACTIVITY_LABELS}
            selected={activity} onSelect={(a) => setActivity(a as ActivityLevel)}
          />
          <Text style={[s.label, { marginTop: 12 }]}>Climate</Text>
          <Chips
            options={CLIMATES}
            labels={{ cold: 'Cold', moderate: 'Moderate', hot: 'Hot' }}
            selected={climate} onSelect={(c) => setClimate(c as Climate)}
          />
        </View>

        <View style={card}>
          <Text style={s.label}>Weather-smart goals (optional)</Text>
          <Text style={s.sub}>
            Allow location so your goal adapts to heat, altitude and dry air.
          </Text>
          <Pressable style={s.detectBtn} onPress={detect} disabled={detecting}>
            <Text style={s.detectTxt}>
              {detecting ? 'Detecting…' : detected ?? '📍 Allow location & weather'}
            </Text>
          </Pressable>
        </View>

        <View style={[card, { alignItems: 'center' }]}>
          <Text style={s.label}>Your daily goal</Text>
          <Text style={s.goal}>{fmtVol(goal, false)}</Text>
          <Text style={s.sub}>Tailored to your body, lifestyle and climate.</Text>
        </View>

        <Pressable style={s.cta} onPress={finish}>
          <Text style={s.ctaTxt}>Start hydrating</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Chips({
  options, labels, selected, onSelect,
}: {
  options: string[]; labels: Record<string, string>;
  selected: string; onSelect: (v: string) => void;
}) {
  return (
    <View style={s.chips}>
      {options.map((o) => (
        <Pressable
          key={o}
          onPress={() => onSelect(o)}
          style={[s.chip, selected === o && s.chipOn]}
        >
          <Text style={[s.chipTxt, selected === o && s.chipTxtOn]}>{labels[o]}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Stepper({
  label, value, set, min, max, unit, step = 1,
}: {
  label: string; value: number; set: (v: number) => void;
  min: number; max: number; unit: string; step?: number;
}) {
  return (
    <View style={s.stepRow}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stepCtl}>
        <Pressable style={s.stepBtn} onPress={() => set(Math.max(min, value - step))}>
          <Text style={s.stepBtnTxt}>−</Text>
        </Pressable>
        <Text style={s.stepVal}>{value} {unit}</Text>
        <Pressable style={s.stepBtn} onPress={() => set(Math.min(max, value + step))}>
          <Text style={s.stepBtnTxt}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  brand: { color: C.mint, fontWeight: '800', fontSize: 16, letterSpacing: 1 },
  h1: { color: C.text, fontSize: 28, fontWeight: '900' },
  sub: { color: C.muted, lineHeight: 20 },
  label: { color: C.text, fontWeight: '700', marginBottom: 8 },
  input: {
    backgroundColor: C.surfaceAlt, color: C.text, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: C.surfaceAlt, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.primary },
  chipTxt: { color: C.muted, fontWeight: '600' },
  chipTxtOn: { color: '#fff' },
  stepRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  stepCtl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: C.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnTxt: { color: C.primary, fontSize: 18, fontWeight: '800' },
  stepVal: { color: C.text, fontWeight: '800', minWidth: 74, textAlign: 'center' },
  bmiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bmiVal: { color: C.mint, fontWeight: '800' },
  detectBtn: {
    backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 12,
    alignItems: 'center', marginTop: 10,
  },
  detectTxt: { color: C.primary, fontWeight: '700' },
  goal: { color: C.primary, fontSize: 40, fontWeight: '900', marginVertical: 6 },
  cta: {
    backgroundColor: C.primary, borderRadius: 18, padding: 16,
    alignItems: 'center', marginBottom: 40,
  },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
