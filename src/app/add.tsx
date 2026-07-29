// Log a drink — the design's sheet: amount ruler first, then the beverage
// radio list (built-ins + the user's own drinks), bordered When chips, the
// hydration line, and a full-width serif CTA. Users can define custom
// drinks by stating how much water a reference serving counts as.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { allBeverages, beverageById, fmtVol, todayKey } from '@/lib/engines';
import { Ruler, RulerScrollView } from '@/lib/ruler';
import { showToast } from '@/lib/toast';
import { C, F, btnPrimary } from '@/lib/theme';

const AMT = { min: 50, max: 1000, px: 0.24, step: 50 };
const PRESETS = [
  { label: 'Half glass', ml: 125 },
  { label: 'Glass', ml: 250 },
  { label: 'Can', ml: 330 },
  { label: 'Mug', ml: 350 },
  { label: 'Bottle', ml: 500 },
];
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

  const bevs = allBeverages();
  const bev = beverageById(bevId);
  const hydration = Math.round(ml * bev.factor);

  const log = () => {
    const at = hoursAgo > 0 ? new Date(Date.now() - hoursAgo * 3600_000) : undefined;
    // A back-dated time can cross midnight; say so, or the log looks lost.
    const backdated = at && todayKey(at) !== todayKey();
    const id = app.addDrink(ml, bev, at);
    router.back();
    showToast(`${fmtVol(ml, !!useOz)} ${bev.name} added${backdated ? ' to yesterday' : ''}`, {
      actionLabel: 'Undo',
      onAction: () => app.undo(id),
    });
  };

  const removeCustom = (id: string, name: string) => {
    app.removeCustomBeverage(id);
    if (bevId === id) setBevId('water');
    showToast(`${name} removed`);
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

      <RulerScrollView
        contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 12, gap: 26 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount — first, per the flow: how much, then what */}
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
          {/* Standard servings — tap to set the ruler */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 }}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.ml}
                onPress={() => setMl(p.ml)}
                style={[s.whenChip, ml === p.ml && s.whenChipOn]}
              >
                <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.text }}>
                  {p.label} · {fmtVol(p.ml, !!useOz)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Beverage list */}
        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>What did you drink</Text>
          {bevs.map((b) => {
            const custom = b.id.startsWith('custom_');
            return (
              <Pressable
                key={b.id}
                onPress={() => setBevId(b.id)}
                style={({ pressed }) => [s.bevRow, pressed && { opacity: 0.7 }]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={[s.radio, bevId === b.id && { borderColor: C.accent }]}>
                    {bevId === b.id && <View style={s.radioDot} />}
                  </View>
                  <Text style={{ fontFamily: F.body, fontSize: 16, color: C.text }} numberOfLines={1}>
                    {b.name}
                  </Text>
                </View>
                <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.muted }}>
                  {b.factor === 1 ? 'counts fully' : `counts ${Math.round(b.factor * 100)}%`}
                </Text>
                {custom && (
                  <Pressable onPress={() => removeCustom(b.id, b.name)} hitSlop={10}>
                    <Text style={{ fontFamily: F.body, fontSize: 15, color: C.muted }}>✕</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}
          <CustomDrinkForm onCreated={setBevId} />
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
      </RulerScrollView>

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

/// "Add your own drink": name it, then state the reference — in a serving
/// of X ml, Y ml counts as water. The factor Y/X scales to any amount.
function CustomDrinkForm({ onCreated }: { onCreated: (id: string) => void }) {
  const app = useApp();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [serving, setServing] = useState('330');
  const [water, setWater] = useState('250');

  const servingN = parseInt(serving, 10);
  const waterN = parseInt(water, 10);
  const valid =
    name.trim().length > 0 &&
    Number.isFinite(servingN) && servingN > 0 &&
    Number.isFinite(waterN) && waterN >= 0;
  const pct = valid ? Math.round(Math.max(0.05, Math.min(1.5, waterN / servingN)) * 100) : null;

  const save = () => {
    if (!valid) return;
    const id = app.addCustomBeverage(name, servingN, waterN);
    onCreated(id);
    setOpen(false);
    setName(''); setServing('330'); setWater('250');
    showToast(`${name.trim()} added — counts ${pct}%`);
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [s.bevRow, { borderBottomWidth: 0 }, pressed && { opacity: 0.7 }]}
      >
        <Text style={{ fontFamily: F.body, fontSize: 16, color: C.accentDeep }}>
          ＋ Add your own drink
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={s.customBox}>
      <Text style={s.customTitle}>Your drink</Text>
      <TextInput
        style={s.input}
        value={name}
        onChangeText={setName}
        placeholder="Name, e.g. Laban"
        placeholderTextColor={C.faint}
        maxLength={24}
        autoFocus
      />
      <Text style={s.customHint}>
        How much water is in a serving of it?
      </Text>
      <View style={{ flexDirection: 'row', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldKicker}>A serving of</Text>
          <View style={s.unitRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={serving}
              onChangeText={setServing}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Text style={s.unitTxt}>ml</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.fieldKicker}>counts as</Text>
          <View style={s.unitRow}>
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={water}
              onChangeText={setWater}
              keyboardType="number-pad"
              maxLength={4}
            />
            <Text style={s.unitTxt}>ml water</Text>
          </View>
        </View>
      </View>
      <Text style={s.customHint}>
        {pct != null
          ? `Counts ${pct}% — every amount you log scales from this.`
          : 'Enter a name and both amounts.'}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
        <Pressable onPress={() => setOpen(false)} style={s.smallBtn} hitSlop={6}>
          <Text style={{ fontFamily: F.body, fontSize: 15, color: C.muted }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={save}
          style={[s.smallBtn, s.smallBtnPrimary, !valid && { opacity: 0.4 }]}
          disabled={!valid}
          hitSlop={6}
        >
          <Text style={{ fontFamily: F.heading, fontSize: 15, color: C.onAccent }}>Save drink</Text>
        </Pressable>
      </View>
    </View>
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
    borderWidth: 1, borderColor: C.divider, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  whenChipOn: { borderWidth: 1.5, borderColor: C.accent, paddingVertical: 7.5, paddingHorizontal: 13.5, borderRadius: 12 },
  hydRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, paddingTop: 2,
  },
  ctaTxt: { fontFamily: F.heading, fontSize: 18, color: C.onAccent },
  customBox: {
    marginTop: 14, padding: 16, gap: 10,
    borderWidth: 1, borderColor: C.divider, borderRadius: 14,
  },
  customTitle: { fontFamily: F.heading, fontSize: 17, color: C.text },
  customHint: { fontFamily: F.body, fontSize: 13, lineHeight: 18, color: C.muted },
  fieldKicker: { fontFamily: F.body, fontSize: 12.5, color: C.muted, marginBottom: 2 },
  input: {
    fontFamily: F.body, fontSize: 16, color: C.text,
    borderBottomWidth: 1, borderBottomColor: C.neutral400,
    paddingVertical: 6, paddingHorizontal: 2,
  },
  unitRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  unitTxt: { fontFamily: F.body, fontSize: 13, color: C.muted },
  smallBtn: {
    paddingVertical: 9, paddingHorizontal: 16, borderRadius: 10,
    borderWidth: 1, borderColor: C.divider,
  },
  smallBtnPrimary: { backgroundColor: C.accent, borderColor: C.accent },
});
