import Svg, { Circle, Path } from 'react-native-svg';

export type StatusIconKind = 'info' | 'warning' | 'stop';

type StatusIconProps = {
  kind: StatusIconKind;
  color: string;
  size?: number;
};

// Status is never carried by color alone (spec 003's 2026-09-25 amendment):
// each step of the overdraft scale has its own shape.
export function StatusIcon({ kind, color, size = 20 }: StatusIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {kind === 'info' && (
        <>
          <Circle cx={12} cy={12} r={9} />
          <Path d="M12 8v5" />
          <Path d="M12 16.5v.01" />
        </>
      )}
      {kind === 'warning' && (
        <>
          <Path d="M12 3.5L22 20.5H2z" />
          <Path d="M12 10v5" />
          <Path d="M12 18v.01" />
        </>
      )}
      {kind === 'stop' && (
        <>
          <Path d="M8 3h8l5 5v8l-5 5H8l-5-5V8z" />
          <Path d="M9.5 9.5l5 5" />
          <Path d="M14.5 9.5l-5 5" />
        </>
      )}
    </Svg>
  );
}
