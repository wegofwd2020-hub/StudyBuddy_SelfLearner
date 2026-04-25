import * as SecureStore from "expo-secure-store";

const KEY = "sbq_byok_key";

export async function saveApiKey(apiKey: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, apiKey, {
    requireAuthentication: false,
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function loadApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}

export function maskApiKey(apiKey: string): string {
  if (apiKey.length < 8) return "sk-ant-...????";
  const last4 = apiKey.slice(-4);
  return `sk-ant-...${last4}`;
}

export function isValidApiKey(value: string): boolean {
  return value.startsWith("sk-ant-") && value.length >= 20;
}
