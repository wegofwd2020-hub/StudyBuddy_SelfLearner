import React, { useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { IS_DEMO } from "@/constants/demo";
import { colors, spacing, typography } from "@/constants/theme";
import { WizardScaffold } from "./WizardScaffold";
import {
  applyStepStatuses,
  firstPendingStep,
  loadFirstRunState,
  setStepStatus,
  STEP_ORDER,
  type FirstRunState,
  type StepId,
} from "./firstRunState";

// First-run onboarding coordinator. Replaces the old single OnboardingModal: it
// chains three skippable, resumable steps (sign up → add an LLM key → reading
// tour), showing the first step that is still `pending` and closing once they
// are all done or skipped.
//
// Phase A wires the state + scaffold + step plumbing with placeholder bodies; the
// real step UIs land in later phases:
//   - signup → SignupStep (Phase C, wraps AuthForm)
//   - key    → KeyStep    (Phase B, wraps ProviderKeyForm + provider guides)
//   - tour   → TourStep   (Phase D, illustrated tab/reader cards)

interface StepMeta {
  index: number;
  title: string;
  subtitle: string;
  helpTopic: string;
  primaryLabel: string;
}

const STEP_META: Record<StepId, StepMeta> = {
  signup: {
    index: 0,
    title: "Create your account",
    subtitle: "An account syncs your library and provider settings across devices.",
    helpTopic: "getting-started-account",
    primaryLabel: "Continue",
  },
  key: {
    index: 1,
    title: "Add an LLM key",
    subtitle: "Mentible is bring-your-own-key — pick a provider and paste a key to start generating.",
    helpTopic: "provider-keys",
    primaryLabel: "Continue",
  },
  tour: {
    index: 2,
    title: "Open a book & explore",
    subtitle: "A quick tour of the tabs and how to open a book to read.",
    helpTopic: "reading-a-book",
    primaryLabel: "Got it",
  },
};

export function FirstRunWizard() {
  const { status } = useAuth();
  const [state, setState] = useState<FirstRunState | null>(null);

  // Load persisted progress once.
  useEffect(() => {
    let active = true;
    void loadFirstRunState().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, []);

  // Environment-driven auto-skips so the flow never dead-ends on a step the build
  // can't run: a signed-in user has signup done; when auth is unavailable
  // (unconfigured build) signup can't run; the demo build also has BYOK disabled,
  // so skip the key step too. Only `pending` steps are touched, so this can't
  // loop.
  useEffect(() => {
    if (!state) return;
    const updates: Partial<Record<StepId, "done" | "skipped">> = {};
    if (state.signup === "pending") {
      if (status === "signed_in") updates.signup = "done";
      else if (status === "unavailable" || IS_DEMO) updates.signup = "skipped";
    }
    if (IS_DEMO && state.key === "pending") updates.key = "skipped";
    if (Object.keys(updates).length > 0) {
      void applyStepStatuses(updates).then(setState);
    }
  }, [state, status]);

  // The step to display. While auth is still resolving we hold signup back rather
  // than flashing it (the effect above will finalize signup once status settles).
  const visibleStep = useMemo<StepId | null>(() => {
    if (!state) return null;
    const step = firstPendingStep(state);
    if (step === "signup" && status === "loading") return null;
    return step;
  }, [state, status]);

  if (!state || !visibleStep) return null;

  const meta = STEP_META[visibleStep];
  const advance = (status_: "done" | "skipped") => {
    void setStepStatus(visibleStep, status_).then(setState);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => advance("skipped")}>
      <View style={styles.overlay}>
        <WizardScaffold
          stepIndex={meta.index}
          stepCount={STEP_ORDER.length}
          title={meta.title}
          subtitle={meta.subtitle}
          helpTopic={meta.helpTopic}
          primaryLabel={meta.primaryLabel}
          onPrimary={() => advance("done")}
          onSkip={() => advance("skipped")}
        >
          {/* TODO(Phase B/C/D): replace with the real step bodies (KeyStep /
              SignupStep / TourStep). Placeholder keeps the chained flow testable. */}
          <Text style={styles.placeholder}>
            This step’s full walkthrough is coming next. For now, use Continue to move on or Skip to
            handle it later from Help.
          </Text>
        </WizardScaffold>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  placeholder: {
    fontSize: typography.sizeSm,
    color: colors.textSecondary,
    lineHeight: 21,
  },
});
