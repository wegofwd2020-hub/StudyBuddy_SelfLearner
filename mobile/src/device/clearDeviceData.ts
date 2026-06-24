import AsyncStorage from "@react-native-async-storage/async-storage";
import { deleteApiKey } from "@/secure/keyStore";
import { PROVIDERS } from "@/constants/providers";

// Keys that survive a "clear this device" wipe: the per-install device identity
// (so device tracking stays stable across the reset) and the accessibility
// preference (a device-level setting, not user data).
const PRESERVE = new Set<string>(["mentible_device_id", "mentible.fontMode.dyslexic"]);

// Wipe app-local state for a clean slate on this device — BYOK keys, the local
// library + authored books, reviews, usage, generation defaults, and the
// onboarding/first-run flags (so onboarding shows again). Deliberately KEEPS the
// device id and the dyslexia-font setting. Pair with signOut() for a full reset.
//
// This is a local wipe only — it does not delete the server account (that's
// "Delete account") nor the Supabase identity (that's the admin reset script).
export async function clearDeviceData(): Promise<void> {
  // BYOK keys live in the device keystore (SecureStore on native); the device id
  // is a separate keystore entry and is intentionally not touched here.
  await Promise.all(PROVIDERS.map((p) => deleteApiKey(p.id)));

  // Everything else the app stores in AsyncStorage (on web that's localStorage,
  // which also holds the device id — hence the PRESERVE guard).
  const keys = await AsyncStorage.getAllKeys();
  const toRemove = keys.filter((k) => !PRESERVE.has(k));
  if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
}
