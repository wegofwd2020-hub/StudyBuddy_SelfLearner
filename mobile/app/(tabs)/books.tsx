import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { deleteBook, loadBookIndex } from "@/storage/bookStore";
import { useResponsive } from "@/hooks/useResponsive";
import { MAX_WIDE_WIDTH } from "@/constants/layout";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { BookMeta } from "@/types/book";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function NewBookButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={styles.newBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="New book"
    >
      <Text style={styles.newBtnText}>+ New book</Text>
    </Pressable>
  );
}

function ImportButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      style={styles.importBtn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Import a book"
    >
      <Text style={styles.importBtnText}>Import a book</Text>
    </Pressable>
  );
}

function BooksHeader({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
  return (
    <View>
      <NewBookButton onPress={onNew} />
      <ImportButton onPress={onImport} />
    </View>
  );
}

export default function BooksScreen() {
  const router = useRouter();
  const [books, setBooks] = useState<BookMeta[]>([]);
  const { isTablet, isDesktop } = useResponsive();
  const numColumns = isDesktop ? 2 : 1;

  useFocusEffect(
    useCallback(() => {
      loadBookIndex().then(setBooks);
    }, []),
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteBook(id);
    setBooks((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (books.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📖</Text>
        <Text style={styles.emptyTitle}>No books yet</Text>
        <Text style={styles.emptyBody}>
          Paste a table of contents and we’ll turn it into an editable topic
          tree you can build a book from.
        </Text>
        <NewBookButton onPress={() => router.push("/book/new")} />
        <ImportButton onPress={() => router.push("/book/import")} />
      </View>
    );
  }

  return (
    <FlatList
      key={numColumns} // numColumns can't change without a remount
      style={styles.list}
      contentContainerStyle={[styles.listContent, isTablet && styles.listContentWide]}
      data={books}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      ListHeaderComponent={
        <BooksHeader
          onNew={() => router.push("/book/new")}
          onImport={() => router.push("/book/import")}
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, numColumns > 1 && styles.cardGrid]}
          onPress={() => router.push(`/book/saved/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open book: ${item.title}`}
        >
          <Ionicons name="book-outline" size={22} color={colors.primary} />
          <View style={styles.cardMain}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.meta}>
              {item.subjectCount} subject{item.subjectCount === 1 ? "" : "s"} ·{" "}
              {item.unitCount} topic{item.unitCount === 1 ? "" : "s"} · {formatDate(item.updatedAt)}
            </Text>
            {typeof item.generatedCount === "number" && item.unitCount > 0 && (
              <Text
                style={[
                  styles.progress,
                  item.generatedCount >= item.unitCount && styles.progressDone,
                ]}
              >
                {item.generatedCount >= item.unitCount
                  ? `✓ All ${item.unitCount} topics generated`
                  : `${item.generatedCount} / ${item.unitCount} topics generated`}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          <Pressable
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Delete book: ${item.title}`}
            hitSlop={8}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </Pressable>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.background },
  listContent: { padding: spacing.md },
  // Desktop: cap + center the grid, and lay cards out in columns.
  listContentWide: { maxWidth: MAX_WIDE_WIDTH, width: "100%", alignSelf: "center" },
  columnWrapper: { gap: spacing.sm },
  cardGrid: { flex: 1 },
  separator: { height: spacing.sm },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  newBtnText: { color: colors.primaryText, fontSize: typography.sizeMd, fontWeight: "700" },
  importBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  importBtnText: { color: colors.textSecondary, fontSize: typography.sizeSm, fontWeight: "600" },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardMain: { flex: 1, gap: 2 },
  title: { fontSize: typography.sizeMd, fontWeight: "700", color: colors.text },
  meta: { fontSize: typography.sizeXs, color: colors.textMuted },
  progress: { fontSize: typography.sizeXs, color: colors.textMuted, marginTop: 2 },
  progressDone: { color: colors.success, fontWeight: "600" },
  deleteBtn: { padding: spacing.xs },
  empty: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: typography.sizeLg, fontWeight: "700", color: colors.text },
  emptyBody: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
});
