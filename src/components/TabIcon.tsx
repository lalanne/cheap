import Svg, { Circle, Path } from 'react-native-svg';

export type TabIconName = 'transactions' | 'overdraft' | 'manage' | 'dashboard';

type TabIconProps = {
  name: TabIconName;
  color: string;
  size?: number;
};

// One mark per top-level tab — design canvas "Tab Bar Style Options",
// option E (the Strava-style bubble App.tsx now uses): a list for the
// daily log, a line sloping up to cover a shortfall for the overdraft, a
// couple of sliders for occasional setup/management, and simple bars for
// the dashboard.
export function TabIcon({ name, color, size = 20 }: TabIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'transactions' && (
        <>
          <Path d="M4 6h16" />
          <Path d="M4 12h16" />
          <Path d="M4 18h10" />
        </>
      )}
      {name === 'overdraft' && (
        <>
          <Path d="M4 16a8 8 0 0 1 16 0" />
          <Path d="M12 16l4-5" />
        </>
      )}
      {name === 'manage' && (
        <>
          <Path d="M4 7h10" />
          <Path d="M18 7h2" />
          <Path d="M4 17h2" />
          <Path d="M10 17h10" />
          <Circle cx={16} cy={7} r={2} />
          <Circle cx={8} cy={17} r={2} />
        </>
      )}
      {name === 'dashboard' && (
        <>
          <Path d="M6 20V11" />
          <Path d="M12 20V5" />
          <Path d="M18 20v-6" />
        </>
      )}
    </Svg>
  );
}
