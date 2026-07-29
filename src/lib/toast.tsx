// Bottom toast — replaces blocking Alert dialogs.
// showToast('250 ml added', { actionLabel: 'Undo', onAction: ... })
// slides up over the tab bar and auto-dismisses.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { C, F, R } from './theme';

const NATIVE = Platform.OS !== 'web';

interface ToastData {
  id: number;
  msg: string;
  actionLabel?: string;
  onAction?: () => void;
}

let pushToast: ((t: ToastData) => void) | null = null;

export function showToast(
  msg: string,
  opts?: { actionLabel?: string; onAction?: () => void },
) {
  pushToast?.({ id: Date.now(), msg, ...opts });
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastData | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = React.useCallback(() => {
    Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: NATIVE }).start();
    // Unmount on a timer — react-native-web doesn't reliably fire the
    // animation completion callback, which would leave an invisible
    // (tap-blocking) toast mounted.
    setTimeout(() => setToast(null), 220);
  }, [anim]);

  useEffect(() => {
    pushToast = (t) => {
      setToast(t);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: NATIVE }).start();
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(hide, 3200);
    };
    return () => {
      pushToast = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [anim, hide]);

  if (!toast) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        st.wrap,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
          }],
        },
      ]}
    >
      <View style={st.inner}>
        <Text style={st.msg}>{toast.msg}</Text>
        {toast.actionLabel && (
          <Pressable
            hitSlop={10}
            onPress={() => { toast.onAction?.(); hide(); }}
          >
            <Text style={st.action}>{toast.actionLabel}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 24, right: 24, bottom: 96,
    alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  inner: {
    width: '100%',
    backgroundColor: C.ink, borderRadius: R.md,
    paddingHorizontal: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  msg: { color: '#f3f2f2', fontFamily: F.body, fontSize: 14, flex: 1 },
  action: { color: C.accent300, fontFamily: F.heading, fontSize: 14, marginLeft: 16 },
});
