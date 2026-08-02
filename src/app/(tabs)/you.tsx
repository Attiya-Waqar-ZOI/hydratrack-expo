// You — port of the design: name headline with profile line and Edit,
// then divider-ruled rows (title + summary left, segmented control right).
// Custom goal opens the ruler; reminders show a count stepper and the
// scheduled times as quiet chips.
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { autoGoal, useApp } from '@/lib/app-state';
import { AppHeader, clock12 } from '@/lib/chrome';
import {
  ACTIVITY_LABELS, ActivityLevel, Climate, GENDER_LABELS, Gender, fmtVol,
} from '@/lib/engines';
import {
  DEFAULT_PREFS, ReminderPrefs, loadReminderPrefs, reminderTimes,
  saveReminderPrefs,
} from '@/lib/reminders';
import { Ruler } from '@/lib/ruler';
import { stepsEnabled } from '@/lib/steps';
import { showToast } from '@/lib/toast';
import { C, F, T } from '@/lib/theme';
import { getApiKey, setApiKey } from '@/lib/vision';

const GOAL = { min: 1000, max: 6000, px: 0.36, step: 50 };

export default function You() {
  const app = useApp();
  const p = app.profile;
  if (!p) return null;
  const useOz = p.unit === 'oz';

  const setUnit = (unit: 'ml' | 'oz') => app.saveProfile({ ...p, unit });

  const setGoalMode = (custom: boolean) => {
    if (custom) {
      app.saveProfile({ ...p, useCustomGoal: 1, customGoalMl: p.dailyGoalMl });
    } else {
      const g = autoGoal(p.weightKg, p.activity as ActivityLevel, p.climate as Climate, p.gender as Gender, p.age);
      app.saveProfile({ ...p, useCustomGoal: 0, dailyGoalMl: g });
    }
  };

  const setGoal = (ml: number) =>
    app.saveProfile({ ...p, dailyGoalMl: ml, customGoalMl: ml, useCustomGoal: 1 });

  const confirmReset = () =>
    Alert.alert('Reset all data?', 'This permanently clears your profile and logs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset', style: 'destructive',
        onPress: () => { app.resetAll(); router.replace('/onboarding'); },
      },
    ]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <AppHeader />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 24 }}>
        {/* Identity: monogram, name, facts */}
        <View style={s.identity}>
          <View style={s.avatar}>
            <Text style={s.avatarTxt}>{(p.name.trim()[0] ?? 'H').toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.idName}>{p.name}</Text>
            <Text style={[T.body, { fontSize: 14, marginTop: 3 }]}>
              {p.age} yrs · {GENDER_LABELS[p.gender as Gender] ?? p.gender}
            </Text>
            <Text style={[T.small, { fontSize: 13, marginTop: 1 }]}>
              {ACTIVITY_LABELS[p.activity as ActivityLevel]}
            </Text>
          </View>
          <Pressable onPress={() => router.push({ pathname: '/onboarding', params: { edit: '1' } })} hitSlop={8}>
            <Text style={s.ghost}>Edit</Text>
          </Pressable>
        </View>

        {/* Daily goal */}
        <View style={s.row}>
          <View style={s.rowHead}>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Daily goal</Text>
              <Text style={s.rowSub}>
                {fmtVol(p.dailyGoalMl, useOz)}, {p.useCustomGoal ? 'Set by you' : 'Automatic'}
              </Text>
            </View>
            <Seg
              options={['Auto', 'Custom']}
              selected={p.useCustomGoal ? 1 : 0}
              onSelect={(i) => setGoalMode(i === 1)}
            />
          </View>
          {!!p.useCustomGoal && (
            <View style={{ marginTop: 12 }}>
              <Text style={s.readout}>{fmtVol(p.dailyGoalMl, useOz)}</Text>
              <Ruler
                value={p.dailyGoalMl} min={GOAL.min} max={GOAL.max} px={GOAL.px} step={GOAL.step}
                labels={Array.from({ length: 11 }, (_, i) => {
                  const v = 1000 + i * 500;
                  return { left: (v - GOAL.min) * GOAL.px, text: (v / 1000).toFixed(1) };
                })}
                onChange={setGoal}
              />
            </View>
          )}
        </View>

        {/* Reminders */}
        <NotificationSettings />

        {/* Weather */}
        <WeatherSettings />

        {/* Steps */}
        <StepSettings />

        {/* Photo detection API key */}
        <VisionSettings />

        {/* Units */}
        <View style={[s.row, s.rowHead]}>
          <View style={{ flex: 1 }}>
            <Text style={s.rowTitle}>Volume unit</Text>
            <Text style={s.rowSub}>How amounts are shown</Text>
          </View>
          <Seg options={['ml', 'oz']} selected={useOz ? 1 : 0} onSelect={(i) => setUnit(i === 1 ? 'oz' : 'ml')} />
        </View>

        {/* Reset */}
        <View style={[s.row, { paddingBottom: 4 }]}>
          <Pressable
            onPress={confirmReset}
            style={({ pressed }) => [s.dangerBtn, pressed && { backgroundColor: C.accent2200 }]}
          >
            <Text style={{ fontFamily: F.heading, fontSize: 15, color: C.accent2Deep }}>Reset all data</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/// Photo drink detection needs the user's own Anthropic API key —
/// stored on this device only, never shipped in the app bundle.
function VisionSettings() {
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => { getApiKey().then((k) => setSaved(!!k)); }, []);

  const save = async () => {
    await setApiKey(draft);
    setSaved(draft.trim().length > 0);
    setDraft('');
    setEditing(false);
    showToast(draft.trim() ? 'Key saved — photo detection is on' : 'Key removed');
  };

  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Photo detection</Text>
          <Text style={s.rowSub}>
            {saved ? 'On — key stored on this device' : 'Needs your AI key (Gemini or Claude)'}
          </Text>
        </View>
        <Seg
          options={[saved ? 'Change' : 'Add', 'Hide']}
          selected={editing ? 0 : 1}
          onSelect={(i) => setEditing(i === 0)}
        />
      </View>
      {editing && (
        <View style={{ marginTop: 12, gap: 10 }}>
          <TextInput
            style={visionStyles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="sk-ant-... or AIza..."
            placeholderTextColor={C.faint}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={save} style={visionStyles.saveBtn} hitSlop={6}>
              <Text style={{ fontFamily: F.heading, fontSize: 14, color: C.onAccent }}>
                {draft.trim() ? 'Save key' : saved ? 'Remove key' : 'Save'}
              </Text>
            </Pressable>
          </View>
          <Text style={[T.small, { fontSize: 12 }]}>
            Works with an Anthropic key (console.anthropic.com, under a cent per
            photo) or a free Google Gemini key (aistudio.google.com, no card
            needed). The key never leaves this phone except to call the AI directly.
          </Text>
        </View>
      )}
    </View>
  );
}

const visionStyles = StyleSheet.create({
  input: {
    fontFamily: F.body, fontSize: 15, color: C.text,
    borderWidth: 1, borderColor: C.divider, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 12, backgroundColor: C.surface,
  },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 10,
    paddingVertical: 9, paddingHorizontal: 16, alignSelf: 'flex-start',
  },
});

/// Step-aware goal: motion-sensor steps add to the daily target.
/// One-time weather setting: allowed once, refreshes itself daily.
function WeatherSettings() {
  const app = useApp();

  const toggle = async (want: boolean) => {
    const ok = await app.setWeatherAuto(want).catch(() => false);
    if (want && !ok) showToast('Could not read the weather — check location permission');
  };

  const ctx = app.dayContext;
  const sub = !app.weatherAuto
    ? 'Hot or dry days raise your goal'
    : ctx?.tempC != null
      ? `${Math.round(ctx.tempC)}°C${ctx.place ? ` in ${ctx.place}` : ''}${app.env.totalMl > 0 ? ` · +${app.env.totalMl} ml today` : ' · no boost today'}`
      : 'On — checks once a day';

  return (
    <View style={[s.row, s.rowHead]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>Weather adjusts the goal</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Seg options={['Off', 'On']} selected={app.weatherAuto ? 1 : 0} onSelect={(i) => toggle(i === 1)} />
    </View>
  );
}

function StepSettings() {
  const app = useApp();
  const [on, setOn] = useState(false);

  useEffect(() => { stepsEnabled().then(setOn); }, []);

  const toggle = async (want: boolean) => {
    const ok = await app.setStepTracking(want);
    setOn(want && ok);
    if (want && !ok) showToast('Motion access denied — enable it in Settings');
  };

  const sub = !on
    ? 'Active days add to your goal'
    : app.stepsToday == null
      ? 'On — reading your steps'
      : `${app.stepsToday.toLocaleString()} steps today${app.stepBoost > 0 ? ` · +${app.stepBoost} ml` : ''}`;

  return (
    <View style={[s.row, s.rowHead]}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>Steps raise the goal</Text>
        <Text style={s.rowSub}>{sub}</Text>
      </View>
      <Seg options={['Off', 'On']} selected={on ? 1 : 0} onSelect={(i) => toggle(i === 1)} />
    </View>
  );
}

/// Reminder preferences — every change reschedules the local notifications.
function NotificationSettings() {
  const app = useApp();
  const [prefs, setPrefs] = useState<ReminderPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadReminderPrefs().then(setPrefs);
  }, []);

  const save = (next: ReminderPrefs) => {
    setPrefs(next);
    const status = app.profile
      ? {
        remainingMl: Math.max(0, app.effectiveGoal - app.todayTotal),
        useOz: app.profile.unit === 'oz',
      }
      : null;
    saveReminderPrefs(next, status).then(({ scheduled, denied }) => {
      if (denied) {
        showToast('Enable notifications in Settings');
      } else if (next.on && scheduled > 0) {
        showToast(`${scheduled} reminders set`);
      }
    });
  };

  const times = reminderTimes(prefs);
  const summary = prefs.on
    ? `${prefs.perDay} a day, ${clock12(prefs.startMin)} to ${clock12(prefs.endMin)}`
    : 'No nudges';

  return (
    <View style={s.row}>
      <View style={s.rowHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.rowTitle}>Reminders</Text>
          <Text style={s.rowSub}>{summary}</Text>
        </View>
        <Seg
          options={['Off', 'On']}
          selected={prefs.on ? 1 : 0}
          onSelect={(i) => save({ ...prefs, on: i === 1 })}
        />
      </View>
      {prefs.on && (
        <View style={{ gap: 14, marginTop: 18, paddingLeft: 2 }}>
          <View style={s.countRow}>
            <Text style={{ fontFamily: F.body, fontSize: 16, color: C.text }}>How many a day</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <Pressable onPress={() => save({ ...prefs, perDay: Math.max(2, prefs.perDay - 1) })} hitSlop={10}>
                <Text style={s.stepBtn}>−</Text>
              </Pressable>
              <Text style={s.count}>{prefs.perDay}</Text>
              <Pressable onPress={() => save({ ...prefs, perDay: Math.min(12, prefs.perDay + 1) })} hitSlop={10}>
                <Text style={s.stepBtn}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {times.map((t) => (
              <View key={t} style={s.timeChip}>
                <Text style={{ fontFamily: F.body, fontSize: 12.5, color: C.text }}>{clock12(t)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

/// Bordered segmented control; selected cell fills with accent.
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
          <Text style={{ fontFamily: F.body, fontSize: 13, color: selected === i ? C.onAccent : C.text }}>
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 6, paddingBottom: 24 },
  avatar: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: C.accent100,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: F.heading, fontSize: 26, color: C.accentDeep, marginTop: -2 },
  idName: { fontFamily: F.heading, fontSize: 22, letterSpacing: -0.4, color: C.text },
  ghost: { fontFamily: F.heading, fontSize: 15, color: C.accentDeep, paddingVertical: 6 },
  row: { borderTopWidth: 1, borderTopColor: C.divider, paddingVertical: 20 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rowTitle: { fontFamily: F.heading, fontSize: 21, letterSpacing: -0.3, color: C.text },
  rowSub: { fontFamily: F.body, fontSize: 14, color: C.muted, marginTop: 2 },
  readout: { fontFamily: F.heading, fontSize: 30, letterSpacing: -0.7, color: C.text, marginBottom: 2 },
  seg: { flexDirection: 'row', borderWidth: 1, borderColor: C.divider, borderRadius: 999, overflow: 'hidden' },
  segOpt: { paddingVertical: 6, paddingHorizontal: 15 },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepBtn: { fontFamily: F.body, fontSize: 20, color: C.accentDeep, width: 24, textAlign: 'center' },
  count: { fontFamily: F.heading, fontSize: 19, minWidth: 22, textAlign: 'center', color: C.text },
  timeChip: { backgroundColor: C.neutral200, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },
  dangerBtn: {
    backgroundColor: C.accent2100,
    borderWidth: 1, borderColor: C.accent2200,
    borderRadius: 999, height: 44,
    paddingHorizontal: 22, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center',
  },
});
