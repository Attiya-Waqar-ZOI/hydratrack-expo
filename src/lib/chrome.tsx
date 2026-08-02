// Shared app chrome for the tab screens: the droplet masthead with the
// date at the right, per the Broadsheet app design.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from './app-state';
import { Droplet } from './logo';
import { C, F } from './theme';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function dateLabel(d = new Date()): string {
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`;
}

/// Minutes-from-midnight -> "7:30 AM".
export function clock12(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
}

/// Divider-ruled drink row: name · time · ±amount. With onPress it becomes
/// tappable (opens the edit sheet) and shows a chevron.
export function LogRow({ name, time, amount, onPress }: {
  name: string; time: string; amount: string; onPress?: () => void;
}) {
  const body = (
    <>
      <Text style={st.logName} numberOfLines={1}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Text style={st.logTime}>{time}</Text>
        <Text style={[st.logAmt, amount.startsWith('−') && { color: C.accent2 }]}>{amount}</Text>
        {onPress && <Text style={st.chevron}>›</Text>}
      </View>
    </>
  );
  if (!onPress) return <View style={st.logRow}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.logRow, pressed && { opacity: 0.65 }]}>
      {body}
    </Pressable>
  );
}

export function AppHeader() {
  const app = useApp();
  const goal = app.effectiveGoal;
  const pct = app.profile && goal > 0
    ? Math.round(Math.min(1, app.todayTotal / goal) * 100)
    : null;
  return (
    <View>
      <View style={st.row}>
        <Droplet width={22} />
        <Text style={st.brand}>HydraTrack</Text>
        {pct != null && (
          <View style={st.chip}>
            <Text style={st.chipTxt}>{pct}%</Text>
          </View>
        )}
      </View>
      {/* Small rounded accent tick under the wordmark, nothing heavier */}
      <View style={st.accentTick} />
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 26, paddingTop: 2, paddingBottom: 12,
  },
  brand: { fontFamily: F.heading, fontSize: 19, letterSpacing: -0.3, color: C.text },
  chip: {
    marginLeft: 'auto', backgroundColor: C.accent100, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 4,
  },
  chipTxt: { fontFamily: F.heading, fontSize: 13, color: C.accent800 },
  accentTick: {
    height: 3, width: 34, borderRadius: 2,
    backgroundColor: C.accent, marginLeft: 26,
  },
  logRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  logName: { fontFamily: F.body, fontSize: 16, color: C.text, flexShrink: 1 },
  logTime: { fontFamily: F.body, fontSize: 14, color: C.faint },
  logAmt: { fontFamily: F.heading, fontSize: 16, color: C.text },
  chevron: { fontFamily: F.body, fontSize: 17, color: C.faint },
});
