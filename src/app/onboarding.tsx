// Onboarding — port of "HydraTrack Onboarding.dc.html" (Broadsheet system).
// Editorial: big serif headlines, underline input, ruler-tape sliders,
// radio lists, and an animated water glass on the goal step.
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import {
  ActivityLevel, Climate, Gender, bmiCategory, computeBmi, recommendedGoalMl,
} from '@/lib/engines';
import { GoalGlass } from '@/lib/glass';
import { Droplet } from '@/lib/logo';
import { Ruler, RulerLabel, RulerScrollView } from '@/lib/ruler';
import { requestStepPermission, stepsEnabled } from '@/lib/steps';
import { C, F, R, T, btnPrimary } from '@/lib/theme';

const NATIVE = Platform.OS !== 'web';
const AGE = { min: 14, max: 90, px: 12 };
const HT = { min: 120, max: 220, px: 6 };
const WT = { min: 35, max: 160, px: 6 };
const GOAL = { min: 1000, max: 6000, px: 0.36, step: 50 };

const GENDERS: { id: Gender; label: string }[] = [
  { id: 'male', label: 'Male' },
  { id: 'female', label: 'Female' },
  { id: 'nonbinary', label: 'Non-binary' },
  { id: 'na', label: 'Rather not say' },
];

const ACTIVITIES: { id: ActivityLevel; label: string; desc: string; emoji: string }[] = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Desk work, little exercise.', emoji: '🛋️' },
  { id: 'light', label: 'Lightly active', desc: 'Walks or chores a few days a week.', emoji: '🚶' },
  { id: 'moderate', label: 'Moderately active', desc: 'Exercise three to five days a week.', emoji: '🏃' },
  { id: 'high', label: 'Very active', desc: 'Hard training most days.', emoji: '🏋️' },
  { id: 'athlete', label: 'Athlete', desc: 'Daily training or physical work.', emoji: '🏆' },
];

const CLIMATES: { id: Climate; label: string; desc: string; emoji: string }[] = [
  { id: 'cold', label: 'Cold', desc: 'Under 15°C most of the year.', emoji: '❄️' },
  { id: 'moderate', label: 'Temperate', desc: 'Four seasons, comfortable most days.', emoji: '🌤️' },
  { id: 'hot', label: 'Hot', desc: 'Above 28°C, you sweat daily.', emoji: '🔥' },
];

export default function Onboarding() {
  const app = useApp();
  // ?edit=1 -> editing the existing profile: prefill everything, save in
  // place, and return to where the user came from.
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editing = edit === '1' && !!app.profile;
  const existing = editing ? app.profile : null;

  const [step, setStep] = useState(1);

  const [name, setName] = useState(existing?.name ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const [age, setAge] = useState(existing?.age ?? 28);
  const [gender, setGender] = useState<Gender>((existing?.gender as Gender) ?? 'male');
  const [heightCm, setHeightCm] = useState(Math.round(existing?.heightCm ?? 175));
  const [htImp, setHtImp] = useState(false);
  const [weightKg, setWeightKg] = useState(Math.round(existing?.weightKg ?? 70));
  const [wtImp, setWtImp] = useState(false);
  const [activity, setActivity] = useState<ActivityLevel>((existing?.activity as ActivityLevel) ?? 'moderate');
  const [climate, setClimate] = useState<Climate>((existing?.climate as Climate) ?? 'moderate');
  const [location, setLocation] = useState<'allow' | 'skip'>(
    editing && app.dayContext?.place ? 'allow' : 'skip',
  );
  const [locBusy, setLocBusy] = useState(false);
  const [stepsChoice, setStepsChoice] = useState<'allow' | 'skip'>('skip');
  const [stepsBusy, setStepsBusy] = useState(false);
  const [detected, setDetected] = useState<string | null>(
    editing && app.dayContext?.place
      ? `${app.dayContext.place}${app.dayContext.tempC != null ? ` · ${Math.round(app.dayContext.tempC)}°C right now` : ''}`
      : null,
  );
  const [goalSet, setGoalSet] = useState<number | null>(
    existing?.useCustomGoal ? (existing.customGoalMl || existing.dailyGoalMl) : null,
  );
  const scroll = useRef<ScrollView>(null);

  const bmi = useMemo(() => computeBmi(heightCm, weightKg), [heightCm, weightKg]);
  const recommended = useMemo(
    () => recommendedGoalMl(weightKg, activity, climate, gender, age),
    [weightKg, activity, climate, gender, age],
  );
  const goal = goalSet ?? recommended;
  const last = step === 6;
  const nameMissing = name.trim() === '';
  // Location granted → live weather drives the goal, so the manual
  // climate step (5) is skipped entirely.
  const skipClimate = location === 'allow';
  const totalSteps = skipClimate ? 5 : 6;
  const shownStep = skipClimate && step === 6 ? 5 : step;

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);
  useEffect(() => { stepsEnabled().then((on) => setStepsChoice(on ? 'allow' : 'skip')); }, []);

  const askSteps = async () => {
    if (stepsBusy) return;
    if (stepsChoice === 'allow') { setStepsChoice('skip'); return; }
    setStepsBusy(true);
    const granted = await requestStepPermission();
    setStepsBusy(false);
    setStepsChoice(granted ? 'allow' : 'skip');
  };

  const next = () => {
    if (step === 1 && nameMissing) { setNameTouched(true); return; }
    if (last) { finish(); return; }
    if (step === 4 && skipClimate) { setStep(6); return; }
    setStep(step + 1);
  };

  // "Allow location" only sticks if the OS permission is actually granted:
  // detectEnvironment() raises the system prompt and returns null on denial.
  // A grant also seeds the climate from the detected temperature, since the
  // manual climate step won't be shown.
  const askLocation = async () => {
    if (locBusy) return;
    setLocBusy(true);
    const ctx = await app.detectEnvironment().catch(() => null);
    setLocBusy(false);
    setLocation(ctx ? 'allow' : 'skip');
    if (ctx?.tempC != null) {
      setClimate(ctx.tempC >= 28 ? 'hot' : ctx.tempC < 15 ? 'cold' : 'moderate');
    }
    setDetected(
      ctx
        ? `${ctx.place ?? 'Location found'}${ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C right now` : ''}`
        : null,
    );
  };
  const back = () => {
    if (step <= 1) return;
    if (step === 6 && skipClimate) { setStep(4); return; }
    setStep(step - 1);
  };

  const finish = () => {
    app.saveProfile({
      name: name.trim() || 'Friend',
      age, gender, heightCm, weightKg,
      activity, climate,
      wakeMin: existing?.wakeMin ?? 7 * 60,
      sleepMin: existing?.sleepMin ?? 23 * 60,
      unit: existing?.unit ?? 'ml',
      useCustomGoal: goalSet != null && goalSet !== recommended ? 1 : 0,
      customGoalMl: goalSet ?? 0,
      dailyGoalMl: goal, bmi,
    });
    app.setStepTracking(stepsChoice === 'allow').catch(() => {});
    if (editing) router.back();
    else router.replace('/(tabs)/home');
  };

  const inch = Math.round(heightCm / 2.54);
  const lb = Math.round(weightKg * 2.20462);
  const bmiLabelText = { underweight: 'underweight', normal: 'healthy weight', overweight: 'overweight', obese: 'obese' }[bmiCategory(bmi)];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header: back, droplet wordmark, step count, hairline progress */}
      <View style={s.header}>
        <View style={s.headerRow}>
          {(step > 1 || editing) ? (
            <Pressable
              onPress={step > 1 ? back : () => router.back()}
              hitSlop={12} style={{ marginRight: 8 }}
            >
              <Text style={{ fontFamily: F.body, fontSize: 18, color: C.muted }}>←</Text>
            </Pressable>
          ) : null}
          <Droplet />
          <Text style={s.brand}>{editing ? 'Edit profile' : 'HydraTrack'}</Text>
          <Text style={s.stepLabel}>{shownStep} of {totalSteps}</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${(shownStep / totalSteps) * 100}%` }]} />
        </View>
      </View>

      <RulerScrollView
        ref={scroll}
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 28, paddingBottom: 8, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <StepIn step={step}>
        {step === 1 && (
          <View style={{ gap: 18 }}>
            <View>
              <Text style={s.h1o}>
                {editing ? 'Your details' : "Let's set your\ndaily goal"}
              </Text>
              <Text style={[T.body, { fontSize: 15, marginTop: 6, maxWidth: 280 }]}>
                {editing
                  ? 'Change anything. Your goal updates with it.'
                  : 'Six short questions, about a minute. Everything stays on your device.'}
              </Text>
            </View>
            <View>
              <Text style={s.fieldLabel}>Name</Text>
              <TextInput
                style={s.bareInput}
                value={name}
                onChangeText={setName}
                onBlur={() => setNameTouched(true)}
                placeholder="Your name"
                placeholderTextColor={C.faint}
              />
              {nameTouched && nameMissing && (
                <Text style={s.fieldHint}>We sign your daily summary with this.</Text>
              )}
            </View>
            <View>
              <Text style={[s.fieldLabel, { marginBottom: 12 }]}>Sex</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {GENDERS.map((g) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setGender(g.id)}
                    style={[s.sexChip, gender === g.id && s.sexChipOn]}
                  >
                    <Text
                      style={{
                        fontFamily: F.heading, fontSize: 15.5,
                        color: gender === g.id ? C.onAccent : C.text,
                      }}
                    >
                      {g.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View style={s.hr} />
            <View>
              <View style={s.valueRow}>
                <Text style={s.fieldLabel}>Age</Text>
                <Text style={s.valueBig}>{age} yrs</Text>
              </View>
              <Ruler
                value={age} min={AGE.min} max={AGE.max} px={AGE.px}
                labels={rulerLabels('age', false)}
                onChange={setAge}
              />
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 20 }}>
            <View>
              <Text style={s.h1o}>Your body</Text>
              <Text style={[T.body, { fontSize: 15, marginTop: 6 }]}>Your goal scales with mass.</Text>
            </View>
            <View>
              <View style={s.valueRow}>
                <Text style={s.fieldLabel}>Height</Text>
                <Seg
                  options={['cm', 'ft/in']} selected={htImp ? 1 : 0}
                  onSelect={(i) => setHtImp(i === 1)}
                />
              </View>
              <Text style={s.readout}>
                {htImp ? `${Math.floor(inch / 12)}'${inch % 12}"` : `${heightCm} cm`}
              </Text>
              <Ruler
                value={heightCm} min={HT.min} max={HT.max} px={HT.px}
                labels={rulerLabels('height', htImp)}
                onChange={setHeightCm}
              />
            </View>
            <View>
              <View style={s.valueRow}>
                <Text style={s.fieldLabel}>Weight</Text>
                <Seg
                  options={['kg', 'lb']} selected={wtImp ? 1 : 0}
                  onSelect={(i) => setWtImp(i === 1)}
                />
              </View>
              <Text style={s.readout}>{wtImp ? `${lb} lb` : `${weightKg} kg`}</Text>
              <Ruler
                value={weightKg} min={WT.min} max={WT.max} px={WT.px}
                labels={rulerLabels('weight', wtImp)}
                onChange={setWeightKg}
              />
            </View>
            <View>
              <View style={[s.valueRow, { marginBottom: 10 }]}>
                <Text style={s.fieldLabel}>BMI</Text>
                <Text style={[T.body, { fontSize: 15 }]}>
                  <Text style={{ fontFamily: F.heading, fontSize: 20, color: C.text }}>{bmi.toFixed(1)}</Text>
                  {'  '}{bmiLabelText}
                </Text>
              </View>
              <BmiBand bmi={bmi} />
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={{ gap: 22 }}>
            <View>
              <Text style={s.h1o}>How active{'\n'}are you?</Text>
              <Text style={[T.body, { fontSize: 15, marginTop: 6 }]}>In a typical week.</Text>
            </View>
            <View style={{ gap: 12 }}>
              {ACTIVITIES.map((a) => (
                <OptionCard
                  key={a.id} label={a.label} desc={a.desc} emoji={a.emoji}
                  selected={activity === a.id} onPress={() => setActivity(a.id)}
                />
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 22 }}>
            <View>
              <Text style={s.h1o}>A goal that{'\n'}follows your day</Text>
              <Text style={[T.body, { fontSize: 15, marginTop: 6, maxWidth: 290 }]}>
                Optional. Tap to allow — tap again to turn off.
              </Text>
            </View>
            <View style={{ gap: 12 }}>
              <OptionCard
                label="Current weather" emoji="🌤️"
                desc={locBusy
                  ? 'Asking for permission…'
                  : location === 'allow'
                    ? detected ?? 'On — heat, dry air and altitude raise your goal.'
                    : 'Uses your location. Hot or dry days raise your goal.'}
                selected={location === 'allow'}
                onPress={location === 'allow' ? () => setLocation('skip') : askLocation}
              />
              <OptionCard
                label="Your steps" emoji="🚶"
                desc={stepsBusy
                  ? 'Asking for permission…'
                  : stepsChoice === 'allow'
                    ? 'On — active days raise your goal.'
                    : 'Uses the motion sensor. Walk a lot, drink a bit more.'}
                selected={stepsChoice === 'allow'}
                onPress={askSteps}
              />
            </View>
            <Text style={[T.body, { fontSize: 14 }]}>
              Checked while you use the app. Nothing leaves the device.
            </Text>
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: 22 }}>
            <View>
              <Text style={s.h1o}>Where you{'\n'}live</Text>
              <Text style={[T.body, { fontSize: 15, marginTop: 6, maxWidth: 260 }]}>
                Heat and dry air raise what you lose in a day.
              </Text>
            </View>
            <View style={{ gap: 12 }}>
              {CLIMATES.map((c) => (
                <OptionCard
                  key={c.id} label={c.label} desc={c.desc} emoji={c.emoji}
                  selected={climate === c.id} onPress={() => setClimate(c.id)}
                />
              ))}
            </View>
          </View>
        )}

        {step === 6 && (
          <View style={{ gap: 20 }}>
            <Text style={[s.h1o, { textAlign: 'center' }]}>Your daily goal</Text>
            <GoalReveal
              ml={goal}
              adjusted={goalSet != null && goalSet !== recommended}
            />
            <View style={{ alignSelf: 'stretch', marginTop: 2 }}>
              <Text style={s.adjustKicker}>Drag to adjust</Text>
              <Ruler
                value={goal} min={GOAL.min} max={GOAL.max} px={GOAL.px} step={GOAL.step}
                labels={rulerLabels('goal', false)}
                onChange={setGoalSet}
              />
            </View>
          </View>
        )}
        </StepIn>
      </RulerScrollView>

      <View style={{ paddingHorizontal: 18, paddingTop: 10, paddingBottom: 10 }}>
        <Pressable
          onPress={next}
          style={({ pressed }) => [
            btnPrimary,
            step === 1 && nameMissing && { opacity: 0.45 },
            pressed && { backgroundColor: C.accentDeep },
          ]}
        >
          <Text style={s.ctaTxt}>{last ? (editing ? 'Save changes' : 'Start hydrating') : 'Continue'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

/// Major tick labels for each ruler, in strip pixels.
function rulerLabels(kind: 'age' | 'height' | 'weight' | 'goal', imperial: boolean): RulerLabel[] {
  const out: RulerLabel[] = [];
  if (kind === 'age') {
    for (let v = 20; v <= 90; v += 10) out.push({ left: (v - AGE.min) * AGE.px, text: String(v) });
  } else if (kind === 'goal') {
    for (let v = 1000; v <= 6000; v += 500) out.push({ left: (v - GOAL.min) * GOAL.px, text: (v / 1000).toFixed(1) });
  } else if (kind === 'height') {
    if (imperial) {
      for (let i = 48; i <= 86; i += 6) {
        const cm = i * 2.54;
        if (cm >= HT.min && cm <= HT.max) out.push({ left: (cm - HT.min) * HT.px, text: `${Math.floor(i / 12)}'${i % 12}` });
      }
    } else {
      for (let v = 120; v <= 220; v += 10) out.push({ left: (v - HT.min) * HT.px, text: String(v) });
    }
  } else {
    if (imperial) {
      for (let lbv = 80; lbv <= 350; lbv += 20) {
        const kg = lbv / 2.20462;
        if (kg >= WT.min && kg <= WT.max) out.push({ left: (kg - WT.min) * WT.px, text: String(lbv) });
      }
    } else {
      for (let v = 40; v <= 160; v += 10) out.push({ left: (v - WT.min) * WT.px, text: String(v) });
    }
  }
  return out;
}

/// Every step slides up and fades in as it appears.
function StepIn({ step, children }: { step: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, {
      toValue: 1, duration: 340,
      easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE,
    }).start();
  }, [step, v]);
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: v,
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

/// The finale: the glass pours full while the figure counts up on the same
/// easing, so they land together. On landing: a success haptic, one soft
/// ripple behind the glass, and a small settle of the number.
function GoalReveal({ ml, adjusted }: { ml: number; adjusted: boolean }) {
  const [shown, setShown] = useState(0);
  const settle = useRef(new Animated.Value(0)).current;
  const raf = useRef<number | null>(null);
  const mounted = useRef(false);
  const ticks = useRef(0);

  useEffect(() => {
    if (mounted.current) { setShown(ml); return; }   // ruler edits update instantly
    mounted.current = true;
    const t0 = Date.now();
    const DUR = 2000;
    const frame = () => {
      const k = Math.min(1, (Date.now() - t0) / DUR);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setShown(Math.round((ml * e) / 10) * 10);
      // Haptic crescendo: ticks as the water rises, firmer near the top.
      const stage = Math.floor(e * 8);
      if (NATIVE && stage > ticks.current) {
        ticks.current = stage;
        Haptics.impactAsync(
          e < 0.65 ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium,
        ).catch(() => {});
      }
      if (k < 1) { raf.current = requestAnimationFrame(frame); return; }
      setShown(ml);
      if (NATIVE) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Animated.sequence([
        Animated.timing(settle, { toValue: 1, duration: 150, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.spring(settle, { toValue: 0, damping: 8, stiffness: 170, useNativeDriver: NATIVE }),
      ]).start();
    };
    raf.current = requestAnimationFrame(frame);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ml]);

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <GoalGlass ml={ml} width={112} startEmpty fillMs={2000} />
      <Animated.View
        style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 8,
          transform: [{ scale: settle.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }],
        }}
      >
        <Text style={s.goalBig}>{(shown / 1000).toFixed(1)}</Text>
        <Text style={s.goalUnit}>litres a day</Text>
      </Animated.View>
      <Text style={s.revealTag}>{adjusted ? 'Adjusted by you' : 'Recommended'}</Text>
    </View>
  );
}

/// Radio list row: 22px circle with accent dot, serif label, muted desc.
/// Selectable option card: a large pictorial block beside the label and
/// description, accent-framed when chosen — the card interface from the
/// original design, in Broadsheet clothes.
function OptionCard({ label, desc, selected, onPress, emoji }: {
  label: string; desc?: string; selected: boolean; onPress: () => void; emoji: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.optCard, selected && s.optCardOn, pressed && { opacity: 0.85 }]}
    >
      <View style={[s.optArt, selected && { backgroundColor: C.accent100 }]}>
        <Text style={{ fontSize: 32 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.heading, fontSize: 19, lineHeight: 23, letterSpacing: -0.3, color: C.text }}>
          {label}
        </Text>
        {desc ? (
          <Text style={{ fontFamily: F.body, fontSize: 14, lineHeight: 19, color: C.neutral600, marginTop: 3 }}>
            {desc}
          </Text>
        ) : null}
      </View>
      <View style={[s.radio, { marginTop: 0 }, selected && { borderColor: C.accent }]}>
        {selected && <View style={s.radioDot} />}
      </View>
    </Pressable>
  );
}

/// Bordered segmented unit toggle; selected cell fills with accent.
function Seg({ options, selected, onSelect }: {
  options: string[]; selected: number; onSelect: (i: number) => void;
}) {
  return (
    <View style={s.seg}>
      {options.map((o, i) => (
        <Pressable
          key={o}
          onPress={() => onSelect(i)}
          style={[s.segOpt, i > 0 && { borderLeftWidth: 1, borderLeftColor: C.divider },
            selected === i && { backgroundColor: C.accent }]}
        >
          <Text style={{ fontFamily: F.body, fontSize: 13, letterSpacing: 0.5, color: selected === i ? C.onAccent : C.text }}>
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/// The BMI band: category-tinted segments with a needle at the value.
function BmiBand({ bmi }: { bmi: number }) {
  const pct = Math.max(1, Math.min(99, ((bmi - 15) / 25) * 100));
  return (
    <View>
      <View style={{ height: 8, backgroundColor: C.neutral200, flexDirection: 'row' }}>
        <View style={{ width: '14%', backgroundColor: C.accent2200 }} />
        <View style={{ width: '26%', backgroundColor: C.accent300 }} />
        <View style={{ width: '20%', backgroundColor: C.accent2200 }} />
        <View style={{ flex: 1, backgroundColor: C.accent2400 }} />
        <View style={{ position: 'absolute', top: -4, bottom: -4, width: 2, backgroundColor: C.text, left: `${pct}%` }} />
      </View>
      <View style={{ height: 16 }}>
        <Text style={[s.bandLabel, { left: '14%' }]}>18.5</Text>
        <Text style={[s.bandLabel, { left: '40%' }]}>25</Text>
        <Text style={[s.bandLabel, { left: '60%' }]}>30</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingHorizontal: 32, paddingTop: 6, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  brand: { fontFamily: F.heading, fontSize: 17, letterSpacing: -0.2, color: C.text },
  stepLabel: { marginLeft: 'auto', fontFamily: F.body, fontSize: 12.5, letterSpacing: 2, color: C.faint },
  track: { height: 3, borderRadius: 2, backgroundColor: C.neutral300, overflow: 'hidden' },
  fill: { height: 3, borderRadius: 2, backgroundColor: C.accent },
  h1o: { fontFamily: F.heading, fontSize: 30, lineHeight: 33, letterSpacing: -0.8, color: C.text },
  fieldLabel: { fontFamily: F.heading, fontSize: 18, color: C.muted, marginBottom: 4 },
  hr: { height: 1, backgroundColor: C.divider, marginVertical: -6 },
  sexChip: {
    backgroundColor: C.surface, borderRadius: R.md,
    paddingVertical: 11, paddingHorizontal: 18,
  },
  sexChipOn: { backgroundColor: C.accent },
  fieldHint: { marginTop: 8, fontFamily: F.body, fontSize: 12.5, color: C.accent2Deep },
  bareInput: {
    backgroundColor: C.surface, borderRadius: R.md,
    paddingVertical: 14, paddingHorizontal: 16,
    fontFamily: F.heading, fontSize: 22, letterSpacing: -0.4, color: C.text,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  valueBig: { fontFamily: F.heading, fontSize: 30, letterSpacing: -0.6, color: C.text },
  readout: { fontFamily: F.heading, fontSize: 30, letterSpacing: -0.7, color: C.text, marginTop: 2, marginBottom: 2 },
  radio: {
    width: 22, height: 22, marginTop: 3, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.neutral400,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: C.accent },
  optCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: C.divider, borderRadius: R.lg,
    backgroundColor: C.surface, padding: 13,
  },
  optCardOn: { borderWidth: 1.5, borderColor: C.accent, padding: 12.5 },
  optArt: {
    width: 58, height: 58, borderRadius: R.md,
    backgroundColor: C.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  seg: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.divider,
    borderRadius: R.md, overflow: 'hidden',
  },
  segOpt: { paddingVertical: 5, paddingHorizontal: 13 },
  goalBig: { fontFamily: F.heading, fontSize: 56, lineHeight: 61, letterSpacing: -2, color: C.text, marginBottom: -7 },

  revealTag: {
    fontFamily: F.body, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase',
    color: C.faint, marginTop: 2,
  },
  adjustKicker: {
    fontFamily: F.body, fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase',
    color: C.faint, textAlign: 'center', marginBottom: 10,
  },
  goalUnit: { fontFamily: F.heading, fontSize: 16, color: C.neutral600, paddingBottom: 5 },
  bandLabel: { position: 'absolute', top: 3, fontFamily: F.body, fontSize: 11.8, color: C.faint, transform: [{ translateX: -10 }] },
  ctaTxt: { fontFamily: F.heading, fontSize: 18, color: C.onAccent },
});
