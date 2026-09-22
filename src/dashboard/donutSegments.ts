import { colors } from '../theme/tokens';

export type DonutSegment = {
  category: string;
  color: string;
  dashLength: number;
  dashOffset: number;
};

// Spec 009 — "Where it went" is a ring built from stacked <Circle>
// elements using the standard strokeDasharray/strokeDashoffset technique
// (see the spec's Decisions section): each segment's dash length is its
// share of the total spend times the circle's circumference, offset by
// the negative cumulative length of every segment drawn before it (SVG
// draws dasharray from the 12-o'clock point going clockwise; a negative
// dashoffset advances the start point further clockwise).
export function computeDonutSegments(categoryTotals: Record<string, number>, radius: number): DonutSegment[] {
  const entries = Object.entries(categoryTotals).filter(([, amount]) => amount > 0);
  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  if (total === 0) {
    return [];
  }

  const circumference = 2 * Math.PI * radius;
  let cumulativeLength = 0;

  return entries.map(([category, amount], index) => {
    const dashLength = (amount / total) * circumference;
    const segment: DonutSegment = {
      category,
      color: colors.chart[index % colors.chart.length],
      dashLength,
      dashOffset: -cumulativeLength,
    };
    cumulativeLength += dashLength;
    return segment;
  });
}
