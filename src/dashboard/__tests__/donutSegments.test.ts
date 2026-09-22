import { computeDonutSegments } from '../donutSegments';

describe('computeDonutSegments (spec 009 criterion 7)', () => {
  it('gives each category a dash length proportional to its share, offset by cumulative prior share', () => {
    const segments = computeDonutSegments({ Housing: 450000, Entertainment: 95000 }, 100);
    // total = 545000; Housing share ~0.8257, Entertainment share ~0.1743
    const circumference = 2 * Math.PI * 100;

    expect(segments).toHaveLength(2);
    expect(segments[0].category).toBe('Housing');
    expect(segments[0].dashLength).toBeCloseTo((450000 / 545000) * circumference, 1);
    expect(segments[0].dashOffset).toBeCloseTo(0, 5);

    expect(segments[1].category).toBe('Entertainment');
    expect(segments[1].dashLength).toBeCloseTo((95000 / 545000) * circumference, 1);
    // offset is the negative cumulative length of segments before it
    // (SVG dashoffset convention used to position each segment in turn)
    expect(segments[1].dashOffset).toBeCloseTo(-segments[0].dashLength, 1);
  });

  it('returns an empty array for no spend', () => {
    expect(computeDonutSegments({}, 100)).toEqual([]);
  });

  it('segment dash lengths sum to the full circumference', () => {
    const segments = computeDonutSegments({ A: 1000, B: 2000, C: 3000 }, 50);
    const circumference = 2 * Math.PI * 50;

    const totalDash = segments.reduce((sum, s) => sum + s.dashLength, 0);
    expect(totalDash).toBeCloseTo(circumference, 5);
  });

  it('uses spec 003 chart color order, cycling if there are more categories than colors', () => {
    const segments = computeDonutSegments({ A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 }, 10);

    expect(segments.map((s) => s.color)).toEqual([
      '#2a78d6',
      '#eb6834',
      '#1baf7a',
      '#eda100',
      '#e87ba4',
      '#2a78d6',
    ]);
  });
});
