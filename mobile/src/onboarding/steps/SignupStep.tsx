import React from "react";
import { StyleSheet, Text } from "react-native";
import { colors, typography } from "@/constants/theme";
import { WizardScaffold } from "../WizardScaffold";
import type { WizardStepProps } from "./types";

// Step 1 — placeholder. Phase C replaces the body with the embedded AuthForm
// (email + Google sign-up) and gates Continue on a successful sign-in.
export function SignupStep({ stepIndex, stepCount, onDone, onSkip }: WizardStepProps) {
  return (
    <WizardScaffold
      stepIndex={stepIndex}
      stepCount={stepCount}
      title="Create your account"
      subtitle="An account syncs your library and provider settings across devices."
      helpTopic="getting-started-account"
      primaryLabel="Continue"
      onPrimary={onDone}
      onSkip={onSkip}
    >
      <Text style={styles.placeholder}>
        The full sign-up flow lands next. For now, Continue to move on or Skip to set up an account
        later from Settings.
      </Text>
    </WizardScaffold>
  );
}

const styles = StyleSheet.create({
  placeholder: { fontSize: typography.sizeSm, color: colors.textSecondary, lineHeight: 21 },
});
