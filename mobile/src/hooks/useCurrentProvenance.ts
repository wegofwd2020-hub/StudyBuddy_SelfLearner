// Fetch + cache the registry's current provenance for a book's LLM config, for
// staleness diffing (ADR-016 D7 / SBQ-TRUST-004).
//
// The registry changes only on deploy, so one fetch per (provider, model) per app
// session is plenty — the result is memoised at module scope and shared across
// every mount (the topic screen today; a Library staleness pip later). On failure
// the hook returns undefined so the badge shows no hint (honest — never a guess).

import { useEffect, useState } from "react";
import { getCurrentProvenance } from "@/api/client";
import type { Provenance } from "@/types/lesson";

const cache = new Map<string, Provenance>();
const inflight = new Map<string, Promise<Provenance>>();

// Key includes the model pin: current.model depends on it (pin vs default).
function cacheKey(provider: string, model: string | null): string {
  return `${provider}::${model ?? ""}`;
}

// Exposed for tests to start from a clean cache.
export function __resetCurrentProvenanceCache(): void {
  cache.clear();
  inflight.clear();
}

export function useCurrentProvenance(
  provider: string,
  model: string | null,
): Provenance | undefined {
  const key = cacheKey(provider, model);
  const [current, setCurrent] = useState<Provenance | undefined>(() => cache.get(key));

  useEffect(() => {
    const cached = cache.get(key);
    if (cached) {
      setCurrent(cached);
      return;
    }

    let active = true;
    setCurrent(undefined);

    let pending = inflight.get(key);
    if (!pending) {
      pending = getCurrentProvenance(provider, model);
      inflight.set(key, pending);
    }

    pending
      .then((prov) => {
        cache.set(key, prov);
        inflight.delete(key);
        if (active) setCurrent(prov);
      })
      .catch(() => {
        // Leave `current` undefined → no staleness hint. Don't cache failures, so
        // a later mount retries (e.g. after the device comes back online).
        inflight.delete(key);
      });

    return () => {
      active = false;
    };
  }, [key, provider, model]);

  return current;
}
