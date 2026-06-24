import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "@/auth/AuthProvider";
import { colors, radius, spacing, typography } from "@/constants/theme";

// The email + Google sign-in/up form, extracted from the sign-in screen so the
// same flow can be reused inside the first-run wizard (SignupStep). The host is
// responsible for the surrounding chrome and for handling the `signed_in` /
// `unavailable` auth states — this component assumes it is only rendered when a
// user can actually sign in, and calls `onAuthenticated` once they have.
export interface AuthFormProps {
  // Invoked after a successful sign-in / sign-up / Google auth (no error).
  onAuthenticated?: () => void;
  initialMode?: "sign_in" | "sign_up";
  // Show the built-in title + subtitle (the screen wants it; the wizard supplies
  // its own header via the scaffold and sets this false).
  showHeader?: boolean;
}

export function AuthForm({
  onAuthenticated,
  initialMode = "sign_in",
  showHeader = true,
}: AuthFormProps) {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<"sign_in" | "sign_up">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const fn = mode === "sign_in" ? signIn : signUp;
    const { error: err } = await fn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onAuthenticated?.();
  };

  const onGoogle = async () => {
    setGoogleBusy(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    setGoogleBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onAuthenticated?.();
  };

  const anyBusy = busy || googleBusy;
  const canSubmit = email.trim().length > 3 && password.length >= 6 && !anyBusy;

  return (
    <View>
      {showHeader ? (
        <>
          <Text style={styles.title}>{mode === "sign_in" ? "Sign in" : "Create account"}</Text>
          <Text style={styles.sub}>
            Your account syncs your library and provider settings across devices.
          </Text>
        </>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        placeholderTextColor={colors.textMuted}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.button, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={submit}
      >
        {busy ? (
          <ActivityIndicator color={colors.primaryText} />
        ) : (
          <Text style={styles.buttonText}>{mode === "sign_in" ? "Sign in" : "Create account"}</Text>
        )}
      </Pressable>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      <Pressable
        style={[styles.googleButton, anyBusy && styles.buttonDisabled]}
        disabled={anyBusy}
        onPress={onGoogle}
      >
        {googleBusy ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        )}
      </Pressable>

      <Pressable
        style={styles.switch}
        onPress={() => {
          setError(null);
          setMode((m) => (m === "sign_in" ? "sign_up" : "sign_in"));
        }}
      >
        <Text style={styles.switchText}>
          {mode === "sign_in" ? "No account? Create one" : "Have an account? Sign in"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: typography.sizeXxl, fontWeight: "700", marginBottom: spacing.xs },
  sub: { color: colors.textSecondary, fontSize: typography.sizeSm, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizeMd,
    marginBottom: spacing.sm,
  },
  error: { color: colors.error, fontSize: typography.sizeSm, marginBottom: spacing.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.primaryText, fontSize: typography.sizeMd, fontWeight: "700" },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: spacing.lg },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: typography.sizeSm, marginHorizontal: spacing.md },
  googleButton: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  googleButtonText: { color: colors.text, fontSize: typography.sizeMd, fontWeight: "600" },
  switch: { alignItems: "center", marginTop: spacing.lg },
  switchText: { color: colors.primary, fontSize: typography.sizeSm },
});
