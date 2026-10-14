import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatCLP, formatShortDate, isSameLocalDay } from '../overdraft/format';
import {
  availableOf,
  inUseSince,
  balanceOf,
  overdraftStatus,
  usedPercent,
} from '../overdraft/overdraftMath';
import { useOverdraftStore } from '../overdraft/store';
import { colors, spacing, typography, type StatusPalette } from '../theme/tokens';
import { StatusIcon } from './StatusIcon';

type OverdraftBannerProps = {
  // The shell passes this to open the Overdraft tab.
  onPress?: () => void;
};

// Spec 012 — the persistent "you're using it" signal, shown under the tab bar
// on every tab whenever the line has a balance; absent while unused.
export function OverdraftBanner({ onPress }: OverdraftBannerProps) {
  const line = useOverdraftStore((s) => s.line);
  const events = useOverdraftStore((s) => s.events);

  if (!line) {
    return null;
  }
  const balance = balanceOf(events);
  const status = overdraftStatus(balance, line.limit);
  if (status === 'unused') {
    return null;
  }

  const since = inUseSince(events);
  const sinceLabel =
    since === null
      ? ''
      : ` · since ${isSameLocalDay(since, new Date()) ? 'today' : formatShortDate(since)}`;
  const percent = usedPercent(balance, line.limit);
  const used = `${formatCLP(balance)} of ${formatCLP(line.limit)}`;

  let title: string;
  let detail: string;
  let palette: StatusPalette = colors.status.notice;
  let icon: 'info' | 'warning' | 'stop' = 'info';

  if (status === 'over-limit') {
    title = `Over your limit by ${formatCLP(balance - line.limit)}`;
    detail = `${used} (${percent}%)${sinceLabel}`;
    palette = colors.status.critical;
    icon = 'stop';
  } else if (status === 'high') {
    title = `Getting close to your limit · ${percent}%`;
    detail = `${used} · ${formatCLP(availableOf(balance, line.limit))} left${sinceLabel}`;
    palette = colors.status.warning;
    icon = 'warning';
  } else if (since !== null && isSameLocalDay(since, new Date())) {
    title = "You're now using your overdraft";
    detail = `${used} (${percent}%)${sinceLabel}`;
  } else {
    title = `In overdraft · ${percent}% of your line`;
    detail = `${used}${sinceLabel}`;
  }

  return (
    <Pressable
      testID="overdraft-banner"
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.banner, { backgroundColor: palette.tone, borderColor: palette.border }]}
    >
      <StatusIcon kind={icon} color={palette.text} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: palette.dark }]}>{title}</Text>
        <Text style={[styles.detail, { color: palette.dark }]}>{detail}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  text: {
    flex: 1,
  },
  title: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm + 1,
  },
  detail: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
  },
});
