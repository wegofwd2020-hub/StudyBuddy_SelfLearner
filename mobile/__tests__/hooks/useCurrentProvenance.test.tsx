import { renderHook, waitFor } from "@testing-library/react-native";

jest.mock("../../src/api/client", () => ({
  getCurrentProvenance: jest.fn(),
}));

const { getCurrentProvenance } = require("../../src/api/client") as {
  getCurrentProvenance: jest.Mock;
};

import {
  useCurrentProvenance,
  __resetCurrentProvenanceCache,
} from "../../src/hooks/useCurrentProvenance";

const PROV = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  model_verified: true,
  integration_version: 2,
  contract_version: 1,
};

beforeEach(() => {
  jest.clearAllMocks();
  __resetCurrentProvenanceCache();
});

describe("useCurrentProvenance", () => {
  it("fetches and returns the current provenance", async () => {
    getCurrentProvenance.mockResolvedValue(PROV);
    const { result } = renderHook(() => useCurrentProvenance("anthropic", null));

    expect(result.current).toBeUndefined(); // before the fetch resolves
    await waitFor(() => expect(result.current).toEqual(PROV));
    expect(getCurrentProvenance).toHaveBeenCalledWith("anthropic", null);
  });

  it("serves later mounts from cache without refetching", async () => {
    getCurrentProvenance.mockResolvedValue(PROV);
    const first = renderHook(() => useCurrentProvenance("anthropic", null));
    await waitFor(() => expect(first.result.current).toEqual(PROV));

    const second = renderHook(() => useCurrentProvenance("anthropic", null));
    await waitFor(() => expect(second.result.current).toEqual(PROV));
    expect(getCurrentProvenance).toHaveBeenCalledTimes(1); // cached
  });

  it("refetches when the model pin differs (cache key includes the pin)", async () => {
    getCurrentProvenance.mockResolvedValue(PROV);
    renderHook(() => useCurrentProvenance("anthropic", null));
    await waitFor(() => expect(getCurrentProvenance).toHaveBeenCalledTimes(1));

    renderHook(() => useCurrentProvenance("anthropic", "claude-opus-4-8"));
    await waitFor(() => expect(getCurrentProvenance).toHaveBeenCalledTimes(2));
    expect(getCurrentProvenance).toHaveBeenLastCalledWith("anthropic", "claude-opus-4-8");
  });

  it("returns undefined on fetch failure (no hint, never a guess)", async () => {
    getCurrentProvenance.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useCurrentProvenance("anthropic", null));
    // Give the rejected promise a tick to settle.
    await waitFor(() => expect(getCurrentProvenance).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
