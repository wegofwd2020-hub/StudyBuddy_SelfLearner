import React, { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { importBook } from "@/storage/importBook";
import { PageContainer } from "@/components/PageContainer";
import { useResponsive } from "@/hooks/useResponsive";
import { colors, radius, spacing, typography } from "@/constants/theme";

// Import a book exported elsewhere (e.g. a migrated book.json from the OnDemand
// Authoring Studio). Paste-based to match the app's existing "paste a TOC" flow
// and avoid a native file-picker dependency.
export default function ImportBookScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const [raw, setRaw] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canImport = raw.trim().length > 0 && !busy;

  const handleImport = useCallback(async () => {
    if (!raw.trim()) return;
    setErrorMsg(null);
    setBusy(true);
    try {
      const book = await importBook(raw);
      router.replace(`/book/saved/${book.id}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Couldn’t import that book.");
      setBusy(false);
    }
  }, [raw, router]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <PageContainer gap={spacing.sm}>
        <Text style={styles.label}>Import a book</Text>
        <Text style={styles.hint}>
          Paste a book’s JSON (for example, one exported from the Authoring
          Studio). It’s saved to this device’s library — nothing is uploaded.
        </Text>
        <TextInput
          style={[styles.input, isDesktop && styles.inputDesktop]}
          value={raw}
          onChangeText={setRaw}
          placeholder={'{\n  "title": "…",\n  "toc": { "subjects": [ … ] },\n  "content": { … }\n}'}
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
          textAlignVertical="top"
          accessibilityLabel="Book JSON input"
        />

        {errorMsg && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        )}

        <Pressable
          style={[styles.importBtn, !canImport && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={!canImport}
          accessibilityRole="button"
          accessibilityLabel="Import book"
          accessibilityState={{ disabled: !canImport }}
        >
          <Text style={styles.importBtnText}>{busy ? "Importing…" : "Import"}</Text>
        </Pressable>
      </PageContainer>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  label: {
    fontSize: typography.sizeSm,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: spacing.sm,
  },
  hint: { color: colors.textMuted, fontSize: typography.sizeSm },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.sizeMd,
    fontFamily: "Menlo",
    minHeight: 200,
  },
  inputDesktop: { minHeight: 320 },
  errorBanner: {
    backgroundColor: colors.error + "22",
    borderColor: colors.error + "66",
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  errorBannerText: { color: colors.error, fontSize: typography.sizeSm },
  importBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  importBtnDisabled: { opacity: 0.45 },
  importBtnText: { color: colors.primaryText, fontSize: typography.sizeMd, fontWeight: "700" },
});
