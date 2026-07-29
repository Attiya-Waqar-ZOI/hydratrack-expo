// Tab dock — port of the design's bottom bar: four hand-drawn stroke icons
// (drop, bars, calendar, person), a 2px accent underline on the active tab,
// and a round accent + button in the center that opens the log sheet.
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs, router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { C } from '@/lib/theme';

const ICONS: Record<string, string> = {
  home: 'M12 3.2C12 3.2 5.5 11 5.5 15.4a6.5 6.5 0 0 0 13 0C18.5 11 12 3.2 12 3.2Z',
  insights: 'M4 20V10M9.3 20V5M14.7 20v-7M20 20V8',
  history: 'M4 6.5h16v14H4zM4 10.5h16M8.5 3.5v4M15.5 3.5v4',
  you: 'M12 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5',
};

function TabButton({ route, active, onPress }: {
  route: string; active: boolean; onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={st.tab} hitSlop={8}>
      <Svg width={25} height={25} viewBox="0 0 24 24">
        <Path
          d={ICONS[route]}
          fill="none"
          stroke={active ? C.accent : C.faint}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
      {active && <View style={st.underline} />}
    </Pressable>
  );
}

function EditorialTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => r.name !== 'add-action');
  const activeName = state.routes[state.index]?.name;
  const go = (name: string) => {
    if (name !== activeName) navigation.navigate(name as never);
  };
  const left = routes.slice(0, 2);
  const right = routes.slice(2);
  return (
    <View style={[st.bar, { paddingBottom: Math.max(insets.bottom - 8, 0) }]}>
      {left.map((r) => (
        <TabButton key={r.key} route={r.name} active={activeName === r.name} onPress={() => go(r.name)} />
      ))}
      <Pressable
        onPress={() => router.push('/add')}
        style={({ pressed }) => [st.plus, pressed && { backgroundColor: C.accentDeep }]}
        hitSlop={6}
      >
        <Svg width={22} height={22} viewBox="0 0 22 22">
          <Path d="M11 3v16M3 11h16" stroke={C.onAccent} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      </Pressable>
      {right.map((r) => (
        <TabButton key={r.key} route={r.name} active={activeName === r.name} onPress={() => go(r.name)} />
      ))}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <EditorialTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Today' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="you" options={{ title: 'You' }} />
      <Tabs.Screen name="add-action" options={{ href: null }} />
    </Tabs>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.divider,
    backgroundColor: C.bg,
    paddingHorizontal: 18, minHeight: 74, gap: 4,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 12, paddingBottom: 14 },
  underline: {
    position: 'absolute', bottom: 4, width: 16, height: 2, backgroundColor: C.accent,
  },
  plus: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: C.accent,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#2d2b2b', shadowOpacity: 0.14, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
});
