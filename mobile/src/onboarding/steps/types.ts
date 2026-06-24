// Shared contract for a first-run wizard step. Each step renders its own
// WizardScaffold (so it controls its body, primary gating and copy) and calls
// onDone / onSkip to tell the coordinator how to advance. The coordinator owns
// the Modal, the persisted progress, and which step is currently visible.
export interface WizardStepProps {
  stepIndex: number; // 0-based, for the progress dots
  stepCount: number;
  onDone: () => void;
  onSkip: () => void;
}
