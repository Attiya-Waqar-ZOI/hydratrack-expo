import { Tabs } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';

import { C } from '@/lib/theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View
        style={{
          paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14,
          backgroundColor: focused ? 'rgba(79,124,255,0.25)' : 'transparent',
          borderWidth: 1,
          borderColor: focused ? 'rgba(79,224,208,0.5)' : 'transparent',
        }}
      >
        <Text style={{ fontSize: 19, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>
      </View>
    );
  };

/// Floating glow dock instead of the flat system tab bar.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute', left: 14, right: 14, bottom: 12,
          height: 68, borderRadius: 26, paddingTop: 6,
          backgroundColor: 'rgba(14,21,36,0.94)',
          borderTopWidth: 0, borderWidth: 1,
          borderColor: 'rgba(79,124,255,0.35)',
          shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 18,
          shadowOffset: { width: 0, height: 4 }, elevation: 14,
        },
        tabBarLabelStyle: { fontWeight: '800', fontSize: 10 },
        tabBarActiveTintColor: C.mint,
        tabBarInactiveTintColor: C.muted,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('💧') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('✨') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('📆') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('🧬') }} />
    </Tabs>
  );
}
