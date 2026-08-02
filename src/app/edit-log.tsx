// Edit a logged entry — reached by tapping any drink row (Home or History).
// Amount, drink and clock time can all change; the entry's day stays put
// unless the new time would land in the future, which is clamped to now.
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '@/lib/app-state';
import { drinkStats, store } from '@/lib/db';
import { beverageById, fmtVol, todayKey } from '@/lib/engines';
import { AmountField, ClockPicker, DrinkPicker, fmtClockTime } from '@/lib/log-widgets';
import { RulerScrollView } from '@/lib/ruler';
import { showToast } from '@/lib/toast';
import { C, F, btnPrimary } from '@/lib/theme';

export default function EditLog() {
  const app = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const useOz = app.profile?.unit === 'oz';

  // Snapshot once; edits live in local state until Save.
  const original = useMemo(() => (id ? store.getLog(id) : null), [id]);
  const [bevId, setBevId] = useState(original?.beverageId ?? 'water');
  const [ml, setMl] = useState(original?.volumeMl ?? 250);
  const [at, setAt] = useState(() => new Date(original?.loggedAt ?? Date.now()));
  const [clockOpen, setClockOpen] = useState(false);

   
  const stats = useMemo(() => drinkStats(), []);

  if (!original) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={{ padding: 26 }}>
          <Text style={{ fontFamily: F.body, fontSize: 16, color: C.muted }}>
            This entry no longer exists.
          </Text>
          <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 16, color: C.accentDeep }}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const bev = beverageById(bevId);
  const hydration = Math.round(ml * bev.factor);

  const setClock = (d: Date) => {
    // Keep the entry on its own day; only the clock time moves.
    const next = new Date(original.loggedAt);
    next.setHours(d.getHours(), d.getMinutes(), 0, 0);
    // Never into the future (only possible when editing today's entries).
    setAt(next.getTime() > Date.now() ? new Date() : next);
  };

  const save = () => {
    app.updateDrink(original.id, ml, bev, at);
    router.back();
    showToast(`Updated to ${fmtVol(ml, !!useOz)} ${bev.name}`);
  };

  const remove = () => {
    Alert.alert('Delete this entry?', `${fmtVol(original.volumeMl, !!useOz)} ${beverageById(original.beverageId).name}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          app.undo(original.id);
          router.back();
          showToast('Entry deleted');
        },
      },
    ]);
  };

  const dayLabel = original.dayKey === todayKey()
    ? 'today'
    : original.dayKey;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontFamily: F.body, fontSize: 17, color: C.muted }}>←</Text>
        </Pressable>
        <Text style={s.title}>Edit entry</Text>
        <Pressable onPress={remove} hitSlop={12} style={{ marginLeft: 'auto' }}>
          <Text style={{ fontFamily: F.body, fontSize: 15, color: C.accent2 }}>Delete</Text>
        </Pressable>
      </View>

      <RulerScrollView
        contentContainerStyle={{ paddingHorizontal: 26, paddingBottom: 12, gap: 26 }}
        keyboardShouldPersistTaps="handled"
      >
        <AmountField ml={ml} onChange={setMl} useOz={!!useOz} />

        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>Drink</Text>
          <DrinkPicker
            selectedId={bevId}
            favorites={app.favorites}
            stats={stats}
            onPick={(pickedId) => setBevId(pickedId)}
          />
        </View>

        <View>
          <Text style={[s.section, { marginBottom: 12 }]}>Time</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ fontFamily: F.heading, fontSize: 22, color: C.text }}>
              {fmtClockTime(at)}
            </Text>
            <Pressable onPress={() => setClockOpen((v) => !v)} style={s.changeBtn} hitSlop={6}>
              <Text style={{ fontFamily: F.body, fontSize: 14, color: C.accentDeep }}>
                {clockOpen ? 'Done' : 'Change'}
              </Text>
            </Pressable>
            <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.faint }}>
              stays on {dayLabel}
            </Text>
          </View>
          {clockOpen && (
            <ClockPicker value={at} onPick={setClock} onDismiss={() => setClockOpen(false)} />
          )}
        </View>

        <View style={s.hydRow}>
          <Text style={{ fontFamily: F.body, fontSize: 15, color: C.muted }}>Counts as hydration</Text>
          <Text style={{
            fontFamily: F.heading, fontSize: 19,
            color: hydration < 0 ? C.accent2 : C.text,
          }}>
            {fmtVol(hydration, !!useOz)}
          </Text>
        </View>
      </RulerScrollView>

      <View style={{ paddingHorizontal: 26, paddingTop: 12, paddingBottom: 16 }}>
        <Pressable
          onPress={save}
          style={({ pressed }) => [btnPrimary, pressed && { backgroundColor: C.accentDeep }]}
        >
          <Text style={s.ctaTxt}>Save changes</Text>
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
  changeBtn: {
    borderWidth: 1, borderColor: C.divider, borderRadius: 10,
    paddingVertical: 6, paddingHorizontal: 12,
  },
  hydRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, paddingTop: 2,
  },
  ctaTxt: { fontFamily: F.heading, fontSize: 18, color: C.onAccent },
});
