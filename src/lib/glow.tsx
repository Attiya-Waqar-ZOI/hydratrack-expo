// GlowPanel: dark panel wrapped in a gradient border with an optional colored
// glow — the app's signature neon-edge surface (used for hero cards, toasts).
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

import { C } from './theme';

export function GlowPanel({
  children,
  colors = ['rgba(79,224,208,0.65)', 'rgba(79,124,255,0.65)'],
  glow = false,
  style,
}: {
  children: React.ReactNode;
  colors?: [string, string] | [string, string, string];
  glow?: boolean;
  style?: ViewStyle;
}) {
  return (
    <View
      style={
        glow && {
          shadowColor: colors[1], shadowOpacity: 0.45, shadowRadius: 16,
          shadowOffset: { width: 0, height: 2 }, elevation: 9,
        }
      }
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={st.border}
      >
        <View style={[st.inner, style]}>{children}</View>
      </LinearGradient>
    </View>
  );
}

const st = StyleSheet.create({
  border: { borderRadius: 24, padding: 1.4 },
  inner: { backgroundColor: C.surface, borderRadius: 22.6, padding: 18 },
});
