import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { deleteEpub, listEpubs, type EpubMeta } from "@/storage/epubLibrary";
import { useResponsive } from "@/hooks/useResponsive";
import { MAX_WIDE_WIDTH } from "@/constants/layout";
import { colors, radius, spacing, typography } from "@/constants/theme";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// The Library: finished books compiled to EPUB3 and stored on this device.
// Tapping a book downloads it (web) or opens the share sheet (native).
export default function LibraryScreen() {
  const router = useRouter();
  const [items, setItems] = useState<EpubMeta[]>([]);
  const { isTablet, isDesktop } = useResponsive();
  const numColumns = isDesktop ? 2 : 1;

  useFocusEffect(
    useCallback(() => {
      listEpubs()
        .then(setItems)
        .catch(() => setItems([]));
    }, []),
  );

  const handleDelete = useCallback(async (id: string) => {
    await deleteEpub(id);
    setItems((prev) => prev.filter((m) => m.id !== id));
  }, []);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>📚</Text>
        <Text style={styles.emptyTitle}>Your Library is empty</Text>
        <Text style={styles.emptyBody}>
          Finish a book in the Books tab, then tap “Save to Library (EPUB3)”. Your
          compiled books appear here.
        </Text>
        <Pressable
          style={styles.cta}
          onPress={() => router.push("/books")}
          accessibilityRole="button"
          accessibilityLabel="Go to Books"
        >
          <Text style={styles.ctaText}>Go to Books →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      key={numColumns}
      style={styles.list}
      contentContainerStyle={[styles.listContent, isTablet && styles.listContentWide]}
      data={items}
      keyExtractor={(item) => item.id}
      numColumns={numColumns}
      columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      renderItem={({ item }) => (
        <Pressable
          style={[styles.card, numColumns > 1 && styles.cardGrid]}
          onPress={() => router.push(`/book/read/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`Open book: ${item.title}`}
        >
          <Ionicons name="book" size={22} color={colors.primary} />
          <View style={styles.cardMain}>
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.meta}>
              EPUB3 · {formatSize(item.sizeBytes)} · {formatDate(item.compiledAt)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          <Pressable
            style={styles.deleteBtn}
            onPress={() => handleDelete(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`Delete from library: ${item.title}`}
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
  listContentWide: { maxWidth: MAX_WIDE_WIDTH, width: "100%", alignSelf: "center" },
  columnWrapper: { gap: spacing.sm },
  cardGrid: { flex: 1 },
  separator: { height: spacing.sm },
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
    maxWidth: 300,
  },
  cta: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  ctaText: { color: colors.primaryText, fontWeight: "700", fontSize: typography.sizeMd },
});
