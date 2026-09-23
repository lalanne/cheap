import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Screen } from '../components/Screen';
import { STARTER_CATEGORIES } from '../transactions/starterCategories';
import { useTransactionsStore } from '../transactions/store';
import { colors, radius, spacing, typography } from '../theme/tokens';

export function CategoriesScreen() {
  const categories = useTransactionsStore((s) => s.categories);
  const addCategory = useTransactionsStore((s) => s.addCategory);
  const deleteCategory = useTransactionsStore((s) => s.deleteCategory);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  function openForm() {
    setName('');
    setError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
  }

  async function handleConfirmAdd() {
    const trimmed = name.trim();
    if (trimmed === '') {
      setError('Enter a name.');
      return;
    }
    await addCategory(trimmed, 'both');
    closeForm();
  }

  return (
    <Screen testID="categories-screen">
      <View style={styles.header}>
        <Text style={styles.title}>Categories</Text>
        {!formOpen && <Button title="Add" onPress={openForm} testID="add-category-button" />}
      </View>

      {formOpen && (
        <View style={styles.form} testID="category-form">
          <Input
            label="New category name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setError(null);
            }}
            testID="new-category-name-input"
            error={error}
          />
          <Button title="Save" onPress={handleConfirmAdd} testID="confirm-add-category-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForm} testID="cancel-add-category-button" />
        </View>
      )}

      {!formOpen && (
        <>
          <Text style={styles.sectionLabel}>Built-in</Text>
          {STARTER_CATEGORIES.map((name) => (
            <View key={name} testID={`category-row-starter-${name}`} style={styles.row}>
              <Text style={styles.rowName}>{name}</Text>
            </View>
          ))}

          <Text style={styles.sectionLabel}>Custom</Text>
          {categories.length === 0 && (
            <View style={styles.emptyState} testID="categories-empty-state">
              <Text style={styles.emptyStateText}>No custom categories yet — tap Add to create one.</Text>
            </View>
          )}
          {categories.map((category) => (
            <View key={category.id} testID={`category-row-${category.id}`} style={styles.row}>
              <Text style={styles.rowName}>{category.name}</Text>
              <Pressable
                testID={`delete-category-${category.id}`}
                onPress={() => deleteCategory(category.id)}
                style={styles.deleteButton}
              >
                <Text style={styles.deleteLabel}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: typography.display,
    fontSize: typography.size.xl,
    color: colors.ink,
  },
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  spacer: {
    height: spacing.sm,
  },
  sectionLabel: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  emptyState: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowName: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.base,
    color: colors.ink,
  },
  deleteButton: {
    paddingHorizontal: spacing.xs + 2,
  },
  deleteLabel: {
    fontFamily: typography.body,
    fontSize: typography.size.xs,
    color: colors.inkMuted,
  },
});
