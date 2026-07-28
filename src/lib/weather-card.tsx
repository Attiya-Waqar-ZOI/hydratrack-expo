// Weather & location card — shown on Home. Detects place/temp/altitude and
// feeds the environment-adjusted goal; manual chips as fallback.
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useApp } from './app-state';
import { tempBoostMl } from './engines';
import { GlowPanel } from './glow';
import { showToast } from './toast';
import { C } from './theme';

const MANUAL = [
  { label: '❄️ Cool', t: 20 },
  { label: '🌤 Warm', t: 28 },
  { label: '☀️ Hot', t: 35 },
  { label: '🔥 Scorching', t: 40 },
];

export function WeatherCard() {
  const app = useApp();
  const [busy, setBusy] = useState(false);
  const ctx = app.dayContext;
  const boost = app.env.totalMl;

  const detect = async () => {
    setBusy(true);
    const result = await app.detectEnvironment();
    setBusy(false);
    showToast(
      result
        ? `📍 ${result.place ?? 'Location detected'}${result.tempC != null ? ` · ${Math.round(result.tempC)}°C` : ''}`
        : 'Location unavailable — set the weather manually',
    );
  };

  return (
    <GlowPanel colors={['rgba(37,199,224,0.55)', 'rgba(27,143,166,0.45)']}>
      <View style={st.rowBetween}>
        <Text style={st.title}>🌡 Weather & climate</Text>
        {boost > 0 && <Text style={{ color: C.mint, fontWeight: '800' }}>+{boost} ml</Text>}
      </View>
      <Text style={st.sub}>
        {ctx?.place
          ? `📍 ${ctx.place}${ctx.tempC != null ? ` · ${Math.round(ctx.tempC)}°C` : ''}`
          : 'Hot or dry days raise your goal automatically.'}
      </Text>
      {(app.env.altitudeMl > 0 || app.env.aridityMl > 0) && (
        <Text style={st.sub}>
          {app.env.altitudeMl > 0 ? `⛰ +${app.env.altitudeMl} ml altitude  ` : ''}
          {app.env.aridityMl > 0 ? `🏜 +${app.env.aridityMl} ml dry air` : ''}
        </Text>
      )}
      <View style={st.chips}>
        <Pressable style={[st.chip, st.detect]} onPress={detect} disabled={busy}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
            {busy ? 'Detecting…' : '📍 Detect'}
          </Text>
        </Pressable>
        {MANUAL.map((m) => (
          <Pressable
            key={m.label}
            style={[st.chip, app.env.tempMl > 0 && tempBoostMl(m.t) === app.env.tempMl && st.chipOn]}
            onPress={() => app.setManualTemp(m.t)}
          >
            <Text style={st.chipTxt}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
    </GlowPanel>
  );
}

const st = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: C.text, fontWeight: '800' },
  sub: { color: C.muted, marginTop: 6, lineHeight: 19 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    backgroundColor: C.surfaceAlt, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  chipOn: { backgroundColor: C.primary },
  chipTxt: { color: C.text, fontWeight: '600', fontSize: 13 },
  detect: { backgroundColor: C.primaryDeep },
});
