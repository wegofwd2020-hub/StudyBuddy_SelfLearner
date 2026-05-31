import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "@/constants/theme";

// In-app book cover, echoing the compiled artifact's "Editorial" cover (see
// compiler/src/cover.ts): a deep-indigo upper field with a green growth mark
// (the "growing mind" / spec→growth motif) over a light lower band carrying the
// title in serif. Authored books have no cover art, so this stands in as a
// consistent, brand-aligned placeholder in the grid and detail views.
export function BookCover({
  title,
  badge,
  size = "thumb",
}: {
  title: string;
  badge?: string; // small label, e.g. "EPUB3" or "12/16"
  size?: "thumb" | "large";
}) {
  const large = size === "large";
  return (
    <View style={[styles.cover, large ? styles.large : styles.thumb]} accessibilityLabel={`Cover: ${title}`}>
      <View style={styles.top}>
        <Ionicons name="trending-up" size={large ? 56 : 32} color="#34d27e" />
      </View>
      <View style={[styles.bottom, large && styles.bottomLarge]}>
        <View style={styles.rule} />
        <Text style={[styles.title, large && styles.titleLarge]} numberOfLines={large ? 4 : 3}>
          {title}
        </Text>
      </View>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    aspectRatio: 3 / 4,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: "#312a8c",
    elevation: 3,
  },
  thumb: { width: "100%" },
  large: { width: 150 },
  top: {
    flex: 0.55,
    backgroundColor: "#312a8c",
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: {
    flex: 0.45,
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 12,
    paddingTop: 10,
    gap: 6,
  },
  bottomLarge: { paddingHorizontal: 16, paddingTop: 14 },
  rule: { width: 22, height: 4, borderRadius: 2, backgroundColor: "#16a34a" },
  title: {
    color: "#1e1b4b",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: "700",
    fontSize: typography.sizeSm,
    lineHeight: 18,
  },
  titleLarge: { fontSize: typography.sizeMd, lineHeight: 22 },
  badge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
});
