// GoalGlass — the design's animated water glass: a tapered tumbler whose
// water level tracks a value, with two drifting wave layers and rising
// bubbles. The waves are Views translated with the native driver; an SVG
// overlay paints everything outside the glass in the page ground and draws
// the outline, so the water only shows through the glass silhouette.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { C } from './theme';

const NATIVE = Platform.OS !== 'web';

// Design coordinates (viewBox 60 × 108).
const VW = 60;
const VH = 108;
const GLASS = 'M10 6 L15 97 Q15.4 102.5 21 102.5 H39 Q44.6 102.5 45 97 L50 6';

function wavePath(w: number, amp: number, mid: number, tall: number): string {
  const seg = w / 4;
  let d = `M0 ${mid}`;
  for (let i = 0; i < 8; i++) {
    const cy = i % 2 === 0 ? mid - amp : mid + amp;
    d += ` Q ${seg * (i + 0.5)} ${cy} ${seg * (i + 1)} ${mid}`;
  }
  return `${d} L ${w * 2} ${tall} L 0 ${tall} Z`;
}

function Bubble({ cx, delay, duration, scale }: {
  cx: number; delay: number; duration: number; scale: number;
}) {
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
        position: 'absolute', left: cx, bottom: 10,
        width: 4 * scale, height: 4 * scale, borderRadius: 3 * scale,
        backgroundColor: C.accent100,
        opacity: v.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 0.9, 0] }),
        transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -46 * scale] }) }],
      }}
    />
  );
}

export function GoalGlass({
  ml, fill, width = 72, ground = C.bg,
}: {
  ml?: number;      // 1000..6000 → design's level mapping
  fill?: number;    // 0..1 direct fill (used on Home for progress)
  width?: number;
  ground?: string;  // color of the surface the glass sits on
}) {
  const scale = width / VW;
  const height = VH * scale;

  // Water surface Y in design coords (smaller = fuller).
  const t = ml != null
    ? (Math.max(1000, Math.min(6000, ml)) - 1000) / 5000
    : Math.max(0, Math.min(1, fill ?? 0));
  const targetY = ml != null
    ? 96 - (0.32 + t * 0.6) * 84 - 9
    : 99 - t * 92;

  const level = useRef(new Animated.Value(targetY * scale)).current;
  const waveA = useRef(new Animated.Value(0)).current;
  const waveB = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(level, {
      toValue: targetY * scale, duration: 450,
      easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE,
    }).start();
  }, [targetY, scale, level]);

  useEffect(() => {
    const drift = (v: Animated.Value, duration: number) =>
      Animated.loop(Animated.timing(v, {
        toValue: 1, duration, easing: Easing.linear, useNativeDriver: NATIVE,
      }));
    const a = drift(waveA, 1600); const b = drift(waveB, 2600);
    const c = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      Animated.timing(bob, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
    ]));
    a.start(); b.start(); c.start();
    return () => { a.stop(); b.stop(); c.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const waveW = width * 2;
  const waveH = 18 * scale;
  const tallH = height + waveH;

  return (
    <View style={{ width, height, overflow: 'hidden' }}>
      {/* Water block: rises to the level, waves drift inside it */}
      <Animated.View
        style={{
          position: 'absolute', top: 0, left: 0,
          transform: [
            { translateY: level },
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5 * scale] }) },
          ],
        }}
      >
        <Animated.View
          style={{
            marginTop: -waveH / 2,
            transform: [{ translateX: waveA.interpolate({ inputRange: [0, 1], outputRange: [0, -width] }) }],
          }}
        >
          <Svg width={waveW * 2} height={tallH}>
            <Path d={wavePath(waveW, waveH / 3, waveH / 2, tallH)} fill={C.accent300} />
          </Svg>
        </Animated.View>
        <Animated.View
          style={{
            position: 'absolute', top: -waveH / 2 + 3 * scale,
            transform: [{ translateX: waveB.interpolate({ inputRange: [0, 1], outputRange: [-width, 0] }) }],
          }}
        >
          <Svg width={waveW * 2} height={tallH}>
            <Path d={wavePath(waveW, waveH / 3, waveH / 2, tallH)} fill={C.accent500} opacity={0.4} />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Bubbles rising through the water */}
      <Bubble cx={width * 0.34} delay={900} duration={2300} scale={scale} />
      <Bubble cx={width * 0.52} delay={1700} duration={2900} scale={scale} />
      <Bubble cx={width * 0.65} delay={2500} duration={2600} scale={scale} />

      {/* Highlight streak */}
      <View
        style={{
          position: 'absolute', left: 18 * scale, top: 6 * scale,
          width: 3.5 * scale, height: 96 * scale,
          backgroundColor: '#f8f4f4', opacity: 0.55,
        }}
      />

      {/* Exterior mask + glass outline */}
      <Svg width={width} height={height} viewBox={`0 0 ${VW} ${VH}`} style={StyleSheet.absoluteFill}>
        <Path
          d={`M0 0 H${VW} V${VH} H0 Z ${GLASS} Z`}
          fill={ground}
          fillRule="evenodd"
        />
        <Path d={GLASS} fill="none" stroke={C.neutral600} strokeWidth={1.2} strokeLinejoin="round" />
      </Svg>
    </View>
  );
}
