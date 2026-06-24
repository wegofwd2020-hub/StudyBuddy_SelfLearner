import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, typography } from "@/constants/theme";
import { WizardScaffold } from "../WizardScaffold";
import type { WizardStepProps } from "./types";

// Step 3 — placeholder. Phase D replaces the body with the illustrated tab/reader
// tour (real TopNavBar icons) and a guided hop into the Library.
export function TourStep({ stepIndex, stepCount, onDone, onSkip }: WizardStepProps) {
  return (
    <WizardScaffold
      stepIndex={stepIndex}
      stepCount={stepCount}
      title="Open a book & explore"
      subtitle="A quick tour of the tabs and how to open a book to read."
      helpTopic="reading-a-book"
      primaryLabel="Got it"
      skipLabel={null}
      onPrimary={onDone}
      onSkip={onSkip}
    >
      <Text style={styles.placeholder}>
        The guided tour lands next. For now, tap Got it — you can reopen this walkthrough anytime from
        Help.
      </Text>
    </WizardScaffold>
  );
}

const styles = StyleSheet.create({
  placeholder: { fontSize: typography.sizeSm, color: colors.textSecondary, lineHeight: 21 },
});
