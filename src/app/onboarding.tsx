import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import {
  ActivityLevel, BMI_LABELS, Climate, bmiCategory, computeBmi, fmtVol,
  goalBreakdown,
} from '@/lib/engines';
import { C } from '@/lib/theme';

// One section per screen, glow-gradient option cards, progress bar on top,
// free back-navigation to revise earlier answers.
const STEPS = ['About you', 'Body & BMI', 'Activity', 'Climate', 'Weather', 'Your goal'];

const ACTIVITY_CARDS: { id: ActivityLevel; emoji: string; label: string; desc: string; grad: [string, string] }[] = [
  { id: 'sedentary', emoji: '🛋️', label: 'Sedentary', desc: 'Mostly sitting — desk work, little exercise.', grad: ['#8B7CF6', '#4F7CFF'] },
  { id: 'light', emoji: '🚶', label: 'Lightly Active', desc: 'Walks, light chores 1–3 days a week.', grad: ['#4F7CFF', '#4FE0D0'] },
  { id: 'moderate', emoji: '🏃', label: 'Moderately Active', desc: 'Exercise or sport 3–5 days a week.', grad: ['#4FE0D0', '#3DDC97'] },
  { id: 'high', emoji: '🏋️', label: 'Very Active', desc: 'Hard training most days.', grad: ['#F2A65A', '#E8845A'] },
  { id: 'athlete', emoji: '🏆', label: 'Athlete', desc: 'Intense daily training or physical job.', grad: ['#EC5A8D', '#F2A65A'] },
];

const CLIMATE_CARDS: { id: Climate; emoji: string; label: string; desc: string; grad: [string, string] }[] = [
  { id: 'cold', emoji: '❄️', label: 'Cold', desc: 'Cool most of the year — sweaters over sunscreen.', grad: ['#4F7CFF', '#4FE0D0'] },
  { id: 'moderate', emoji: '🌤️', label: 'Moderate', desc: 'Four seasons, comfortable most days.', grad: ['#4FE0D0', '#3DDC97'] },
  { id: 'hot', emoji: '🔥', label: 'Hot', desc: 'Heat and sun most of the year — you sweat daily.', grad: ['#F2A65A', '#F06277'] },
];

export default function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);

  // Collected data
  const [name, setName] = useState('');
  const [age, setAge] = useState(28);
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [height, setHeight] = useState(175);
  const [weight, setWeight] = useState(70);
  const [activity, setActivity] = useState<ActivityLevel>('moderate');
  const [climate, setClimate] = useState<Climate>('moderate');
  const [detecting, setDetecting] = useState(false);
  const [detected, setDetected] = useState<string | null>(null);
  const [customGoal, setCustomGoal] = useState<number | null>(null);

  const bmi = useMemo(() => computeBmi(height, weight), [height, weight]);
  const recommended = useMemo(
    () => goalBreakdown(weight, activity, climate, bmi).totalMl,
    [weight, activity, climate, bmi],
  );
  const goal = customGoal ?? recommended;

  const last = step === STEPS.length - 1;
  const next = () => (last ? finish() : setStep(step + 1));
  const back = () => step > 0 && setStep(step - 1);

  const detect = async () => {
    setDetecting(true);
    const ctx = await app.detectEnvironment();
    setDetecting(false);
    setDetected(
      ctx
        ? `✅ ${ctx.place ?? 'Location detected'}${ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C` : ''}`
        : '⚠️ Could not detect — you can set weather manually later.',
    );
  };

  const finish = () => {
    app.saveProfile({
      name: name.trim() || 'Friend',
      age, gender, heightCm: height, weightKg: weight,
      activity, climate, wakeMin: 7 * 60, sleepMin: 23 * 60,
      unit: 'ml',
      useCustomGoal: customGoal != null && customGoal !== recommended ? 1 : 0,
      customGoalMl: customGoal ?? 0,
      dailyGoalMl: goal, bmi,
    });
    router.replace('/(tabs)/home');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header: back + progress bar + step count */}
      <View style={s.header}>
        <Pressable onPress={back} hitSlop={12} style={{ width: 34, opacity: step > 0 ? 1 : 0 }}>
          <Text style={{ color: C.text, fontSize: 22 }}>‹</Text>
        </Pressable>
        <View style={s.track}>
          <LinearGradient
            colors={[C.mint, C.primary]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[s.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]}
          />
        </View>
        <Text style={s.stepCount}>{step + 1}/{STEPS.length}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 14 }}>
        {step === 0 && (
          <>
            <View style={{ alignItems: 'center', marginBottom: 8 }}>
              <LinearGradient
                colors={[C.mint, C.primary, C.primaryDeep]}
                style={s.logo}
              >
                <Text style={{ fontSize: 40 }}>💧</Text>
              </LinearGradient>
              <Text style={s.brand}>HydraTrack</Text>
              <Text style={s.tagline}>Precision hydration</Text>
            </View>
            <Text style={s.h1}>About you</Text>
            <Text style={s.sub}>Just the basics — this stays on your device.</Text>
            <Text style={s.label}>Name</Text>
            <TextInput
              style={s.input} value={name} onChangeText={setName}
              placeholder="What should we call you?" placeholderTextColor={C.muted}
            />
            <Stepper label="Age" value={age} set={setAge} min={12} max={90} unit="yrs" />
            <Text style={s.label}>Gender</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {(['male', 'female'] as const).map((g) => (
                <GlowCard
                  key={g} flex selected={gender === g} onPress={() => setGender(g)}
                  grad={g === 'male' ? ['#4F7CFF', '#4FE0D0'] : ['#EC5A8D', '#8B7CF6']}
                >
                  <Text style={s.cardEmoji}>{g === 'male' ? '👨' : '👩'}</Text>
                  <Text style={s.cardTitle}>{g === 'male' ? 'Male' : 'Female'}</Text>
                </GlowCard>
              ))}
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <Text style={s.h1}>Body & BMI</Text>
            <Text style={s.sub}>Your goal is personalized from your body.</Text>
            <Stepper label="Height" value={height} set={setHeight} min={120} max={220} unit="cm" />
            <Stepper label="Weight" value={weight} set={setWeight} min={35} max={160} unit="kg" />
            <GlowCard selected grad={[C.mint, C.primary]}>
              <Text style={s.sub}>Your BMI</Text>
              <Text style={s.big}>{bmi.toFixed(1)}</Text>
              <Text style={{ color: C.mint, fontWeight: '700' }}>{BMI_LABELS[bmiCategory(bmi)]}</Text>
            </GlowCard>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={s.h1}>Activity level</Text>
            <Text style={s.sub}>How much do you move on a typical week?</Text>
            {ACTIVITY_CARDS.map((a) => (
              <GlowCard key={a.id} selected={activity === a.id} onPress={() => setActivity(a.id)} grad={a.grad}>
                <Text style={s.cardEmoji}>{a.emoji}</Text>
                <Text style={s.cardTitle}>{a.label}</Text>
                <Text style={s.cardDesc}>{a.desc}</Text>
              </GlowCard>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <Text style={s.h1}>Your climate</Text>
            <Text style={s.sub}>Hot climates raise how much you need.</Text>
            {CLIMATE_CARDS.map((c) => (
              <GlowCard key={c.id} selected={climate === c.id} onPress={() => setClimate(c.id)} grad={c.grad}>
                <Text style={[s.cardEmoji, { fontSize: 44 }]}>{c.emoji}</Text>
                <Text style={s.cardTitle}>{c.label}</Text>
                <Text style={s.cardDesc}>{c.desc}</Text>
              </GlowCard>
            ))}
          </>
        )}

        {step === 4 && (
          <>
            <Text style={s.h1}>Weather-smart goals</Text>
            <Text style={s.sub}>
              Optional: allow location so your goal adapts automatically to heat,
              altitude and dry air — and travel days get flagged in your history.
            </Text>
            <GlowCard selected grad={['#F2A65A', '#E8845A']} onPress={detecting ? undefined : detect}>
              <Text style={s.cardEmoji}>📍</Text>
              <Text style={s.cardTitle}>
                {detecting ? 'Detecting…' : detected ?? 'Allow location & weather'}
              </Text>
              <Text style={s.cardDesc}>
                {detected ? 'Tap to re-detect.' : 'Uses your location once per day. Skippable.'}
              </Text>
            </GlowCard>
          </>
        )}

        {step === 5 && (
          <>
            <Text style={s.h1}>Your daily goal</Text>
            <Text style={s.sub}>Based on everything you told us. Adjust it if you like.</Text>
            <GlowCard selected grad={[C.mint, C.primary]}>
              <Text style={[s.big, { fontSize: 44, textAlign: 'center' }]}>{fmtVol(goal, false)}</Text>
              <View style={s.goalCtl}>
                <RoundBtn label="−100" onPress={() => setCustomGoal(Math.max(500, goal - 100))} />
                <RoundBtn label="+100" onPress={() => setCustomGoal(Math.min(6000, goal + 100))} />
              </View>
              {customGoal != null && customGoal !== recommended && (
                <Pressable onPress={() => setCustomGoal(null)}>
                  <Text style={{ color: C.mint, textAlign: 'center', marginTop: 10, fontWeight: '600' }}>
                    Reset to recommended ({fmtVol(recommended, false)})
                  </Text>
                </Pressable>
              )}
            </GlowCard>
            <Text style={[s.sub, { textAlign: 'center' }]}>
              You can change this anytime in the You tab.
            </Text>
          </>
        )}
      </ScrollView>

      <View style={{ padding: 20 }}>
        <Pressable onPress={next}>
          <LinearGradient
            colors={[C.primary, C.primaryDeep]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={s.cta}
          >
            <Text style={s.ctaTxt}>{last ? 'Start hydrating 💧' : 'Continue'}</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/// Dark card wrapped in a gradient border that glows when selected —
/// the aurora-glow effect.
function GlowCard({
  children, selected = false, onPress, grad, flex = false,
}: {
  children: React.ReactNode; selected?: boolean;
  onPress?: () => void; grad: [string, string]; flex?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        flex && { flex: 1 },
        selected && {
          shadowColor: grad[1], shadowOpacity: 0.55, shadowRadius: 14,
          shadowOffset: { width: 0, height: 0 }, elevation: 10,
        },
      ]}
    >
      <LinearGradient
        colors={selected ? grad : ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0.05)']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ borderRadius: 22, padding: 1.6 }}
      >
        <View style={gc.inner}>{children}</View>
      </LinearGradient>
    </Pressable>
  );
}

function Stepper({
  label, value, set, min, max, unit,
}: {
  label: string; value: number; set: (v: number) => void;
  min: number; max: number; unit: string;
}) {
  return (
    <View style={s.stepRow}>
      <Text style={s.label}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <RoundBtn label="−" onPress={() => set(Math.max(min, value - 1))} />
        <Text style={s.stepVal}>{value} {unit}</Text>
        <RoundBtn label="＋" onPress={() => set(Math.min(max, value + 1))} />
      </View>
    </View>
  );
}

function RoundBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.roundBtn}>
      <Text style={{ color: C.primary, fontWeight: '800', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

const gc = StyleSheet.create({
  inner: { backgroundColor: C.surface, borderRadius: 20.4, padding: 16 },
});

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  track: {
    flex: 1, height: 6, borderRadius: 4,
    backgroundColor: C.surfaceAlt, overflow: 'hidden',
  },
  fill: { height: 6, borderRadius: 4 },
  stepCount: { color: C.muted, fontWeight: '700', width: 34, textAlign: 'right' },
  logo: {
    width: 84, height: 84, borderRadius: 42,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  brand: { color: '#FFFFFF', fontSize: 26, fontWeight: '900', letterSpacing: 0.5 },
  tagline: { color: C.mint, fontSize: 12, fontWeight: '600', letterSpacing: 2 },
  h1: { color: C.text, fontSize: 26, fontWeight: '900' },
  sub: { color: C.muted, lineHeight: 20 },
  label: { color: C.text, fontWeight: '700', marginTop: 4 },
  input: {
    backgroundColor: C.surfaceAlt, color: C.text, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  stepRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: 6,
  },
  stepVal: { color: C.text, fontWeight: '800', minWidth: 76, textAlign: 'center' },
  roundBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  cardEmoji: { fontSize: 30, marginBottom: 6 },
  cardTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: 16 },
  cardDesc: { color: C.muted, marginTop: 3, lineHeight: 18 },
  big: { color: C.text, fontSize: 34, fontWeight: '900', marginVertical: 4 },
  goalCtl: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginTop: 10 },
  cta: { borderRadius: 18, padding: 17, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
