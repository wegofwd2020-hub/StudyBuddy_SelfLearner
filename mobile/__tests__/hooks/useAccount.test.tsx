import { renderHook, act, waitFor } from "@testing-library/react-native";

// Self-contained mocks (jest hoists these above imports).
jest.mock("@/api/accountClient", () => ({
  getAccount: jest.fn().mockResolvedValue({ sub: "u1", email: "a@x.com", credentials: [] }),
  putCredential: jest.fn().mockResolvedValue({}),
  deleteCredential: jest.fn().mockResolvedValue(undefined),
  deleteAccount: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/auth/AuthProvider", () => ({
  useAuth: () => ({ accessToken: "tok", status: "signed_in" }),
}));

import { useAccount } from "@/hooks/useAccount";
import * as client from "@/api/accountClient";

beforeEach(() => jest.clearAllMocks());

describe("useAccount", () => {
  it("loads the account on mount when signed in", async () => {
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.account?.sub).toBe("u1"));
    expect(client.getAccount).toHaveBeenCalledWith("tok");
  });

  it("setCredential puts custody then refreshes", async () => {
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.account).not.toBeNull());
    await act(async () => {
      await result.current.setCredential("anthropic", "device_local");
    });
    expect(client.putCredential).toHaveBeenCalledWith("tok", "anthropic", {
      source: "device_local",
    });
    expect(client.getAccount).toHaveBeenCalledTimes(2); // initial + post-mutation refresh
  });

  it("removeCredential deletes then refreshes", async () => {
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.account).not.toBeNull());
    await act(async () => {
      await result.current.removeCredential("anthropic");
    });
    expect(client.deleteCredential).toHaveBeenCalledWith("tok", "anthropic");
  });

  it("purge deletes the account and clears local state (D8)", async () => {
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.account).not.toBeNull());
    await act(async () => {
      await result.current.purge();
    });
    expect(client.deleteAccount).toHaveBeenCalledWith("tok");
    expect(result.current.account).toBeNull();
  });
});
