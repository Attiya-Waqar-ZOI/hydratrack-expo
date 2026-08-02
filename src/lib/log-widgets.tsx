// Shared widgets for logging screens (add + edit): the amount field with a
// type-in readout, ruler and size chips; the categorized emoji drink grid
// (favorites / popular / built-in groups / your drinks); and the exact-time
// picker. Kept together so both screens stay visually identical.
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DrinkStat } from './db';
import {
  BEVERAGE_CATEGORIES, Beverage, SIZE_CHIPS, allBeverages, beverageById, fmtVol, todayKey,
} from './engines';
import { Ruler } from './ruler';
import { C, F } from './theme';
import type { FavoriteRow } from './types';

// Native time wheel; the web preview falls back to an HH:MM input.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const DateTimePicker = Platform.OS === 'web' ? null : require('@react-native-community/datetimepicker').default;

// ── Amount ──────────────────────────────────────────────────────────
const AMT = { min: 50, max: 1000, px: 0.24, step: 50 };

export function AmountField({ ml, onChange, useOz, usualMl }: {
  ml: number;
  onChange: (ml: number) => void;
  useOz: boolean;
  usualMl?: number | null; // the drink's most-logged size, shown as a chip
}) {
  const [draft, setDraft] = useState<string | null>(null); // non-null while typing

  const commit = () => {
    if (draft != null) {
      const n = parseInt(draft, 10);
      if (Number.isFinite(n) && n > 0) onChange(Math.min(2000, Math.max(10, n)));
    }
    setDraft(null);
  };

  const chips = useMemo(() => {
    const base = [...SIZE_CHIPS];
    if (usualMl && !base.includes(usualMl)) base.unshift(usualMl);
    return base;
  }, [usualMl]);

  return (
    <View>
      <View style={s.amtRow}>
        <Text style={s.section}>How much</Text>
        {/* Punch the number in directly, or drag the ruler below */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
          <TextInput
            style={s.readoutInput}
            value={draft ?? String(ml)}
            onFocus={() => setDraft(String(ml))}
            onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ''))}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            returnKeyType="done"
            maxLength={4}
          />
          <Text style={s.readoutUnit}>ml{useOz ? ` · ${fmtVol(ml, true)}` : ''}</Text>
        </View>
      </View>
      <View style={{ marginTop: 4 }}>
        <Ruler
          value={Math.min(AMT.max, Math.max(AMT.min, ml))}
          min={AMT.min} max={AMT.max} px={AMT.px} step={AMT.step}
          labels={Array.from({ length: 5 }, (_, i) => {
            const v = 200 + i * 200;
            return { left: (v - AMT.min) * AMT.px, text: String(v) };
          })}
          onChange={onChange}
        />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 10 }}>
        {chips.map((v) => (
          <Pressable key={v} onPress={() => onChange(v)} style={[s.chip, ml === v && s.chipOn]}>
            <Text style={{ fontFamily: F.body, fontSize: 13.5, color: C.text }}>
              {v === usualMl && !SIZE_CHIPS.includes(v) ? `Usual · ${fmtVol(v, useOz)}` : fmtVol(v, useOz)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── Drink grid ──────────────────────────────────────────────────────
interface Tile { bev: Beverage; ml?: number; favId?: string }
interface Cat { key: string; label: string; tiles: Tile[] }

export function DrinkPicker({
  selectedId, favorites, stats, onPick, onRemoveFavorite, onRemoveCustom, footer,
}: {
  selectedId: string;
  favorites: FavoriteRow[];
  stats: DrinkStat[];
  onPick: (beverageId: string, suggestedMl?: number) => void;
  onRemoveFavorite?: (id: string, label: string) => void;
  onRemoveCustom?: (id: string, name: string) => void;
  footer?: React.ReactNode; // rendered under "Your drinks" (the add-your-own form)
}) {
  const usualOf = (bevId: string) => stats.find((st) => st.beverageId === bevId)?.usualMl;

  const cats = useMemo<Cat[]>(() => {
    const customs = allBeverages().filter((b) => b.id.startsWith('custom_'));
    const list: Cat[] = [];
    if (favorites.length > 0) {
      list.push({
        key: 'fav', label: '★ Favorites',
        tiles: favorites.map((f) => ({ bev: beverageById(f.beverageId), ml: f.volumeMl, favId: f.id })),
      });
    }
    const pop = stats.filter((st) => st.uses >= 2).slice(0, 6);
    if (pop.length > 0) {
      list.push({
        key: 'popular', label: 'Popular',
        tiles: pop.map((st) => ({ bev: beverageById(st.beverageId), ml: st.usualMl })),
      });
    }
    for (const c of BEVERAGE_CATEGORIES) {
      list.push({ key: c.key, label: c.label, tiles: c.ids.map((id) => ({ bev: beverageById(id) })) });
    }
    list.push({ key: 'mine', label: 'Your drinks', tiles: customs.map((bev) => ({ bev })) });
    return list;
  }, [favorites, stats]);

  // Open on the category that holds the current selection (edit screen),
  // falling back to the first (favorites/popular on the add sheet).
  const [activeKey, setActiveKey] = useState(() => {
    const home = BEVERAGE_CATEGORIES.find((c) => c.ids.includes(selectedId))?.key
      ?? (selectedId.startsWith('custom_') ? 'mine' : null);
    return home && selectedId !== 'water' ? home : cats[0].key;
  });
  const active = cats.find((c) => c.key === activeKey) ?? cats[0];
  // If the active category vanished (last favorite removed), fall back.
  useEffect(() => {
    if (!cats.some((c) => c.key === activeKey)) setActiveKey(cats[0].key);
  }, [cats, activeKey]);

  const longPress = (t: Tile) => {
    if (t.favId && onRemoveFavorite) {
      Alert.alert('Remove favorite?', `${t.bev.name} · ${t.ml} ml`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemoveFavorite(t.favId!, t.bev.name) },
      ]);
    } else if (t.bev.id.startsWith('custom_') && onRemoveCustom) {
      Alert.alert('Delete this drink?', t.bev.name, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onRemoveCustom(t.bev.id, t.bev.name) },
      ]);
    }
  };

  return (
    <View>
      {/* Category rail */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }}>
        {cats.map((c) => (
          <Pressable
            key={c.key}
            onPress={() => setActiveKey(c.key)}
            style={[s.catChip, c.key === active.key && s.catChipOn]}
          >
            <Text style={{
              fontFamily: F.heading, fontSize: 14,
              color: c.key === active.key ? C.onAccent : C.text,
            }}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Tile grid */}
      <View style={s.grid}>
        {active.tiles.map((t, i) => {
          const on = t.bev.id === selectedId;
          const pctNote = t.bev.factor === 1
            ? null
            : `${t.bev.factor < 0 ? '−' : ''}${Math.abs(Math.round(t.bev.factor * 100))}%`;
          return (
            <Pressable
              key={`${t.bev.id}_${t.ml ?? ''}_${i}`}
              onPress={() => onPick(t.bev.id, t.ml ?? usualOf(t.bev.id))}
              onLongPress={() => longPress(t)}
              style={[s.tile, on && s.tileOn]}
            >
              <Text style={{ fontSize: 26 }}>{t.bev.emoji}</Text>
              <Text style={s.tileName} numberOfLines={2}>{t.bev.name}</Text>
              <Text style={s.tileSub}>
                {t.ml != null ? `${t.ml} ml` : (pctNote ?? ' ')}
              </Text>
            </Pressable>
          );
        })}
        {active.key === 'mine' && active.tiles.length === 0 && (
          <Text style={[s.tileSub, { paddingVertical: 8 }]}>
            No custom drinks yet — add one below.
          </Text>
        )}
      </View>
      {active.key === 'mine' && footer}
      {(active.key === 'fav' || active.key === 'mine') && active.tiles.length > 0 && (
        <Text style={{ fontFamily: F.body, fontSize: 12, color: C.faint, marginTop: 6 }}>
          Hold a tile to remove it.
        </Text>
      )}
    </View>
  );
}

// ── When ────────────────────────────────────────────────────────────
export type WhenSel =
  | { kind: 'now' }
  | { kind: 'ago'; h: number }
  | { kind: 'exact'; date: Date };

/// Resolve a selection to a concrete moment. An exact clock time that is
/// still ahead of "now" belongs to yesterday — logs are never in the future.
export function resolveWhen(sel: WhenSel, now = new Date()): { date: Date; yesterday: boolean } {
  if (sel.kind === 'now') return { date: now, yesterday: false };
  if (sel.kind === 'ago') {
    const d = new Date(now.getTime() - sel.h * 3600_000);
    return { date: d, yesterday: todayKey(d) !== todayKey(now) };
  }
  const d = new Date(now);
  d.setHours(sel.date.getHours(), sel.date.getMinutes(), 0, 0);
  if (d.getTime() > now.getTime()) {
    d.setDate(d.getDate() - 1);
    return { date: d, yesterday: true };
  }
  return { date: d, yesterday: false };
}

export function fmtClockTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/// Per-platform clock control. iOS: inline spinner. Android: system dialog
/// (fires once, then closes). Web: a plain HH:MM input.
export function ClockPicker({ value, onPick, onDismiss }: {
  value: Date;
  onPick: (d: Date) => void;
  onDismiss?: () => void;
}) {
  const [webText, setWebText] = useState(
    `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
  );
  if (Platform.OS === 'web') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
        <TextInput
          style={s.webClock}
          value={webText}
          onChangeText={setWebText}
          placeholder="HH:MM"
          onBlur={() => {
            const m = webText.match(/^(\d{1,2}):(\d{2})$/);
            if (!m) return;
            const d = new Date(value);
            d.setHours(Math.min(23, +m[1]), Math.min(59, +m[2]), 0, 0);
            onPick(d);
          }}
        />
        <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted }}>24-hour</Text>
      </View>
    );
  }
  return (
    <DateTimePicker
      value={value}
      mode="time"
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      themeVariant="light"
      onChange={(e: { type: string }, d?: Date) => {
        if (Platform.OS === 'android') onDismiss?.();
        if (e.type !== 'dismissed' && d) onPick(d);
      }}
      style={Platform.OS === 'ios' ? { height: 130, alignSelf: 'stretch' } : undefined}
    />
  );
}

const AGO_CHIPS = [
  { label: 'Now', h: 0 }, { label: '1h ago', h: 1 }, { label: '2h ago', h: 2 },
  { label: '3h ago', h: 3 }, { label: '6h ago', h: 6 },
];

export function TimeField({ sel, onChange }: {
  sel: WhenSel;
  onChange: (s: WhenSel) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const resolved = resolveWhen(sel);
  // iOS keeps the spinner inline; Android's dialog closes itself.
  const keepOpen = pickerOpen && Platform.OS !== 'android';

  return (
    <View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {AGO_CHIPS.map((w) => {
          const on = !pickerOpen && (
            (sel.kind === 'now' && w.h === 0) || (sel.kind === 'ago' && sel.h === w.h)
          );
          return (
            <Pressable
              key={w.h}
              onPress={() => {
                setPickerOpen(false);
                onChange(w.h === 0 ? { kind: 'now' } : { kind: 'ago', h: w.h });
              }}
              style={[s.chip, on && s.chipOn]}
            >
              <Text style={{ fontFamily: F.body, fontSize: 15, color: C.text }}>{w.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            onChange({ kind: 'exact', date: resolved.date });
            setPickerOpen(true);
          }}
          style={[s.chip, (pickerOpen || sel.kind === 'exact') && s.chipOn]}
        >
          <Text style={{ fontFamily: F.body, fontSize: 15, color: C.text }}>
            {sel.kind === 'exact' ? `⏱ ${fmtClockTime(resolved.date)}` : '⏱ Exact time…'}
          </Text>
        </Pressable>
      </View>

      {keepOpen && (
        <ClockPicker
          value={resolved.date}
          onPick={(d) => onChange({ kind: 'exact', date: d })}
          onDismiss={() => setPickerOpen(false)}
        />
      )}

      <Text style={{ fontFamily: F.body, fontSize: 13, color: C.muted, marginTop: 8 }}>
        {sel.kind === 'now'
          ? `Logs at the current time, ${fmtClockTime(resolved.date)}.`
          : `Logs at ${fmtClockTime(resolved.date)}${resolved.yesterday ? ' yesterday — a time ahead of now counts as the day before' : ''}.`}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { fontFamily: F.heading, fontSize: 19, color: C.text },
  amtRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  readoutInput: {
    fontFamily: F.heading, fontSize: 30, letterSpacing: -0.7, color: C.text,
    minWidth: 78, textAlign: 'right', paddingVertical: 0,
    borderBottomWidth: 1, borderBottomColor: C.neutral400,
  },
  readoutUnit: { fontFamily: F.body, fontSize: 14, color: C.muted },
  chip: {
    borderWidth: 1, borderColor: C.divider, borderRadius: 12,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  chipOn: {
    borderWidth: 1.5, borderColor: C.accent,
    paddingVertical: 7.5, paddingHorizontal: 13.5,
  },
  catChip: {
    borderRadius: 999, paddingVertical: 8, paddingHorizontal: 15,
    backgroundColor: C.surface,
  },
  catChipOn: { backgroundColor: C.accent },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 12 },
  tile: {
    width: '31%', flexGrow: 1, maxWidth: '32%',
    alignItems: 'center', gap: 3,
    borderWidth: 1, borderColor: C.divider, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 6,
  },
  tileOn: { borderWidth: 1.5, borderColor: C.accent, backgroundColor: C.accent100 },
  tileName: { fontFamily: F.body, fontSize: 12.5, color: C.text, textAlign: 'center' },
  tileSub: { fontFamily: F.body, fontSize: 11.5, color: C.faint },
  webClock: {
    fontFamily: F.body, fontSize: 16, color: C.text,
    borderBottomWidth: 1, borderBottomColor: C.neutral400,
    paddingVertical: 4, minWidth: 70,
  },
});
