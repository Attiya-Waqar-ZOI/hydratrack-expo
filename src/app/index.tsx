import { Redirect } from 'expo-router';
import React from 'react';

import { useApp } from '@/lib/app-state';

/// Entry gate: returning users go straight home, new users to onboarding.
export default function Index() {
  const { profile } = useApp();
  return <Redirect href={profile ? '/(tabs)/home' : '/onboarding'} />;
}
