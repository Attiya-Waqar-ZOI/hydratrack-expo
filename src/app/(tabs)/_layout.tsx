import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

import { C } from '@/lib/theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>{emoji}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: C.surface, borderTopColor: 'rgba(255,255,255,0.06)' },
        tabBarActiveTintColor: C.primary,
        tabBarInactiveTintColor: C.muted,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('💧') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('📊') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('🙂') }} />
    </Tabs>
  );
}
