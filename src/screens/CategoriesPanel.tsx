import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { Input } from '../components/Input';
import type { Category } from '../transactions/types';
import { STARTER_CATEGORIES } from '../transactions/starterCategories';
import { useTransactionsStore } from '../transactions/store';
import { colors, radius, spacing, typography } from '../theme/tokens';

// Content-only — no Screen wrapper, no own scroll region. Composed by
// ManageScreen alongside BudgetsPanel/DebtsPanel (spec 009's 2026-09-23
// amendment); was a standalone top-level CategoriesScreen before that.
export function CategoriesPanel() {
  const categories = useTransactionsStore((s) => s.categories);
  const addCategory = useTransactionsStore((s) => s.addCategory);
  const deleteCategory = useTransactionsStore((s) => s.deleteCategory);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [parentCategory, setParentCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Spec 011 — only starter categories and existing top-level custom
  // categories can be picked as a parent; a subcategory can never itself
  // be a parent (one level of nesting only), so this list structurally
  // excludes them rather than needing extra validation.
  const topLevelCustom = categories.filter((c) => c.parentCategory === null);
  const parentOptions = [...STARTER_CATEGORIES, ...topLevelCustom.map((c) => c.name)];

  function openForm() {
    setName('');
    setParentCategory(null);
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
    await addCategory(trimmed, 'both', parentCategory);
    closeForm();
  }

  function subcategoriesOf(parentName: string): Category[] {
    return categories.filter((c) => c.parentCategory === parentName);
  }

  function renderSubcategoryRow(category: Category) {
    return (
      <View key={category.id} testID={`category-row-${category.id}`} style={styles.subRow}>
        <Text style={styles.rowNameSub}>{category.name}</Text>
        <Pressable
          testID={`delete-category-${category.id}`}
          onPress={() => deleteCategory(category.id)}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteLabel}>Delete</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View testID="categories-panel">
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

          <Text style={styles.label}>Parent category (optional)</Text>
          <View style={styles.chipRow}>
            <Pressable
              testID="parent-category-chip-None"
              style={parentCategory === null ? styles.chipActive : styles.chip}
              onPress={() => setParentCategory(null)}
            >
              <Text style={parentCategory === null ? styles.chipLabelActive : styles.chipLabel}>None</Text>
            </Pressable>
            {parentOptions.map((option) => (
              <Pressable
                key={option}
                testID={`parent-category-chip-${option}`}
                style={parentCategory === option ? styles.chipActive : styles.chip}
                onPress={() => setParentCategory(option)}
              >
                <Text style={parentCategory === option ? styles.chipLabelActive : styles.chipLabel}>{option}</Text>
              </Pressable>
            ))}
          </View>

          <Button title="Save" onPress={handleConfirmAdd} testID="confirm-add-category-button" />
          <View style={styles.spacer} />
          <Button title="Cancel" onPress={closeForm} testID="cancel-add-category-button" />
        </View>
      )}

      {!formOpen && (
        <>
          <Text style={styles.sectionLabel}>Built-in</Text>
          {STARTER_CATEGORIES.map((starterName) => (
            <View key={starterName} testID={`category-group-${starterName}`}>
              <View testID={`category-row-starter-${starterName}`} style={styles.row}>
                <Text style={styles.rowName}>{starterName}</Text>
              </View>
              {subcategoriesOf(starterName).map(renderSubcategoryRow)}
            </View>
          ))}

          <Text style={styles.sectionLabel}>Custom</Text>
          {categories.length === 0 && (
            <View style={styles.emptyState} testID="categories-empty-state">
              <Text style={styles.emptyStateText}>No custom categories yet — tap Add to create one.</Text>
            </View>
          )}
          {topLevelCustom.map((category) => (
            <View key={category.id} testID={`category-group-${category.name}`}>
              <View testID={`category-row-${category.id}`} style={styles.row}>
                <Text style={styles.rowName}>{category.name}</Text>
                <Pressable
                  testID={`delete-category-${category.id}`}
                  onPress={() => deleteCategory(category.id)}
                  style={styles.deleteButton}
                >
                  <Text style={styles.deleteLabel}>Delete</Text>
                </Pressable>
              </View>
              {subcategoriesOf(category.name).map(renderSubcategoryRow)}
            </View>
          ))}
        </>
      )}
    </View>
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
  label: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
    marginBottom: spacing.xs + 2,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  chip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  chipLabel: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
  },
  chipLabelActive: {
    fontFamily: typography.bodyBold,
    fontSize: typography.size.sm,
    color: colors.onAccent,
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
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingLeft: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowNameSub: {
    fontFamily: typography.body,
    fontSize: typography.size.sm,
    color: colors.inkSecondary,
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
