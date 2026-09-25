// Calm Ledger — spec 003. Single source of truth for themed values;
// screen code must reference these, never raw hex/px.

export type StatusPalette = { text: string; dark: string; tone: string; border: string };

export const colors = {
  background: '#F7F5F1',
  surface: '#FFFFFF',
  border: 'rgba(11,11,11,0.08)',
  ink: '#1B1B18',
  inkSecondary: '#6B6A63',
  inkMuted: '#8A8880',
  accent: '#0F6B5C',
  onAccent: '#FFFFFF',
  success: '#0F7A3D',
  // Spec 003's 2026-09-25 amendment: a graded status scale (spec 012's
  // overdraft gauge/banner). Red stays reserved for the critical step;
  // status is always also carried by an icon/wording, never color alone.
  status: {
    notice: { text: '#A16207', dark: '#5C3F04', tone: '#FBF3DC', border: '#EBD79A' },
    warning: { text: '#C2410C', dark: '#7C2D0A', tone: '#FCE8DC', border: '#F2C2A4' },
    critical: { text: '#B91C1C', dark: '#7F1D1D', tone: '#FBE1E1', border: '#F0B3B3' },
  },
  // Validated categorical order from the dataviz skill's reference palette
  // (blue, orange, aqua, yellow, magenta) — fixed adjacency order, never
  // reordered, never reused for anything but category identity.
  chart: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  card: 14,
  input: 10,
} as const;

export const typography = {
  display: 'Fraunces_600SemiBold',
  body: 'PublicSans_400Regular',
  bodyBold: 'PublicSans_600SemiBold',
  size: {
    xs: 12,
    sm: 13,
    base: 15,
    lg: 20,
    xl: 27,
  },
} as const;
