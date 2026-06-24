import AsyncStorage from "@react-native-async-storage/async-storage";

const deletedProviders: string[] = [];
jest.mock("../../src/secure/keyStore", () => ({
  deleteApiKey: jest.fn(async (provider: string) => {
    deletedProviders.push(provider);
  }),
}));

jest.mock("../../src/constants/providers", () => ({
  PROVIDERS: [{ id: "anthropic" }, { id: "groq" }],
}));

import { clearDeviceData } from "../../src/device/clearDeviceData";

beforeEach(async () => {
  await AsyncStorage.clear();
  deletedProviders.length = 0;
});

describe("clearDeviceData", () => {
  it("wipes app data but preserves the device id and accessibility setting", async () => {
    await AsyncStorage.setItem("mentible_device_id", "dev-123");
    await AsyncStorage.setItem("mentible.fontMode.dyslexic", "1");
    await AsyncStorage.setItem("sbq_book_index", "[...]");
    await AsyncStorage.setItem("mentible_firstrun_v1", "{...}");
    await AsyncStorage.setItem("mentible_onboarding_seen_v1", "1");

    await clearDeviceData();

    // Preserved
    expect(await AsyncStorage.getItem("mentible_device_id")).toBe("dev-123");
    expect(await AsyncStorage.getItem("mentible.fontMode.dyslexic")).toBe("1");
    // Wiped
    expect(await AsyncStorage.getItem("sbq_book_index")).toBeNull();
    expect(await AsyncStorage.getItem("mentible_firstrun_v1")).toBeNull();
    expect(await AsyncStorage.getItem("mentible_onboarding_seen_v1")).toBeNull();
  });

  it("clears every provider's BYOK key", async () => {
    await clearDeviceData();
    expect(deletedProviders.sort()).toEqual(["anthropic", "groq"]);
  });
});
