import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { typography } from "@/constants/theme";

// Books have no cover art (the compiler makes none), so synthesise a book-like
// cover: a deterministic brand-ish colour from the title, a darker spine, the
// title in serif, and a faint book glyph. Used as grid thumbnails and as the
// large cover in the detail panel.
const COVER_COLORS = ["#1e5fbf", "#0f766e", "#6d28d9", "#b45309", "#be123c", "#0e7490", "#374151"];

function colorFor(title: string): string {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = (h * 31 + title.charCodeAt(i)) >>> 0;
  return COVER_COLORS[h % COVER_COLORS.length];
}

// Darken a #rrggbb hex by a factor (0–1) for the spine.
function darken(hex: string, f = 0.7): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${r},${g},${b})`;
}

export function BookCover({
  title,
  badge,
  size = "thumb",
}: {
  title: string;
  badge?: string; // small label, e.g. "EPUB3" or "12/16"
  size?: "thumb" | "large";
}) {
  const bg = colorFor(title);
  const large = size === "large";
  return (
    <View
      style={[styles.cover, large ? styles.large : styles.thumb, { backgroundColor: bg }]}
      accessibilityLabel={`Cover: ${title}`}
    >
      <View style={[styles.spine, { backgroundColor: darken(bg) }]} />
      <Text
        style={[styles.title, large && styles.titleLarge, badge && styles.titleWithBadge]}
        numberOfLines={large ? 7 : 4}
      >
        {title}
      </Text>
      <Ionicons
        name="book"
        size={large ? 22 : 15}
        color="rgba(255,255,255,0.45)"
        style={styles.glyph}
      />
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
    paddingVertical: 14,
    paddingRight: 12,
    paddingLeft: 18, // room for the spine
    justifyContent: "flex-start",
    overflow: "hidden",
    elevation: 3,
  },
  thumb: { width: "100%" },
  large: { width: 150 },
  spine: { position: "absolute", left: 0, top: 0, bottom: 0, width: 8 },
  title: {
    color: "#ffffff",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontWeight: "700",
    fontSize: typography.sizeSm,
    lineHeight: 18,
  },
  titleLarge: { fontSize: typography.sizeMd, lineHeight: 22 },
  // Drop the title below the top-right badge so a long first line doesn't run
  // under it (badge sits at top:8 and is ~16px tall).
  titleWithBadge: { marginTop: 14 },
  glyph: { position: "absolute", right: 10, bottom: 10 },
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
