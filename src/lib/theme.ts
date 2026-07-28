// Liquid Aurora — ported brand palette. v1 ships dark-first (ink surfaces).
export const C = {
  bg: '#0A0D10',
  surface: '#14181D',
  surfaceAlt: '#1C2127',
  text: '#F1F5F7',
  muted: '#8B95A0',
  primary: '#25C7E0',
  primaryDeep: '#17A0B8',
  mint: '#7BE8F5',
  gold: '#E8B458',
  amber: '#F2A65A',
  grape: '#1B8FA6',
  success: '#3DDC97',
  warning: '#F2A65A',
  danger: '#F06277',
};

// Luminous "neon-edge" base card: subtle glowing border + soft colored
// shadow so every surface reads like the dark-glow design language.
export const card = {
  backgroundColor: C.surface,
  borderRadius: 24,
  borderWidth: 1,
  borderColor: 'rgba(37,199,224,0.22)',
  padding: 18,
  shadowColor: C.primary,
  shadowOpacity: 0.22,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 5,
} as const;
