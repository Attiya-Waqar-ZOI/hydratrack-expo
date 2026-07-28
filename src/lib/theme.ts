// Broadsheet — editorial design system from the user's Claude Design project.
// Airy water-tinted ground, ink text, one water-blue accent plus a magenta
// second ink used only for warnings. Serif throughout, soft rounded corners,
// hairline dividers instead of boxed cards.
export const C = {
  bg: '#fbfcfd',        // near-white paper, just off pure white
  surface: '#e9f3f9',   // card / quiet fill, fresh water tint
  text: '#201e1d',      // ink
  muted: '#605d5d',     // neutral-700, secondary text
  faint: '#9b9797',     // neutral-500, small labels and ticks
  divider: 'rgba(32,30,29,0.16)',
  neutral200: '#e7ebef',
  neutral300: '#d8dee3',
  neutral400: '#bab6b6',
  neutral600: '#7d7979',
  ink: '#2d2b2b',       // inverse surface (snackbar)

  accent: '#0088b0',    // water blue
  accentDeep: '#006786',    // accent-700
  accent100: '#e9f8ff',
  accent200: '#cbeeff',
  accent300: '#99e0ff',
  accent500: '#38a6cf',
  accent800: '#004961',
  onAccent: '#f3f2f2',  // paper text on accent fills

  accent2: '#d6006c',   // magenta second ink: errors, "behind pace"
  accent2Deep: '#790e3d',
  accent2100: '#fff1f4',
  accent2200: '#ffdee6',
  accent2400: '#ff90b1',
};

// Source Serif 4 for everything, per the design system.
export const F = {
  heading: 'SourceSerif4_600SemiBold',
  body: 'SourceSerif4_400Regular',
};

// Soft radii: rounded, easy on the eye.
export const R = { sm: 8, md: 12, lg: 18 };

// Broadsheet card: quiet surface fill, no border, no shadow.
export const card = {
  backgroundColor: C.surface,
  borderRadius: R.lg,
  padding: 16,
} as const;

// Full-width primary button, 56px, serif, paper text on accent.
export const btnPrimary = {
  backgroundColor: C.accent,
  borderRadius: 28,
  height: 56,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

// Shared type styles.
export const T = {
  h1: { fontFamily: F.heading, fontSize: 37, lineHeight: 39, letterSpacing: -1.1, color: C.text },
  h2: { fontFamily: F.heading, fontSize: 24, lineHeight: 28, letterSpacing: -0.4, color: C.text },
  sectionTitle: { fontFamily: F.heading, fontSize: 17, color: C.text },
  body: { fontFamily: F.body, fontSize: 15, lineHeight: 22, color: C.muted },
  small: { fontFamily: F.body, fontSize: 12.5, color: C.faint },
  kicker: {
    fontFamily: F.body, fontSize: 11, letterSpacing: 1.2,
    textTransform: 'uppercase' as const, color: C.faint,
  },
} as const;
