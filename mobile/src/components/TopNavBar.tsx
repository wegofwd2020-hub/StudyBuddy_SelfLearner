import React from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { colors, radius, spacing, typography } from "@/constants/theme";

type IconName = keyof typeof Ionicons.glyphMap;

// route name → label + active/inactive icon. `index` is the Query screen.
const TABS: Record<string, { label: string; active: IconName; inactive: IconName }> = {
  library: { label: "Library", active: "bookmarks", inactive: "bookmarks-outline" },
  index: { label: "Query", active: "sparkles", inactive: "sparkles-outline" },
  books: { label: "Books", active: "book", inactive: "book-outline" },
  settings: { label: "Settings", active: "settings", inactive: "settings-outline" },
  help: { label: "Help", active: "help-circle", inactive: "help-circle-outline" },
  about: { label: "About", active: "information-circle", inactive: "information-circle-outline" },
};

// Visual left→right order of the menu (the redesigned sequence). Query sits 2nd,
// after Library; the brand logo is rendered before this row and links to Query.
const ORDER = ["library", "index", "books", "settings", "help", "about"];

// Top, center-aligned navigation bar with square icon+label tiles and a leading
// Mentible mark that jumps to Query. Replaces the default bottom tab bar (passed
// to <Tabs tabBar={…}>); horizontally scrollable so 7 items don't cramp a phone.
export function TopNavBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routeByName = new Map(state.routes.map((r) => [r.name, r] as const));
  const activeName = state.routes[state.index]?.name;

  const go = (name: string) => {
    const route = routeByName.get(name);
    if (!route) return;
    const focused = name === activeName;
    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true,
    });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.xs }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        <Pressable
          onPress={() => go("index")}
          accessibilityRole="button"
          accessibilityLabel="Mentible — go to Query"
          style={styles.logoBtn}
        >
          <Image
            source={require("../../assets/brand/mentible-icon-1024-redorange.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </Pressable>

        {ORDER.map((name) => {
          const cfg = TABS[name];
          if (!cfg || !routeByName.has(name)) return null;
          const focused = name === activeName;
          return (
            <Pressable
              key={name}
              onPress={() => go(name)}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={cfg.label}
              style={[styles.tile, focused && styles.tileActive]}
            >
              <Ionicons
                name={focused ? cfg.active : cfg.inactive}
                size={22}
                color={focused ? colors.primary : colors.textMuted}
              />
              <Text
                style={[styles.tileLabel, focused && styles.tileLabelActive]}
                numberOfLines={1}
              >
                {cfg.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  // flexGrow + center → centered when the row fits, scrollable when it overflows.
  row: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.xs,
  },
  logoBtn: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.xs,
  },
  logo: { width: 40, height: 40 },
  // Square tiles (icon over label) with a clear, rounded border.
  tile: {
    width: 64,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    justifyContent: "center",
    alignItems: "center",
    gap: 3,
  },
  tileActive: { backgroundColor: colors.primary + "22", borderColor: colors.primary },
  tileLabel: {
    fontSize: typography.sizeXs,
    fontWeight: "600",
    color: colors.textMuted,
  },
  tileLabelActive: { color: colors.primary },
});
