// Liquid Aurora — ported brand palette. v1 ships dark-first (ink surfaces).
export const C = {
  bg: '#070B14',
  surface: '#0E1524',
  surfaceAlt: '#16213A',
  text: '#ECF1FF',
  muted: '#7E8AA6',
  primary: '#4F7CFF',
  primaryDeep: '#2E4FD8',
  mint: '#4FE0D0',
  gold: '#E8B458',
  amber: '#F2A65A',
  grape: '#8B7CF6',
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
  borderColor: 'rgba(79,124,255,0.22)',
  padding: 18,
  shadowColor: C.primary,
  shadowOpacity: 0.22,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 5,
} as const;
