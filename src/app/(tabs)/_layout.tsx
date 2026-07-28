import { LinearGradient } from 'expo-linear-gradient';
import { Tabs, router } from 'expo-router';
import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { C } from '@/lib/theme';

const icon = (emoji: string) =>
  function TabIcon({ focused }: { focused: boolean }) {
    return (
      <Text style={{ fontSize: 21, opacity: focused ? 1 : 0.4 }}>{emoji}</Text>
    );
  };

/// The raised circular action button in the middle of the dock —
/// it doesn't navigate to a tab, it opens the add-drink modal.
function AddButton() {
  return (
    <Pressable
      onPress={() => router.push('/add')}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      hitSlop={10}
    >
      <View style={{ top: -22 }}>
        <LinearGradient
          colors={[C.mint, C.primary, C.grape]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 60, height: 60, borderRadius: 30,
            alignItems: 'center', justifyContent: 'center',
            borderWidth: 3, borderColor: C.bg,
            shadowColor: C.primary, shadowOpacity: 0.7, shadowRadius: 16,
            shadowOffset: { width: 0, height: 6 }, elevation: 16,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: -2 }}>＋</Text>
        </LinearGradient>
      </View>
    </Pressable>
  );
}

/// Banking-style floating dock: four slim icon+label tabs with a
/// prominent circular add button rising out of the center.
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute', left: 14, right: 14, bottom: 12,
          height: 66, borderRadius: 24, paddingTop: 8, paddingBottom: 8,
          backgroundColor: 'rgba(13,17,21,0.97)',
          borderTopWidth: 0, borderWidth: 1,
          borderColor: 'rgba(37,199,224,0.3)',
          shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 18,
          shadowOffset: { width: 0, height: 6 }, elevation: 14,
        },
        tabBarItemStyle: { paddingTop: 2 },
        tabBarLabelStyle: { fontWeight: '700', fontSize: 10 },
        tabBarActiveTintColor: C.mint,
        tabBarInactiveTintColor: C.muted,
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('💧') }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarIcon: icon('✨') }} />
      <Tabs.Screen
        name="add-action"
        options={{ title: '', tabBarButton: AddButton }}
      />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('📆') }} />
      <Tabs.Screen name="you" options={{ title: 'You', tabBarIcon: icon('🧬') }} />
    </Tabs>
  );
}
