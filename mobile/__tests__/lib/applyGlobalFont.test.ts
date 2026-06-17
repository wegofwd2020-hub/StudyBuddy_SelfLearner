import { resolveFamilyForStyle } from "@/lib/applyGlobalFont";

describe("resolveFamilyForStyle", () => {
  it("leaves icon fonts untouched (the Ionicons → CJK regression)", () => {
    // @expo/vector-icons renders glyphs as <Text fontFamily="Ionicons">; overriding
    // it would turn icons into tofu/CJK characters.
    expect(resolveFamilyForStyle({ fontFamily: "Ionicons" }, false)).toBeNull();
    expect(resolveFamilyForStyle({ fontFamily: "MaterialCommunityIcons" }, false)).toBeNull();
    // Even in dyslexic mode icons must stay icons.
    expect(resolveFamilyForStyle({ fontFamily: "Ionicons" }, true)).toBeNull();
  });

  it("leaves monospace and other deliberate families untouched", () => {
    expect(resolveFamilyForStyle({ fontFamily: "monospace" }, false)).toBeNull();
    expect(resolveFamilyForStyle({ fontFamily: "monospace" }, true)).toBeNull();
  });

  it("maps unstyled text to Inter by weight", () => {
    expect(resolveFamilyForStyle({}, false)).toBe("Inter_400Regular");
    expect(resolveFamilyForStyle({ fontWeight: "700" }, false)).toBe("Inter_700Bold");
  });

  it("treats large + bold text as a serif heading", () => {
    expect(resolveFamilyForStyle({ fontSize: 28, fontWeight: "700" }, false)).toBe(
      "SourceSerif4_700Bold",
    );
    // large but not bold → still body
    expect(resolveFamilyForStyle({ fontSize: 28, fontWeight: "400" }, false)).toBe(
      "Inter_400Regular",
    );
  });

  it("remaps explicit serif intent to the bundled serif", () => {
    expect(resolveFamilyForStyle({ fontFamily: "serif", fontWeight: "600" }, false)).toBe(
      "SourceSerif4_600SemiBold",
    );
    expect(resolveFamilyForStyle({ fontFamily: "Georgia" }, false)).toBe("SourceSerif4_400Regular");
  });

  it("swaps text families to OpenDyslexic in dyslexic mode", () => {
    expect(resolveFamilyForStyle({}, true)).toBe("OpenDyslexic_400Regular");
    expect(resolveFamilyForStyle({ fontSize: 28, fontWeight: "700" }, true)).toBe(
      "OpenDyslexic_700Bold",
    );
  });
});
