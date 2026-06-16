import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "@/auth/AuthProvider";
import { OnboardingModal } from "@/components/OnboardingModal";
import { useSeedDefaultLibrary } from "@/hooks/useSeedDefaultLibrary";

export default function RootLayout() {
  // Seed the default shareable library on first run (ADR-017, #111).
  useSeedDefaultLibrary();
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0f172a" },
          headerTintColor: "#f1f5f9",
          headerTitleStyle: { fontWeight: "700" },
          contentStyle: { backgroundColor: "#0f172a" },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="concepts"
          options={{
            title: "UI concepts (prototype)",
            headerBackTitle: "Settings",
          }}
        />
        <Stack.Screen
          name="diagram-types"
          options={{
            title: "Diagram types",
            headerBackTitle: "Help",
          }}
        />
        <Stack.Screen
          name="book/new"
          options={{
            title: "New book",
            headerBackTitle: "Studio",
          }}
        />
        <Stack.Screen
          name="book/saved/[id]"
          options={{
            title: "Edit book",
            headerBackTitle: "Studio",
          }}
        />
        <Stack.Screen
          name="book/generate/[id]"
          options={{
            title: "Write topics",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="book/topic/[bookId]/[topicId]"
          options={{
            title: "Topic",
            headerBackTitle: "Back",
          }}
        />
        <Stack.Screen
          name="book/read/[id]"
          options={{
            title: "Read",
            headerBackTitle: "Library",
          }}
        />
        <Stack.Screen
          name="book/reviews/[id]"
          options={{
            title: "Reviews",
            headerBackTitle: "Library",
          }}
        />
        <Stack.Screen
          name="sign-in"
          options={{ title: "Sign in", headerBackTitle: "Settings" }}
        />
        <Stack.Screen
          name="account"
          options={{ title: "Account", headerBackTitle: "Settings" }}
        />
        <Stack.Screen
          name="usage"
          options={{ title: "Usage", headerBackTitle: "Settings" }}
        />
      </Stack>
      <OnboardingModal />
    </AuthProvider>
  );
}
