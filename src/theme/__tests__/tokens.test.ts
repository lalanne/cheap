import { colors, radius, spacing, typography } from '../tokens';

describe('theme tokens', () => {
  it('defines the Calm Ledger palette (spec 003)', () => {
    expect(colors.background).toBe('#F7F5F1');
    expect(colors.surface).toBe('#FFFFFF');
    expect(colors.border).toBe('rgba(11,11,11,0.08)');
    expect(colors.ink).toBe('#1B1B18');
    expect(colors.inkSecondary).toBe('#6B6A63');
    expect(colors.inkMuted).toBe('#8A8880');
    expect(colors.accent).toBe('#0F6B5C');
    expect(colors.onAccent).toBe('#FFFFFF');
    expect(colors.success).toBe('#0F7A3D');
  });

  it('defines the validated categorical chart palette in the fixed adjacency order', () => {
    expect(colors.chart).toEqual([
      '#2a78d6', // blue — slot 1
      '#eb6834', // orange — slot 2
      '#1baf7a', // aqua — slot 3
      '#eda100', // yellow — slot 4
      '#e87ba4', // magenta — slot 5
    ]);
  });

  it('defines card and input radii', () => {
    expect(radius.card).toBe(14);
    expect(radius.input).toBe(10);
  });

  it('defines a spacing scale', () => {
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(16);
    expect(spacing.lg).toBe(24);
  });

  it('defines the display and body font families', () => {
    expect(typography.display).toBe('Fraunces_600SemiBold');
    expect(typography.body).toBe('PublicSans_400Regular');
    expect(typography.bodyBold).toBe('PublicSans_600SemiBold');
  });

  it('defines a type-size scale', () => {
    expect(typography.size.xs).toBe(12);
    expect(typography.size.sm).toBe(13);
    expect(typography.size.base).toBe(15);
  });
});
