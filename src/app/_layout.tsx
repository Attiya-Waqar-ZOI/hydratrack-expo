import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { View } from 'react-native';

import { AppStateProvider } from '@/lib/app-state';
import { ToastHost } from '@/lib/toast';
import { C } from '@/lib/theme';

export default function RootLayout() {
  return (
    <AppStateProvider>
      <View style={{ flex: 1 }}>
      <StatusBar style="light" />
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
          options={{
            presentation: 'modal',
            headerShown: true,
            title: 'Log a drink',
            headerStyle: { backgroundColor: C.surface },
            headerTintColor: C.text,
          }}
        />
      </Stack>
      <ToastHost />
      </View>
    </AppStateProvider>
  );
}
