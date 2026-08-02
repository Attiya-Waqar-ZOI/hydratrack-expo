// Log a drink — photo detection up top, then the requested flow: amount
// (type it or slide it, with standard size chips), the categorized emoji
// drink grid (favorites / popular / groups / your own), the moment it was
// drunk (chips or an exact clock time, never in the future), and the CTA.
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { drinkStats } from '@/lib/db';
import { beverageById, fmtVol } from '@/lib/engines';
import { AmountField, DrinkPicker, TimeField, WhenSel, resolveWhen } from '@/lib/log-widgets';
import { RulerScrollView } from '@/lib/ruler';
import { showToast } from '@/lib/toast';
import { C, F, btnPrimary } from '@/lib/theme';
import { detectDrink, getApiKey } from '@/lib/vision';

export default function AddDrink() {
  const app = useApp();
  const useOz = app.profile?.unit === 'oz';
  const [bevId, setBevId] = useState('water');
  const [ml, setMl] = useState(250);
  const [when, setWhen] = useState<WhenSel>({ kind: 'now' });
  const [scanning, setScanning] = useState(false);
  const [guessNote, setGuessNote] = useState<string | null>(null);

  // app.version dep: refreshed after every log so Popular stays honest.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => drinkStats(), [app.version]);

  const snap = async () => {
    if (scanning) return;
    const key = await getApiKey();
    if (!key) {
      showToast('Add your AI key first: You tab → Photo detection');
      return;
    }
    if (Platform.OS === 'web') { pickImage(false); return; }
    Alert.alert('Detect drink from a photo', 'The photo is sent to your AI provider to identify the drink and amount.', [
      { text: 'Take photo', onPress: () => pickImage(true) },
      { text: 'Choose from library', onPress: () => pickImage(false) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const pickImage = async (camera: boolean) => {
    try {
      const ImagePicker = await import('expo-image-picker');
      if (camera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) { showToast('Camera access denied'); return; }
      }
      const result = camera
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;

      setScanning(true);
      setGuessNote(null);
      // Downscale before upload: cheaper, faster, and under the API's size cap.
      const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
      const img = await manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: SaveFormat.JPEG, base64: true },
      );
      const key = await getApiKey();
      const guess = await detectDrink(img.base64!, key!);
      setBevId(guess.beverage.id);
      setMl(guess.amountMl);
      setGuessNote(
        `Looks like ${guess.label} · about ${guess.amountMl} ml`
        + `${guess.confidence === 'low' ? ' (not sure — please check)' : ''}. Adjust if needed.`,
      );
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const msg = raw === 'empty' || raw === 'refused'
        ? 'Could not identify the drink — try again or pick manually'
        : `Scan failed — ${raw}`;
      // Keep it on screen (toasts vanish too fast to read an API error).
      setGuessNote(msg);
      showToast(msg);
    } finally {
      setScanning(false);
    }
  };

  const bev = beverageById(bevId);
  const hydration = Math.round(ml * bev.factor);
  const usualMl = stats.find((st) => st.beverageId === bevId)?.usualMl ?? null;
  const isFav = app.favorites.some((f) => f.beverageId === bevId && f.volumeMl === ml);

  const pick = (id: string, suggestedMl?: number) => {
    setBevId(id);
    if (suggestedMl) setMl(suggestedMl);
  };

  const log = () => {
    const { date, yesterday } = resolveWhen(when);
    const id = app.addDrink(ml, bev, when.kind === 'now' ? undefined : date);
    router.back();
    showToast(`${fmtVol(ml, !!useOz)} ${bev.name} added${yesterday ? ' to yesterday' : ''}`, {
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
        {/* Photo detection — snap or upload, AI fills in type + amount */}
        <View>
          <Pressable
            onPress={snap}
            disabled={scanning}
            style={({ pressed }) => [s.snapBtn, pressed && { backgroundColor: C.accent100 }]}
          >
            {scanning
              ? <ActivityIndicator color={C.accentDeep} />
              : <Text style={{ fontSize: 20 }}>📷</Text>}
            <Text style={s.snapTxt}>
              {scanning ? 'Identifying your drink…' : 'Snap or upload a photo'}
            </Text>
          </Pressable>
          {guessNote && (
            <Text style={{ fontFamily: F.body, fontSize: 13.5, lineHeight: 19, color: C.neutral600, marginTop: 8 }}>
              ✨ {guessNote}
            </Text>
          )}
        </View>

        {/* Amount — type it in, slide the ruler, or tap a standard size */}
        <AmountField ml={ml} onChange={setMl} useOz={!!useOz} usualMl={usualMl} />

        {/* Drink grid */}
        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>What did you drink</Text>
          <DrinkPicker
            selectedId={bevId}
            favorites={app.favorites}
            stats={stats}
            onPick={pick}
            onRemoveFavorite={(id, label) => {
              app.removeFavorite(id);
              showToast(`${label} removed from favorites`);
            }}
            onRemoveCustom={removeCustom}
            footer={<CustomDrinkForm onCreated={setBevId} />}
          />
          {/* Star the current drink + size for one-tap logging on Home */}
          <Pressable
            onPress={() => {
              const nowFav = app.toggleFavorite(bevId, ml);
              showToast(nowFav
                ? `${bev.name} · ${fmtVol(ml, !!useOz)} pinned to favorites`
                : 'Removed from favorites');
            }}
            style={({ pressed }) => [s.favRow, pressed && { opacity: 0.7 }]}
            hitSlop={6}
          >
            <Text style={{ fontSize: 17, color: isFav ? C.accent : C.faint }}>{isFav ? '★' : '☆'}</Text>
            <Text style={{ fontFamily: F.body, fontSize: 14.5, color: C.accentDeep }}>
              {isFav
                ? `${bev.name} · ${fmtVol(ml, !!useOz)} is a favorite`
                : `Save ${bev.name} · ${fmtVol(ml, !!useOz)} as a favorite`}
            </Text>
          </Pressable>
        </View>

        {/* When */}
        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>When</Text>
          <TimeField sel={when} onChange={setWhen} />
        </View>

        {/* Hydration line */}
        <View style={s.hydRow}>
          <Text style={{ fontFamily: F.body, fontSize: 15, color: C.muted }}>Counts as hydration</Text>
          <Text style={{
            fontFamily: F.heading, fontSize: 19,
            color: hydration < 0 ? C.accent2 : C.text,
          }}>
            {fmtVol(hydration, !!useOz)}
          </Text>
        </View>
        {hydration < 0 && (
          <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: -18 }}>
            Alcohol dehydrates — this entry subtracts from today&apos;s total.
          </Text>
        )}
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
        style={({ pressed }) => [{ paddingVertical: 11 }, pressed && { opacity: 0.7 }]}
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
  favRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 14,
  },
  hydRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, paddingTop: 2,
  },
  ctaTxt: { fontFamily: F.heading, fontSize: 18, color: C.onAccent },
  customBox: {
    marginTop: 8, padding: 16, gap: 10,
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
  snapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: C.divider, borderRadius: 14,
    backgroundColor: C.surface, paddingVertical: 13,
  },
  snapTxt: { fontFamily: F.heading, fontSize: 16, color: C.text },
});
