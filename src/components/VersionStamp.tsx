import Constants from 'expo-constants';
import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '../theme/tokens';

export function VersionStamp() {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const build = Constants.nativeBuildVersion;
  const label = build ? `v${version} (${build})` : `v${version}`;

  return <Text style={styles.text}>{label}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
