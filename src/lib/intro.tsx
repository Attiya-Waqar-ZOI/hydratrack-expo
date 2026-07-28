// Launch intro, ~2 s, tap to skip:
//   1. a droplet falls into a glass circle (stretch on the way down)
//   2. it lands: quick splash ring, and the water starts rising
//   3. the water has two sine-wave layers drifting at different speeds
//   4. the wordmark settles in, then the overlay dissolves
// All motion is transform/opacity on plain Views (native driver), so it
// stays at 60 fps; the waves are static SVG paths that tile seamlessly
// when translated by one period.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { C, F } from './theme';

const NATIVE = Platform.OS !== 'web';
const SIZE = 180;            // glass circle diameter
const AMP = 12;              // wave amplitude
const WAVE_H = SIZE + AMP * 2;
const WAVE_W = SIZE * 2;     // two periods drawn; translating by SIZE loops seamlessly
const LEVEL = SIZE * 0.40;   // resting water surface, from circle top

function Wave({ color, opacity, trough = false }: {
  color: string; opacity: number; trough?: boolean;
}) {
  const mid = AMP;
  const c = trough ? AMP * 2 : 0; // first control point: crest up or trough down
  const d =
    `M0 ${mid} Q ${SIZE / 4} ${c} ${SIZE / 2} ${mid} ` +
    `T ${SIZE} ${mid} T ${SIZE * 1.5} ${mid} T ${WAVE_W} ${mid} ` +
    `L ${WAVE_W} ${WAVE_H} L 0 ${WAVE_H} Z`;
  return (
    <Svg width={WAVE_W} height={WAVE_H}>
      <Path d={d} fill={color} opacity={opacity} />
    </Svg>
  );
}

export function IntroSplash() {
  const [gone, setGone] = useState(false);
  const drop = useRef(new Animated.Value(0)).current;      // droplet fall progress
  const splash = useRef(new Animated.Value(0)).current;    // impact ring
  const rise = useRef(new Animated.Value(0)).current;      // water level
  const waveFront = useRef(new Animated.Value(0)).current; // horizontal drift
  const waveBack = useRef(new Animated.Value(0)).current;
  const word = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  const dismiss = useRef(() => {
    Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: NATIVE })
      .start(() => setGone(true));
    setTimeout(() => setGone(true), 360); // web fallback: completion cb can be unreliable
  }).current;

  useEffect(() => {
    const drift = (v: Animated.Value, duration: number) =>
      Animated.loop(Animated.timing(v, {
        toValue: 1, duration, easing: Easing.linear, useNativeDriver: NATIVE,
      }));
    drift(waveFront, 1400).start();
    drift(waveBack, 2100).start();

    Animated.sequence([
      // Fall: accelerating, like gravity.
      Animated.timing(drop, {
        toValue: 1, duration: 480,
        easing: Easing.in(Easing.quad), useNativeDriver: NATIVE,
      }),
      // Impact: splash ring + water rising + wordmark, overlapping.
      Animated.parallel([
        Animated.timing(splash, {
          toValue: 1, duration: 420,
          easing: Easing.out(Easing.quad), useNativeDriver: NATIVE,
        }),
        Animated.timing(rise, {
          toValue: 1, duration: 950,
          easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE,
        }),
        Animated.timing(word, {
          toValue: 1, duration: 450, delay: 350,
          easing: Easing.out(Easing.cubic), useNativeDriver: NATIVE,
        }),
      ]),
      Animated.delay(420),
    ]).start(dismiss);

    const failsafe = setTimeout(dismiss, 3200);
    return () => clearTimeout(failsafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (gone) return null;

  const waveX = (v: Animated.Value) => ({
    transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, -SIZE] }) }],
  });

  return (
    <Animated.View style={[st.wrap, { opacity: fade }]}>
      <Pressable style={st.press} onPress={dismiss}>
        <View style={st.glass}>
          {/* Water: rises as a block; each layer drifts sideways inside it */}
          <Animated.View
            style={[
              st.water,
              {
                transform: [{
                  translateY: rise.interpolate({
                    inputRange: [0, 1],
                    outputRange: [SIZE + AMP, LEVEL - AMP],
                  }),
                }],
              },
            ]}
          >
            <Animated.View style={[st.waveLayer, waveX(waveBack)]}>
              <Wave color={C.accent300} opacity={0.9} trough />
            </Animated.View>
            <Animated.View style={[st.waveLayer, { top: 5 }, waveX(waveFront)]}>
              <Wave color={C.accent} opacity={0.85} />
            </Animated.View>
          </Animated.View>

          {/* Droplet: falls to the surface, stretches, then vanishes */}
          <Animated.View
            style={[
              st.droplet,
              {
                opacity: drop.interpolate({
                  inputRange: [0, 0.1, 0.92, 1], outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateY: drop.interpolate({
                      inputRange: [0, 1], outputRange: [-SIZE * 0.9, LEVEL - 24],
                    }),
                  },
                  {
                    scaleY: drop.interpolate({
                      inputRange: [0, 0.7, 1], outputRange: [1, 1.25, 0.8],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={22} height={30} viewBox="0 0 22 30">
              <Path
                d="M11 0 C11 8 0 14 0 21 a11 9 0 0 0 22 0 C22 14 11 8 11 0 Z"
                fill={C.accent}
              />
            </Svg>
          </Animated.View>

          {/* Splash ring at the impact point */}
          <Animated.View
            style={[
              st.splash,
              {
                opacity: splash.interpolate({
                  inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0],
                }),
                transform: [
                  { scaleX: splash.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.8] }) },
                  { scaleY: splash.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.9] }) },
                ],
              },
            ]}
          />
        </View>

        <Animated.View
          style={{
            opacity: word,
            transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
          }}
        >
          <Text style={st.word}>HydraTrack</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
    zIndex: 100,
  },
  press: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  glass: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2,
    backgroundColor: '#faf9f9',
    borderWidth: 1, borderColor: C.divider,
    overflow: 'hidden',
  },
  water: { position: 'absolute', top: 0, left: 0, width: WAVE_W, height: WAVE_H },
  waveLayer: { position: 'absolute', top: 0, left: 0 },
  droplet: { position: 'absolute', top: 0, left: SIZE / 2 - 11 },
  splash: {
    position: 'absolute', top: LEVEL - 14, left: SIZE / 2 - 28,
    width: 56, height: 28, borderRadius: 28,
    borderWidth: 2, borderColor: C.accent,
  },
  word: {
    color: C.text, fontSize: 24, fontFamily: F.heading,
    letterSpacing: -0.3, marginTop: 24,
  },
});
