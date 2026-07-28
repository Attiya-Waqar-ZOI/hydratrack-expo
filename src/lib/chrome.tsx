// Shared app chrome for the tab screens: the droplet masthead with the
// date at the right, per the Broadsheet app design.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

/// Divider-ruled drink row: name · time · +amount.
export function LogRow({ name, time, amount }: {
  name: string; time: string; amount: string;
}) {
  return (
    <View style={st.logRow}>
      <Text style={st.logName}>{name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
        <Text style={st.logTime}>{time}</Text>
        <Text style={st.logAmt}>{amount}</Text>
      </View>
    </View>
  );
}

export function AppHeader() {
  return (
    <View>
      <View style={st.row}>
        <Droplet />
        <Text style={st.brand}>HydraTrack</Text>
      </View>
      <View style={st.rule} />
    </View>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    paddingHorizontal: 26, paddingTop: 2, paddingBottom: 12,
  },
  rule: { height: 1, backgroundColor: C.divider, marginHorizontal: 26 },
  brand: { fontFamily: F.heading, fontSize: 17, letterSpacing: -0.2, color: C.text },
  logRow: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    gap: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.divider,
  },
  logName: { fontFamily: F.body, fontSize: 16, color: C.text },
  logTime: { fontFamily: F.body, fontSize: 14, color: C.faint },
  logAmt: { fontFamily: F.heading, fontSize: 16, color: C.text },
});
