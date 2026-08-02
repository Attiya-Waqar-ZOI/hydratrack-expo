// Ruler — the Broadsheet tape slider: a tick strip you drag sideways past a
// fixed accent needle. The strip tracks the finger continuously through an
// Animated.Value (no re-render per frame), snapping only the reported value.
// Haptics: a medium impact per snap tick, throttled so fast drags stay fluid.
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, PanResponder, Platform, ScrollView, ScrollViewProps, StyleSheet, Text, View,
} from 'react-native';

import { C, F } from './theme';

const NATIVE = Platform.OS !== 'web';
const HAPTIC_GAP_MS = 40; // minimum spacing between ticks so they never queue up

export interface RulerLabel { left: number; text: string }

// ── Scroll lock ─────────────────────────────────────────────────────
// A finger on a ruler locks vertical scrolling in every RulerScrollView,
// so slightly diagonal drags don't bounce the page while sliding.
const lockListeners = new Set<(locked: boolean) => void>();
let activeDrags = 0;

function setRulerDragging(dragging: boolean) {
  activeDrags = Math.max(0, activeDrags + (dragging ? 1 : -1));
  const locked = activeDrags > 0;
  lockListeners.forEach((l) => l(locked));
}

/// Drop-in ScrollView that freezes while any Ruler is being touched.
export const RulerScrollView = React.forwardRef<ScrollView, ScrollViewProps>(
  function RulerScrollView({ scrollEnabled, ...props }, ref) {
    const [locked, setLocked] = useState(false);
    useEffect(() => {
      lockListeners.add(setLocked);
      return () => { lockListeners.delete(setLocked); };
    }, []);
    return <ScrollView ref={ref} {...props} scrollEnabled={!locked && scrollEnabled !== false} />;
  },
);

export function Ruler({
  value, min, max, px, step = 1, tickEvery, labels, onChange,
}: {
  value: number; min: number; max: number;
  px: number;               // pixels per unit
  step?: number;            // snap increment, in units
  tickEvery?: number;       // visual tick + haptic spacing (defaults to step)
  labels: RulerLabel[];     // major tick positions (px from strip start) + text
  onChange: (v: number) => void;
}) {
  // A fine step (e.g. 1 ml) still draws readable ticks and buzzes only at
  // the coarser interval, or the strip smears and the haptics never stop.
  const tickStep = tickEvery ?? step;
  const tickRef = useRef(tickStep); tickRef.current = tickStep;
  const [half, setHalf] = useState(160);
  const halfRef = useRef(half); halfRef.current = half;
  const valueRef = useRef(value); valueRef.current = value;
  const changeRef = useRef(onChange); changeRef.current = onChange;
  const startVal = useRef(value);
  const dragging = useRef(false);
  const lastTick = useRef(0);

  const x = useRef(new Animated.Value(half - (value - min) * px)).current;

  // Keep the strip in place when the value changes from outside a drag
  // (unit toggle, reset) or when the layout width settles.
  useEffect(() => {
    if (!dragging.current) x.setValue(half - (value - min) * px);
  }, [value, half, min, px, x]);

  const tick = () => {
    const now = Date.now();
    if (now - lastTick.current < HAPTIC_GAP_MS) return;
    lastTick.current = now;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dx) > 1 && Math.abs(g.dx) > Math.abs(g.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => {
      dragging.current = true;
      setRulerDragging(true);
      startVal.current = valueRef.current;
    },
    onPanResponderMove: (_, g) => {
      const raw = startVal.current - g.dx / px;
      const cont = Math.max(min, Math.min(max, raw));           // continuous, follows the finger
      x.setValue(halfRef.current - (cont - min) * px);
      const snapped = Math.max(min, Math.min(max, Math.round(raw / step) * step));
      const prev = valueRef.current;
      if (snapped !== prev) {
        changeRef.current(snapped);
        if (NATIVE && Math.floor(snapped / tickRef.current) !== Math.floor(prev / tickRef.current)) tick();
      }
    },
    onPanResponderRelease: () => {
      dragging.current = false;
      setRulerDragging(false);
      // Settle onto the snapped tick.
      Animated.timing(x, {
        toValue: halfRef.current - (valueRef.current - min) * px,
        duration: 90, useNativeDriver: NATIVE,
      }).start();
    },
    onPanResponderTerminate: () => {
      dragging.current = false;
      setRulerDragging(false);
      x.setValue(halfRef.current - (valueRef.current - min) * px);
    },
  })).current;

  const width = (max - min) * px;

  // The tick strip is static content; build it once per config.
  const strip = useMemo(() => {
    const nTicks = Math.floor((max - min) / tickStep) + 1;
    return (
      <>
        {Array.from({ length: nTicks }, (_, i) => (
          <View key={i} style={[st.minor, { left: i * tickStep * px }]} />
        ))}
        {labels.map((l) => (
          <React.Fragment key={l.left}>
            <View style={[st.major, { left: l.left }]} />
            <Text style={[st.label, { left: l.left - 24 }]} numberOfLines={1}>{l.text}</Text>
          </React.Fragment>
        ))}
      </>
    );
  }, [min, max, tickStep, px, labels]);

  return (
    <View
      style={st.grab}
      onLayout={(e) => setHalf(e.nativeEvent.layout.width / 2)}
      {...pan.panHandlers}
    >
      <View style={st.wrap}>
        <View style={st.window}>
          <Animated.View style={[st.strip, { width, transform: [{ translateX: x }] }]}>
            {strip}
          </Animated.View>
        </View>
        <View style={[st.needle, { left: half }]} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  // The touch surface is much taller than the drawn ruler, so a thumb
  // anywhere near the strip grabs it.
  grab: { paddingVertical: 16, marginVertical: -10, justifyContent: 'center' },
  wrap: { height: 44, position: 'relative' },
  window: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  strip: { position: 'absolute', top: 0, height: 44 },
  minor: { position: 'absolute', top: 8, width: 1, height: 6, backgroundColor: C.neutral400 },
  major: { position: 'absolute', top: 4, width: 1, height: 10, backgroundColor: C.neutral600 },
  label: {
    position: 'absolute', top: 20, width: 48, height: 18, textAlign: 'center',
    fontFamily: F.body, fontSize: 11.8, lineHeight: 16, color: C.faint,
  },
  needle: { position: 'absolute', top: 0, width: 1.5, height: 16, backgroundColor: C.accent },
});
