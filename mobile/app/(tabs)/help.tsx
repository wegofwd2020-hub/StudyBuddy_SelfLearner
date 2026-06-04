import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { PageContainer } from "@/components/PageContainer";
import { searchHelpTopics, type HelpBlock } from "@/constants/helpContent";
import { colors, radius, spacing, typography } from "@/constants/theme";

// Help screen — renders the structured, searchable help content (issue #60).
// Topics live in constants/helpContent.ts so they stay maintainable + indexable.
export default function HelpScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const topics = useMemo(() => searchHelpTopics(query), [query]);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <PageContainer>
        <Text style={styles.title}>Help</Text>
        <TextInput
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Search help…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search help"
        />

        {topics.length === 0 ? (
          <Text style={styles.empty}>No help topics match “{query.trim()}”.</Text>
        ) : (
          topics.map((t) => (
            <View key={t.id} style={styles.section}>
              <Text style={styles.sectionLabel}>{t.title}</Text>
              <View style={styles.card}>
                {t.blocks.map((b, i) => (
                  <Block key={i} block={b} onLink={(href) => router.push(href)} />
                ))}
              </View>
            </View>
          ))
        )}
      </PageContainer>
    </ScrollView>
  );
}

function Block({ block, onLink }: { block: HelpBlock; onLink: (href: HelpBlockHref) => void }) {
  switch (block.kind) {
    case "text":
      return <Text style={styles.body}>{block.text}</Text>;
    case "steps":
      return (
        <>
          {block.steps.map((s, i) => (
            <Step key={i} n={i + 1} text={s} />
          ))}
        </>
      );
    case "link":
      return (
        <Pressable
          style={styles.linkBtn}
          onPress={() => onLink(block.href)}
          accessibilityRole="button"
          accessibilityLabel={block.label}
        >
          <Text style={styles.linkBtnText}>{block.label}</Text>
        </Pressable>
      );
    case "defs":
      return (
        <>
          {block.defs.map((d, i) => (
            <View key={i} style={styles.def}>
              <Text style={styles.defTerm}>{d.term}</Text>
              <Text style={styles.defText}>{d.def}</Text>
            </View>
          ))}
        </>
      );
  }
}

// The href type a link block carries (narrowed from HelpBlock).
type HelpBlockHref = Extract<HelpBlock, { kind: "link" }>["href"];

function Step({ n, text }: { n: number; text: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepNum}>
        <Text style={styles.stepNumText}>{n}</Text>
      </View>
      <Text style={styles.stepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  title: {
    fontSize: typography.sizeXl,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xs,
  },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: typography.sizeMd,
  },
  empty: { color: colors.textMuted, fontSize: typography.sizeSm, paddingVertical: spacing.md },
  section: { gap: spacing.xs },
  sectionLabel: {
    fontSize: typography.sizeXs,
    fontWeight: "600",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  body: { fontSize: typography.sizeSm, color: colors.textSecondary, lineHeight: 21 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary + "33",
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumText: { color: colors.primary, fontWeight: "700", fontSize: typography.sizeXs },
  stepText: { flex: 1, fontSize: typography.sizeSm, color: colors.text, lineHeight: 21 },
  linkBtn: { alignSelf: "flex-start" },
  linkBtnText: { color: colors.primary, fontWeight: "700", fontSize: typography.sizeSm },
  def: { gap: 2 },
  defTerm: { fontSize: typography.sizeSm, fontWeight: "700", color: colors.text },
  defText: { fontSize: typography.sizeSm, color: colors.textSecondary, lineHeight: 20 },
});
