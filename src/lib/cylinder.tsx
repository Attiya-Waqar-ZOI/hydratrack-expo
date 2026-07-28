// Cylinder — the Home hero from the design: an open-top measuring cylinder
// with animated water, rising bubbles, 0.5 L gauge ticks down the left and
// a bold goal line across the top. Built from Views (rect tube = easy
// overflow clipping) plus small wave SVGs translated with the native driver.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { C, F } from './theme';

const NATIVE = Platform.OS !== 'web';
const TUBE_W = 52;   // inner tube width
const TUBE_H = 224;  // inner tube height
const GAUGE_W = 50;  // label + tick gutter to the left
const WAVE_H = 12;

function wavePath(w: number, amp: number, tall: number): string {
  const seg = w / 4;
  let d = `M0 ${amp}`;
  for (let i = 0; i < 8; i++) {
    const cy = i % 2 === 0 ? 0 : amp * 2;
    d += ` Q ${seg * (i + 0.5)} ${cy} ${seg * (i + 1)} ${amp}`;
  }
  return `${d} L ${w * 2} ${tall} L 0 ${tall} Z`;
}

function Bubble({ cx, delay, duration }: { cx: number; delay: number; duration: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration, easing: Easing.in(Easing.quad), useNativeDriver: NATIVE }),
      Animated.timing(v, { toValue: 0, duration: 1, useNativeDriver: NATIVE }),
    ]));
    loop.start();
    return () => loop.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View
      style={{
        position: 'absolute', left: cx, bottom: 8,
        width: 4, height: 4, borderRadius: 2,
        backgroundColor: C.accent100,
        opacity: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.9, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -64] }) }],
      }}
    />
  );
}

export function Cylinder({ goalMl, totalMl }: { goalMl: number; totalMl: number }) {
  const pct = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
  // Water surface, measured from the tube top.
  const targetY = TUBE_H - pct * TUBE_H;

  const level = useRef(new Animated.Value(targetY)).current;
  const waveA = useRef(new Animated.Value(0)).current;
  const waveB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(level, {
      toValue: targetY, duration: 600,
      easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE,
    }).start();
  }, [targetY, level]);

  useEffect(() => {
    const drift = (v: Animated.Value, duration: number) =>
      Animated.loop(Animated.timing(v, {
        toValue: 1, duration, easing: Easing.linear, useNativeDriver: NATIVE,
      }));
    const a = drift(waveA, 2600); const b = drift(waveB, 4100);
    a.start(); b.start();
    return () => { a.stop(); b.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Gauge ticks every 500 ml, stopping short of the goal line.
  const gauge: { y: number; label: string }[] = [];
  for (let v = 500; v < goalMl - 100; v += 500) {
    gauge.push({ y: TUBE_H - (v / goalMl) * TUBE_H, label: `${(v / 1000).toFixed(1)} L` });
  }

  const waveW = TUBE_W * 2;
  const tall = TUBE_H + WAVE_H * 2;

  return (
    <View style={{ width: GAUGE_W + TUBE_W + 2, height: TUBE_H + 14 }}>
      {/* "goal" label above the gauge gutter */}
      <Text style={[st.gaugeText, { right: TUBE_W + 8, top: 0 }]}>goal</Text>

      {/* Gauge ticks + labels */}
      {gauge.map((g) => (
        <React.Fragment key={g.label}>
          <View style={{ position: 'absolute', right: TUBE_W + 2, top: 14 + g.y, width: 9, height: 1, backgroundColor: C.faint }} />
          <Text style={[st.gaugeText, { right: TUBE_W + 16, top: 14 + g.y - 6 }]}>{g.label}</Text>
        </React.Fragment>
      ))}

      {/* The tube: open top, hairline walls, bold ink goal line at the rim */}
      <View style={st.tube}>
        <View style={st.tubeInner}>
          <Animated.View style={{ position: 'absolute', top: 0, left: 0, transform: [{ translateY: level }] }}>
            <Animated.View
              style={{
                marginTop: -WAVE_H / 2,
                transform: [{ translateX: waveA.interpolate({ inputRange: [0, 1], outputRange: [0, -TUBE_W] }) }],
              }}
            >
              <Svg width={waveW * 2} height={tall}>
                <Path d={wavePath(waveW, WAVE_H / 3, tall)} fill={C.accent300} />
              </Svg>
            </Animated.View>
            <Animated.View
              style={{
                position: 'absolute', top: -WAVE_H / 2 + 3,
                transform: [{ translateX: waveB.interpolate({ inputRange: [0, 1], outputRange: [-TUBE_W, 0] }) }],
              }}
            >
              <Svg width={waveW * 2} height={tall}>
                <Path d={wavePath(waveW, WAVE_H / 3, tall)} fill={C.accent500} opacity={0.35} />
              </Svg>
            </Animated.View>
          </Animated.View>
          <Bubble cx={10} delay={1100} duration={3000} />
          <Bubble cx={26} delay={2400} duration={3700} />
        </View>
        <View style={st.goalLine} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  gaugeText: {
    position: 'absolute', fontFamily: F.body, fontSize: 11.5, color: C.muted,
    textAlign: 'right', width: 40,
  },
  tube: {
    position: 'absolute', right: 0, top: 14,
    width: TUBE_W + 2, height: TUBE_H + 1,
    borderLeftWidth: 1.2, borderRightWidth: 1.2, borderBottomWidth: 1.2,
    borderColor: C.neutral600,
  },
  tubeInner: { flex: 1, overflow: 'hidden' },
  goalLine: {
    position: 'absolute', top: -1.2, left: -1.2, right: -1.2, height: 2.4,
    backgroundColor: C.text,
  },
});
