import {
  SourceSerif4_400Regular, SourceSerif4_600SemiBold, useFonts,
} from '@expo-google-fonts/source-serif-4';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';

import { AppStateProvider } from '@/lib/app-state';
import { IntroSplash } from '@/lib/intro';
import { loadReminderPrefs, resyncReminders } from '@/lib/reminders';
import { ToastHost } from '@/lib/toast';
import { C } from '@/lib/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
  });

  // Reschedule reminders every launch so they track the device's
  // current clock and timezone (travel, DST, manual time changes).
  useEffect(() => {
    loadReminderPrefs().then(resyncReminders).catch(() => {});
  }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;

  return (
    <AppStateProvider>
      <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="add"
          options={{ presentation: 'modal', headerShown: false }}
        />
      </Stack>
      <ToastHost />
      <IntroSplash />
      </View>
    </AppStateProvider>
  );
}
