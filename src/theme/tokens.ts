// Calm Ledger — spec 003. Single source of truth for themed values;
// screen code must reference these, never raw hex/px.

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
} as const;
