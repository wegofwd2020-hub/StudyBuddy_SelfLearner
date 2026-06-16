import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  clearUsage,
  listUsage,
  recordUsage,
  summarizeUsage,
  type UsageEvent,
} from "@/storage/usageStore";
import type { UsageObservation } from "@/types/lesson";

const obs = (over: Partial<UsageObservation> = {}): UsageObservation => ({
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  input_tokens: 100,
  output_tokens: 500,
  tokens_estimated: false,
  attempts: 1,
  ...over,
});

const ev = (over: Partial<UsageEvent> = {}): UsageEvent => ({
  ...obs(),
  ts: 1,
  ...over,
});

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("usageStore — record/list/clear", () => {
  it("records and lists newest-first", async () => {
    await recordUsage(obs({ model: "gpt-4o-mini" }), { topicTitle: "A" });
    await recordUsage(obs({ model: "claude-sonnet-4-6" }), { topicTitle: "B" });

    const events = await listUsage();
    expect(events).toHaveLength(2);
    expect(events[0].topicTitle).toBe("B"); // newest first
    expect(events[0].ts).toBeGreaterThan(0);
  });

  it("stores no key or content — only metadata fields", async () => {
    await recordUsage(obs(), { topicTitle: "Quadratics" });
    const [e] = await listUsage();
    expect(Object.keys(e).sort()).toEqual(
      ["attempts", "input_tokens", "model", "output_tokens", "provider", "topicTitle", "tokens_estimated", "ts"].sort(),
    );
  });

  it("clears history", async () => {
    await recordUsage(obs());
    await clearUsage();
    expect(await listUsage()).toHaveLength(0);
  });

  it("never throws on a bad stored blob", async () => {
    await AsyncStorage.setItem("sbq_usage_ledger", "not json");
    expect(await listUsage()).toEqual([]);
  });
});

describe("summarizeUsage", () => {
  it("rolls up totals and groups by provider × model", () => {
    const s = summarizeUsage([
      ev({ provider: "anthropic", model: "claude-sonnet-4-6", input_tokens: 100, output_tokens: 500 }),
      ev({ provider: "anthropic", model: "claude-sonnet-4-6", input_tokens: 200, output_tokens: 1000 }),
      ev({ provider: "openai", model: "gpt-4o-mini", input_tokens: 50, output_tokens: 50 }),
    ]);

    expect(s.totalGenerations).toBe(3);
    expect(s.totalInputTokens).toBe(350);
    expect(s.totalOutputTokens).toBe(1550);
    expect(s.byModel).toHaveLength(2);
    // sonnet group is biggest → sorted first
    expect(s.byModel[0].model).toBe("claude-sonnet-4-6");
    expect(s.byModel[0].generations).toBe(2);
    expect(s.byModel[0].inputTokens).toBe(300);
  });

  it("estimates cost from the price table (sonnet: $3/M in, $15/M out)", () => {
    const s = summarizeUsage([
      ev({ provider: "anthropic", model: "claude-sonnet-4-6", input_tokens: 1_000_000, output_tokens: 1_000_000 }),
    ]);
    expect(s.estCostUsd).toBeCloseTo(18, 5); // 3 + 15
  });

  it("flags unknown models and excludes them from cost (null when none known)", () => {
    const s = summarizeUsage([ev({ provider: "mistral", model: "some-unknown-model" })]);
    expect(s.anyRateUnknown).toBe(true);
    expect(s.estCostUsd).toBeNull();
    expect(s.byModel[0].estCostUsd).toBeNull();
  });

  it("treats free providers (groq) as zero cost, not unknown", () => {
    const s = summarizeUsage([ev({ provider: "groq", model: "llama-3.3-70b" })]);
    expect(s.anyRateUnknown).toBe(false);
    expect(s.estCostUsd).toBe(0);
  });

  it("surfaces estimated-token rows", () => {
    const s = summarizeUsage([ev({ tokens_estimated: true })]);
    expect(s.anyTokensEstimated).toBe(true);
    expect(s.byModel[0].anyEstimated).toBe(true);
  });

  it("empty ledger → zeroed summary, null cost", () => {
    const s = summarizeUsage([]);
    expect(s.totalGenerations).toBe(0);
    expect(s.estCostUsd).toBeNull();
    expect(s.byModel).toEqual([]);
  });
});
