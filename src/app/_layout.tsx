import {
  SourceSerif4_400Regular, SourceSerif4_600SemiBold, useFonts,
} from '@expo-google-fonts/source-serif-4';
import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Platform, View } from 'react-native';

import { AppStateProvider } from '@/lib/app-state';
import { IntroSplash } from '@/lib/intro';
import { ToastHost } from '@/lib/toast';
import { C } from '@/lib/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
  });

  // Launch resync of reminders happens in AppStateProvider (it knows the
  // live remaining amount). Here: tapping a reminder or its "Add intake"
  // button opens the quick-log dialog.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      setTimeout(() => router.push('/quick-log'), 250);
    });
    return () => sub.remove();
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
        <Stack.Screen
          name="quick-log"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            headerShown: false,
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
      <ToastHost />
      <IntroSplash />
      </View>
    </AppStateProvider>
  );
}
