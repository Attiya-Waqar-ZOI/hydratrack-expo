// Onboarding — port of "HydraTrack Onboarding.dc.html" (Broadsheet system).
// Editorial: big serif headlines, underline input, ruler-tape sliders,
// radio lists, and an animated water glass on the goal step.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import {
  ActivityLevel, Climate, Gender, bmiCategory, computeBmi, recommendedGoalMl,
} from '@/lib/engines';
import { GoalGlass } from '@/lib/glass';
import { Droplet } from '@/lib/logo';
import { Ruler, RulerLabel } from '@/lib/ruler';
import { C, F, R, T, btnPrimary } from '@/lib/theme';

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

const ACTIVITIES: { id: ActivityLevel; label: string; desc: string }[] = [
  { id: 'sedentary', label: 'Sedentary', desc: 'Desk work, little exercise.' },
  { id: 'light', label: 'Lightly active', desc: 'Walks or chores a few days a week.' },
  { id: 'moderate', label: 'Moderately active', desc: 'Exercise three to five days a week.' },
  { id: 'high', label: 'Very active', desc: 'Hard training most days.' },
  { id: 'athlete', label: 'Athlete', desc: 'Daily training or physical work.' },
];

const CLIMATES: { id: Climate; label: string; desc: string }[] = [
  { id: 'cold', label: 'Cold', desc: 'Under 15°C most of the year.' },
  { id: 'moderate', label: 'Temperate', desc: 'Four seasons, comfortable most days.' },
  { id: 'hot', label: 'Hot', desc: 'Above 28°C, you sweat daily.' },
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
  const [detected, setDetected] = useState<string | null>(
    editing && app.dayContext?.place
      ? `${app.dayContext.place}${app.dayContext.tempC != null ? ` · ${Math.round(app.dayContext.tempC)}°C right now` : ''}`
      : null,
  );
  const [goalSet, setGoalSet] = useState<number | null>(
    existing?.useCustomGoal ? (existing.customGoalMl || existing.dailyGoalMl) : null,
  );
  const [displayMl, setDisplayMl] = useState<number | null>(null);
  const raf = useRef<number | null>(null);
  const scroll = useRef<ScrollView>(null);

  const bmi = useMemo(() => computeBmi(heightCm, weightKg), [heightCm, weightKg]);
  const recommended = useMemo(
    () => recommendedGoalMl(weightKg, activity, climate, gender, age),
    [weightKg, activity, climate, gender, age],
  );
  const goal = goalSet ?? recommended;
  const last = step === 6;
  const nameMissing = name.trim() === '';

  // Count the goal up from zero when the last step appears.
  useEffect(() => {
    if (step !== 6) return;
    scroll.current?.scrollTo({ y: 0, animated: false });
    const t0 = Date.now();
    const to = goalSet ?? recommended;
    const frame = () => {
      const k = Math.min(1, (Date.now() - t0) / 950);
      const e = 1 - Math.pow(1 - k, 3);
      setDisplayMl(Math.round((to * e) / 10) * 10);
      if (k < 1) raf.current = requestAnimationFrame(frame);
      else setDisplayMl(null);
    };
    raf.current = requestAnimationFrame(frame);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [step]);

  const next = () => {
    if (step === 1 && nameMissing) { setNameTouched(true); return; }
    if (last) { finish(); return; }
    setStep(step + 1);
  };

  // "Allow location" only sticks if the OS permission is actually granted:
  // detectEnvironment() raises the system prompt and returns null on denial.
  const askLocation = async () => {
    if (locBusy) return;
    setLocBusy(true);
    const ctx = await app.detectEnvironment().catch(() => null);
    setLocBusy(false);
    setLocation(ctx ? 'allow' : 'skip');
    setDetected(
      ctx
        ? `${ctx.place ?? 'Location found'}${ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C right now` : ''}`
        : null,
    );
  };
  const back = () => step > 1 && setStep(step - 1);

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
    if (editing) router.back();
    else router.replace('/(tabs)/home');
  };

  const shownMl = goalSet ?? displayMl ?? goal;
  const inch = Math.round(heightCm / 2.54);
  const lb = Math.round(weightKg * 2.20462);
  const bmiLabelText = { underweight: 'underweight', normal: 'healthy weight', overweight: 'overweight', obese: 'obese' }[bmiCategory(bmi)];
  const goalReason =
    `${wtImp ? `${lb} lb` : `${weightKg} kg`}, ` +
    `${ACTIVITIES.find((a) => a.id === activity)!.label.toLowerCase()}, ` +
    `${CLIMATES.find((c) => c.id === climate)!.label.toLowerCase()} climate` +
    (location === 'allow' ? '. Adjusted daily for the weather where you are.' : '. Fixed, since location is off.');

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
          <Text style={s.stepLabel}>{step} of 6</Text>
        </View>
        <View style={s.track}>
          <View style={[s.fill, { width: `${(step / 6) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingHorizontal: 32, paddingTop: 32, paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
      >
        {step === 1 && (
          <View style={{ gap: 28 }}>
            <View>
              <Text style={T.h1}>
                {editing ? 'Your details' : "Let's set your\ndaily goal"}
              </Text>
              <Text style={[T.body, { fontSize: 16, marginTop: 10, maxWidth: 280 }]}>
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
            <View>
              <Text style={[s.fieldLabel, { marginBottom: 14 }]}>Sex</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 28, rowGap: 12 }}>
                {GENDERS.map((g) => (
                  <Pressable key={g.id} onPress={() => setGender(g.id)} style={{ paddingBottom: 7 }}>
                    <Text
                      style={{
                        fontFamily: F.heading, fontSize: 17,
                        color: gender === g.id ? C.text : C.faint,
                      }}
                    >
                      {g.label}
                    </Text>
                    {gender === g.id && <View style={s.underline} />}
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={{ gap: 44 }}>
            <View>
              <Text style={T.h1}>Your body</Text>
              <Text style={[T.body, { fontSize: 16, marginTop: 12 }]}>Your goal scales with mass.</Text>
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
          <View style={{ gap: 40 }}>
            <View>
              <Text style={T.h1}>How active{'\n'}are you?</Text>
              <Text style={[T.body, { fontSize: 16, marginTop: 12 }]}>In a typical week.</Text>
            </View>
            <View style={{ gap: 24 }}>
              {ACTIVITIES.map((a) => (
                <RadioRow
                  key={a.id} label={a.label} desc={a.desc}
                  selected={activity === a.id} onPress={() => setActivity(a.id)}
                />
              ))}
            </View>
          </View>
        )}

        {step === 4 && (
          <View style={{ gap: 40 }}>
            <View>
              <Text style={T.h1}>Where you{'\n'}live</Text>
              <Text style={[T.body, { fontSize: 16, marginTop: 12, maxWidth: 260 }]}>
                Heat and dry air raise what you lose in a day.
              </Text>
            </View>
            <View style={{ gap: 26 }}>
              {CLIMATES.map((c) => (
                <RadioRow
                  key={c.id} label={c.label} desc={c.desc}
                  selected={climate === c.id} onPress={() => setClimate(c.id)}
                />
              ))}
            </View>
          </View>
        )}

        {step === 5 && (
          <View style={{ gap: 40 }}>
            <View>
              <Text style={T.h1}>Follow the{'\n'}weather</Text>
              <Text style={[T.body, { fontSize: 16, marginTop: 12, maxWidth: 290 }]}>
                Optional. With location on, your goal moves with the heat and altitude of where you actually are.
              </Text>
            </View>
            <View style={{ gap: 26 }}>
              <RadioRow
                label="Allow location"
                desc={locBusy
                  ? 'Asking for permission…'
                  : detected ?? 'Your goal adapts to the day.'}
                selected={location === 'allow'} onPress={askLocation}
              />
              <RadioRow
                label="Not now" desc="Keep a fixed goal; turn it on later."
                selected={location === 'skip'} onPress={() => setLocation('skip')}
              />
            </View>
            <Text style={[T.body, { fontSize: 14 }]}>
              Checked once a day. Coordinates never leave the device.
            </Text>
          </View>
        )}

        {step === 6 && (
          <View style={{ gap: 26 }}>
            <Text style={T.h1}>Your daily{'\n'}goal</Text>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                  <Text style={s.goalBig}>{(shownMl / 1000).toFixed(1)}</Text>
                  <Text style={s.goalUnit}>litres a day</Text>
                </View>
                <GoalGlass ml={shownMl} />
              </View>
              <View style={{ marginTop: 18 }}>
                <Ruler
                  value={goal} min={GOAL.min} max={GOAL.max} px={GOAL.px} step={GOAL.step}
                  labels={rulerLabels('goal', false)}
                  onChange={setGoalSet}
                />
              </View>
              <Text style={[T.body, { fontSize: 15, marginTop: 10 }]}>
                {shownMl.toLocaleString('en-US')} ml · {goalSet == null || goalSet === recommended ? 'recommended' : 'adjusted by you'}
              </Text>
            </View>
            <View>
              <Text style={[s.fieldLabel, { fontSize: 21, marginBottom: 4 }]}>Why this number</Text>
              <Text style={[T.body, { fontSize: 15, maxWidth: 300 }]}>{goalReason}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={{ paddingHorizontal: 32, paddingTop: 16, paddingBottom: 12 }}>
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

/// Radio list row: 22px circle with accent dot, serif label, muted desc.
function RadioRow({ label, desc, selected, onPress }: {
  label: string; desc?: string; selected: boolean; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ flexDirection: 'row', gap: 16 }, pressed && { opacity: 0.7 }]}
    >
      <View style={[s.radio, selected && { borderColor: C.accent }]}>
        {selected && <View style={s.radioDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: F.heading, fontSize: 21, lineHeight: 25, letterSpacing: -0.3, color: C.text }}>
          {label}
        </Text>
        {desc ? (
          <Text style={{ fontFamily: F.body, fontSize: 14.5, lineHeight: 20, color: C.neutral600, marginTop: 3 }}>
            {desc}
          </Text>
        ) : null}
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
  header: { paddingHorizontal: 32, paddingTop: 8, gap: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  brand: { fontFamily: F.heading, fontSize: 17, letterSpacing: -0.2, color: C.text },
  stepLabel: { marginLeft: 'auto', fontFamily: F.body, fontSize: 12.5, letterSpacing: 2, color: C.faint },
  track: { height: 2, backgroundColor: C.neutral300 },
  fill: { height: 2, backgroundColor: C.accent },
  fieldLabel: { fontFamily: F.heading, fontSize: 17, color: C.text, marginBottom: 2 },
  fieldHint: { marginTop: 8, fontFamily: F.body, fontSize: 12.5, color: C.accent2Deep },
  bareInput: {
    paddingVertical: 8, paddingHorizontal: 0,
    fontFamily: F.heading, fontSize: 26, letterSpacing: -0.5, color: C.text,
    borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 },
  valueBig: { fontFamily: F.heading, fontSize: 30, letterSpacing: -0.6, color: C.text },
  readout: { fontFamily: F.heading, fontSize: 34, letterSpacing: -0.85, color: C.text, marginTop: 4, marginBottom: 2 },
  underline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, backgroundColor: C.accent },
  radio: {
    width: 22, height: 22, marginTop: 3, borderRadius: 11,
    borderWidth: 1.5, borderColor: C.neutral400,
    alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 11, height: 11, borderRadius: 5.5, backgroundColor: C.accent },
  seg: {
    flexDirection: 'row', borderWidth: 1, borderColor: C.divider,
    borderRadius: R.md, overflow: 'hidden',
  },
  segOpt: { paddingVertical: 5, paddingHorizontal: 13 },
  goalBig: { fontFamily: F.heading, fontSize: 72, lineHeight: 78, letterSpacing: -2.8, color: C.text, marginBottom: -10 },
  goalUnit: { fontFamily: F.heading, fontSize: 19, color: C.neutral600, paddingBottom: 6 },
  bandLabel: { position: 'absolute', top: 3, fontFamily: F.body, fontSize: 11.8, color: C.faint, transform: [{ translateX: -10 }] },
  ctaTxt: { fontFamily: F.heading, fontSize: 18, color: C.onAccent },
});
