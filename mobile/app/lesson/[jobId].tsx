import React, { useEffect } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useGenerateJob } from "@/hooks/useGenerateJob";
import { LessonRenderer } from "@/components/LessonRenderer";
import { saveLastLesson } from "@/storage/lessonStore";
import { colors, spacing, typography } from "@/constants/theme";

export default function LessonScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { status, lesson, error, elapsed } = useGenerateJob(jobId ?? null);

  useEffect(() => {
    if (jobId && lesson) {
      saveLastLesson(jobId, lesson).catch(() => {
        // Best-effort — failure to cache does not break lesson display.
      });
    }
  }, [jobId, lesson]);

  if (status === "done" && lesson) {
    return <LessonRenderer lesson={lesson} />;
  }

  if (status === "failed" || error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠</Text>
        <Text style={styles.errorTitle}>Generation failed</Text>
        <Text style={styles.errorBody}>
          {error ?? "Unknown error. Your Anthropic key was not saved — try again."}
        </Text>
        <Pressable
          style={styles.retryBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back and try again"
        >
          <Text style={styles.retryBtnText}>← Try again</Text>
        </Pressable>
      </View>
    );
  }

  const statusLabel =
    status === "running" ? "Generating…" : "Queued — starting soon…";

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.statusLabel}>{statusLabel}</Text>
      {elapsed > 0 && (
        <Text style={styles.elapsed}>{elapsed}s elapsed</Text>
      )}
      <Text style={styles.hint}>
        This typically takes 30–90 seconds. Stay on this screen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  statusLabel: {
    fontSize: typography.sizeLg,
    fontWeight: "600",
    color: colors.text,
    textAlign: "center",
  },
  elapsed: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
  },
  hint: {
    fontSize: typography.sizeSm,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: typography.sizeLg,
    fontWeight: "700",
    color: colors.error,
  },
  errorBody: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  retryBtn: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryBtnText: {
    color: colors.primary,
    fontWeight: "600",
    fontSize: typography.sizeMd,
  },
});
